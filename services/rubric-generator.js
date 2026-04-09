const LLMService = require('./llm');
const OCRService = require('./ocr');
const path = require('path');
const fs = require('fs');
const AdmZip = require('adm-zip');
const { loadPrompt } = require('../utils/prompt-loader');

const llm = new LLMService();
const ocr = new OCRService();

const MAX_FILES = 10;
const SUPPORTED_EXT = new Set(['.pdf', '.png', '.jpg', '.jpeg', '.zip']);

const RUBRIC_SYSTEM_PROMPT = loadPrompt(
  'system/rubric.md',
  'You are an expert university rubric designer. Return valid JSON array only.'
);

async function extractFileText(filePath, fileName) {
  const ext = path.extname(fileName || filePath).toLowerCase();

  if (ext === '.zip') {
    const texts = [];
    const zip = new AdmZip(filePath);
    const entries = zip.getEntries().filter(e =>
      !e.isDirectory && SUPPORTED_EXT.has(path.extname(e.entryName).toLowerCase()) && path.extname(e.entryName).toLowerCase() !== '.zip'
    );

    const tmpDir = path.resolve(process.env.UPLOAD_DIR || './data/uploads', `_zip_${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });

    for (const entry of entries.slice(0, MAX_FILES)) {
      const tmpPath = path.join(tmpDir, `${Date.now()}_${path.basename(entry.entryName)}`);
      fs.writeFileSync(tmpPath, entry.getData());
      try {
        const pages = await ocr.extractPages(tmpPath);
        const text = pages.map(p => p.text).join('\n\n');
        if (text.trim()) texts.push({ name: entry.entryName, text });
      } catch {} finally {
        try { fs.unlinkSync(tmpPath); } catch {}
      }
    }
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
    return texts;
  }

  const pages = await ocr.extractPages(filePath);
  const text = pages.map(p => p.text).join('\n\n---PAGE BREAK---\n\n');
  return text.trim() ? [{ name: fileName || path.basename(filePath), text }] : [];
}

async function generateRubricFromFiles(filePaths, options = {}) {
  const allDocs = [];

  for (const { path: fp, originalname } of filePaths) {
    const docs = await extractFileText(fp, originalname);
    allDocs.push(...docs);
  }

  if (!allDocs.length) {
    throw new Error('Could not extract any text from the uploaded files.');
  }

  const charBudget = 20000;
  const perDoc = Math.floor(charBudget / allDocs.length);
  const combined = allDocs.map((d, i) =>
    `=== DOCUMENT ${i + 1}: ${d.name} ===\n${d.text.slice(0, perDoc)}`
  ).join('\n\n');

  let prompt = `Analyze the following ${allDocs.length} document(s) and generate an exam rubric:\n\n${combined}`;

  if (options.totalMarks) prompt += `\n\nTotal marks for the exam: ${options.totalMarks}`;
  if (options.numQuestions) prompt += `\n\nExpected number of questions: ${options.numQuestions}`;
  if (options.instructions) prompt += `\n\nProfessor's instructions: ${options.instructions}`;

  const raw = await llm.chat([{ role: 'user', content: prompt }], RUBRIC_SYSTEM_PROMPT);
  return parseRubricResponse(raw);
}

async function generateRubricFromFile(filePath, options = {}) {
  return generateRubricFromFiles([{ path: filePath, originalname: path.basename(filePath) }], options);
}

async function generateRubricFromText(text, options = {}) {
  let prompt = `Generate a rubric for these questions:\n\n${text.slice(0, 10000)}`;
  if (options.totalMarks) prompt += `\n\nTotal marks: ${options.totalMarks}`;
  if (options.instructions) prompt += `\n\nProfessor's instructions: ${options.instructions}`;

  const raw = await llm.chat([{ role: 'user', content: prompt }], RUBRIC_SYSTEM_PROMPT);
  return parseRubricResponse(raw);
}

async function generateFromSyllabus(syllabusText, options = {}) {
  let referenceMaterial = '';
  if (options.referenceFiles && options.referenceFiles.length) {
    const allDocs = [];
    for (const { path: fp, originalname } of options.referenceFiles) {
      const docs = await extractFileText(fp, originalname);
      allDocs.push(...docs);
    }
    if (allDocs.length) {
      const perDoc = Math.floor(8000 / allDocs.length);
      referenceMaterial = '\n\nReference documents provided:\n' +
        allDocs.map((d, i) => `=== REF ${i + 1}: ${d.name} ===\n${d.text.slice(0, perDoc)}`).join('\n\n');
    }
  }

  const prompt = `Based on this course syllabus, generate a comprehensive exam with questions and rubric.
Target difficulty: ${options.difficulty || 'medium'}
Total marks: ${options.totalMarks || 100}
Number of questions: ${options.numQuestions || 5}
Exam type: ${options.examType || 'midterm'}
${options.instructions ? `\nProfessor's instructions: ${options.instructions}` : ''}
${options.pastPerformance ? `\nPast exam analysis (topics that were under-assessed):\n${options.pastPerformance}\n` : ''}

Syllabus:\n${syllabusText.slice(0, 8000)}${referenceMaterial}`;

  const raw = await llm.chat([{ role: 'user', content: prompt }], RUBRIC_SYSTEM_PROMPT);
  return parseRubricResponse(raw);
}

function parseRubricResponse(raw) {
  try {
    let cleaned = (raw || '').trim();
    if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```[a-z]*\n?/i, '').replace(/```$/, '').trim();
    const start = cleaned.indexOf('[');
    const end = cleaned.lastIndexOf(']');
    if (start === -1 || end <= start) throw new Error('No JSON array found');

    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    if (!Array.isArray(parsed)) throw new Error('Response is not an array');

    return parsed.map((q, i) => ({
      question_no: String(q.question_no || (i + 1)),
      question_text: (q.question_text || '').trim(),
      max_marks: parseFloat(q.max_marks) || 10,
      key_points: Array.isArray(q.key_points)
        ? q.key_points.map(kp => ({
            point: (kp.point || '').trim(),
            marks: parseFloat(kp.marks) || 1,
          })).filter(kp => kp.point)
        : [],
      grading_notes: (q.grading_notes || '').trim() || null,
    })).filter(q => q.question_text);
  } catch {
    return [{ question_no: '1', question_text: 'AI could not parse the document. Please add questions manually.', max_marks: 10, key_points: [], grading_notes: raw?.slice(0, 500) }];
  }
}

module.exports = { generateRubricFromFile, generateRubricFromFiles, generateRubricFromText, generateFromSyllabus };

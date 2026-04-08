const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { ensureAuth, ensureSubscription, asyncHandler, assertExamOwner } = require('../middleware/auth');
const { requireInt } = require('../middleware/validate');
const { Course, Exam, Rubric } = require('../models');
const { generateRubricFromFiles, generateRubricFromText, generateFromSyllabus } = require('../services/rubric-generator');

const uploadDir = path.resolve(process.env.UPLOAD_DIR || './data/uploads');
const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 30 * 1024 * 1024, files: 10 },
  fileFilter(req, file, cb) {
    cb(null, /\.(pdf|png|jpg|jpeg|zip)$/i.test(file.originalname));
  },
});

function cleanupFiles(files) {
  for (const f of (files || [])) {
    try { fs.unlinkSync(f.path); } catch {}
  }
}

router.post('/auto-generate', ensureAuth, ensureSubscription, upload.array('rubric_files', 10), asyncHandler(async (req, res) => {
  const examId = requireInt(req.body.exam_id, 'Exam');
  await assertExamOwner(req, examId);

  let questions;

  if (req.files && req.files.length) {
    const opts = {};
    if (req.body.total_marks) opts.totalMarks = parseFloat(req.body.total_marks);
    if (req.body.num_questions) opts.numQuestions = parseInt(req.body.num_questions);
    if (req.body.instructions) opts.instructions = req.body.instructions;

    try {
      questions = await generateRubricFromFiles(req.files, opts);
    } finally {
      cleanupFiles(req.files);
    }
  } else if (req.body.question_text) {
    questions = await generateRubricFromText(req.body.question_text, {
      totalMarks: parseFloat(req.body.total_marks) || undefined,
      instructions: req.body.instructions || undefined,
    });
  } else {
    req.flash('error', 'Upload files or enter question text.');
    return res.redirect(`/rubric?exam_id=${examId}`);
  }

  let added = 0;
  const existingCount = await Rubric.count({ where: { exam_id: examId } });

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    await Rubric.create({
      exam_id: examId,
      question_no: q.question_no,
      question_order: existingCount + i + 1,
      question_text: q.question_text,
      max_marks: q.max_marks,
      key_points: JSON.stringify(q.key_points),
      grading_notes: q.grading_notes,
    });
    added++;
  }

  req.flash('success', `AI analyzed ${req.files?.length || 0} file(s) and generated ${added} rubric question(s). Review and edit as needed.`);
  res.redirect(`/rubric?exam_id=${examId}`);
}));

router.post('/from-syllabus', ensureAuth, ensureSubscription, upload.array('syllabus_files', 10), asyncHandler(async (req, res) => {
  const examId = requireInt(req.body.exam_id, 'Exam');
  await assertExamOwner(req, examId);

  let syllabusText = req.body.syllabus_text || '';
  let referenceFiles = [];

  if (req.files && req.files.length) {
    const firstFile = req.files[0];
    if (!syllabusText.trim()) {
      const OCRService = require('../services/ocr');
      const ocrSvc = new OCRService();
      const pages = await ocrSvc.extractPages(firstFile.path);
      syllabusText = pages.map(p => p.text).join('\n\n');
      referenceFiles = req.files.slice(1);
    } else {
      referenceFiles = req.files;
    }
  }

  if (!syllabusText.trim()) {
    cleanupFiles(req.files);
    req.flash('error', 'Upload a syllabus file or paste the syllabus text.');
    return res.redirect(`/rubric?exam_id=${examId}`);
  }

  try {
    const questions = await generateFromSyllabus(syllabusText, {
      difficulty: req.body.difficulty || 'medium',
      totalMarks: parseFloat(req.body.total_marks) || 100,
      numQuestions: parseInt(req.body.num_questions) || 5,
      examType: req.body.exam_type || 'midterm',
      instructions: req.body.instructions || undefined,
      referenceFiles,
    });

    let added = 0;
    const existingCount = await Rubric.count({ where: { exam_id: examId } });

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      await Rubric.create({
        exam_id: examId,
        question_no: q.question_no,
        question_order: existingCount + i + 1,
        question_text: q.question_text,
        max_marks: q.max_marks,
        key_points: JSON.stringify(q.key_points),
        grading_notes: q.grading_notes,
      });
      added++;
    }

    req.flash('success', `AI analyzed ${(req.files?.length || 0)} file(s) and generated ${added} questions. Review and edit.`);
  } finally {
    cleanupFiles(req.files);
  }

  res.redirect(`/rubric?exam_id=${examId}`);
}));

module.exports = router;

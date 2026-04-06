const { Submission, Rubric, Grade } = require('../models');
const OCRService = require('./ocr');
const LLMService = require('./llm');

const ocr = new OCRService();
const llm = new LLMService();

async function gradeSubmission(submissionId, progressCb) {
  const submission = await Submission.findByPk(submissionId);
  if (!submission) throw new Error(`Submission ${submissionId} not found`);

  submission.status = 'grading';
  submission.error_message = null;
  await submission.save();

  const rubrics = await Rubric.findAll({
    where: { exam_id: submission.exam_id },
    order: [['question_order', 'ASC'], ['id', 'ASC']],
  });

  if (!rubrics.length) {
    submission.status = 'error';
    submission.error_message = 'No rubric found for exam';
    await submission.save();
    throw new Error('No rubric found for this exam');
  }

  let pages;
  try {
    pages = await ocr.extractPages(submission.file_path);
  } catch (err) {
    submission.status = 'error';
    submission.error_message = `OCR failed: ${err.message}`;
    await submission.save();
    throw err;
  }

  if (!pages.length) {
    submission.status = 'error';
    submission.error_message = 'Could not extract any pages from PDF';
    await submission.save();
    throw new Error('Could not extract any pages from PDF');
  }

  submission.page_count = pages.length;
  await submission.save();

  const fallbackQuestions = [];

  try {
    for (let i = 0; i < rubrics.length; i++) {
      const rubric = rubrics[i];
      if (progressCb) progressCb(`Question ${i + 1}/${rubrics.length}: ${rubric.question_no}`);

      let detectedPages = ocr.detectQuestionPages(pages, rubric.question_no);
      if (!detectedPages.length) {
        detectedPages = pages.map(p => p.pageNumber);
        fallbackQuestions.push(rubric.question_no);
      }

      const answerText = ocr.collectAnswerText(pages, detectedPages).trim();
      let keyPoints = [];
      try { keyPoints = JSON.parse(rubric.key_points || '[]'); } catch {}

      const result = await llm.gradeAnswer({
        questionNo: rubric.question_no,
        questionText: rubric.question_text,
        maxMarks: rubric.max_marks,
        keyPoints,
        gradingNotes: rubric.grading_notes || '',
        studentAnswer: answerText,
      });

      let feedback = (result.feedback || '').trim();
      if (fallbackQuestions.includes(rubric.question_no)) {
        feedback += '\n\nNote: Auto-detection could not isolate this question; all pages were used for grading.';
      }

      const [grade] = await Grade.findOrCreate({
        where: { submission_id: submissionId, rubric_id: rubric.id },
        defaults: { question_no: rubric.question_no },
      });

      grade.detected_pages = detectedPages.join(',');
      grade.ocr_text = answerText;
      grade.awarded_marks = Math.min(Math.max(result.score || 0, 0), rubric.max_marks);
      grade.feedback = feedback;
      grade.matched_points = JSON.stringify(result.matched_points || []);
      grade.missing_points = JSON.stringify(result.missing_points || []);
      grade.confidence = Math.min(Math.max(result.confidence || 0, 0), 1);
      grade.raw_response = (result.raw_response || '').slice(0, 8000);
      await grade.save();

      await new Promise(r => setTimeout(r, 800));
    }

    submission.status = 'done';
    submission.error_message = null;
    await submission.save();

    return { gradedQuestions: rubrics.length, fallbackQuestions };
  } catch (err) {
    submission.status = 'error';
    submission.error_message = (err.message || '').slice(0, 1000);
    await submission.save();
    throw err;
  }
}

module.exports = { gradeSubmission };

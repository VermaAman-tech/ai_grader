const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { ensureAuth, ensureSubscription, asyncHandler, assertCourseOwner } = require('../middleware/auth');
const { requireInt, requireString, optionalString } = require('../middleware/validate');
const { Course, Exam, Rubric } = require('../models');
const { generateFromSyllabus } = require('../services/rubric-generator');
const { getExamAnalytics } = require('../services/analytics');

const uploadDir = path.resolve(process.env.UPLOAD_DIR || './data/uploads');
const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 30 * 1024 * 1024, files: 10 },
  fileFilter(req, file, cb) {
    const safeName = (file.originalname || '').replace(/\0/g, '');
    cb(null, /\.(pdf|png|jpg|jpeg|zip)$/i.test(safeName));
  },
});

function cleanupFiles(files) {
  for (const f of (files || [])) {
    try { fs.unlinkSync(f.path); } catch {}
  }
}

router.get('/', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const courses = await Course.findAll({ where: { user_id: req.session.userId }, order: [['name', 'ASC']] });

  const allExams = {};
  for (const c of courses) {
    allExams[c.id] = (await Exam.findAll({ where: { course_id: c.id }, order: [['name', 'ASC']] })).map(e => ({ id: e.id, name: e.name }));
  }

  res.render('exam-design', { courses, allExams });
}));

router.post('/generate', ensureAuth, ensureSubscription, upload.array('reference_files', 10), asyncHandler(async (req, res) => {
  const courseId = requireInt(req.body.course_id, 'Course');
  await assertCourseOwner(req, courseId);

  const examName = requireString(req.body.exam_name, 'Exam name', { maxLen: 200 });
  const examType = optionalString(req.body.exam_type) || 'midterm';
  const difficulty = optionalString(req.body.difficulty) || 'medium';
  const totalMarks = parseFloat(req.body.total_marks) || 100;
  const numQuestions = parseInt(req.body.num_questions) || 5;
  const instructions = optionalString(req.body.instructions) || '';

  let syllabusText = req.body.syllabus_text || '';
  let referenceFiles = [];

  if (req.files && req.files.length) {
    if (!syllabusText.trim()) {
      const OCRService = require('../services/ocr');
      const ocrSvc = new OCRService();
      const pages = await ocrSvc.extractPages(req.files[0].path);
      syllabusText = pages.map(p => p.text).join('\n\n');
      referenceFiles = req.files.slice(1);
    } else {
      referenceFiles = req.files;
    }
  }

  if (!syllabusText.trim()) {
    cleanupFiles(req.files);
    req.flash('error', 'Provide syllabus text or upload at least one file.');
    return res.redirect('/exam-design');
  }

  let pastPerformance = '';
  if (req.body.reference_exam_id) {
    try {
      const analytics = await getExamAnalytics(parseInt(req.body.reference_exam_id));
      if (analytics) {
        const hard = analytics.questionStats.filter(q => q.difficulty === 'Hard');
        const easy = analytics.questionStats.filter(q => q.difficulty === 'Easy');
        pastPerformance = `Previous exam: avg ${analytics.classAvg}/${analytics.maxPossible}\n`;
        if (hard.length) pastPerformance += `Hard questions (under-assessed topics): ${hard.map(q => q.questionNo).join(', ')}\n`;
        if (easy.length) pastPerformance += `Easy questions: ${easy.map(q => q.questionNo).join(', ')}\n`;
        pastPerformance += `Pass rate: ${analytics.passRate}%`;
      }
    } catch {}
  }

  try {
    const questions = await generateFromSyllabus(syllabusText, {
      difficulty, totalMarks, numQuestions, examType, pastPerformance,
      instructions, referenceFiles,
    });

    const exam = await Exam.create({
      course_id: courseId,
      name: examName,
      exam_type: examType,
      total_marks: totalMarks,
      instructions: `AI-generated ${examType} exam. Difficulty: ${difficulty}. ${numQuestions} questions.${instructions ? ' ' + instructions : ''}`,
    });

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      await Rubric.create({
        exam_id: exam.id,
        question_no: q.question_no,
        question_order: i + 1,
        question_text: q.question_text,
        max_marks: q.max_marks,
        key_points: JSON.stringify(q.key_points),
        grading_notes: q.grading_notes,
      });
    }

    req.flash('success', `Exam "${examName}" created from ${(req.files?.length || 0)} file(s) with ${questions.length} AI-generated questions. Review and edit on the Rubric page.`);
    res.redirect(`/rubric?exam_id=${exam.id}`);
  } finally {
    cleanupFiles(req.files);
  }
}));

module.exports = router;

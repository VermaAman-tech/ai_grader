const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { ensureAuth, ensureSubscription, asyncHandler, assertCourseOwner, assertExamOwner, assertSubmissionOwner } = require('../middleware/auth');
const { requireInt } = require('../middleware/validate');
const { Course, Exam, Student, Submission, IntegrationConfig } = require('../models');

const uploadDir = process.env.UPLOAD_DIR || './data/uploads';
const storage = multer.diskStorage({
  destination(req, file, cb) {
    const dir = path.resolve(uploadDir);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(req, file, cb) {
    const ts = Date.now();
    cb(null, `${ts}_${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    cb(null, file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf'));
  },
});

router.get('/', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const courses = await Course.findAll({ where: { user_id: req.session.userId }, order: [['name', 'ASC']] });
  const courseId = parseInt(req.query.course_id) || null;
  const examId = parseInt(req.query.exam_id) || null;

  let exams = [], students = [], submissions = [];
  if (courseId) {
    await assertCourseOwner(req, courseId);
    exams = await Exam.findAll({ where: { course_id: courseId }, order: [['name', 'ASC']] });
    students = await Student.findAll({ where: { course_id: courseId }, order: [['name', 'ASC']] });
  }
  if (examId) {
    await assertExamOwner(req, examId);
    submissions = await Submission.findAll({
      where: { exam_id: examId },
      include: [{ model: Student }],
      order: [['created_at', 'DESC']],
    });
  }

  let turnitinActive = false, gradescopeActive = false;
  if (courseId) {
    const tCfg = await IntegrationConfig.findOne({ where: { provider: 'turnitin', course_id: courseId, user_id: req.session.userId, is_active: true } });
    turnitinActive = !!tCfg;
    const gCfg = await IntegrationConfig.findOne({ where: { provider: 'gradescope', course_id: courseId, user_id: req.session.userId, is_active: true } });
    gradescopeActive = !!gCfg;
  }

  res.locals.examId = examId;
  res.locals.courseId = courseId;
  res.render('submissions', { courses, exams, students, submissions, selectedCourseId: courseId, selectedExamId: examId, turnitinActive, gradescopeActive });
}));

router.post('/upload', ensureAuth, ensureSubscription, upload.array('pdf_files', 100), asyncHandler(async (req, res) => {
  const examId = requireInt(req.body.exam_id, 'Exam');
  const exam = await assertExamOwner(req, examId);
  const courseId = exam.course_id;

  if (!req.files?.length) {
    req.flash('error', 'At least one PDF file is required.');
    return res.redirect(`/submissions?course_id=${courseId}&exam_id=${examId}`);
  }

  const { student_ids } = req.body;
  const students = student_ids
    ? (Array.isArray(student_ids) ? student_ids : [student_ids]).map(Number)
    : [];

  let uploaded = 0;
  for (let i = 0; i < req.files.length; i++) {
    const file = req.files[i];
    const studentId = students[i] || students[0] || null;
    if (!studentId) {
      req.flash('error', 'Each file must be assigned to a student.');
      continue;
    }

    await Submission.create({
      exam_id: examId,
      student_id: studentId,
      file_name: file.originalname,
      file_path: file.path,
      status: 'pending',
    });
    uploaded++;
  }

  req.flash('success', `${uploaded} submission(s) uploaded.`);
  res.redirect(`/submissions?course_id=${courseId}&exam_id=${examId}`);
}));

router.post('/:id/delete', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const sub = await assertSubmissionOwner(req, parseInt(req.params.id));
  try { fs.unlinkSync(sub.file_path); } catch {}
  const examId = sub.exam_id;
  await sub.destroy();
  req.flash('success', 'Submission deleted.');
  res.redirect(`/submissions?exam_id=${examId}`);
}));

module.exports = router;

const router = require('express').Router();
const { ensureAuth, ensureSubscription, asyncHandler, assertExamOwner } = require('../middleware/auth');
const { requireInt, requireFloat, optionalString } = require('../middleware/validate');
const { Course, Exam, Submission, Grade, Rubric, Student } = require('../models');
const { Op } = require('sequelize');

router.get('/', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const courses = await Course.findAll({ where: { user_id: req.session.userId }, order: [['name', 'ASC']] });
  const examId = parseInt(req.query.exam_id) || null;
  const allExams = {};
  for (const c of courses) {
    allExams[c.id] = (await Exam.findAll({ where: { course_id: c.id }, order: [['name', 'ASC']] })).map(e => ({ id: e.id, name: e.name }));
  }

  let flaggedGrades = [];
  let threshold = 0.6;
  let examName = '';

  if (examId) {
    const exam = await assertExamOwner(req, examId);
    examName = exam.name;
    const course = await Course.findByPk(exam.course_id);
    threshold = course?.review_threshold || 0.6;

    flaggedGrades = await Grade.findAll({
      where: {
        confidence: { [Op.lt]: threshold },
        review_status: { [Op.in]: ['auto', 'flagged'] },
      },
      include: [
        { model: Submission, required: true, where: { exam_id: examId }, include: [{ model: Student }] },
        { model: Rubric },
      ],
      order: [['confidence', 'ASC']],
    });
  }

  res.render('review-queue', { courses, allExams, flaggedGrades, threshold, selectedExamId: examId, examName });
}));

router.post('/approve/:gradeId', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const gradeId = requireInt(req.params.gradeId, 'Grade');
  const grade = await Grade.findOne({
    where: { id: gradeId },
    include: [{ model: Submission, include: [{ model: Exam, required: true, include: [{ model: Course, required: true, where: { user_id: req.session.userId } }] }] }],
  });
  if (!grade) throw new Error('ACCESS_DENIED');

  grade.review_status = 'approved';
  await grade.save();
  req.flash('success', `Q${grade.question_no} approved.`);
  res.redirect(`/review-queue?exam_id=${grade.Submission.exam_id}`);
}));

router.post('/override/:gradeId', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const gradeId = requireInt(req.params.gradeId, 'Grade');
  const grade = await Grade.findOne({
    where: { id: gradeId },
    include: [{ model: Submission, include: [{ model: Exam, required: true, include: [{ model: Course, required: true, where: { user_id: req.session.userId } }] }] }],
  });
  if (!grade) throw new Error('ACCESS_DENIED');

  const { override_marks, override_note } = req.body;
  grade.override_marks = override_marks !== '' ? Math.max(0, parseFloat(override_marks) || 0) : null;
  grade.override_note = optionalString(override_note, { maxLen: 1000 });
  grade.review_status = 'overridden';
  grade.modified_by_session = req.sessionID;
  await grade.save();

  req.flash('success', `Q${grade.question_no} overridden to ${grade.override_marks} marks.`);
  res.redirect(`/review-queue?exam_id=${grade.Submission.exam_id}`);
}));

router.post('/threshold/:courseId', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const courseId = requireInt(req.params.courseId, 'Course');
  const course = await Course.findOne({ where: { id: courseId, user_id: req.session.userId } });
  if (!course) throw new Error('ACCESS_DENIED');

  const threshold = Math.min(1, Math.max(0, parseFloat(req.body.threshold) || 0.6));
  course.review_threshold = threshold;
  await course.save();
  req.flash('success', `Review threshold set to ${(threshold * 100).toFixed(0)}%.`);
  res.redirect(req.get('Referer') || '/review-queue');
}));

module.exports = router;

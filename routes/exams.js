const router = require('express').Router();
const { ensureAuth, ensureSubscription, asyncHandler, assertCourseOwner, assertExamOwner } = require('../middleware/auth');
const { requireString, requireInt, requireFloat, optionalString } = require('../middleware/validate');
const { Course, Exam, Rubric, Submission } = require('../models');

router.get('/', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const courses = await Course.findAll({ where: { user_id: req.session.userId }, order: [['name', 'ASC']] });
  const courseId = parseInt(req.query.course_id) || null;
  let exams = [];

  if (courseId) {
    await assertCourseOwner(req, courseId);
    const rawExams = await Exam.findAll({ where: { course_id: courseId }, order: [['created_at', 'DESC']] });
    for (const e of rawExams) {
      const rubricCount = await Rubric.count({ where: { exam_id: e.id } });
      const subCount = await Submission.count({ where: { exam_id: e.id } });
      exams.push({ ...e.toJSON(), rubricCount, subCount });
    }
  }

  res.render('exams', { courses, exams, selectedCourseId: courseId });
}));

router.post('/', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const courseId = requireInt(req.body.course_id, 'Course');
  await assertCourseOwner(req, courseId);

  const name = requireString(req.body.name, 'Exam name', { maxLen: 200 });
  const exam_type = optionalString(req.body.exam_type, { maxLen: 50 }) || 'exam';
  const total_marks = requireFloat(req.body.total_marks || '100', 'Total marks', { min: 1, max: 10000 });
  const instructions = optionalString(req.body.instructions, { maxLen: 2000 });

  await Exam.create({ course_id: courseId, name, exam_type, total_marks, instructions });
  req.flash('success', `Exam "${name}" created.`);
  res.redirect(`/exams?course_id=${courseId}`);
}));

router.post('/:id/delete', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const exam = await assertExamOwner(req, parseInt(req.params.id));
  const courseId = exam.course_id;
  const examName = exam.name;
  await exam.destroy();
  req.flash('success', `Exam "${examName}" deleted.`);
  res.redirect(`/exams?course_id=${courseId}`);
}));

module.exports = router;

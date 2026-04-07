const router = require('express').Router();
const { ensureAuth, ensureSubscription, asyncHandler, assertCourseOwner } = require('../middleware/auth');
const { requireString, optionalString } = require('../middleware/validate');
const { Course, Exam, Student } = require('../models');

router.get('/', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const courses = await Course.findAll({
    where: { user_id: req.session.userId },
    order: [['created_at', 'DESC']],
  });

  const data = [];
  for (const c of courses) {
    const examCount = await Exam.count({ where: { course_id: c.id } });
    const studentCount = await Student.count({ where: { course_id: c.id } });
    data.push({ ...c.toJSON(), examCount, studentCount });
  }

  res.render('courses', { courses: data });
}));

router.post('/', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const name = requireString(req.body.name, 'Course name', { maxLen: 200 });
  const code = requireString(req.body.code, 'Course code', { maxLen: 50 });
  const semester = optionalString(req.body.semester, { maxLen: 100 });
  const section = optionalString(req.body.section, { maxLen: 50 });

  await Course.create({
    user_id: req.session.userId,
    name, code, semester, section,
  });
  req.flash('success', `Course "${name}" created.`);
  res.redirect('/courses');
}));

router.post('/:id/delete', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const course = await assertCourseOwner(req, parseInt(req.params.id));
  const courseName = course.name;
  await course.destroy();
  req.flash('success', `Course "${courseName}" deleted.`);
  res.redirect('/courses');
}));

module.exports = router;

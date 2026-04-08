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

router.get('/:id', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const course = await assertCourseOwner(req, parseInt(req.params.id));
  const examCount = await Exam.count({ where: { course_id: course.id } });
  const studentCount = await Student.count({ where: { course_id: course.id } });
  const exams = await Exam.findAll({ where: { course_id: course.id }, order: [['created_at', 'DESC']] });
  res.locals.courseId = course.id;
  res.render('course-detail', { course: { ...course.toJSON(), examCount, studentCount }, exams });
}));

router.post('/', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const name = requireString(req.body.name, 'Course name', { maxLen: 200 });
  const code = requireString(req.body.code, 'Course code', { maxLen: 50 });
  const semester = optionalString(req.body.semester, { maxLen: 100 });
  const section = optionalString(req.body.section, { maxLen: 50 });
  const description = optionalString(req.body.description, { maxLen: 2000 });
  const objectives = optionalString(req.body.objectives, { maxLen: 3000 });
  const syllabus = optionalString(req.body.syllabus, { maxLen: 5000 });
  const credits = parseInt(req.body.credits) || null;
  const department = optionalString(req.body.department, { maxLen: 200 });

  await Course.create({
    user_id: req.session.userId,
    name, code, semester, section,
    description, objectives, syllabus, credits, department,
  });
  req.flash('success', `Course "${name}" created.`);
  res.redirect('/courses');
}));

router.post('/:id/update', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const course = await assertCourseOwner(req, parseInt(req.params.id));

  course.name = requireString(req.body.name, 'Course name', { maxLen: 200 });
  course.code = requireString(req.body.code, 'Course code', { maxLen: 50 });
  course.semester = optionalString(req.body.semester, { maxLen: 100 }) || null;
  course.section = optionalString(req.body.section, { maxLen: 50 }) || null;
  course.description = optionalString(req.body.description, { maxLen: 2000 }) || null;
  course.objectives = optionalString(req.body.objectives, { maxLen: 3000 }) || null;
  course.syllabus = optionalString(req.body.syllabus, { maxLen: 5000 }) || null;
  course.credits = parseInt(req.body.credits) || null;
  course.department = optionalString(req.body.department, { maxLen: 200 }) || null;
  await course.save();

  req.flash('success', 'Course updated.');
  res.redirect(`/courses/${course.id}`);
}));

router.post('/:id/delete', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const course = await assertCourseOwner(req, parseInt(req.params.id));
  const courseName = course.name;
  await course.destroy();
  req.flash('success', `Course "${courseName}" deleted.`);
  res.redirect('/courses');
}));

module.exports = router;

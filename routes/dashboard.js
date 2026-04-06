const router = require('express').Router();
const { ensureAuth, ensureSubscription } = require('../middleware/auth');
const { Course, Exam, Student, Submission, Grade, Rubric, Subscription } = require('../models');
const { Op } = require('sequelize');

router.get('/dashboard', ensureAuth, ensureSubscription, async (req, res) => {
  const userId = req.session.userId;

  const courses = await Course.count({ where: { user_id: userId } });
  const courseIds = (await Course.findAll({ where: { user_id: userId }, attributes: ['id'] })).map(c => c.id);

  const exams = courseIds.length ? await Exam.count({ where: { course_id: { [Op.in]: courseIds } } }) : 0;
  const students = courseIds.length ? await Student.count({ where: { course_id: { [Op.in]: courseIds } } }) : 0;

  const examIds = courseIds.length
    ? (await Exam.findAll({ where: { course_id: { [Op.in]: courseIds } }, attributes: ['id'] })).map(e => e.id)
    : [];

  const submissions = examIds.length ? await Submission.count({ where: { exam_id: { [Op.in]: examIds } } }) : 0;
  const done = examIds.length ? await Submission.count({ where: { exam_id: { [Op.in]: examIds }, status: 'done' } }) : 0;
  const pending = examIds.length ? await Submission.count({ where: { exam_id: { [Op.in]: examIds }, status: 'pending' } }) : 0;
  const errors = examIds.length ? await Submission.count({ where: { exam_id: { [Op.in]: examIds }, status: 'error' } }) : 0;
  const grades = examIds.length ? await Grade.count({ where: { submission_id: { [Op.in]: (await Submission.findAll({ where: { exam_id: { [Op.in]: examIds } }, attributes: ['id'] })).map(s => s.id) } } }) : 0;
  const rubrics = examIds.length ? await Rubric.count({ where: { exam_id: { [Op.in]: examIds } } }) : 0;

  const recentCourses = await Course.findAll({ where: { user_id: userId }, order: [['created_at', 'DESC']], limit: 5 });
  const recentSubs = examIds.length ? await Submission.findAll({
    where: { exam_id: { [Op.in]: examIds } },
    order: [['created_at', 'DESC']], limit: 5,
    include: [{ model: Student }, { model: Exam }],
  }) : [];

  const sub = req.subscription;

  res.render('dashboard', {
    stats: { courses, exams, students, submissions, done, pending, errors, grades, rubrics },
    recentCourses, recentSubs, sub,
  });
});

module.exports = router;

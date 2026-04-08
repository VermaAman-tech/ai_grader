const router = require('express').Router();
const { ensureAuth, ensureSubscription, asyncHandler } = require('../middleware/auth');
const { Course, Exam, Student, Submission, Grade, Rubric, User } = require('../models');
const { Op } = require('sequelize');

const FREE_PAPER_LIMIT = parseInt(process.env.FREE_PAPER_LIMIT || '10', 10);

router.get('/dashboard', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const userId = req.session.userId;

  const userCourses = await Course.findAll({ where: { user_id: userId }, attributes: ['id'] });
  const courseIds = userCourses.map(c => c.id);

  const courses = courseIds.length;
  const exams = courseIds.length ? await Exam.count({ where: { course_id: { [Op.in]: courseIds } } }) : 0;
  const students = courseIds.length ? await Student.count({ where: { course_id: { [Op.in]: courseIds } } }) : 0;

  const examIds = courseIds.length
    ? (await Exam.findAll({ where: { course_id: { [Op.in]: courseIds } }, attributes: ['id'] })).map(e => e.id)
    : [];

  const submissions = examIds.length ? await Submission.count({ where: { exam_id: { [Op.in]: examIds } } }) : 0;
  const done = examIds.length ? await Submission.count({ where: { exam_id: { [Op.in]: examIds }, status: 'done' } }) : 0;
  const pending = examIds.length ? await Submission.count({ where: { exam_id: { [Op.in]: examIds }, status: 'pending' } }) : 0;
  const errors = examIds.length ? await Submission.count({ where: { exam_id: { [Op.in]: examIds }, status: 'error' } }) : 0;

  let grades = 0, rubrics = 0;
  if (examIds.length) {
    const subIds = (await Submission.findAll({ where: { exam_id: { [Op.in]: examIds } }, attributes: ['id'] })).map(s => s.id);
    grades = subIds.length ? await Grade.count({ where: { submission_id: { [Op.in]: subIds } } }) : 0;
    rubrics = await Rubric.count({ where: { exam_id: { [Op.in]: examIds } } });
  }

  const recentCourses = await Course.findAll({ where: { user_id: userId }, order: [['created_at', 'DESC']], limit: 5 });
  const recentSubs = examIds.length ? await Submission.findAll({
    where: { exam_id: { [Op.in]: examIds } },
    order: [['created_at', 'DESC']], limit: 5,
    include: [{ model: Student }, { model: Exam }],
  }) : [];

  const sub = req.subscription;
  const user = await User.findByPk(userId);
  const isFree = sub && (sub.plan === 'free' || sub.plan === 'trial');
  const freeInfo = isFree
    ? { used: user.papers_graded_total, limit: FREE_PAPER_LIMIT }
    : null;

  res.render('dashboard', {
    stats: { courses, exams, students, submissions, done, pending, errors, grades, rubrics },
    recentCourses, recentSubs, sub, freeInfo,
  });
}));

module.exports = router;

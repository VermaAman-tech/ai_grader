const router = require('express').Router();
const { ensureAuth, asyncHandler } = require('../middleware/auth');
const { Course, Exam, Student, Submission, Grade, Rubric, User, CourseTA, CourseEnrollment, Subscription } = require('../models');
const { Op } = require('sequelize');

const FREE_PAPER_LIMIT = parseInt(process.env.FREE_PAPER_LIMIT || '10', 10);

router.get('/dashboard', ensureAuth, asyncHandler(async (req, res) => {
  if (req.session.role === 'student') {
    return res.redirect('/student/dashboard');
  }
  const userId = req.session.userId;
  const user = await User.findByPk(userId);

  // Courses the user owns (instructor)
  const ownedCourses = await Course.findAll({
    where: { user_id: userId },
    order: [['created_at', 'DESC']],
  });

  // Courses the user TAs
  const taAssignments = await CourseTA.findAll({
    where: { user_id: userId, status: 'active' },
    include: [{ model: Course, include: [{ model: User, attributes: ['full_name'] }] }],
  });
  const taCourses = taAssignments
    .filter(a => a.Course)
    .map(a => ({ ...a.Course.get({ plain: true }), professorName: a.Course.User?.full_name || 'Unknown' }));

  // Courses the user is enrolled in as student (via CourseEnrollment or Student roster link)
  const studentEnrollments = await CourseEnrollment.findAll({
    where: { user_id: userId, role: 'student', status: 'active' },
    include: [{ model: Course, include: [{ model: User, attributes: ['full_name'] }] }],
  });
  let enrolledCourses = studentEnrollments
    .filter(e => e.Course)
    .map(e => ({ ...e.Course.get({ plain: true }), professorName: e.Course.User?.full_name || 'Unknown' }));

  // Also check Student roster records for backward compat
  if (!enrolledCourses.length) {
    const rosterLinks = await Student.findAll({
      where: { user_id: userId },
      include: [{ model: Course, include: [{ model: User, attributes: ['full_name'] }] }],
    });
    enrolledCourses = rosterLinks
      .filter(s => s.Course)
      .map(s => ({ ...s.Course.get({ plain: true }), professorName: s.Course.User?.full_name || 'Unknown' }));
  }

  // Stats for instructor view
  const courseIds = ownedCourses.map(c => c.id);
  let stats = { courses: courseIds.length, exams: 0, students: 0, submissions: 0, done: 0, pending: 0, errors: 0, grades: 0, rubrics: 0 };

  if (courseIds.length) {
    stats.exams = await Exam.count({ where: { course_id: { [Op.in]: courseIds } } });
    stats.students = await Student.count({ where: { course_id: { [Op.in]: courseIds } } });

    const examIds = (await Exam.findAll({ where: { course_id: { [Op.in]: courseIds } }, attributes: ['id'] })).map(e => e.id);
    if (examIds.length) {
      stats.submissions = await Submission.count({ where: { exam_id: { [Op.in]: examIds } } });
      stats.done = await Submission.count({ where: { exam_id: { [Op.in]: examIds }, status: 'done' } });
      stats.pending = await Submission.count({ where: { exam_id: { [Op.in]: examIds }, status: 'pending' } });
      stats.errors = await Submission.count({ where: { exam_id: { [Op.in]: examIds }, status: 'error' } });

      const subIds = (await Submission.findAll({ where: { exam_id: { [Op.in]: examIds } }, attributes: ['id'] })).map(s => s.id);
      stats.grades = subIds.length ? await Grade.count({ where: { submission_id: { [Op.in]: subIds } } }) : 0;
      stats.rubrics = await Rubric.count({ where: { exam_id: { [Op.in]: examIds } } });
    }
  }

  // Subscription info
  const now = new Date();
  let sub = await Subscription.findOne({
    where: { user_id: userId, scope: 'individual', status: 'active', end_date: { [Op.gt]: now } },
  });
  if (!sub && req.session.collegeId) {
    sub = await Subscription.findOne({
      where: { college_id: req.session.collegeId, status: 'active', end_date: { [Op.gt]: now } },
    });
  }
  const isFree = sub && (sub.plan === 'free' || sub.plan === 'trial');
  const freeInfo = isFree ? { used: user?.papers_graded_total || 0, limit: FREE_PAPER_LIMIT } : null;

  const hasAnyCourses = ownedCourses.length || taCourses.length || enrolledCourses.length;

  res.render('dashboard', {
    stats,
    ownedCourses,
    taCourses,
    enrolledCourses,
    hasAnyCourses,
    sub,
    freeInfo,
  });
}));

module.exports = router;

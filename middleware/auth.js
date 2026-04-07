const { Subscription, College, Course, Exam, Submission, Grade, Rubric, Student } = require('../models');
const { Op } = require('sequelize');

function ensureAuth(req, res, next) {
  if (req.session && req.session.userId) return next();
  req.flash('error', 'Please sign in to continue.');
  res.redirect('/login');
}

async function ensureSubscription(req, res, next) {
  if (!req.session || !req.session.userId) {
    req.flash('error', 'Please sign in to continue.');
    return res.redirect('/login');
  }

  const now = new Date();
  let activeSub = null;

  const individual = await Subscription.findOne({
    where: {
      user_id: req.session.userId,
      scope: 'individual',
      status: 'active',
      end_date: { [Op.gt]: now },
    },
  });
  if (individual) activeSub = individual;

  if (!activeSub && req.session.collegeId) {
    const college = await Subscription.findOne({
      where: {
        college_id: req.session.collegeId,
        scope: 'college',
        status: 'active',
        end_date: { [Op.gt]: now },
      },
    });
    if (college) activeSub = college;
  }

  if (activeSub) {
    req.subscription = activeSub;
    res.locals.subscription = activeSub;
    res.locals.planTier = activeSub.plan === 'trial' ? 'FREE' : 'PRO';
    res.locals.planLabel = activeSub.plan === 'trial'
      ? 'Free Trial'
      : activeSub.plan.charAt(0).toUpperCase() + activeSub.plan.slice(1);
    return next();
  }

  if (req.session.role === 'professor' && req.session.collegeId) {
    req.flash('error', 'Your college subscription has expired. Please ask your college admin to renew.');
  } else {
    req.flash('error', 'Your subscription has expired. Please renew to continue.');
  }
  res.redirect('/plans');
}

function ensureAdmin(req, res, next) {
  if (req.session && req.session.role === 'admin') return next();
  req.flash('error', 'Admin access required.');
  res.redirect('/dashboard');
}

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(err => {
      if (err.message === 'ACCESS_DENIED') {
        req.flash('error', 'You do not have permission to access that resource.');
        return res.redirect('/dashboard');
      }
      console.error(`[${req.method} ${req.originalUrl}]`, err.message);
      req.flash('error', 'Something went wrong. Please try again.');
      const back = req.get('Referer') || '/dashboard';
      return res.redirect(back);
    });
  };
}

async function assertCourseOwner(req, courseId) {
  const course = await Course.findOne({
    where: { id: courseId, user_id: req.session.userId }
  });
  if (!course) throw new Error('ACCESS_DENIED');
  return course;
}

async function assertExamOwner(req, examId) {
  const exam = await Exam.findOne({
    where: { id: examId },
    include: [{ model: Course, where: { user_id: req.session.userId } }]
  });
  if (!exam) throw new Error('ACCESS_DENIED');
  return exam;
}

async function assertSubmissionOwner(req, submissionId) {
  const sub = await Submission.findOne({
    where: { id: submissionId },
    include: [{ model: Exam, include: [{ model: Course, where: { user_id: req.session.userId } }] }]
  });
  if (!sub) throw new Error('ACCESS_DENIED');
  return sub;
}

async function assertGradeOwner(req, gradeId) {
  const grade = await Grade.findOne({
    where: { id: gradeId },
    include: [{ model: Submission, include: [{ model: Exam, include: [{ model: Course, where: { user_id: req.session.userId } }] }] }]
  });
  if (!grade) throw new Error('ACCESS_DENIED');
  return grade;
}

async function assertStudentOwner(req, studentId) {
  const student = await Student.findOne({
    where: { id: studentId },
    include: [{ model: Course, where: { user_id: req.session.userId } }]
  });
  if (!student) throw new Error('ACCESS_DENIED');
  return student;
}

module.exports = {
  ensureAuth, ensureSubscription, ensureAdmin, asyncHandler,
  assertCourseOwner, assertExamOwner, assertSubmissionOwner,
  assertGradeOwner, assertStudentOwner,
};

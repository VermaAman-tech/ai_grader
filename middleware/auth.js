const { Subscription, College, User, Course, Exam, Submission, Grade, Rubric, Student, CourseTA, CourseEnrollment } = require('../models');
const { Op } = require('sequelize');

const FREE_PAPER_LIMIT = 10;

function setSessionUser(session, user, extras = {}) {
  session.userId = user.id;
  session.userName = user.full_name;
  session.userEmail = user.email;
  session.email = user.email;
  session.role = extras.role || user.role || 'professor';
  session.collegeId = extras.collegeId !== undefined ? extras.collegeId : (user.college_id || null);
  session.collegeName = extras.collegeName !== undefined ? extras.collegeName : (user.College?.name || null);
  session.collegeType = extras.collegeType !== undefined ? extras.collegeType : (user.College?.type || null);
}

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
        status: 'active',
        end_date: { [Op.gt]: now },
      },
    });
    if (college) activeSub = college;
  }

  if (!activeSub) {
    const taAssignment = await CourseTA.findOne({
      where: { user_id: req.session.userId, status: 'active' },
      include: [{ model: Course }],
    });
    if (taAssignment) {
      const instructorSub = await Subscription.findOne({
        where: { user_id: taAssignment.Course.user_id, scope: 'individual', status: 'active', end_date: { [Op.gt]: now } },
      });
      if (instructorSub) activeSub = instructorSub;
    }
  }

  if (activeSub) {
    req.subscription = activeSub;
    res.locals.subscription = activeSub;
    const isFree = activeSub.plan === 'free' || activeSub.plan === 'trial';
    res.locals.planTier = isFree ? 'FREE' : 'PRO';
    res.locals.planLabel = isFree ? 'Free' : activeSub.plan.charAt(0).toUpperCase() + activeSub.plan.slice(1);

    if (isFree) {
      const user = await User.findByPk(req.session.userId);
      res.locals.papersUsed = user?.papers_graded_total || 0;
      res.locals.paperLimit = FREE_PAPER_LIMIT;
    }
    return next();
  }

  if (req.session.collegeId) {
    req.flash('error', 'Your institution\'s subscription has expired. Please ask your admin to renew.');
  } else {
    req.flash('error', 'No active plan. Please choose a plan to continue.');
  }
  res.redirect('/plans');
}

function ensureProfessor(req, res, next) {
  if (!req.session || !req.session.userId) {
    req.flash('error', 'Please sign in to continue.');
    return res.redirect('/login');
  }
  const role = req.session.role;
  if (role === 'student' || role === 'user') {
    req.flash('error', 'This area is for instructors only.');
    return res.redirect('/student/dashboard');
  }
  return next();
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
      if (req.originalUrl === '/dashboard') {
        return next(err);
      }
      req.flash('error', 'Something went wrong. Please try again.');
      const referer = req.get('referer');
      return res.redirect(referer || '/dashboard');
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

function ensureTA(req, res, next) {
  if (req.session && req.session.userId) {
    const taCheck = CourseTA.findOne({ where: { user_id: req.session.userId, status: 'active' } });
    return taCheck.then(ta => {
      if (ta) return next();
      req.flash('error', 'No active TA assignments.');
      res.redirect('/dashboard');
    }).catch(() => { res.redirect('/login'); });
  }
  req.flash('error', 'Please sign in to continue.');
  res.redirect('/login');
}

function asyncTA(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(err => {
      if (err.message === 'ACCESS_DENIED') {
        req.flash('error', 'You do not have permission to access that resource.');
        return res.redirect('/ta-portal/dashboard');
      }
      console.error(`[${req.method} ${req.originalUrl}]`, err.message);
      req.flash('error', 'Something went wrong. Please try again.');
      return res.redirect('/ta-portal/dashboard');
    });
  };
}

async function getTAAssignment(userId, courseId) {
  const ta = await CourseTA.findOne({
    where: { user_id: userId, course_id: courseId, status: 'active' },
  });
  if (!ta) return null;

  const permissions = {
    can_grade: ta.can_grade !== false,
    can_view_analytics: ta.can_view_analytics === true,
    can_manage_roster: ta.can_manage_roster === true,
    can_post_announcements: ta.can_post_announcements === true,
    can_access_cribs: ta.can_access_cribs === true,
    can_manage_docs: ta.can_manage_docs === true,
  };

  if (ta.role === 'head_ta') {
    Object.keys(permissions).forEach(k => { permissions[k] = true; });
  }

  // Backward compat: read from JSON if boolean columns are all default
  const ALLOWED_PERM_KEYS = new Set(Object.keys(permissions));
  if (!ta.can_grade && !ta.can_view_analytics && !ta.can_manage_roster) {
    try {
      const stored = JSON.parse(ta.assigned_students || '[]');
      if (stored && typeof stored === 'object' && !Array.isArray(stored) && stored.permissions) {
        for (const key of Object.keys(stored.permissions)) {
          if (ALLOWED_PERM_KEYS.has(key)) permissions[key] = !!stored.permissions[key];
        }
      }
    } catch {}
  }

  let assignedStudents = [];
  try {
    const stored = JSON.parse(ta.assigned_students || '[]');
    if (Array.isArray(stored)) assignedStudents = stored;
    else if (stored && stored.students) assignedStudents = stored.students;
  } catch {}

  let assignedQuestions = [];
  try { assignedQuestions = JSON.parse(ta.assigned_questions || '[]'); } catch {}

  return { ta, permissions, assignedStudents, assignedQuestions };
}

function ensureTAPerm(permission) {
  return async (req, res, next) => {
    const courseId = parseInt(req.params.courseId || req.body.course_id || req.query.course_id);
    if (!courseId) {
      req.flash('error', 'Course not specified.');
      return res.redirect('/ta-portal/dashboard');
    }
    const assignment = await getTAAssignment(req.session.userId, courseId);
    if (!assignment) {
      req.flash('error', 'You are not assigned to this course.');
      return res.redirect('/ta-portal/dashboard');
    }
    if (!assignment.permissions[permission]) {
      req.flash('error', 'You do not have permission for this action.');
      return res.redirect(`/ta-portal/course/${courseId}`);
    }
    req.taAssignment = assignment;
    next();
  };
}

module.exports = {
  setSessionUser,
  ensureAuth, ensureSubscription, ensureProfessor, ensureAdmin, asyncHandler,
  assertCourseOwner, assertExamOwner, assertSubmissionOwner,
  assertGradeOwner, assertStudentOwner,
  ensureTA, asyncTA, getTAAssignment, ensureTAPerm,
};

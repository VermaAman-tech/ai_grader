const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const { asyncHandler, setSessionUser } = require('../middleware/auth');

const studentOtpRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many code requests. Please try again later.',
});
const studentOtpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many attempts. Please try again later.',
});
const pollRespondLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 80,
  standardHeaders: true,
  legacyHeaders: false,
});
const { requireInt } = require('../middleware/validate');
const { User, Student, Course, Exam, Submission, Grade, Rubric, Crib, Announcement,
        ConceptNode, QuestionConcept, LivePoll, PollResponse, GradeBoundary,
        CourseDocument, DiscussionThread, DiscussionPost, ClassSession,
        CourseTA, CourseEnrollment } = require('../models');
const { Op } = require('sequelize');
const { generateOTP, storeOTP, verifyOTP, clearOTP } = require('../services/otp-store');
const { sendOtpEmail } = require('../services/email');
const { isLocked, recordFailure, resetFailures } = require('../services/otp-throttle');
const { UniqueConstraintError } = require('sequelize');

const DISCUSSION_MAX = 8000;
const POLL_RESPONSE_MAX = 2000;

function allowDevOtpExpose() {
  return process.env.NODE_ENV !== 'production' && process.env.DEV_OTP_EXPOSE === 'true';
}

function ensureStudent(req, res, next) {
  if (req.session && req.session.userId) {
    if (req.session.role === 'student') return next();
    const userId = req.session.userId;
    return Promise.all([
      Student.findOne({ where: { user_id: userId } }),
      CourseEnrollment.findOne({ where: { user_id: userId, role: 'student', status: 'active' } }),
      CourseTA.findOne({ where: { user_id: userId, status: 'active' } }),
    ]).then(([roster, enrollment, ta]) => {
      if (roster || enrollment || ta) return next();
      req.flash('error', 'No student enrollment found for your account.');
      return res.redirect('/dashboard');
    }).catch(() => res.redirect('/login'));
  }
  req.flash('error', 'Please sign in to continue.');
  res.redirect('/login');
}

async function getStudentTAAssignments(userId) {
  const tas = await CourseTA.findAll({
    where: { user_id: userId, status: 'active' },
    include: [{ model: Course }],
  });
  return tas.filter(t => t.Course).map(t => ({
    courseId: t.Course.id,
    courseCode: t.Course.code,
    courseName: t.Course.name,
    taId: t.id,
    role: t.role,
  }));
}

async function findStudentEnrollment(courseId, email, userId) {
  const roster = await Student.findOne({
    where: { course_id: courseId, email },
    include: [{ model: Course, include: [{ model: User, attributes: ['full_name'] }] }],
  });
  if (roster) return { roster, course: roster.Course };

  const ce = await CourseEnrollment.findOne({
    where: { course_id: courseId, user_id: userId, role: 'student', status: 'active' },
    include: [{ model: Course, include: [{ model: User, attributes: ['full_name'] }] }],
  });
  if (ce) return { roster: null, course: ce.Course };

  return null;
}

function clientIp(req) {
  return req.ip || req.connection?.remoteAddress || 'unknown';
}

router.get('/login', (req, res) => {
  if (req.session && req.session.userId) return res.redirect('/dashboard');
  res.redirect('/login');
});

router.post('/request-otp', studentOtpRequestLimiter, asyncHandler(async (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();
  if (!email) {
    req.flash('error', 'Please enter your email.');
    return res.redirect('/login');
  }

  const enrollment = await Student.findOne({ where: { email } });
  req.session.pendingStudentEmail = email;

  let mockOTP = null;
  if (enrollment) {
    let user = await User.findOne({ where: { email } });
    if (!user) {
      user = await User.create({
        full_name: enrollment.name,
        email,
        password_hash: User.hashPassword('otp-only-' + Date.now()),
        role: 'student',
        email_verified: true,
        college_id: null,
      });
      await Student.update({ user_id: user.id }, { where: { email } });
    }

    const otp = generateOTP();
    storeOTP(`student:${email}`, otp, 10 * 60 * 1000);
    if (allowDevOtpExpose()) mockOTP = otp;
    let sent = false;
    try {
      sent = await sendOtpEmail({
        to: email,
        code: otp,
        subject: 'Your Intelligrade student login code',
        intro: 'Use this code to sign in to the student portal:',
      });
    } catch (e) {
      console.error('[Student OTP email]', e.message);
    }
    if (!sent && process.env.NODE_ENV === 'production') {
      clearOTP(`student:${email}`);
      req.flash('error', 'We could not send a login code. Try again later or contact your instructor.');
      delete req.session.pendingStudentEmail;
      return req.session.save(() => res.redirect('/login'));
    }
    if (!sent && process.env.NODE_ENV !== 'production') {
      console.log(`[Student OTP] ${email}: ${otp}`);
    }
  }

  await new Promise(r => setTimeout(r, 50 + Math.floor(Math.random() * 120)));

  const msg = 'If this email is on your course roster, a login code has been sent. Enter it below.';
  req.session.save(() => {
    res.render('student-login', {
      layout: false,
      step: 'otp',
      email,
      mockOTP,
      error: [],
      success: [msg],
    });
  });
}));

router.post('/verify-otp', studentOtpVerifyLimiter, asyncHandler(async (req, res) => {
  const email = req.session.pendingStudentEmail;
  if (!email) return res.redirect('/login');

  const ip = clientIp(req);
  if (isLocked('otp-email', email) || isLocked('otp-ip', ip)) {
    req.flash('error', 'Too many attempts. Please wait before trying again.');
    return res.render('student-login', {
      layout: false, step: 'otp', email,
      mockOTP: null,
      error: req.flash('error'), success: [],
    });
  }

  const { otp } = req.body;
  const enrollment = await Student.findOne({ where: { email } });
  if (!enrollment || !verifyOTP(`student:${email}`, otp)) {
    if (enrollment) recordFailure('otp-email', email);
    recordFailure('otp-ip', ip);
    req.flash('error', 'Invalid or expired code. Please try again or request a new code.');
    return res.render('student-login', {
      layout: false, step: 'otp', email,
      mockOTP: null,
      error: req.flash('error'), success: [],
    });
  }

  const user = await User.findOne({ where: { email } });
  if (!user) return res.redirect('/login');

  resetFailures('otp-email', email);
  resetFailures('otp-ip', ip);

  req.session.regenerate(function (err) {
    if (err) {
      req.flash('error', 'Session error. Please try again.');
      return res.redirect('/login');
    }
    setSessionUser(req.session, user);
    delete req.session.pendingStudentEmail;
    req.session.save(() => res.redirect('/student/dashboard'));
  });
}));

router.post('/resend-otp', studentOtpRequestLimiter, asyncHandler(async (req, res) => {
  const email = req.session.pendingStudentEmail;
  if (!email) return res.redirect('/login');

  const enrollment = await Student.findOne({ where: { email } });
  if (!enrollment) {
    const msg = 'If this email is on your course roster, a login code has been sent. Enter it below.';
    return req.session.save(() => {
      res.render('student-login', {
        layout: false, step: 'otp', email,
        mockOTP: null,
        error: [], success: [msg],
      });
    });
  }

  const otp = generateOTP();
  storeOTP(`student:${email}`, otp, 10 * 60 * 1000);
  let sent = false;
  try {
    sent = await sendOtpEmail({
      to: email,
      code: otp,
      subject: 'Your new Intelligrade student login code',
      intro: 'Use this code to sign in to the student portal:',
    });
  } catch (e) {
    console.error('[Student OTP email]', e.message);
  }
  if (!sent && process.env.NODE_ENV === 'production') {
    req.flash('error', 'Could not send email. Try again later.');
    return req.session.save(() => res.redirect('/login'));
  }
  if (!sent && process.env.NODE_ENV !== 'production') {
    console.log(`[Student OTP Resend] ${email}: ${otp}`);
  }

  const msg = 'If this email is on your course roster, a login code has been sent. Enter it below.';
  const mockOTP = allowDevOtpExpose() ? otp : null;
  req.session.save(() => {
    res.render('student-login', {
      layout: false, step: 'otp', email,
      mockOTP,
      error: req.flash('error'), success: [msg],
    });
  });
}));

router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

router.get('/dashboard', ensureStudent, asyncHandler(async (req, res) => {
  const enrollments = await Student.findAll({
    where: { email: req.session.email },
    include: [{ model: Course, include: [{ model: User, attributes: ['full_name'] }] }],
  });

  const courseEnrollments = await CourseEnrollment.findAll({
    where: { user_id: req.session.userId, role: 'student', status: 'active' },
    include: [{ model: Course, include: [{ model: User, attributes: ['full_name'] }] }],
  });

  const seenCourseIds = new Set(enrollments.map(e => e.course_id));
  for (const ce of courseEnrollments) {
    if (ce.Course && !seenCourseIds.has(ce.course_id)) {
      seenCourseIds.add(ce.course_id);
      enrollments.push(ce);
    }
  }

  const courseIds = [...seenCourseIds];
  const studentIds = enrollments.filter(e => e.id && e.course_id).map(e => e.id);

  const announcements = courseIds.length ? await Announcement.findAll({
    where: { course_id: { [Op.in]: courseIds }, published_at: { [Op.lte]: new Date() } },
    include: [{ model: Course, attributes: ['name', 'code'] }],
    order: [['published_at', 'DESC']],
    limit: 10,
  }) : [];

  const submissions = studentIds.length ? await Submission.findAll({
    where: { student_id: { [Op.in]: studentIds }, status: 'done' },
    include: [{ model: Exam, where: { grades_released: true }, include: [{ model: Course }] }, { model: Student }],
    order: [['updated_at', 'DESC']],
    limit: 10,
  }).catch(() => []) : [];

  const totalExams = studentIds.length ? await Submission.count({ where: { student_id: { [Op.in]: studentIds } } }) : 0;

  const taAssignments = await getStudentTAAssignments(req.session.userId);

  res.render('student-dashboard', {
    layout: 'partials/student-layout',
    pageTitle: 'Dashboard',
    currentPage: 'dashboard',
    taAssignments,
    enrollments,
    announcements,
    recentGrades: submissions,
    stats: { totalCourses: courseIds.length, totalExams, gradedExams: submissions.length, taCount: taAssignments.length },
  });
}));

router.get('/courses', ensureStudent, asyncHandler(async (req, res) => {
  const enrollments = await Student.findAll({
    where: { email: req.session.email },
    include: [{ model: Course, include: [{ model: User, attributes: ['full_name'] }] }],
  });
  const courseEnrollments = await CourseEnrollment.findAll({
    where: { user_id: req.session.userId, role: 'student', status: 'active' },
    include: [{ model: Course, include: [{ model: User, attributes: ['full_name'] }] }],
  });
  const seenIds = new Set(enrollments.map(e => e.course_id));
  for (const ce of courseEnrollments) {
    if (ce.Course && !seenIds.has(ce.course_id)) {
      seenIds.add(ce.course_id);
      enrollments.push(ce);
    }
  }
  const taAssignments = await getStudentTAAssignments(req.session.userId);
  res.render('student-courses', {
    layout: 'partials/student-layout',
    pageTitle: 'My Courses',
    currentPage: 'courses',
    taAssignments,
    enrollments,
  });
}));

/* TA Panel — loaded via fetch inside the floating window */
router.get('/ta-panel/:courseId', ensureStudent, asyncHandler(async (req, res) => {
  const courseId = requireInt(req.params.courseId, 'Course');
  const ta = await CourseTA.findOne({
    where: { user_id: req.session.userId, course_id: courseId, status: 'active' },
    include: [{ model: Course, include: [{ model: User, attributes: ['full_name'] }] }],
  });
  if (!ta) return res.status(403).send('<p>You are not assigned as a TA for this course.</p>');

  const course = ta.Course;
  const exams = await Exam.findAll({ where: { course_id: courseId }, order: [['created_at', 'DESC']] });
  const examIds = exams.map(e => e.id);

  const pendingCount = examIds.length
    ? await Submission.count({ where: { exam_id: { [Op.in]: examIds }, status: 'pending' } })
    : 0;
  const gradedCount = examIds.length
    ? await Submission.count({ where: { exam_id: { [Op.in]: examIds }, status: 'done' } })
    : 0;
  const studentCount = await Student.count({ where: { course_id: courseId } });
  const announcements = await Announcement.findAll({
    where: { course_id: courseId },
    order: [['created_at', 'DESC']],
    limit: 5,
  });

  const permissions = {
    can_grade: ta.can_grade !== false,
    can_view_analytics: ta.can_view_analytics === true || ta.role === 'head_ta',
    can_manage_roster: ta.can_manage_roster === true || ta.role === 'head_ta',
    can_post_announcements: ta.can_post_announcements === true || ta.role === 'head_ta',
    can_access_cribs: ta.can_access_cribs === true || ta.role === 'head_ta',
    can_manage_docs: ta.can_manage_docs === true || ta.role === 'head_ta',
  };

  res.render('student-ta-panel', {
    layout: false,
    course,
    exams,
    ta,
    permissions,
    pendingCount,
    gradedCount,
    studentCount,
    announcements,
  });
}));

router.get('/course/:courseId', ensureStudent, asyncHandler(async (req, res) => {
  const courseId = requireInt(req.params.courseId, 'Course');
  const found = await findStudentEnrollment(courseId, req.session.email, req.session.userId);
  if (!found) throw new Error('ACCESS_DENIED');

  const { roster: enrollment, course } = found;

  const exams = await Exam.findAll({ where: { course_id: courseId }, order: [['created_at', 'DESC']] });

  const examResults = [];
  for (const exam of exams) {
    const sub = enrollment ? await Submission.findOne({
      where: { exam_id: exam.id, student_id: enrollment.id },
      include: [{ model: Grade, include: [{ model: Rubric }] }],
    }) : null;
    const grades = sub ? sub.Grades.map(g => ({
      ...g.toJSON(),
      effectiveMarks: g.override_marks !== null ? g.override_marks : g.awarded_marks,
    })) : [];
    const totalAwarded = grades.reduce((s, g) => s + g.effectiveMarks, 0);
    const totalMax = grades.reduce((s, g) => s + (g.Rubric?.max_marks || 0), 0);
    examResults.push({
      exam, sub, grades, totalAwarded, totalMax,
      released: exam.grades_released,
      pct: totalMax > 0 ? ((totalAwarded / totalMax) * 100).toFixed(1) : null,
    });
  }

  const announcements = await Announcement.findAll({
    where: { course_id: courseId, published_at: { [Op.lte]: new Date() } },
    order: [['published_at', 'DESC']],
  });

  const concepts = await ConceptNode.findAll({ where: { course_id: courseId } });

  const classSessions = await ClassSession.findAll({
    where: { course_id: courseId, status: 'completed' },
    order: [['session_date', 'DESC']],
    limit: 10,
  });

  const documents = await CourseDocument.findAll({
    where: { course_id: courseId, allow_download: true },
    order: [['created_at', 'DESC']],
  });

  const threads = await DiscussionThread.findAll({
    where: { course_id: courseId },
    include: [{ model: DiscussionPost, attributes: ['id'] }],
    order: [['created_at', 'DESC']],
    limit: 5,
  });

  const taAssignments = await getStudentTAAssignments(req.session.userId);
  res.render('student-course', {
    layout: 'partials/student-layout',
    pageTitle: course.code,
    currentPage: 'course-' + courseId,
    taAssignments,
    enrollment,
    course,
    examResults,
    announcements,
    concepts,
    classSessions,
    documents,
    threads,
  });
}));

router.get('/grades/:examId', ensureStudent, asyncHandler(async (req, res) => {
  const examId = requireInt(req.params.examId, 'Exam');
  const exam = await Exam.findByPk(examId, { include: [{ model: Course }] });
  if (!exam) throw new Error('ACCESS_DENIED');

  const found = await findStudentEnrollment(exam.course_id, req.session.email, req.session.userId);
  if (!found) throw new Error('ACCESS_DENIED');
  const enrollment = found.roster;

  if (!exam.grades_released) {
    req.flash('error', 'Grades have not been released yet.');
    return res.redirect(`/student/course/${exam.course_id}`);
  }

  const sub = enrollment ? await Submission.findOne({
    where: { exam_id: examId, student_id: enrollment.id },
    include: [{ model: Grade, include: [{ model: Rubric, include: [{ model: QuestionConcept, include: [ConceptNode] }] }] }],
  }) : null;

  if (!sub) {
    req.flash('error', 'No submission found for this exam.');
    return res.redirect(`/student/course/${exam.course_id}`);
  }

  const grades = (sub.Grades || [])
    .sort((a, b) => (a.Rubric?.question_order || 0) - (b.Rubric?.question_order || 0))
    .map(g => {
      let matched = [], missing = [];
      try { matched = JSON.parse(g.matched_points || '[]'); } catch {}
      try { missing = JSON.parse(g.missing_points || '[]'); } catch {}
      const concepts = (g.Rubric?.QuestionConcepts || []).map(qc => qc.ConceptNode?.name).filter(Boolean);
      return {
        ...g.toJSON(),
        parsedMatched: matched,
        parsedMissing: missing,
        effectiveMarks: g.override_marks !== null ? g.override_marks : g.awarded_marks,
        concepts,
      };
    });

  const totalAwarded = grades.reduce((s, g) => s + g.effectiveMarks, 0);
  const totalMax = grades.reduce((s, g) => s + (g.Rubric?.max_marks || 0), 0);

  const existingCribs = await Crib.findAll({
    where: { exam_id: examId, student_id: enrollment.id },
  });

  const course = exam.Course;
  const cribDeadline = exam.grades_released_at
    ? new Date(new Date(exam.grades_released_at).getTime() + (course.crib_window_hours || 48) * 3600000)
    : null;
  const canCrib = cribDeadline ? new Date() < cribDeadline : false;

  const taAssignments = await getStudentTAAssignments(req.session.userId);
  res.render('student-grades', {
    layout: 'partials/student-layout',
    pageTitle: exam.name + ' Grades',
    currentPage: 'grades-' + examId,
    taAssignments,
    exam, course, sub, grades, totalAwarded, totalMax,
    existingCribs, canCrib, cribDeadline,
    enrollment,
  });
}));

router.post('/crib', ensureStudent, asyncHandler(async (req, res) => {
  const { grade_id, exam_id, question_no, student_reasoning } = req.body;
  const gradeId = requireInt(grade_id, 'Grade');
  const examId = requireInt(exam_id, 'Exam');

  const exam = await Exam.findByPk(examId, { include: [{ model: Course }] });
  if (!exam || !exam.grades_released) {
    req.flash('error', 'Regrade requests are not available until grades are released.');
    return res.redirect(exam ? `/student/course/${exam.course_id}` : '/student/dashboard');
  }

  const found = await findStudentEnrollment(exam.course_id, req.session.email, req.session.userId);
  if (!found || !found.roster) throw new Error('ACCESS_DENIED');
  const enrollment = found.roster;

  const course = exam.Course;
  const cribDeadline = exam.grades_released_at
    ? new Date(new Date(exam.grades_released_at).getTime() + (course.crib_window_hours || 48) * 3600000)
    : null;
  if (!cribDeadline || new Date() >= cribDeadline) {
    req.flash('error', 'The regrade request window for this exam has closed.');
    return res.redirect(`/student/grades/${examId}`);
  }

  const grade = await Grade.findOne({
    where: { id: gradeId },
    include: [{ model: Submission, required: true, include: [{ model: Exam, required: true }] }],
  });
  if (!grade || grade.Submission.exam_id !== examId || grade.Submission.student_id !== enrollment.id) {
    req.flash('error', 'Invalid grade or exam for your account.');
    return res.redirect(`/student/grades/${examId}`);
  }

  try {
    await Crib.create({
      grade_id: gradeId,
      student_id: enrollment.id,
      exam_id: examId,
      question_no: (question_no || '').toString().slice(0, 50),
      student_reasoning: (student_reasoning || '').toString().trim().slice(0, 5000) || '(no text)',
      status: 'pending',
    });
  } catch (e) {
    if (e instanceof UniqueConstraintError) {
      req.flash('error', 'You already submitted a regrade request for this question.');
      return res.redirect(`/student/grades/${examId}`);
    }
    throw e;
  }

  req.flash('success', 'Crib submitted successfully. You will be notified once it is reviewed.');
  res.redirect(`/student/grades/${examId}`);
}));

router.get('/poll/:roomCode', (req, res) => {
  res.render('student-poll', { layout: false, roomCode: req.params.roomCode });
});

router.post('/poll/:roomCode/respond', pollRespondLimiter, asyncHandler(async (req, res) => {
  const poll = await LivePoll.findOne({ where: { room_code: req.params.roomCode.trim(), is_active: true } });
  if (!poll) return res.status(404).json({ error: 'Poll not found or closed' });

  const response = String(req.body.response || '').trim().slice(0, POLL_RESPONSE_MAX);
  const response_name = String(req.body.name || 'Anonymous').trim().slice(0, 200);
  if (!response) return res.status(400).json({ error: 'Response required' });

  await PollResponse.create({
    poll_id: poll.id,
    response,
    response_name,
    user_id: req.session?.userId || null,
  });
  res.json({ ok: true });
}));

router.get('/discussions/:courseId', ensureStudent, asyncHandler(async (req, res) => {
  const courseId = requireInt(req.params.courseId, 'Course');
  const found = await findStudentEnrollment(courseId, req.session.email, req.session.userId);
  if (!found) throw new Error('ACCESS_DENIED');
  const enrollment = found.roster;
  const courseObj = found.course;

  const threads = await DiscussionThread.findAll({
    where: { course_id: courseId },
    include: [
      { model: User, attributes: ['full_name', 'role'] },
      { model: DiscussionPost, attributes: ['id'] },
    ],
    order: [['is_pinned', 'DESC'], ['created_at', 'DESC']],
  });

  const taAssignments = await getStudentTAAssignments(req.session.userId);
  res.render('student-discussions', { layout: 'partials/student-layout', pageTitle: 'Discussions', currentPage: 'discussions', taAssignments, course: courseObj, threads, enrollment });
}));

router.get('/discussion-thread/:threadId', ensureStudent, asyncHandler(async (req, res) => {
  const threadId = requireInt(req.params.threadId, 'Thread');
  const thread = await DiscussionThread.findOne({
    where: { id: threadId },
    include: [
      { model: Course },
      { model: User, attributes: ['full_name', 'role'] },
    ],
  });
  if (!thread) throw new Error('ACCESS_DENIED');

  const found = await findStudentEnrollment(thread.course_id, req.session.email, req.session.userId);
  if (!found) throw new Error('ACCESS_DENIED');
  const enrollment = found.roster;

  thread.view_count += 1;
  await thread.save();

  const posts = await DiscussionPost.findAll({
    where: { thread_id: threadId },
    include: [{ model: User, attributes: ['full_name', 'role'] }],
    order: [['created_at', 'ASC']],
  });

  const taAssignments = await getStudentTAAssignments(req.session.userId);
  res.render('student-discussion-thread', { layout: 'partials/student-layout', pageTitle: thread.title, currentPage: 'discussions', taAssignments, thread, posts, course: thread.Course, enrollment });
}));

router.post('/discussion-reply/:threadId', ensureStudent, asyncHandler(async (req, res) => {
  const threadId = requireInt(req.params.threadId, 'Thread');
  const thread = await DiscussionThread.findByPk(threadId);
  if (!thread) throw new Error('ACCESS_DENIED');

  const found = await findStudentEnrollment(thread.course_id, req.session.email, req.session.userId);
  if (!found) throw new Error('ACCESS_DENIED');

  const content = (req.body.content || '').trim().slice(0, DISCUSSION_MAX);
  if (!content) {
    req.flash('error', 'Reply cannot be empty.');
    return res.redirect(`/student/discussion-thread/${threadId}`);
  }

  await DiscussionPost.create({
    thread_id: threadId,
    user_id: req.session.userId,
    content,
    is_anonymous: req.body.is_anonymous === 'on',
  });

  req.flash('success', 'Reply posted.');
  res.redirect(`/student/discussion-thread/${threadId}`);
}));

module.exports = router;

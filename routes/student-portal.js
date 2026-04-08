const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const { asyncHandler } = require('../middleware/auth');

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
        CourseDocument, DiscussionThread, DiscussionPost, ClassSession } = require('../models');
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
  if (req.session && req.session.userId && req.session.role === 'student') return next();
  req.flash('error', 'Please sign in as a student.');
  res.redirect('/student/login');
}

function clientIp(req) {
  return req.ip || req.connection?.remoteAddress || 'unknown';
}

router.get('/login', (req, res) => {
  res.render('student-login', {
    layout: false,
    error: req.flash('error'),
    success: req.flash('success'),
    step: 'email',
    email: '',
    mockOTP: null,
  });
});

router.post('/request-otp', studentOtpRequestLimiter, asyncHandler(async (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();
  if (!email) {
    req.flash('error', 'Please enter your email.');
    return res.redirect('/student/login');
  }

  const enrollment = await Student.findOne({ where: { email } });
  req.session.pendingStudentEmail = email;

  let mockOTP = null;
  if (enrollment) {
    let user = await User.findOne({ where: { email, role: 'student' } });
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
      return req.session.save(() => res.redirect('/student/login'));
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
  if (!email) return res.redirect('/student/login');

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

  const user = await User.findOne({ where: { email, role: 'student' } });
  if (!user) return res.redirect('/student/login');

  resetFailures('otp-email', email);
  resetFailures('otp-ip', ip);

  req.session.regenerate(function (err) {
    if (err) {
      req.flash('error', 'Session error. Please try again.');
      return res.redirect('/student/login');
    }
    req.session.userId = user.id;
    req.session.userName = user.full_name;
    req.session.role = 'student';
    req.session.email = user.email;
    delete req.session.pendingStudentEmail;

    req.session.save(() => res.redirect('/student/dashboard'));
  });
}));

router.post('/resend-otp', studentOtpRequestLimiter, asyncHandler(async (req, res) => {
  const email = req.session.pendingStudentEmail;
  if (!email) return res.redirect('/student/login');

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
    return req.session.save(() => res.redirect('/student/login'));
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
  req.session.destroy(() => res.redirect('/student/login'));
});

router.get('/dashboard', ensureStudent, asyncHandler(async (req, res) => {
  const enrollments = await Student.findAll({
    where: { email: req.session.email },
    include: [{ model: Course, include: [{ model: User, attributes: ['full_name'] }] }],
  });

  const courseIds = enrollments.map(e => e.course_id);
  const studentIds = enrollments.map(e => e.id);

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

  const conceptMastery = {};
  for (const sid of studentIds) {
    const grades = await Grade.findAll({
      include: [
        { model: Submission, required: true, where: { student_id: sid } },
        { model: Rubric, include: [{ model: QuestionConcept, include: [ConceptNode] }] },
      ],
    });
    for (const g of grades) {
      const maxMarks = g.Rubric?.max_marks || 1;
      const effective = g.override_marks !== null ? g.override_marks : g.awarded_marks;
      const pct = (effective / maxMarks) * 100;
      const concepts = g.Rubric?.QuestionConcepts || [];
      for (const qc of concepts) {
        const name = qc.ConceptNode?.name;
        if (!name) continue;
        if (!conceptMastery[name]) conceptMastery[name] = { total: 0, count: 0 };
        conceptMastery[name].total += pct;
        conceptMastery[name].count += 1;
      }
    }
  }
  const masteryList = Object.entries(conceptMastery)
    .map(([name, d]) => ({ name, avg: Math.round(d.total / d.count), count: d.count }))
    .sort((a, b) => a.avg - b.avg);

  res.render('student-dashboard', {
    layout: false,
    enrollments,
    announcements,
    recentGrades: submissions,
    stats: { totalCourses: courseIds.length, totalExams, gradedExams: submissions.length },
    conceptMastery: masteryList,
  });
}));

router.get('/course/:courseId', ensureStudent, asyncHandler(async (req, res) => {
  const courseId = requireInt(req.params.courseId, 'Course');
  const enrollment = await Student.findOne({
    where: { course_id: courseId, email: req.session.email },
    include: [{ model: Course, include: [{ model: User, attributes: ['full_name'] }] }],
  });
  if (!enrollment) throw new Error('ACCESS_DENIED');

  const exams = await Exam.findAll({ where: { course_id: courseId }, order: [['created_at', 'DESC']] });

  const examResults = [];
  for (const exam of exams) {
    const sub = await Submission.findOne({
      where: { exam_id: exam.id, student_id: enrollment.id },
      include: [{ model: Grade, include: [{ model: Rubric }] }],
    });
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

  res.render('student-course', {
    layout: false,
    enrollment,
    course: enrollment.Course,
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

  const enrollment = await Student.findOne({
    where: { course_id: exam.course_id, email: req.session.email },
  });
  if (!enrollment) throw new Error('ACCESS_DENIED');

  if (!exam.grades_released) {
    req.flash('error', 'Grades have not been released yet.');
    return res.redirect(`/student/course/${exam.course_id}`);
  }

  const sub = await Submission.findOne({
    where: { exam_id: examId, student_id: enrollment.id },
    include: [{ model: Grade, include: [{ model: Rubric, include: [{ model: QuestionConcept, include: [ConceptNode] }] }] }],
  });

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

  res.render('student-grades', {
    layout: false,
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

  const enrollment = await Student.findOne({
    where: { course_id: exam.course_id, email: req.session.email },
  });
  if (!enrollment) throw new Error('ACCESS_DENIED');

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
  const enrollment = await Student.findOne({
    where: { course_id: courseId, email: req.session.email },
    include: [{ model: Course }],
  });
  if (!enrollment) throw new Error('ACCESS_DENIED');

  const threads = await DiscussionThread.findAll({
    where: { course_id: courseId },
    include: [
      { model: User, attributes: ['full_name', 'role'] },
      { model: DiscussionPost, attributes: ['id'] },
    ],
    order: [['is_pinned', 'DESC'], ['created_at', 'DESC']],
  });

  res.render('student-discussions', { layout: false, course: enrollment.Course, threads, enrollment });
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

  const enrollment = await Student.findOne({
    where: { course_id: thread.course_id, email: req.session.email },
  });
  if (!enrollment) throw new Error('ACCESS_DENIED');

  thread.view_count += 1;
  await thread.save();

  const posts = await DiscussionPost.findAll({
    where: { thread_id: threadId },
    include: [{ model: User, attributes: ['full_name', 'role'] }],
    order: [['created_at', 'ASC']],
  });

  res.render('student-discussion-thread', { layout: false, thread, posts, course: thread.Course, enrollment });
}));

router.post('/discussion-reply/:threadId', ensureStudent, asyncHandler(async (req, res) => {
  const threadId = requireInt(req.params.threadId, 'Thread');
  const thread = await DiscussionThread.findByPk(threadId);
  if (!thread) throw new Error('ACCESS_DENIED');

  const enrollment = await Student.findOne({
    where: { course_id: thread.course_id, email: req.session.email },
  });
  if (!enrollment) throw new Error('ACCESS_DENIED');

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

const router = require('express').Router();
const { ensureAuth, asyncHandler } = require('../middleware/auth');
const { Course, Student, CourseEnrollment, CourseTA, User } = require('../models');

router.get('/', (req, res) => {
  if (!req.session.userId) {
    return res.render('join-course-public', { layout: false, code: req.query.code || '' });
  }
  res.render('join-course', { layout: false, code: req.query.code || '' });
});

router.get('/:code', (req, res, next) => {
  if (!req.session.userId) {
    req.session.pendingJoinCode = req.params.code;
    req.session.pendingJoinRole = req.query.role || null;
    req.flash('success', 'Sign in or create an account to join the course.');
    return req.session.save(() => res.redirect('/login'));
  }
  next();
}, asyncHandler(async (req, res) => {
  const course = await Course.findOne({
    where: { join_code: req.params.code },
    include: [{ model: User, attributes: ['full_name'] }],
  });
  if (!course) {
    req.flash('error', 'Invalid join code. Please check and try again.');
    return res.redirect('/courses/join');
  }
  if (!course.allow_join) {
    req.flash('error', 'This course is not accepting new members.');
    return res.redirect('/dashboard');
  }

  const existing = await CourseEnrollment.findOne({
    where: { course_id: course.id, user_id: req.session.userId },
  });
  if (existing) {
    req.flash('success', `You are already enrolled in "${course.name}".`);
    const dest = req.session.role === 'student' || req.session.role === 'user'
      ? '/student/dashboard' : '/dashboard';
    return res.redirect(dest);
  }

  res.render('join-course-confirm', {
    layout: false,
    course: course.toJSON(),
    professor: course.User?.full_name || 'Unknown',
    code: req.params.code,
    preselectedRole: req.query.role || 'student',
  });
}));

router.post('/', ensureAuth, asyncHandler(async (req, res) => {
  const code = (req.body.code || '').trim().toUpperCase();
  const role = req.body.role || 'student';

  const studentDest = '/student/dashboard';
  const profDest = '/dashboard';
  const isStudent = req.session.role === 'student' || req.session.role === 'user';
  const defaultDest = isStudent ? studentDest : profDest;

  if (!code) {
    req.flash('error', 'Please enter a join code.');
    return res.redirect('/courses/join');
  }

  const course = await Course.findOne({ where: { join_code: code } });
  if (!course) {
    req.flash('error', 'Invalid join code. Please check and try again.');
    return res.redirect('/courses/join');
  }
  if (!course.allow_join) {
    req.flash('error', 'This course is not accepting new members.');
    return res.redirect(defaultDest);
  }

  const existing = await CourseEnrollment.findOne({
    where: { course_id: course.id, user_id: req.session.userId },
  });
  if (existing) {
    req.flash('success', `You are already enrolled in "${course.name}".`);
    return res.redirect(defaultDest);
  }

  // TA is invite-only: only allow role=ta if a CourseTA invitation exists
  let enrollRole = 'student';
  if (role === 'ta') {
    const taInvite = await CourseTA.findOne({
      where: { course_id: course.id, email: req.session.email },
    });
    if (taInvite) {
      enrollRole = 'ta';
    } else {
      req.flash('error', 'TA access requires an invitation from the professor. You have been enrolled as a student.');
    }
  }

  await CourseEnrollment.create({
    course_id: course.id,
    user_id: req.session.userId,
    role: enrollRole,
    status: 'active',
    join_method: 'code',
  });

  const user = await User.findByPk(req.session.userId);
  if (user && enrollRole === 'student') {
    await Student.update(
      { user_id: user.id },
      { where: { course_id: course.id, email: user.email, user_id: null } }
    );
  }

  if (user && enrollRole === 'ta') {
    await CourseTA.update(
      { user_id: user.id, status: 'active' },
      { where: { course_id: course.id, email: user.email, user_id: null } }
    );
  }

  req.flash('success', `Joined "${course.name}" as ${enrollRole === 'ta' ? 'Teaching Assistant' : 'student'}.`);
  res.redirect(defaultDest);
}));

module.exports = router;

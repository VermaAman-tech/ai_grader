const router = require('express').Router();
const crypto = require('crypto');
const { User, College, Subscription, CourseTA, Student, CourseEnrollment, PasswordReset } = require('../models');
const { asyncHandler, setSessionUser } = require('../middleware/auth');
const { Op } = require('sequelize');
const { generateOTP, storeOTP, verifyOTP } = require('../services/otp-store');
const { sendOtpEmail } = require('../services/email');
const { isLocked, recordFailure, resetFailures } = require('../services/otp-throttle');

function getPostLoginRedirect(session) {
  const code = session.pendingJoinCode;
  const role = session.pendingJoinRole;
  if (code) {
    delete session.pendingJoinCode;
    delete session.pendingJoinRole;
    return `/courses/join/${code}${role ? '?role=' + role : ''}`;
  }
  if (session.role === 'student' || session.role === 'user') {
    return '/student/dashboard';
  }
  return '/dashboard';
}

const FREE_PAPER_LIMIT = 10;

const PLAN_DURATIONS = {
  free:       36500,
  trial:      14,
  monthly:    30,
  quarterly:  90,
  semiannual: 180,
  annual:     365,
};

const FREE_SUBSCRIBE_PLANS = new Set(['free', 'trial']);

function allowDevOtpExpose() {
  return process.env.NODE_ENV !== 'production' && process.env.DEV_OTP_EXPOSE === 'true';
}

// ─── LOGIN ───
router.get('/login', (req, res) => {
  if (req.session.userId) return res.redirect(getPostLoginRedirect(req.session));
  res.render('login', { layout: false, pendingJoin: req.session.pendingJoinCode || null });
});

router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    req.flash('error', 'Email and password are required.');
    return res.redirect('/login');
  }

  const cleanEmail = (email || '').trim().toLowerCase();
  const user = await User.findOne({ where: { email: cleanEmail }, include: [College] });
  if (!user || !user.checkPassword(password)) {
    req.flash('error', 'Invalid email or password.');
    return res.redirect('/login');
  }
  if (!user.email_verified) {
    req.flash('error', 'Please verify your email before signing in. Check your inbox for the code, or register again to resend.');
    return res.redirect('/login');
  }
  if (!user.is_active) {
    req.flash('error', 'Account is deactivated. Contact your administrator.');
    return res.redirect('/login');
  }

  // Link any pending TA invitations
  const taInvites = await CourseTA.findAll({
    where: { email: cleanEmail, user_id: null },
  });
  for (const a of taInvites) {
    a.user_id = user.id;
    if (a.status === 'pending') a.status = 'active';
    await a.save();
  }

  // Link any pending student roster entries
  await Student.update({ user_id: user.id }, { where: { email: cleanEmail, user_id: null } });

  const pendingJoin = req.session.pendingJoinCode;
  const pendingJoinRole = req.session.pendingJoinRole;

  req.session.regenerate(function (err) {
    if (err) { req.flash('error', 'Session error.'); return res.redirect('/login'); }
    setSessionUser(req.session, user);
    if (pendingJoin) {
      req.session.pendingJoinCode = pendingJoin;
      req.session.pendingJoinRole = pendingJoinRole;
    }
    const dest = getPostLoginRedirect(req.session);
    req.session.save(() => res.redirect(dest));
  });
}));

// ─── OTP LOGIN (passwordless, available for any user) ───
router.post('/request-otp', asyncHandler(async (req, res) => {
  const cleanEmail = (req.body.email || '').trim().toLowerCase();
  if (!cleanEmail) {
    req.flash('error', 'Please enter your email.');
    return res.redirect('/login');
  }

  const user = await User.findOne({ where: { email: cleanEmail } });
  req.session.pendingOtpEmail = cleanEmail;
  let devOtp = null;

  if (user && user.email_verified) {
    const otp = generateOTP();
    storeOTP(`login:${cleanEmail}`, otp, 10 * 60 * 1000);
    if (allowDevOtpExpose()) devOtp = otp;
    let sent = false;
    try {
      sent = await sendOtpEmail({
        to: cleanEmail,
        code: otp,
        subject: 'Your Intelligrade login code',
        intro: 'Use this code to sign in:',
      });
    } catch (e) {
      console.error('[OTP email]', e.message);
    }
    if (!sent && process.env.NODE_ENV !== 'production') {
      console.log(`[Login OTP] ${cleanEmail}: ${otp}`);
    }
  }

  await new Promise(r => setTimeout(r, 50 + Math.floor(Math.random() * 120)));
  req.flash('success', 'If an account exists for this email, a login code has been sent.');
  req.session.save(() => res.render('otp-verify', {
    layout: false,
    email: cleanEmail,
    mockOTP: devOtp,
  }));
}));

router.post('/verify-login-otp', asyncHandler(async (req, res) => {
  const email = req.session.pendingOtpEmail;
  if (!email) return res.redirect('/login');

  if (isLocked('login-otp', email)) {
    req.flash('error', 'Too many failed attempts. Please wait 15 minutes and request a new code.');
    return res.redirect('/login');
  }

  const { otp } = req.body;
  if (!verifyOTP(`login:${email}`, otp)) {
    recordFailure('login-otp', email);
    req.flash('error', 'Invalid or expired code. Please try again.');
    return res.render('otp-verify', { layout: false, email, mockOTP: null });
  }
  resetFailures('login-otp', email);

  const user = await User.findOne({ where: { email }, include: [College] });
  if (!user) return res.redirect('/login');

  await Student.update({ user_id: user.id }, { where: { email, user_id: null } });
  const taInvites = await CourseTA.findAll({ where: { email, user_id: null } });
  for (const a of taInvites) { a.user_id = user.id; if (a.status === 'pending') a.status = 'active'; await a.save(); }

  const pendingJoin = req.session.pendingJoinCode;
  const pendingJoinRole = req.session.pendingJoinRole;

  req.session.regenerate(function (err) {
    if (err) { req.flash('error', 'Session error.'); return res.redirect('/login'); }
    setSessionUser(req.session, user);
    delete req.session.pendingOtpEmail;
    if (pendingJoin) {
      req.session.pendingJoinCode = pendingJoin;
      req.session.pendingJoinRole = pendingJoinRole;
    }
    const dest = getPostLoginRedirect(req.session);
    req.session.save(() => res.redirect(dest));
  });
}));

// ─── REGISTER (role-agnostic) ───
router.get('/register', (req, res) => {
  if (req.session.userId) return res.redirect(getPostLoginRedirect(req.session));
  res.render('register', { layout: false, pendingJoin: req.session.pendingJoinCode || null });
});

router.post('/register', asyncHandler(async (req, res) => {
  const { full_name, email, phone, password, confirm_password, role, admin_type, institution_name, department } = req.body;
  const errors = [];

  if (!full_name || full_name.trim().length < 2) errors.push('Full name is required.');
  if (full_name && full_name.length > 200) errors.push('Name is too long (200 char max).');
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) errors.push('A valid email is required.');
  if (cleanEmail.length > 254) errors.push('Email is too long.');
  const cleanPhone = (phone || '').replace(/[^0-9+]/g, '');
  if (cleanPhone && cleanPhone.length < 8) errors.push('Enter a valid phone number.');
  if (cleanPhone && cleanPhone.length > 20) errors.push('Phone number is too long.');
  if (!password || password.length < 6) errors.push('Password must be at least 6 characters.');
  if (password && password.length > 128) errors.push('Password is too long (128 char max).');
  if (password !== confirm_password) errors.push('Passwords do not match.');
  if (department && department.length > 200) errors.push('Department name is too long.');

  if (errors.length) {
    errors.forEach(e => req.flash('error', e));
    return res.redirect('/register');
  }

  const existing = await User.findOne({ where: { email: cleanEmail } });
  if (existing) {
    req.flash('error', 'An account with this email already exists.');
    return res.redirect('/register');
  }

  const domain = cleanEmail.split('@')[1];
  let college = null;
  let userRole = role || 'professor';
  let pendingAdminCollege = null;

  const selectedRole = userRole;

  if (userRole === 'student') {
    college = null;
  } else if (userRole === 'admin') {
    if (!institution_name || institution_name.trim().length < 2) {
      req.flash('error', 'Institution name is required.');
      return res.redirect('/register');
    }
    const taken = await College.findOne({ where: { domain } });
    if (taken) {
      req.flash('error', `An institution is already registered for @${domain}. Join as a member instead.`);
      return res.redirect('/register');
    }
    pendingAdminCollege = { name: institution_name.trim(), domain, type: admin_type || 'college' };
  } else {
    college = await College.findOne({ where: { domain } });
    if (!college && selectedRole !== 'professor') {
      userRole = 'individual';
    }
  }

  const resolvedDbRole = userRole === 'student' ? 'student'
    : userRole === 'admin' ? 'admin'
    : 'professor';

  const user = await User.create({
    college_id: college?.id || null,
    full_name: full_name.trim(),
    email: cleanEmail,
    phone: cleanPhone || null,
    password_hash: User.hashPassword(password),
    role: resolvedDbRole,
    department: (department || '').trim() || null,
    email_verified: false,
    phone_verified: false,
  });

  // Link any pending TA invitations or student roster entries
  await Student.update({ user_id: user.id }, { where: { email: cleanEmail, user_id: null } });
  await CourseTA.update({ user_id: user.id, status: 'active' }, { where: { email: cleanEmail, user_id: null } });

  const otp = generateOTP();
  storeOTP(`email:${cleanEmail}`, otp, 5 * 60 * 1000);
  let sent = false;
  try {
    sent = await sendOtpEmail({
      to: cleanEmail,
      code: otp,
      subject: 'Verify your Intelligrade account',
      intro: 'Use this code to verify your email:',
    });
  } catch (e) {
    console.error('[OTP email]', e.message);
  }
  const isProd = process.env.NODE_ENV === 'production';
  if (!sent && isProd) {
    await user.destroy();
    req.flash('error', 'We could not send the verification email. Configure SMTP and try again.');
    return res.redirect('/register');
  }
  if (!sent && !isProd) {
    console.log(`[OTP] Email verification for ${cleanEmail}: ${otp} (SMTP not configured)`);
  }

  req.session.pendingUserId = user.id;
  req.session.pendingEmail = cleanEmail;
  req.session.pendingRole = userRole;
  req.session.pendingCollegeId = college?.id || null;
  req.session.pendingCollegeName = college?.name || null;
  req.session.pendingCollegeType = college?.type || null;
  req.session.pendingAdminCollege = pendingAdminCollege;
  // pendingJoinCode/pendingJoinRole are already on the session from the join redirect

  if (allowDevOtpExpose()) req.session.devOtpPreview = otp;
  else delete req.session.devOtpPreview;

  if (resolvedDbRole !== 'student' && !college) {
    const now = new Date();
    const end = new Date(now);
    end.setDate(end.getDate() + PLAN_DURATIONS.free);
    await Subscription.create({
      user_id: user.id,
      plan: 'free',
      scope: 'individual',
      start_date: now,
      end_date: end,
      status: 'active',
      amount: 0,
    });
  }

  req.session.save(() => res.redirect('/verify-email'));
}));

// ─── EMAIL VERIFICATION ───
router.get('/verify-email', (req, res) => {
  if (!req.session.pendingUserId) return res.redirect('/register');
  const mockOTP = allowDevOtpExpose() ? req.session.devOtpPreview : null;
  res.render('verify-email', {
    layout: false,
    email: req.session.pendingEmail,
    mockOTP,
  });
});

router.post('/verify-email', asyncHandler(async (req, res) => {
  const { otp } = req.body;
  if (!req.session.pendingUserId) return res.redirect('/register');

  const email = req.session.pendingEmail;

  if (isLocked('email-otp', email)) {
    req.flash('error', 'Too many failed attempts. Please wait 15 minutes and request a new code.');
    return res.redirect('/verify-email');
  }

  if (!verifyOTP(`email:${email}`, otp)) {
    recordFailure('email-otp', email);
    req.flash('error', 'Invalid or expired OTP. Please try again.');
    return res.redirect('/verify-email');
  }
  resetFailures('email-otp', email);

  const user = await User.findByPk(req.session.pendingUserId, { include: [College] });
  if (!user) return res.redirect('/register');

  user.email_verified = true;

  const role = req.session.pendingRole;
  const pendingAdminCollege = req.session.pendingAdminCollege;
  let collegeId = req.session.pendingCollegeId;
  let collegeName = req.session.pendingCollegeName;
  let collegeType = req.session.pendingCollegeType;

  if (pendingAdminCollege) {
    const created = await College.create({
      name: pendingAdminCollege.name,
      domain: pendingAdminCollege.domain,
      type: pendingAdminCollege.type || 'college',
    });
    user.college_id = created.id;
    collegeId = created.id;
    collegeName = created.name;
    collegeType = created.type;
  }

  await user.save();

  const pendingJoin = req.session.pendingJoinCode;
  const pendingJoinRole = req.session.pendingJoinRole;

  delete req.session.pendingAdminCollege;
  delete req.session.devOtpPreview;

  req.session.regenerate(function (err) {
    if (err) { req.flash('error', 'Session error.'); return res.redirect('/login'); }
    setSessionUser(req.session, user, { collegeId, collegeName, collegeType });
    if (pendingJoin) {
      req.session.pendingJoinCode = pendingJoin;
      req.session.pendingJoinRole = pendingJoinRole;
    }

    req.session.save(() => {
      if (role === 'admin') {
        req.flash('success', 'Email verified! Choose a plan for your institution.');
        return res.redirect('/plans');
      }
      req.flash('success', 'Email verified! Welcome to Intelligrade.');
      const dest = getPostLoginRedirect(req.session);
      res.redirect(dest);
    });
  });
}));

router.post('/resend-otp', asyncHandler(async (req, res) => {
  if (!req.session.pendingEmail) return res.redirect('/register');
  const otp = generateOTP();
  storeOTP(`email:${req.session.pendingEmail}`, otp, 5 * 60 * 1000);
  let sent = false;
  try {
    sent = await sendOtpEmail({
      to: req.session.pendingEmail,
      code: otp,
      subject: 'Your new Intelligrade verification code',
      intro: 'Use this code to verify your email:',
    });
  } catch (e) {
    console.error('[OTP email]', e.message);
  }
  if (!sent && process.env.NODE_ENV === 'production') {
    req.flash('error', 'Could not send email. Check SMTP configuration.');
    return req.session.save(() => res.redirect('/verify-email'));
  }
  if (!sent && process.env.NODE_ENV !== 'production') {
    console.log(`[OTP] Resent for ${req.session.pendingEmail}: ${otp}`);
  }
  if (allowDevOtpExpose()) req.session.devOtpPreview = otp;
  else delete req.session.devOtpPreview;
  req.flash('success', 'A new verification code has been sent to your email.');
  req.session.save(() => res.redirect('/verify-email'));
}));

// ─── FORGOT / RESET PASSWORD ───
router.get('/forgot-password', (req, res) => {
  res.render('forgot-password', { layout: false });
});

router.post('/forgot-password', asyncHandler(async (req, res) => {
  const cleanEmail = (req.body.email || '').trim().toLowerCase();
  if (!cleanEmail) {
    req.flash('error', 'Please enter your email.');
    return res.redirect('/forgot-password');
  }

  const user = await User.findOne({ where: { email: cleanEmail } });
  if (user && user.email_verified) {
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000);
    await PasswordReset.create({ user_id: user.id, token, expires_at: expires });

    const resetLink = `${req.protocol}://${req.get('host')}/reset-password/${token}`;
    let sent = false;
    try {
      sent = await sendOtpEmail({
        to: cleanEmail,
        code: resetLink,
        subject: 'Reset your Intelligrade password',
        intro: 'Click the link below to reset your password (valid for 1 hour):',
      });
    } catch (e) {
      console.error('[Reset email]', e.message);
    }
    if (!sent && process.env.NODE_ENV !== 'production') {
      console.log(`[Password Reset] ${cleanEmail}: ${resetLink}`);
    }
  }

  req.flash('success', 'If an account exists for this email, a password reset link has been sent.');
  res.redirect('/login');
}));

router.get('/reset-password/:token', asyncHandler(async (req, res) => {
  if (!/^[a-f0-9]{64}$/.test(req.params.token)) {
    req.flash('error', 'This reset link is invalid or has expired.');
    return res.redirect('/forgot-password');
  }
  const reset = await PasswordReset.findOne({
    where: { token: req.params.token, used: false, expires_at: { [Op.gt]: new Date() } },
  });
  if (!reset) {
    req.flash('error', 'This reset link is invalid or has expired.');
    return res.redirect('/forgot-password');
  }
  res.render('reset-password', { layout: false, token: req.params.token });
}));

router.post('/reset-password/:token', asyncHandler(async (req, res) => {
  if (!/^[a-f0-9]{64}$/.test(req.params.token)) {
    req.flash('error', 'This reset link is invalid or has expired.');
    return res.redirect('/forgot-password');
  }
  const { password, confirm_password } = req.body;
  if (!password || password.length < 6) {
    req.flash('error', 'Password must be at least 6 characters.');
    return res.redirect(`/reset-password/${req.params.token}`);
  }
  if (password.length > 128) {
    req.flash('error', 'Password is too long (128 char max).');
    return res.redirect(`/reset-password/${req.params.token}`);
  }
  if (password !== confirm_password) {
    req.flash('error', 'Passwords do not match.');
    return res.redirect(`/reset-password/${req.params.token}`);
  }

  const reset = await PasswordReset.findOne({
    where: { token: req.params.token, used: false, expires_at: { [Op.gt]: new Date() } },
  });
  if (!reset) {
    req.flash('error', 'This reset link is invalid or has expired.');
    return res.redirect('/forgot-password');
  }

  const user = await User.findByPk(reset.user_id);
  if (!user) return res.redirect('/forgot-password');

  user.password_hash = User.hashPassword(password);
  await user.save();
  reset.used = true;
  await reset.save();

  // Invalidate all other reset tokens for this user
  await PasswordReset.update({ used: true }, { where: { user_id: user.id, used: false } });

  req.flash('success', 'Password reset successfully. Please sign in.');
  res.redirect('/login');
}));

// ─── PLANS ───
router.get('/plans', asyncHandler(async (req, res) => {
  if (!req.session.userId) return res.redirect('/login');

  const now = new Date();
  const user = await User.findByPk(req.session.userId, { include: [College] });
  let activeSub = null;

  activeSub = await Subscription.findOne({
    where: { user_id: req.session.userId, scope: 'individual', status: 'active', end_date: { [Op.gt]: now } },
  });

  if (!activeSub && req.session.collegeId) {
    activeSub = await Subscription.findOne({
      where: { college_id: req.session.collegeId, status: 'active', end_date: { [Op.gt]: now } },
    });
  }

  const collegeType = user?.College?.type || null;
  const isIndividual = !req.session.collegeId;

  res.render('plans', {
    layout: false,
    session: req.session,
    activeSub,
    collegeName: req.session.collegeName || null,
    collegeType,
    isIndividual,
    paperLimit: FREE_PAPER_LIMIT,
    papersUsed: user?.papers_graded_total || 0,
  });
}));

router.post('/subscribe', asyncHandler(async (req, res) => {
  if (!req.session.userId) return res.redirect('/login');

  const { plan, scope } = req.body;
  const planScope = scope || (req.session.collegeId ? (req.session.role === 'admin' ? 'college' : 'individual') : 'individual');

  if (planScope !== 'individual' && req.session.role !== 'admin') {
    req.flash('error', 'Only admins can purchase institutional subscriptions.');
    return res.redirect('/plans');
  }

  if (!PLAN_DURATIONS[plan]) {
    req.flash('error', 'Invalid plan selected.');
    return res.redirect('/plans');
  }

  if (!FREE_SUBSCRIBE_PLANS.has(plan)) {
    req.flash('error', 'Paid plans require checkout. Use the payment option on this page.');
    return res.redirect('/plans');
  }

  const now = new Date();
  const end = new Date(now);
  end.setDate(end.getDate() + PLAN_DURATIONS[plan]);

  if (planScope === 'individual') {
    await Subscription.update({ status: 'expired' }, {
      where: { user_id: req.session.userId, scope: 'individual', status: 'active' },
    });
  } else if (req.session.collegeId) {
    await Subscription.update({ status: 'expired' }, {
      where: { college_id: req.session.collegeId, status: 'active' },
    });
  }

  await Subscription.create({
    user_id: req.session.userId,
    college_id: planScope !== 'individual' ? req.session.collegeId : null,
    plan,
    scope: planScope,
    start_date: now,
    end_date: end,
    status: 'active',
    amount: 0,
  });

  const label = plan === 'free' ? 'Free Plan' : plan.charAt(0).toUpperCase() + plan.slice(1);
  req.flash('success', `${label} plan activated!`);
  res.redirect('/dashboard');
}));

router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

module.exports = router;

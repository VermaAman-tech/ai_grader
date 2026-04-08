const router = require('express').Router();
const { User, College, Subscription } = require('../models');
const { asyncHandler } = require('../middleware/auth');
const { Op } = require('sequelize');
const { generateOTP, storeOTP, verifyOTP } = require('../services/otp-store');
const { sendOtpEmail } = require('../services/email');

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
  if (req.session.userId) return res.redirect('/dashboard');
  res.render('login', { layout: false });
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

  req.session.regenerate(function (err) {
    if (err) { req.flash('error', 'Session error.'); return res.redirect('/login'); }
    req.session.userId = user.id;
    req.session.userName = user.full_name;
    req.session.userEmail = user.email;
    req.session.role = user.role;
    req.session.collegeId = user.college_id;
    req.session.collegeName = user.College?.name || null;
    req.session.collegeType = user.College?.type || null;
    req.session.save(() => res.redirect('/dashboard'));
  });
}));

// ─── REGISTER ───
router.get('/register', (req, res) => {
  if (req.session.userId) return res.redirect('/dashboard');
  res.render('register', { layout: false });
});

router.post('/register', asyncHandler(async (req, res) => {
  const { full_name, email, phone, password, confirm_password, role, admin_type, institution_name, department } = req.body;
  const errors = [];

  if (!full_name || full_name.trim().length < 2) errors.push('Full name is required.');
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) errors.push('A valid email is required.');
  const cleanPhone = (phone || '').replace(/[^0-9+]/g, '');
  if (cleanPhone && cleanPhone.length < 8) errors.push('Enter a valid phone number.');
  if (!password || password.length < 6) errors.push('Password must be at least 6 characters.');
  if (password !== confirm_password) errors.push('Passwords do not match.');

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
  let userRole = role || 'individual';
  let pendingAdminCollege = null;

  if (userRole === 'admin') {
    if (!institution_name || institution_name.trim().length < 2) {
      req.flash('error', 'Institution name is required.');
      return res.redirect('/register');
    }
    const taken = await College.findOne({ where: { domain } });
    if (taken) {
      req.flash('error', `An institution is already registered for @${domain}. Join as a member instead.`);
      return res.redirect('/register');
    }
    pendingAdminCollege = { name: institution_name.trim(), domain, type: 'college' };
    userRole = 'admin';
  } else if (userRole === 'professor') {
    college = await College.findOne({ where: { domain } });
    if (!college) {
      req.flash('error', `No institution is registered for @${domain}. Your admin must register first, or sign up as Individual.`);
      return res.redirect('/register');
    }
    userRole = 'professor';
  }

  const user = await User.create({
    college_id: college?.id || null,
    full_name: full_name.trim(),
    email: cleanEmail,
    phone: cleanPhone || null,
    password_hash: User.hashPassword(password),
    role: userRole === 'individual' ? 'professor' : userRole,
    department: (department || '').trim() || null,
    email_verified: false,
    phone_verified: false,
  });

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
    req.flash('error', 'We could not send the verification email. Configure SMTP (e.g. SMTP_HOST, SMTP_USER, SMTP_PASS) and try again.');
    return res.redirect('/register');
  }
  if (!sent && !isProd) {
    console.log(`[OTP] Email verification for ${cleanEmail}: ${otp} (SMTP not configured — set env for real delivery)`);
  }

  req.session.pendingUserId = user.id;
  req.session.pendingEmail = cleanEmail;
  req.session.pendingRole = userRole;
  req.session.pendingCollegeId = college?.id || null;
  req.session.pendingCollegeName = college?.name || null;
  req.session.pendingCollegeType = college?.type || null;
  req.session.pendingAdminCollege = pendingAdminCollege;

  if (allowDevOtpExpose()) req.session.devOtpPreview = otp;
  else delete req.session.devOtpPreview;

  if (userRole === 'individual') {
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
  if (!verifyOTP(`email:${email}`, otp)) {
    req.flash('error', 'Invalid or expired OTP. Please try again.');
    return res.redirect('/verify-email');
  }

  const user = await User.findByPk(req.session.pendingUserId);
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

  delete req.session.pendingAdminCollege;
  delete req.session.devOtpPreview;

  req.session.regenerate(function (err) {
    if (err) { req.flash('error', 'Session error.'); return res.redirect('/login'); }
    req.session.userId = user.id;
    req.session.userName = user.full_name;
    req.session.userEmail = user.email;
    req.session.role = user.role;
    req.session.collegeId = collegeId;
    req.session.collegeName = collegeName;
    req.session.collegeType = collegeType;

    req.session.save(() => {
      if (role === 'admin') {
        req.flash('success', 'Email verified! Choose a plan for your institution.');
        return res.redirect('/plans');
      }
      if (role === 'individual') {
        req.flash('success', 'Email verified! You have 10 free paper evaluations. Upgrade anytime.');
        return res.redirect('/dashboard');
      }
      req.flash('success', 'Email verified! Welcome to Intelligrade.');
      res.redirect('/dashboard');
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

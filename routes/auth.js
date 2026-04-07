const router = require('express').Router();
const { User, College, Subscription } = require('../models');
const { asyncHandler } = require('../middleware/auth');
const { Op } = require('sequelize');

const PLAN_DURATIONS = {
  trial:      7,
  monthly:    30,
  quarterly:  90,
  semiannual: 180,
  annual:     365,
};

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
  if (!user.is_active) {
    req.flash('error', 'Account is deactivated. Contact your administrator.');
    return res.redirect('/login');
  }

  req.session.regenerate(function (err) {
    if (err) {
      req.flash('error', 'Session error. Please try again.');
      return res.redirect('/login');
    }
    req.session.userId = user.id;
    req.session.userName = user.full_name;
    req.session.userEmail = user.email;
    req.session.role = user.role;
    req.session.collegeId = user.college_id;
    req.session.collegeName = user.College?.name || null;

    req.session.save(function (saveErr) {
      if (saveErr) {
        req.flash('error', 'Session error. Please try again.');
        return res.redirect('/login');
      }
      res.redirect('/dashboard');
    });
  });
}));

router.get('/register', (req, res) => {
  if (req.session.userId) return res.redirect('/dashboard');
  res.render('register', { layout: false });
});

router.post('/register', asyncHandler(async (req, res) => {
  const { full_name, email, password, confirm_password, role, college_name, department } = req.body;
  const errors = [];

  if (!full_name || full_name.trim().length < 2) errors.push('Full name is required.');
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) errors.push('A valid email address is required.');
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
  let userRole = role === 'admin' ? 'admin' : 'professor';

  if (userRole === 'admin') {
    if (!college_name || college_name.trim().length < 2) {
      req.flash('error', 'College name is required for admin registration.');
      return res.redirect('/register');
    }
    college = await College.findOne({ where: { domain } });
    if (college) {
      req.flash('error', `A college is already registered for the domain @${domain}. Register as a professor instead.`);
      return res.redirect('/register');
    }
    college = await College.create({ name: college_name.trim(), domain });
  } else {
    college = await College.findOne({ where: { domain } });
    if (!college) {
      req.flash('error', `No college is registered for @${domain}. Your college admin must register the institution first, or register as a College Admin to set up your institution.`);
      return res.redirect('/register');
    }
  }

  const user = await User.create({
    college_id: college.id,
    full_name: full_name.trim(),
    email: cleanEmail,
    password_hash: User.hashPassword(password),
    role: userRole,
    department: (department || '').trim() || null,
  });

  req.session.regenerate(function (err) {
    if (err) {
      req.flash('error', 'Session error. Please try again.');
      return res.redirect('/login');
    }
    req.session.userId = user.id;
    req.session.userName = user.full_name;
    req.session.userEmail = user.email;
    req.session.role = user.role;
    req.session.collegeId = college.id;
    req.session.collegeName = college.name;

    req.session.save(function (saveErr) {
      if (saveErr) {
        req.flash('error', 'Session error. Please try again.');
        return res.redirect('/login');
      }
      if (userRole === 'admin') {
        req.flash('success', 'College registered! Choose a plan to activate your institution.');
        return res.redirect('/plans');
      }
      req.flash('success', `Welcome to ${college.name}! Your access is managed by your college admin.`);
      res.redirect('/dashboard');
    });
  });
}));

router.get('/plans', asyncHandler(async (req, res) => {
  if (!req.session.userId) return res.redirect('/login');

  const now = new Date();
  let activeSub = null;

  activeSub = await Subscription.findOne({
    where: { user_id: req.session.userId, scope: 'individual', status: 'active', end_date: { [Op.gt]: now } },
  });

  if (!activeSub && req.session.collegeId) {
    activeSub = await Subscription.findOne({
      where: { college_id: req.session.collegeId, scope: 'college', status: 'active', end_date: { [Op.gt]: now } },
    });
  }

  const collegeName = req.session.collegeName || null;

  res.render('plans', {
    layout: false,
    session: req.session,
    activeSub,
    collegeName,
  });
}));

router.post('/subscribe', asyncHandler(async (req, res) => {
  if (!req.session.userId) return res.redirect('/login');

  if (req.session.role !== 'admin') {
    req.flash('error', 'Only college admins can purchase subscriptions. Your plan is managed by your institution.');
    return res.redirect('/plans');
  }

  if (!req.session.collegeId) {
    req.flash('error', 'No college is linked to your account.');
    return res.redirect('/plans');
  }

  const { plan } = req.body;

  if (!PLAN_DURATIONS[plan]) {
    req.flash('error', 'Invalid plan selected.');
    return res.redirect('/plans');
  }

  const existingSub = await Subscription.findOne({
    where: { college_id: req.session.collegeId, scope: 'college', status: 'active' },
  });

  if (plan === 'trial') {
    const trialUsed = await Subscription.findOne({
      where: { college_id: req.session.collegeId, plan: 'trial' },
    });
    if (trialUsed) {
      req.flash('error', 'Free trial has already been used for your college.');
      return res.redirect('/plans');
    }
  }

  const now = new Date();
  const end = new Date(now);
  end.setDate(end.getDate() + PLAN_DURATIONS[plan]);

  if (existingSub) {
    existingSub.status = 'expired';
    await existingSub.save();
  }

  await Subscription.create({
    user_id: req.session.userId,
    college_id: req.session.collegeId,
    plan,
    scope: 'college',
    start_date: now,
    end_date: end,
    status: 'active',
  });

  const label = plan === 'trial' ? 'Free Trial' : plan.charAt(0).toUpperCase() + plan.slice(1);
  req.flash('success', `${label} plan activated for your college! All professors with your domain now have access.`);
  res.redirect('/dashboard');
}));

router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

module.exports = router;

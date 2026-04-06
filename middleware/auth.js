const { Subscription, College } = require('../models');
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

  // Check individual subscription
  const individual = await Subscription.findOne({
    where: {
      user_id: req.session.userId,
      scope: 'individual',
      status: 'active',
      end_date: { [Op.gt]: now },
    },
  });
  if (individual) {
    req.subscription = individual;
    return next();
  }

  // Check college subscription
  if (req.session.collegeId) {
    const college = await Subscription.findOne({
      where: {
        college_id: req.session.collegeId,
        scope: 'college',
        status: 'active',
        end_date: { [Op.gt]: now },
      },
    });
    if (college) {
      req.subscription = college;
      return next();
    }
  }

  req.flash('error', 'Your subscription has expired. Please renew to continue.');
  res.redirect('/plans');
}

function ensureAdmin(req, res, next) {
  if (req.session && req.session.role === 'admin') return next();
  req.flash('error', 'Admin access required.');
  res.redirect('/dashboard');
}

module.exports = { ensureAuth, ensureSubscription, ensureAdmin };

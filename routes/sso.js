const router = require('express').Router();
const { passport } = require('../config/passport');
const { asyncHandler } = require('../middleware/auth');

function setSessionUser(session, user) {
  session.userId = user.id;
  session.userName = user.full_name;
  session.userEmail = user.email;
  session.role = user.role;
  session.collegeId = user.college_id;
  session.collegeName = user.College?.name || null;
}

function getPostLoginRedirect(session) {
  if (session.pendingJoinCode) return `/courses/join/${session.pendingJoinCode}`;
  if (session.role === 'student' || session.role === 'user') return '/student/dashboard';
  return '/dashboard';
}

// Google OAuth
router.get('/google', (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    req.flash('error', 'Google SSO is not configured.');
    return res.redirect('/login');
  }
  passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});

router.get('/google/callback',
  (req, res, next) => {
    passport.authenticate('google', { failureRedirect: '/login', failureFlash: true })(req, res, next);
  },
  (req, res) => {
    const user = req.user;
    req.session.regenerate(function (err) {
      if (err) {
        req.flash('error', 'Session error.');
        return res.redirect('/login');
      }
      setSessionUser(req.session, user);
      const dest = getPostLoginRedirect(req.session);
      req.session.save(() => res.redirect(dest));
    });
  }
);

// SAML SSO
router.get('/saml', (req, res, next) => {
  if (!process.env.SAML_ENTRY_POINT) {
    req.flash('error', 'SAML SSO is not configured for your institution.');
    return res.redirect('/login');
  }
  passport.authenticate('saml')(req, res, next);
});

router.post('/saml/callback',
  (req, res, next) => {
    passport.authenticate('saml', { failureRedirect: '/login', failureFlash: true })(req, res, next);
  },
  (req, res) => {
    const user = req.user;
    req.session.regenerate(function (err) {
      if (err) {
        req.flash('error', 'Session error.');
        return res.redirect('/login');
      }
      setSessionUser(req.session, user);
      const dest = getPostLoginRedirect(req.session);
      req.session.save(() => res.redirect(dest));
    });
  }
);

// SAML metadata endpoint (for IdP configuration)
router.get('/saml/metadata', (req, res) => {
  if (!process.env.SAML_ENTRY_POINT) {
    return res.status(404).send('SAML not configured.');
  }
  try {
    const strategy = passport._strategy('saml');
    res.type('application/xml');
    res.send(strategy.generateServiceProviderMetadata());
  } catch {
    res.status(500).send('Could not generate SAML metadata.');
  }
});

// SSO status check (for login page UI)
router.get('/status', (req, res) => {
  res.json({
    google: !!process.env.GOOGLE_CLIENT_ID,
    saml: !!process.env.SAML_ENTRY_POINT,
    saml_name: process.env.SAML_IDP_NAME || 'Institution SSO',
  });
});

module.exports = router;

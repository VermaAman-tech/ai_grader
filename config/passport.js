const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { User, College, Subscription, CourseTA, Student } = require('../models');
const { PLAN_DURATIONS } = require('./pricing');

passport.serializeUser((user, done) => done(null, user.id));

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findByPk(id, { include: [College] });
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

function configureGoogleSSO() {
  const clientID = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const callbackURL = process.env.GOOGLE_CALLBACK_URL || '/auth/google/callback';

  if (!clientID || !clientSecret) {
    console.warn('[SSO] Google OAuth not configured — set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.');
    return false;
  }

  passport.use(new GoogleStrategy({
    clientID,
    clientSecret,
    callbackURL,
    scope: ['profile', 'email'],
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      const email = (profile.emails?.[0]?.value || '').toLowerCase().trim();
      if (!email) return done(null, false, { message: 'No email from Google.' });

      let user = await User.findOne({ where: { email } });

      if (user) {
        if (!user.email_verified) {
          user.email_verified = true;
          await user.save();
        }
        await linkPendingInvites(user);
        return done(null, user);
      }

      const domain = email.split('@')[1];
      const college = await College.findOne({ where: { domain } });

      user = await User.create({
        college_id: college?.id || null,
        full_name: profile.displayName || email.split('@')[0],
        email,
        password_hash: User.hashPassword(require('crypto').randomBytes(32).toString('hex')),
        role: 'professor',
        email_verified: true,
      });

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

      await linkPendingInvites(user);
      return done(null, user);
    } catch (err) {
      return done(err, null);
    }
  }));

  console.log('[SSO] Google OAuth configured.');
  return true;
}

function configureSAML() {
  const entryPoint = process.env.SAML_ENTRY_POINT;
  const issuer = process.env.SAML_ISSUER;
  const cert = process.env.SAML_CERT;
  const callbackUrl = process.env.SAML_CALLBACK_URL || '/auth/saml/callback';

  if (!entryPoint || !issuer) {
    console.warn('[SSO] SAML not configured — set SAML_ENTRY_POINT, SAML_ISSUER, SAML_CERT.');
    return false;
  }

  try {
    const SamlStrategy = require('passport-saml').Strategy;

    passport.use('saml', new SamlStrategy({
      entryPoint,
      issuer,
      callbackUrl,
      cert: cert || '',
      wantAssertionsSigned: false,
    }, async (profile, done) => {
      try {
        const email = (
          profile.email ||
          profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'] ||
          profile.nameID ||
          ''
        ).toLowerCase().trim();

        if (!email) return done(null, false, { message: 'No email in SAML assertion.' });

        const displayName = profile.displayName ||
          profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] ||
          email.split('@')[0];

        let user = await User.findOne({ where: { email } });

        if (user) {
          if (!user.email_verified) {
            user.email_verified = true;
            await user.save();
          }
          await linkPendingInvites(user);
          return done(null, user);
        }

        const domain = email.split('@')[1];
        const college = await College.findOne({ where: { domain } });

        user = await User.create({
          college_id: college?.id || null,
          full_name: displayName,
          email,
          password_hash: User.hashPassword(require('crypto').randomBytes(32).toString('hex')),
          role: 'professor',
          email_verified: true,
        });

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

        await linkPendingInvites(user);
        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }));

    console.log('[SSO] SAML configured.');
    return true;
  } catch (err) {
    console.warn('[SSO] SAML setup error:', err.message);
    return false;
  }
}

async function linkPendingInvites(user) {
  const email = user.email;
  await CourseTA.update(
    { user_id: user.id, status: 'active' },
    { where: { email, user_id: null } }
  );
  await Student.update(
    { user_id: user.id },
    { where: { email, user_id: null } }
  );
}

function initializePassport(app) {
  app.use(passport.initialize());
  app.use(passport.session());

  const googleEnabled = configureGoogleSSO();
  const samlEnabled = configureSAML();

  return { googleEnabled, samlEnabled };
}

module.exports = { initializePassport, passport };

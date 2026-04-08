const router = require('express').Router();
const { ensureAuth, asyncHandler } = require('../middleware/auth');
const { Subscription, User, College } = require('../models');
const { validateCoupon, applyDiscount, calculatePrice, PLANS, PLAN_DURATIONS } = require('../config/pricing');

let stripe = null;
try {
  if (process.env.STRIPE_SECRET_KEY) {
    stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  }
} catch {}

router.post('/validate-coupon', ensureAuth, asyncHandler(async (req, res) => {
  const { code } = req.body;
  const coupon = validateCoupon(code);
  if (!coupon) {
    return res.json({ valid: false, message: 'Invalid or expired coupon code.' });
  }
  return res.json({
    valid: true,
    discount: coupon.discount,
    description: coupon.description,
    message: `${coupon.description} applied!`,
  });
}));

router.post('/create-session', ensureAuth, asyncHandler(async (req, res) => {
  const { plan, scope, billing, currency, coupon_code, num_profs, num_students } = req.body;

  if (!PLANS[plan]) {
    return res.json({ error: 'Invalid plan.' });
  }

  if (!stripe) {
    return handleDirectSubscription(req, res, plan, scope, billing || 'monthly', coupon_code, currency);
  }

  const cur = currency === 'inr' ? 'inr' : 'usd';
  const priceResult = calculatePrice({
    plan, billing: billing || 'monthly', scope: scope || 'individual',
    numProfs: parseInt(num_profs) || 1, numStudents: parseInt(num_students) || 100,
    currency: cur,
  });

  if (!priceResult) {
    return res.json({ error: 'Invalid plan configuration.' });
  }

  let amount = priceResult.total;
  const coupon = validateCoupon(coupon_code, scope, billing);
  if (coupon) {
    amount = applyDiscount(amount, coupon.discount);
  }

  const planLabel = `${PLANS[plan].name} ${scope === 'college' ? 'College' : 'Individual'} (${billing || 'monthly'})`;

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: cur,
          product_data: {
            name: `Intelligrade ${planLabel}`,
            description: coupon ? `${coupon.description} applied` : PLANS[plan].tagline,
          },
          unit_amount: amount,
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${req.protocol}://${req.get('host')}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.protocol}://${req.get('host')}/plans`,
      metadata: {
        user_id: String(req.session.userId),
        plan, scope, billing: billing || 'monthly',
        coupon_code: coupon_code || '',
      },
    });

    return res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe session error:', err.message);
    return res.json({ error: 'Payment service error.' });
  }
}));

router.get('/success', ensureAuth, asyncHandler(async (req, res) => {
  const sessionId = req.query.session_id;

  if (stripe && sessionId) {
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.payment_status === 'paid') {
        const { plan, scope, billing } = session.metadata;
        await activateSubscription(req.session.userId, req.session.collegeId, plan, scope, billing, session.amount_total);
        req.flash('success', 'Payment successful! Your plan is now active.');
        return res.redirect('/dashboard');
      }
    } catch (err) {
      console.error('Stripe verify error:', err.message);
    }
  }

  req.flash('error', 'Unable to verify payment. Contact support if you were charged.');
  res.redirect('/plans');
}));

router.post('/webhook', asyncHandler(async (req, res) => {
  if (!stripe) return res.status(200).send('OK');

  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (endpointSecret && sig) {
    try {
      const event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
      if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const { user_id, plan, scope, billing } = session.metadata;
        if (user_id && plan && scope) {
          const user = await User.findByPk(parseInt(user_id));
          await activateSubscription(parseInt(user_id), user?.college_id, plan, scope, billing, session.amount_total);
        }
      }
    } catch (err) {
      console.error('Webhook error:', err.message);
      return res.status(400).send('Webhook error');
    }
  }

  res.status(200).send('OK');
}));

async function handleDirectSubscription(req, res, plan, scope, billing, couponCode, currency) {
  if (scope !== 'individual' && req.session.role !== 'admin') {
    return res.json({ error: 'Only admins can purchase institutional plans.' });
  }

  await activateSubscription(req.session.userId, req.session.collegeId, plan, scope, billing, 0);
  return res.json({ url: '/dashboard' });
}

async function activateSubscription(userId, collegeId, plan, scope, billing, amount) {
  const now = new Date();
  const end = new Date(now);
  const duration = billing === 'yearly' ? 365 : billing === 'semester' ? 150 : 30;
  end.setDate(end.getDate() + duration);

  if (scope === 'individual') {
    await Subscription.update({ status: 'expired' }, {
      where: { user_id: userId, scope: 'individual', status: 'active' },
    });
  } else if (collegeId) {
    await Subscription.update({ status: 'expired' }, {
      where: { college_id: collegeId, status: 'active' },
    });
  }

  await Subscription.create({
    user_id: userId,
    college_id: scope !== 'individual' ? collegeId : null,
    plan, scope,
    start_date: now, end_date: end,
    status: 'active',
    amount: (amount || 0) / 100,
  });
}

module.exports = router;

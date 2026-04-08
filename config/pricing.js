// ═══════════════════════════════════════════════════════════════════
// Pricing Model v2 — Professor-wise, per 100-student batches
// 3 Plans: Assess, Academic, Enterprise
// Pricing scales per 100 students (0-100 base, 101-200 = 2x, etc.)
// 12-prof bundle: buy 12, pay for 10 (2 free)
// Semester (5 months) and Yearly options with discounts
// ═══════════════════════════════════════════════════════════════════

const PLANS = {
  assess: {
    id: 'assess',
    name: 'Assess',
    tagline: 'AI Grading + Student Learning Analytics',
    description: 'Automated grading with deep analytics, student reports, knowledge graphs, and learning gap tracking.',
    perProf: {
      monthly:  { inr: 799_00, usd: 10_00 },
      semester: { inr: 3599_00, usd: 45_00, months: 5 },
      yearly:   { inr: 6999_00, usd: 89_00 },
    },
    college: {
      monthly:  { inr: 7999_00, usd: 99_00, profsIncluded: 10 },
      semester: { inr: 35999_00, usd: 449_00, months: 5, profsIncluded: 10 },
      yearly:   { inr: 69999_00, usd: 879_00, profsIncluded: 10 },
    },
    features: {
      aiGrading: true, analytics: true, studentReports: true,
      knowledgeGraph: true, examDesign: true, export: true,
      reviewQueue: true, gradeBoundaries: true,
      studentPortal: false, taWorkflow: false, discussions: false,
      announcements: false, courseDocs: false, cribs: false,
      livePolls: false, classSessions: false, engagement: false,
      moodleLTI: false, piazza: false, agenticAI: false,
      sso: false, apiAccess: false,
    },
    featureList: [
      'AI-powered exam grading',
      'Deep analytics & insights',
      'Student learning reports',
      'Knowledge graph tracking',
      'AI exam designer',
      'Grade boundaries & curves',
      'Human review queue',
      'Excel/PDF export',
      'LaTeX rendering',
    ],
  },

  academic: {
    id: 'academic',
    name: 'Academic',
    tagline: 'Grading + Course & Assignment Management',
    description: 'Everything in Assess plus TA workflow, announcements, course documents, discussions, and class sessions.',
    perProf: {
      monthly:  { inr: 1499_00, usd: 19_00 },
      semester: { inr: 6799_00, usd: 85_00, months: 5 },
      yearly:   { inr: 13999_00, usd: 175_00 },
    },
    college: {
      monthly:  { inr: 14999_00, usd: 189_00, profsIncluded: 10 },
      semester: { inr: 67499_00, usd: 849_00, months: 5, profsIncluded: 10 },
      yearly:   { inr: 139999_00, usd: 1749_00, profsIncluded: 10 },
    },
    features: {
      aiGrading: true, analytics: true, studentReports: true,
      knowledgeGraph: true, examDesign: true, export: true,
      reviewQueue: true, gradeBoundaries: true,
      studentPortal: true, taWorkflow: true, discussions: true,
      announcements: true, courseDocs: true, cribs: true,
      livePolls: false, classSessions: true, engagement: false,
      moodleLTI: false, piazza: false, agenticAI: false,
      sso: false, apiAccess: false,
    },
    featureList: [
      'Everything in Assess',
      'Student portal with OTP login',
      'TA workflow & management',
      'Announcements system',
      'Course documents (RAG)',
      'Discussion board',
      'Crib / regrade portal',
      'Class session planner',
      'Student roster auto-enrollment',
    ],
  },

  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    tagline: 'Full Platform — All Features',
    description: 'Complete course intelligence platform with live engagement, agentic AI, Moodle/Piazza integration, and SSO.',
    perProf: {
      monthly:  { inr: 1999_00, usd: 25_00 },
      semester: { inr: 8999_00, usd: 115_00, months: 5 },
      yearly:   { inr: 18999_00, usd: 239_00 },
    },
    college: {
      monthly:  { inr: 19999_00, usd: 249_00, profsIncluded: 10 },
      semester: { inr: 89999_00, usd: 1129_00, months: 5, profsIncluded: 10 },
      yearly:   { inr: 189999_00, usd: 2379_00, profsIncluded: 10 },
    },
    features: {
      aiGrading: true, analytics: true, studentReports: true,
      knowledgeGraph: true, examDesign: true, export: true,
      reviewQueue: true, gradeBoundaries: true,
      studentPortal: true, taWorkflow: true, discussions: true,
      announcements: true, courseDocs: true, cribs: true,
      livePolls: true, classSessions: true, engagement: true,
      moodleLTI: true, piazza: true, agenticAI: true,
      sso: true, apiAccess: true,
    },
    featureList: [
      'Everything in Academic',
      'Live polls & engagement tools',
      'Agentic AI assistant (full tool access)',
      'Active feedback conversations',
      'Moodle LTI integration',
      'Piazza sync',
      'SSO / SAML',
      'API access',
      'Speech-to-action (voice commands)',
      'RAG-powered document reasoning',
    ],
  },
};

const BUNDLE_DISCOUNT = {
  threshold: 12,
  freeProfs: 2,
  description: 'Buy 12 professors, get 2 free',
};

function calculatePrice({ plan, billing, scope, numProfs, numStudents, currency }) {
  const planData = PLANS[plan];
  if (!planData) return null;

  const cur = currency || 'inr';
  const studentBatches = Math.max(1, Math.ceil((numStudents || 1) / 100));
  let effectiveProfs = numProfs || 1;

  if (scope === 'college') {
    const tierData = planData.college[billing];
    if (!tierData) return null;

    const basePrice = tierData[cur];
    const includedProfs = tierData.profsIncluded || 10;

    let extraProfs = Math.max(0, effectiveProfs - includedProfs);
    const bundleSets = Math.floor(extraProfs / BUNDLE_DISCOUNT.threshold);
    extraProfs -= bundleSets * BUNDLE_DISCOUNT.freeProfs;

    const extraProfPrice = planData.perProf[billing]?.[cur] || 0;
    const total = (basePrice * studentBatches) + (extraProfs * extraProfPrice * studentBatches);

    return {
      basePrice, studentBatches, effectiveProfs,
      extraProfs, bundleSets, extraProfPrice,
      total, currency: cur, plan, billing, scope,
      perMonth: billing === 'yearly' ? Math.round(total / 12) : billing === 'semester' ? Math.round(total / 5) : total,
    };
  }

  const tierData = planData.perProf[billing];
  if (!tierData) return null;

  const basePrice = tierData[cur];

  const bundleSets = Math.floor(effectiveProfs / BUNDLE_DISCOUNT.threshold);
  const freeProfs = bundleSets * BUNDLE_DISCOUNT.freeProfs;
  const paidProfs = effectiveProfs - freeProfs;

  const total = basePrice * paidProfs * studentBatches;

  return {
    basePrice, studentBatches, effectiveProfs, paidProfs, freeProfs,
    total, currency: cur, plan, billing, scope: scope || 'individual',
    perMonth: billing === 'yearly' ? Math.round(total / 12) : billing === 'semester' ? Math.round(total / 5) : total,
  };
}

function formatPrice(amountInPaise, currency) {
  if (currency === 'usd') return '$' + (amountInPaise / 100).toLocaleString('en-US');
  return '\u20B9' + (amountInPaise / 100).toLocaleString('en-IN');
}

const COUPONS = {
  'LAUNCH30':   { discount: 0.30, description: '30% off first 3 months', active: true, maxMonths: 3 },
  'WELCOME20':  { discount: 0.20, description: '20% off', active: true },
  'EDUCATOR50': { discount: 0.50, description: '50% off for educators', active: true },
  'ANNUAL15':   { discount: 0.15, description: '15% off annual plans', active: true, billingRestrict: 'yearly' },
  'COLLEGE25':  { discount: 0.25, description: '25% off college plans', active: true, scopeRestrict: 'college' },
};

function validateCoupon(code, scope, billing) {
  const coupon = COUPONS[(code || '').toUpperCase().trim()];
  if (!coupon || !coupon.active) return null;
  if (coupon.scopeRestrict && coupon.scopeRestrict !== scope) return null;
  if (coupon.billingRestrict && coupon.billingRestrict !== billing) return null;
  return coupon;
}

function applyDiscount(amountInSmallestUnit, discountFraction) {
  return Math.round(amountInSmallestUnit * (1 - discountFraction));
}

const PLAN_DURATIONS = {
  free:     36500,
  starter:  36500,
  monthly:  30,
  semester: 150,
  yearly:   365,
};

function getPlanFeatures(planName) {
  if (planName === 'free' || planName === 'starter') return PLANS.assess.features;
  if (planName === 'assess') return PLANS.assess.features;
  if (planName === 'academic') return PLANS.academic.features;
  if (planName === 'enterprise') return PLANS.enterprise.features;
  if (planName === 'monthly' || planName === 'yearly') return PLANS.academic.features;
  if (planName === 'faculty_pro') return PLANS.academic.features;
  if (planName === 'department') return PLANS.enterprise.features;
  if (planName === 'institution') return PLANS.enterprise.features;
  return PLANS.assess.features;
}

module.exports = {
  PLANS, BUNDLE_DISCOUNT, COUPONS, PLAN_DURATIONS,
  calculatePrice, formatPrice, validateCoupon, applyDiscount, getPlanFeatures,
};

require('dotenv').config();
const isProd = process.env.NODE_ENV === 'production';
if (isProd) {
  const sec = process.env.SESSION_SECRET;
  if (!sec || sec === 'dev-secret-change-me') {
    console.error('FATAL: Set SESSION_SECRET in production.');
    process.exit(1);
  }
}

const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const methodOverride = require('method-override');
const ejsLayouts = require('express-ejs-layouts');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const { sequelize } = require('./models');

const app = express();
const PORT = process.env.PORT || 3000;
const { jsonForScript } = require('./utils/safe-json');

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(ejsLayouts);
app.set('layout', 'partials/layout');

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(express.json({ limit: '2mb' }));
app.use(methodOverride('_method'));

app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
  },
}));
app.use(flash());

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests. Please slow down.',
});
app.use(globalLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many login attempts. Please try again in 15 minutes.',
});

const gradingLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Grading rate limit reached. Please wait a moment.',
});

app.use((req, res, next) => {
  res.locals.session = req.session;
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  res.locals.currentPath = req.path;
  res.locals.jsonForScript = jsonForScript;
  next();
});

app.get('/', (req, res) => {
  if (req.session.userId) return res.redirect('/dashboard');
  res.render('landing', { layout: false });
});

app.get('/terms', (req, res) => {
  res.render('terms', { layout: false });
});

app.get('/privacy', (req, res) => {
  res.render('privacy', { layout: false });
});

app.post('/login', authLimiter);
app.post('/register', authLimiter);

// ── Core routes ──
app.use('/', require('./routes/auth'));
app.use('/', require('./routes/dashboard'));
app.use('/courses', require('./routes/courses'));
app.use('/exams', require('./routes/exams'));
app.use('/roster', require('./routes/roster'));
app.use('/rubric', require('./routes/rubric'));
app.use('/submissions', require('./routes/submissions'));
app.use('/grading', gradingLimiter, require('./routes/grading'));
app.use('/analytics', require('./routes/analytics'));
app.use('/assistant', require('./routes/assistant'));
app.use('/export', require('./routes/export'));
app.use('/rubric/ai', require('./routes/rubric-ai'));
app.use('/grading/boundaries', require('./routes/grade-boundaries'));
app.use('/grading/email', require('./routes/email-grades'));
app.use('/submissions', require('./routes/zip-upload'));
app.use('/exam-design', require('./routes/exam-design'));
app.use('/student-reports', require('./routes/student-reports'));
app.use('/knowledge-graph', require('./routes/knowledge-graph'));
app.use('/api/session', require('./routes/session-activity'));
app.use('/checkout', require('./routes/checkout'));

// ── New feature routes (features2.md) ──
app.use('/review-queue', require('./routes/review-queue'));
app.use('/ta', require('./routes/ta'));
app.use('/cribs', require('./routes/cribs'));
app.use('/announcements', require('./routes/announcements'));
app.use('/course-documents', require('./routes/course-documents'));
app.use('/discussions', require('./routes/discussions'));
app.use('/live-polls', require('./routes/live-polls'));
app.use('/class-sessions', require('./routes/class-sessions'));

// ── Learning Objectives & Active Feedback ──
app.use('/learning-objectives', require('./routes/learning-objectives'));
app.use('/active-feedback', require('./routes/active-feedback'));

// ── Integrations (Moodle, Piazza) ──
app.use('/integrations', require('./routes/integrations'));

// ── Student portal (separate auth flow) ──
app.use('/student', require('./routes/student-portal'));

app.use((req, res) => {
  res.status(404).render('404', { layout: false });
});

app.use((err, req, res, _next) => {
  console.error(err.stack);
  res.status(500).render('500', { layout: false });
});

function cleanExports() {
  const exportDir = path.resolve(process.env.EXPORT_DIR || './data/exports');
  try {
    const files = fs.readdirSync(exportDir);
    const now = Date.now();
    const maxAge = 60 * 60 * 1000;
    for (const f of files) {
      const fp = path.join(exportDir, f);
      try {
        const stat = fs.statSync(fp);
        if (now - stat.mtimeMs > maxAge) fs.unlinkSync(fp);
      } catch {}
    }
  } catch {}
}

async function start() {
  const dirs = [
    process.env.UPLOAD_DIR || './data/uploads',
    process.env.EXPORT_DIR || './data/exports',
  ];
  for (const d of dirs) fs.mkdirSync(path.resolve(d), { recursive: true });

  await sequelize.sync({ alter: false });
  console.log('Database synced.');

  cleanExports();
  setInterval(cleanExports, 30 * 60 * 1000);

  app.listen(PORT, () => {
    console.log(`Intelligrade running at http://localhost:${PORT}`);
  });
}

module.exports = { app, authLimiter, gradingLimiter };

start().catch(err => {
  console.error('Failed to start:', err);
  process.exit(1);
});

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
const helmet = require('helmet');
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

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://unpkg.com", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.jsdelivr.net"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(express.json({ limit: '2mb' }));

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

const sensitiveAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests. Please try again in 15 minutes.',
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
  if (req.session.userId) {
    const role = req.session.role;
    if (role === 'student' || role === 'user') return res.redirect('/student/dashboard');
    return res.redirect('/dashboard');
  }
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
app.post('/request-otp', sensitiveAuthLimiter);
app.post('/verify-login-otp', sensitiveAuthLimiter);
app.post('/verify-email', sensitiveAuthLimiter);
app.post('/resend-otp', sensitiveAuthLimiter);
app.post('/forgot-password', sensitiveAuthLimiter);

const { ensureProfessor } = require('./middleware/auth');

// ── Core routes (auth & dashboard have their own role guards) ──
app.use('/', require('./routes/auth'));
app.use('/', require('./routes/dashboard'));

// ── Course join routes (accessible to all authenticated users) ──
app.use('/courses/join', require('./routes/course-join'));

// ── Professor-only routes (students/TAs blocked at mount level) ──
app.use('/courses', ensureProfessor, require('./routes/courses'));
app.use('/exams', ensureProfessor, require('./routes/exams'));
app.use('/roster', ensureProfessor, require('./routes/roster'));
app.use('/rubric', ensureProfessor, require('./routes/rubric'));
app.use('/submissions', ensureProfessor, require('./routes/submissions'));
app.use('/grading', ensureProfessor, gradingLimiter, require('./routes/grading'));
app.use('/analytics', ensureProfessor, require('./routes/analytics'));
app.use('/assistant', ensureProfessor, require('./routes/assistant'));
app.use('/export', ensureProfessor, require('./routes/export'));
app.use('/rubric/ai', ensureProfessor, require('./routes/rubric-ai'));
app.use('/grading/boundaries', ensureProfessor, require('./routes/grade-boundaries'));
app.use('/grading/email', ensureProfessor, require('./routes/email-grades'));
app.use('/submissions', ensureProfessor, require('./routes/zip-upload'));
app.use('/exam-design', ensureProfessor, require('./routes/exam-design'));
app.use('/student-reports', ensureProfessor, require('./routes/student-reports'));
app.use('/knowledge-graph', ensureProfessor, require('./routes/knowledge-graph'));
app.use('/api/session', require('./routes/session-activity'));
app.use('/checkout', require('./routes/checkout'));

// ── New feature routes (professor-only) ──
app.use('/review-queue', ensureProfessor, require('./routes/review-queue'));
app.use('/ta', ensureProfessor, require('./routes/ta'));
app.use('/cribs', ensureProfessor, require('./routes/cribs'));
app.use('/announcements', ensureProfessor, require('./routes/announcements'));
app.use('/course-documents', ensureProfessor, require('./routes/course-documents'));
app.use('/discussions', ensureProfessor, require('./routes/discussions'));
app.use('/live-polls', ensureProfessor, require('./routes/live-polls'));
app.use('/class-sessions', ensureProfessor, require('./routes/class-sessions'));

// ── Learning Objectives & Active Feedback (professor-only) ──
app.use('/learning-objectives', ensureProfessor, require('./routes/learning-objectives'));
app.use('/active-feedback', ensureProfessor, require('./routes/active-feedback'));

// ── Integrations (professor-only) ──
app.use('/integrations', ensureProfessor, require('./routes/integrations'));

// ── TA portal (separate auth flow) ──
app.use('/ta-portal', require('./routes/ta-portal'));

// ── Student portal (separate auth flow) ──
app.use('/student', require('./routes/student-portal'));

app.use((req, res) => {
  res.status(404).render('404', { layout: false });
});

app.use((err, req, res, _next) => {
  // Handle multer / file upload errors gracefully
  if (err && err.name === 'MulterError') {
    req.flash('error', `Upload error: ${err.message}`);
    const ref = req.get('referer');
    return res.redirect(ref || '/dashboard');
  }
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    req.flash('error', 'File is too large.');
    const ref = req.get('referer');
    return res.redirect(ref || '/dashboard');
  }
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

async function ensureLegacySchemaCompatibility() {
  const queryInterface = sequelize.getQueryInterface();
  const models = Object.values(sequelize.models);

  for (const model of models) {
    const tableName = model.getTableName();
    let tableInfo;

    try {
      tableInfo = await queryInterface.describeTable(tableName);
    } catch {
      // Table does not exist yet; sync() will create it.
      continue;
    }

    const existingColumns = new Set(
      Object.keys(tableInfo).map(col => col.toLowerCase())
    );

    for (const attr of Object.values(model.rawAttributes)) {
      const columnName = attr.field || attr.fieldName;
      if (!columnName || existingColumns.has(columnName.toLowerCase())) continue;

      await queryInterface.addColumn(tableName, columnName, {
        type: attr.type,
        allowNull: true,
      });

      existingColumns.add(columnName.toLowerCase());
      console.log(`Patched legacy schema: added ${tableName}.${columnName}.`);
    }
  }
}

async function start() {
  const dirs = [
    process.env.UPLOAD_DIR || './data/uploads',
    process.env.EXPORT_DIR || './data/exports',
  ];
  for (const d of dirs) fs.mkdirSync(path.resolve(d), { recursive: true });

  await ensureLegacySchemaCompatibility();
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

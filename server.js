require('dotenv').config();
const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const methodOverride = require('method-override');
const ejsLayouts = require('express-ejs-layouts');
const path = require('path');
const fs = require('fs');
const { sequelize } = require('./models');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(ejsLayouts);
app.set('layout', 'partials/layout');

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));

app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 },
}));
app.use(flash());

app.use((req, res, next) => {
  res.locals.session = req.session;
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  res.locals.currentPath = req.path;
  next();
});

// Landing page
app.get('/', (req, res) => {
  if (req.session.userId) return res.redirect('/dashboard');
  res.render('landing', { layout: false });
});

// Routes
app.use('/', require('./routes/auth'));
app.use('/', require('./routes/dashboard'));
app.use('/courses', require('./routes/courses'));
app.use('/exams', require('./routes/exams'));
app.use('/roster', require('./routes/roster'));
app.use('/rubric', require('./routes/rubric'));
app.use('/submissions', require('./routes/submissions'));
app.use('/grading', require('./routes/grading'));
app.use('/analytics', require('./routes/analytics'));
app.use('/chat', require('./routes/chat'));
app.use('/export', require('./routes/export'));

app.use((req, res) => {
  res.status(404).render('404', { layout: false });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('500', { layout: false });
});

async function start() {
  const dirs = [
    process.env.UPLOAD_DIR || './data/uploads',
    process.env.EXPORT_DIR || './data/exports',
  ];
  for (const d of dirs) fs.mkdirSync(path.resolve(d), { recursive: true });

  await sequelize.sync({ alter: false });
  console.log('Database synced.');

  app.listen(PORT, () => {
    console.log(`Intelligrade running at http://localhost:${PORT}`);
  });
}

start().catch(err => {
  console.error('Failed to start:', err);
  process.exit(1);
});

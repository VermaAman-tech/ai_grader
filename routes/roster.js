const router = require('express').Router();
const multer = require('multer');
const { ensureAuth, ensureSubscription } = require('../middleware/auth');
const { Course, Student } = require('../models');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const COL_ALIASES = {
  name: ['name', 'student name', 'full name', 'student_name'],
  roll: ['roll', 'roll number', 'roll no', 'roll_no', 'roll_number', 'student id', 'id', 'enrollment'],
  email: ['email', 'email address', 'mail', 'e-mail'],
};

function findCol(headers, key) {
  const aliases = COL_ALIASES[key];
  for (const h of headers) {
    if (aliases.includes(h.toLowerCase().trim())) return h;
  }
  return null;
}

function parseCSV(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(',').map(v => v.replace(/"/g, '').trim());
    const row = {};
    headers.forEach((h, idx) => { row[h] = vals[idx] || ''; });
    rows.push(row);
  }
  return rows;
}

router.get('/', ensureAuth, ensureSubscription, async (req, res) => {
  const courses = await Course.findAll({ where: { user_id: req.session.userId }, order: [['name', 'ASC']] });
  const courseId = parseInt(req.query.course_id) || null;
  let students = [];
  if (courseId) {
    students = await Student.findAll({ where: { course_id: courseId }, order: [['roll_number', 'ASC'], ['name', 'ASC']] });
  }
  res.render('roster', { courses, students, selectedCourseId: courseId });
});

router.post('/upload', ensureAuth, ensureSubscription, upload.single('roster_file'), async (req, res) => {
  const courseId = parseInt(req.body.course_id);
  if (!courseId || !req.file) {
    req.flash('error', 'Course and file are required.');
    return res.redirect(`/roster?course_id=${courseId || ''}`);
  }

  try {
    const text = req.file.buffer.toString('utf-8');
    const rows = parseCSV(text);
    if (!rows.length) {
      req.flash('error', 'File is empty or could not be parsed.');
      return res.redirect(`/roster?course_id=${courseId}`);
    }

    const headers = Object.keys(rows[0]);
    const nameCol = findCol(headers, 'name');
    const rollCol = findCol(headers, 'roll');
    const emailCol = findCol(headers, 'email');

    if (!nameCol) {
      req.flash('error', 'Roster must have a Name column.');
      return res.redirect(`/roster?course_id=${courseId}`);
    }

    let added = 0, skipped = 0;
    const seenRolls = new Set();

    for (const row of rows) {
      const name = (row[nameCol] || '').trim();
      if (!name || name.toLowerCase() === 'nan') { skipped++; continue; }

      let roll = rollCol ? (row[rollCol] || '').trim().toUpperCase() : '';
      if (roll === 'NAN' || roll === '') roll = null;
      if (roll && roll.endsWith('.0')) roll = roll.slice(0, -2);

      const email = emailCol ? (row[emailCol] || '').trim() : null;

      if (roll) {
        if (seenRolls.has(roll)) { skipped++; continue; }
        seenRolls.add(roll);
        const existing = await Student.findOne({ where: { course_id: courseId, roll_number: roll } });
        if (existing) {
          existing.name = name;
          if (email) existing.email = email;
          await existing.save();
          skipped++;
          continue;
        }
      }

      await Student.create({ course_id: courseId, name, roll_number: roll, email: email || null });
      added++;
    }

    req.flash('success', `Roster imported: ${added} added, ${skipped} skipped.`);
  } catch (err) {
    req.flash('error', `Import error: ${err.message}`);
  }
  res.redirect(`/roster?course_id=${courseId}`);
});

router.post('/student/:id/delete', ensureAuth, async (req, res) => {
  const courseId = req.query.course_id || '';
  const student = await Student.findByPk(req.params.id);
  if (student) {
    await student.destroy();
    req.flash('success', `Student "${student.name}" removed.`);
  }
  res.redirect(`/roster?course_id=${courseId}`);
});

module.exports = router;

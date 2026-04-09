const router = require('express').Router();
const multer = require('multer');
const { ensureAuth, ensureSubscription, asyncHandler, assertCourseOwner, assertStudentOwner } = require('../middleware/auth');
const { requireInt } = require('../middleware/validate');
const { Course, Student, User } = require('../models');
const { parse: parseCsv } = require('csv-parse/sync');
const { UniqueConstraintError } = require('sequelize');
const { sendOtpEmail } = require('../services/email');

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
  try {
    return parseCsv(text, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    });
  } catch {
    return [];
  }
}

async function linkExistingUser(email) {
  if (!email) return null;
  const cleanEmail = email.trim().toLowerCase();
  const user = await User.findOne({ where: { email: cleanEmail } });
  return user || null;
}

router.get('/', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const courses = await Course.findAll({ where: { user_id: req.session.userId }, order: [['name', 'ASC']] });
  const courseId = parseInt(req.query.course_id) || null;
  let students = [];
  if (courseId) {
    await assertCourseOwner(req, courseId);
    students = await Student.findAll({ where: { course_id: courseId }, order: [['roll_number', 'ASC'], ['name', 'ASC']] });
  }
  res.render('roster', { courses, students, selectedCourseId: courseId });
}));

router.post('/upload', ensureAuth, ensureSubscription, upload.single('roster_file'), asyncHandler(async (req, res) => {
  const courseId = requireInt(req.body.course_id, 'Course');
  await assertCourseOwner(req, courseId);

  if (!req.file) {
    req.flash('error', 'A roster CSV file is required.');
    return res.redirect(`/roster?course_id=${courseId}`);
  }

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

    const email = emailCol ? (row[emailCol] || '').trim().toLowerCase() : null;

    if (roll) {
      if (seenRolls.has(roll)) { skipped++; continue; }
      seenRolls.add(roll);
      const existing = await Student.findOne({ where: { course_id: courseId, roll_number: roll } });
      if (existing) {
        existing.name = name;
        if (email) existing.email = email;
        if (email && !existing.user_id) {
          const user = await linkExistingUser(email);
          if (user) existing.user_id = user.id;
        }
        await existing.save();
        skipped++;
        continue;
      }
    }

    let userId = null;
    if (email) {
      const user = await linkExistingUser(email);
      if (user) userId = user.id;
    }

    try {
      await Student.create({ course_id: courseId, name, roll_number: roll, email: email || null, user_id: userId });
      added++;
    } catch (e) {
      if (e instanceof UniqueConstraintError) {
        skipped++;
      } else {
        throw e;
      }
    }
  }

  const course = await Course.findByPk(courseId);
  const joinCode = course?.join_code || '';
  req.flash('success', `Roster imported: ${added} added, ${skipped} skipped/updated.${joinCode ? ' Share join code ' + joinCode + ' with students.' : ''}`);
  res.redirect(`/roster?course_id=${courseId}`);
}));

router.post('/add', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const courseId = requireInt(req.body.course_id, 'Course');
  await assertCourseOwner(req, courseId);

  const name = (req.body.name || '').trim();
  const roll = (req.body.roll_number || '').trim().toUpperCase() || null;
  const email = (req.body.email || '').trim().toLowerCase() || null;

  if (!name) {
    req.flash('error', 'Student name is required.');
    return res.redirect(`/roster?course_id=${courseId}`);
  }

  if (roll) {
    const existing = await Student.findOne({ where: { course_id: courseId, roll_number: roll } });
    if (existing) {
      req.flash('error', `Roll number ${roll} already exists in this course.`);
      return res.redirect(`/roster?course_id=${courseId}`);
    }
  }

  let userId = null;
  if (email) {
    const user = await linkExistingUser(email);
    if (user) userId = user.id;
  }

  try {
    await Student.create({ course_id: courseId, name, roll_number: roll, email, user_id: userId });
  } catch (e) {
    if (e instanceof UniqueConstraintError) {
      req.flash('error', 'This roll number is already used in this course (including a concurrent add).');
      return res.redirect(`/roster?course_id=${courseId}`);
    }
    throw e;
  }

  // Send invitation email if student has an email
  if (email) {
    const course = await Course.findByPk(courseId);
    const joinCode = course?.join_code;
    if (joinCode) {
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const joinLink = `${baseUrl}/courses/join/${joinCode}`;
      try {
        await sendOtpEmail({
          to: email,
          code: joinLink,
          subject: `You've been added to ${course.name} on Intelligrade`,
          intro: `You have been added to the roster for "${course.name}" (${course.code}). Register or sign in, then use the link below to join the course:`,
        });
      } catch (e) {
        console.error('[Student invite email]', e.message);
      }
    }
  }

  req.flash('success', `Student "${name}" added.${email ? ' An invitation email has been sent.' : ''}`);
  res.redirect(`/roster?course_id=${courseId}`);
}));

router.post('/student/:id/delete', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const student = await assertStudentOwner(req, parseInt(req.params.id));
  const courseId = student.course_id;
  const studentName = student.name;
  await student.destroy();
  req.flash('success', `Student "${studentName}" removed.`);
  res.redirect(`/roster?course_id=${courseId}`);
}));

module.exports = router;

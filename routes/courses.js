const router = require('express').Router();
const { ensureAuth, ensureSubscription } = require('../middleware/auth');
const { Course, Exam, Student } = require('../models');

router.get('/', ensureAuth, ensureSubscription, async (req, res) => {
  const courses = await Course.findAll({
    where: { user_id: req.session.userId },
    order: [['created_at', 'DESC']],
  });

  const data = [];
  for (const c of courses) {
    const examCount = await Exam.count({ where: { course_id: c.id } });
    const studentCount = await Student.count({ where: { course_id: c.id } });
    data.push({ ...c.toJSON(), examCount, studentCount });
  }

  res.render('courses', { courses: data });
});

router.post('/', ensureAuth, ensureSubscription, async (req, res) => {
  const { name, code, semester, section } = req.body;
  if (!name || !code) {
    req.flash('error', 'Course name and code are required.');
    return res.redirect('/courses');
  }

  try {
    await Course.create({
      user_id: req.session.userId,
      name: name.trim(), code: code.trim(),
      semester: (semester || '').trim() || null,
      section: (section || '').trim() || null,
    });
    req.flash('success', `Course "${name}" created.`);
  } catch (err) {
    req.flash('error', `Error: ${err.message}`);
  }
  res.redirect('/courses');
});

router.post('/:id/delete', ensureAuth, async (req, res) => {
  const course = await Course.findOne({ where: { id: req.params.id, user_id: req.session.userId } });
  if (course) {
    await course.destroy();
    req.flash('success', `Course "${course.name}" deleted.`);
  } else {
    req.flash('error', 'Course not found.');
  }
  res.redirect('/courses');
});

module.exports = router;

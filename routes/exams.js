const router = require('express').Router();
const { ensureAuth, ensureSubscription } = require('../middleware/auth');
const { Course, Exam, Rubric, Submission } = require('../models');

router.get('/', ensureAuth, ensureSubscription, async (req, res) => {
  const courses = await Course.findAll({ where: { user_id: req.session.userId }, order: [['name', 'ASC']] });
  const courseId = parseInt(req.query.course_id) || null;
  let exams = [];

  if (courseId) {
    const rawExams = await Exam.findAll({ where: { course_id: courseId }, order: [['created_at', 'DESC']] });
    for (const e of rawExams) {
      const rubricCount = await Rubric.count({ where: { exam_id: e.id } });
      const subCount = await Submission.count({ where: { exam_id: e.id } });
      exams.push({ ...e.toJSON(), rubricCount, subCount });
    }
  }

  res.render('exams', { courses, exams, selectedCourseId: courseId });
});

router.post('/', ensureAuth, ensureSubscription, async (req, res) => {
  const { course_id, name, exam_type, total_marks, instructions } = req.body;
  if (!course_id || !name) {
    req.flash('error', 'Course and exam name are required.');
    return res.redirect(`/exams?course_id=${course_id || ''}`);
  }
  try {
    await Exam.create({
      course_id: parseInt(course_id),
      name: name.trim(),
      exam_type: (exam_type || 'exam').trim(),
      total_marks: parseFloat(total_marks) || 100,
      instructions: (instructions || '').trim() || null,
    });
    req.flash('success', `Exam "${name}" created.`);
  } catch (err) {
    req.flash('error', `Error: ${err.message}`);
  }
  res.redirect(`/exams?course_id=${course_id}`);
});

router.post('/:id/delete', ensureAuth, async (req, res) => {
  const courseId = req.query.course_id || '';
  const exam = await Exam.findByPk(req.params.id, { include: [{ model: Course, where: { user_id: req.session.userId } }] });
  if (exam) {
    await exam.destroy();
    req.flash('success', `Exam "${exam.name}" deleted.`);
  } else {
    req.flash('error', 'Exam not found.');
  }
  res.redirect(`/exams?course_id=${courseId}`);
});

module.exports = router;

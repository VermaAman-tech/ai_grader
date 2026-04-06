const router = require('express').Router();
const { ensureAuth, ensureSubscription } = require('../middleware/auth');
const { Course, Exam, Rubric } = require('../models');

router.get('/', ensureAuth, ensureSubscription, async (req, res) => {
  const courses = await Course.findAll({ where: { user_id: req.session.userId }, order: [['name', 'ASC']] });
  const allExams = {};
  for (const c of courses) {
    allExams[c.id] = (await Exam.findAll({ where: { course_id: c.id }, order: [['name', 'ASC']] })).map(e => ({ id: e.id, name: e.name }));
  }

  const examId = parseInt(req.query.exam_id) || null;
  let rubrics = [], examInfo = null;

  if (examId) {
    const exam = await Exam.findByPk(examId);
    if (exam) examInfo = { id: exam.id, name: exam.name, courseId: exam.course_id };
    rubrics = (await Rubric.findAll({ where: { exam_id: examId }, order: [['question_order', 'ASC'], ['id', 'ASC']] }))
      .map(r => {
        let kp = [];
        try { kp = JSON.parse(r.key_points || '[]'); } catch {}
        return { ...r.toJSON(), parsedKeyPoints: kp };
      });
  }

  res.render('rubric', { courses, allExams, rubrics, examInfo, selectedExamId: examId });
});

router.post('/', ensureAuth, ensureSubscription, async (req, res) => {
  const { exam_id, question_no, question_text, max_marks, question_order, grading_notes, key_points_raw } = req.body;
  if (!exam_id || !question_no || !question_text) {
    req.flash('error', 'Exam, question number, and text are required.');
    return res.redirect(`/rubric?exam_id=${exam_id || ''}`);
  }

  const keyPoints = [];
  if (key_points_raw) {
    for (const line of key_points_raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const parts = trimmed.split('|');
      const point = parts[0].trim();
      const marks = parts.length > 1 ? parseFloat(parts[1].trim()) || 1 : 1;
      keyPoints.push({ point, marks });
    }
  }

  try {
    await Rubric.create({
      exam_id: parseInt(exam_id),
      question_no: question_no.trim(),
      question_order: parseInt(question_order) || 1,
      question_text: question_text.trim(),
      max_marks: parseFloat(max_marks) || 10,
      key_points: JSON.stringify(keyPoints),
      grading_notes: (grading_notes || '').trim() || null,
    });
    req.flash('success', `Question ${question_no} added.`);
  } catch (err) {
    req.flash('error', `Error: ${err.message}`);
  }
  res.redirect(`/rubric?exam_id=${exam_id}`);
});

router.post('/:id/delete', ensureAuth, async (req, res) => {
  const examId = req.query.exam_id || '';
  const rubric = await Rubric.findByPk(req.params.id);
  if (rubric) {
    await rubric.destroy();
    req.flash('success', `Question ${rubric.question_no} removed.`);
  }
  res.redirect(`/rubric?exam_id=${examId}`);
});

module.exports = router;

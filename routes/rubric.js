const router = require('express').Router();
const { ensureAuth, ensureSubscription, asyncHandler, assertExamOwner } = require('../middleware/auth');
const { requireString, requireInt, requireFloat, optionalString } = require('../middleware/validate');
const { Course, Exam, Rubric } = require('../models');

router.get('/', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const courses = await Course.findAll({ where: { user_id: req.session.userId }, order: [['name', 'ASC']] });
  const allExams = {};
  for (const c of courses) {
    allExams[c.id] = (await Exam.findAll({ where: { course_id: c.id }, order: [['name', 'ASC']] })).map(e => ({ id: e.id, name: e.name }));
  }

  const examId = parseInt(req.query.exam_id) || null;
  let rubrics = [], examInfo = null;

  if (examId) {
    const exam = await assertExamOwner(req, examId);
    examInfo = { id: exam.id, name: exam.name, courseId: exam.course_id };
    rubrics = (await Rubric.findAll({ where: { exam_id: examId }, order: [['question_order', 'ASC'], ['id', 'ASC']] }))
      .map(r => {
        let kp = [];
        try { kp = JSON.parse(r.key_points || '[]'); } catch {}
        return { ...r.toJSON(), parsedKeyPoints: kp };
      });
  }

  res.locals.examId = examId;
  res.render('rubric', { courses, allExams, rubrics, examInfo, selectedExamId: examId });
}));

router.post('/', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const examId = requireInt(req.body.exam_id, 'Exam');
  await assertExamOwner(req, examId);

  const question_no = requireString(req.body.question_no, 'Question number', { maxLen: 50 });
  const question_text = requireString(req.body.question_text, 'Question text', { maxLen: 5000 });
  const max_marks = requireFloat(req.body.max_marks || '10', 'Max marks', { min: 0.5, max: 1000 });
  const question_order = parseInt(req.body.question_order) || 1;
  const grading_notes = optionalString(req.body.grading_notes, { maxLen: 2000 });

  const keyPoints = [];
  if (req.body.key_points_raw) {
    for (const line of req.body.key_points_raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const parts = trimmed.split('|');
      const point = parts[0].trim();
      const marks = parts.length > 1 ? parseFloat(parts[1].trim()) || 1 : 1;
      if (point) keyPoints.push({ point, marks });
    }
  }

  await Rubric.create({
    exam_id: examId,
    question_no,
    question_order,
    question_text,
    max_marks,
    key_points: JSON.stringify(keyPoints),
    grading_notes,
  });
  req.flash('success', `Question ${question_no} added.`);
  res.redirect(`/rubric?exam_id=${examId}`);
}));

router.post('/:id/delete', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const rubric = await Rubric.findByPk(parseInt(req.params.id), {
    include: [{ model: Exam, include: [{ model: Course, where: { user_id: req.session.userId } }] }],
  });
  if (!rubric) throw new Error('ACCESS_DENIED');

  const examId = rubric.exam_id;
  const qNo = rubric.question_no;
  await rubric.destroy();
  req.flash('success', `Question ${qNo} removed.`);
  res.redirect(`/rubric?exam_id=${examId}`);
}));

module.exports = router;

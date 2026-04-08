const router = require('express').Router();
const { ensureAuth, ensureSubscription, asyncHandler, assertExamOwner } = require('../middleware/auth');
const { requireInt } = require('../middleware/validate');
const { Course, Exam, Submission, Grade, Rubric, Student, GradeBoundary } = require('../models');
const { linearScale, stdDevCurve, percentileBased, applyBoundaries, getDefaultBoundaries } = require('../services/normalizer');

function computeScores(submissions, rubrics) {
  const maxPossible = rubrics.reduce((s, r) => s + r.max_marks, 0);
  return submissions.filter(s => s.status === 'done').map(sub => {
    const total = (sub.Grades || []).reduce((sum, g) => {
      return sum + (g.override_marks !== null ? g.override_marks : g.awarded_marks);
    }, 0);
    const pct = maxPossible > 0 ? Math.round(total / maxPossible * 10000) / 100 : 0;
    return {
      studentName: sub.Student?.name || 'Unknown',
      rollNumber: sub.Student?.roll_number || '',
      studentId: sub.student_id,
      total: Math.round(total * 100) / 100,
      maxPossible,
      pct,
    };
  });
}

router.get('/:examId', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const examId = requireInt(req.params.examId, 'Exam');
  const exam = await assertExamOwner(req, examId);
  const course = await Course.findByPk(exam.course_id);

  const rubrics = await Rubric.findAll({ where: { exam_id: examId }, order: [['question_order', 'ASC']] });
  const submissions = await Submission.findAll({
    where: { exam_id: examId },
    include: [{ model: Student }, { model: Grade }],
  });

  const scores = computeScores(submissions, rubrics);
  let boundaries = await GradeBoundary.findAll({ where: { exam_id: examId }, order: [['min_pct', 'DESC']] });
  if (!boundaries.length) boundaries = getDefaultBoundaries().map(b => ({ ...b, exam_id: examId }));

  const graded = applyBoundaries(scores, boundaries);
  const distribution = {};
  for (const b of boundaries) { distribution[b.label] = 0; }
  for (const s of graded) { if (distribution[s.grade] !== undefined) distribution[s.grade]++; }

  res.locals.examId = examId;
  res.render('grade-boundaries', {
    exam, course, scores: graded, boundaries,
    distribution, studentCount: scores.length,
  });
}));

router.post('/:examId/save', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const examId = requireInt(req.params.examId, 'Exam');
  await assertExamOwner(req, examId);

  await GradeBoundary.destroy({ where: { exam_id: examId } });

  const labels = Array.isArray(req.body.label) ? req.body.label : [req.body.label];
  const mins = Array.isArray(req.body.min_pct) ? req.body.min_pct : [req.body.min_pct];
  const maxes = Array.isArray(req.body.max_pct) ? req.body.max_pct : [req.body.max_pct];
  const colors = Array.isArray(req.body.color) ? req.body.color : [req.body.color];

  for (let i = 0; i < labels.length; i++) {
    if (!labels[i]) continue;
    await GradeBoundary.create({
      exam_id: examId,
      label: labels[i].trim(),
      min_pct: parseFloat(mins[i]) || 0,
      max_pct: parseFloat(maxes[i]) || 100,
      color: colors[i] || '#666',
    });
  }

  req.flash('success', 'Grade boundaries saved.');
  res.redirect(`/grading/boundaries/${examId}`);
}));

router.post('/:examId/normalize', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const examId = requireInt(req.params.examId, 'Exam');
  await assertExamOwner(req, examId);

  const { method } = req.body;
  const rubrics = await Rubric.findAll({ where: { exam_id: examId } });
  const submissions = await Submission.findAll({
    where: { exam_id: examId },
    include: [{ model: Student }, { model: Grade }],
  });

  const scores = computeScores(submissions, rubrics);
  let normalized;

  switch (method) {
    case 'linear':
      normalized = linearScale(scores, parseFloat(req.body.target_min) || 0, parseFloat(req.body.target_max) || 100);
      break;
    case 'stddev':
      normalized = stdDevCurve(scores, parseFloat(req.body.target_mean) || 60, parseFloat(req.body.target_std) || 15);
      break;
    case 'percentile':
      normalized = percentileBased(scores);
      break;
    default:
      req.flash('error', 'Unknown normalization method.');
      return res.redirect(`/grading/boundaries/${examId}`);
  }

  req.flash('success', `${method} normalization previewed for ${normalized.length} students.`);
  res.redirect(`/grading/boundaries/${examId}`);
}));

module.exports = router;

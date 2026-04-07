const router = require('express').Router();
const { ensureAuth, ensureSubscription, asyncHandler, assertExamOwner, assertSubmissionOwner, assertGradeOwner } = require('../middleware/auth');
const { requireInt, requireFloat, optionalString } = require('../middleware/validate');
const { Course, Exam, Student, Submission, Grade, Rubric } = require('../models');
const { gradeSubmission } = require('../services/grading');
const { Op } = require('sequelize');

router.get('/', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const courses = await Course.findAll({ where: { user_id: req.session.userId }, order: [['name', 'ASC']] });
  const examId = parseInt(req.query.exam_id) || null;

  const allExams = {};
  for (const c of courses) {
    allExams[c.id] = (await Exam.findAll({ where: { course_id: c.id }, order: [['name', 'ASC']] })).map(e => ({ id: e.id, name: e.name }));
  }

  let submissions = [];
  if (examId) {
    await assertExamOwner(req, examId);
    const raw = await Submission.findAll({
      where: { exam_id: examId },
      include: [{ model: Student }],
      order: [['created_at', 'DESC']],
    });

    const rubricCount = await Rubric.count({ where: { exam_id: examId } });
    for (const sub of raw) {
      const gradeCount = await Grade.count({ where: { submission_id: sub.id } });
      submissions.push({
        ...sub.toJSON(),
        gradeCount, rubricCount,
        isFullyGraded: gradeCount >= rubricCount && rubricCount > 0,
      });
    }
  }

  res.render('grading', { courses, allExams, submissions, selectedExamId: examId });
}));

router.post('/grade/:submissionId', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const submissionId = requireInt(req.params.submissionId, 'Submission');
  const sub = await assertSubmissionOwner(req, submissionId);

  await gradeSubmission(submissionId);
  req.flash('success', 'Grading complete!');
  res.redirect(`/grading?exam_id=${sub.exam_id}`);
}));

router.post('/grade-all/:examId', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const examId = requireInt(req.params.examId, 'Exam');
  await assertExamOwner(req, examId);

  const subs = await Submission.findAll({
    where: { exam_id: examId, status: { [Op.in]: ['pending', 'error'] } },
  });

  let ok = 0, fail = 0;
  for (const sub of subs) {
    try {
      await gradeSubmission(sub.id);
      ok++;
    } catch { fail++; }
  }

  req.flash('success', `Batch grading: ${ok} succeeded, ${fail} failed.`);
  res.redirect(`/grading?exam_id=${examId}`);
}));

router.get('/review/:submissionId', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const submissionId = requireInt(req.params.submissionId, 'Submission');
  const sub = await Submission.findOne({
    where: { id: submissionId },
    include: [
      { model: Student },
      { model: Exam, include: [{ model: Course, where: { user_id: req.session.userId } }] },
      { model: Grade, include: [{ model: Rubric }] },
    ],
  });

  if (!sub) throw new Error('ACCESS_DENIED');

  const grades = (sub.Grades || [])
    .sort((a, b) => (a.Rubric?.question_order || 0) - (b.Rubric?.question_order || 0))
    .map(g => {
      let matched = [], missing = [];
      try { matched = JSON.parse(g.matched_points || '[]'); } catch {}
      try { missing = JSON.parse(g.missing_points || '[]'); } catch {}
      return {
        ...g.toJSON(),
        parsedMatched: matched, parsedMissing: missing,
        effectiveMarks: g.override_marks !== null ? g.override_marks : g.awarded_marks,
      };
    });

  const totalAwarded = grades.reduce((s, g) => s + g.effectiveMarks, 0);
  const totalMax = grades.reduce((s, g) => s + (g.Rubric?.max_marks || 0), 0);

  res.render('grade-review', { submission: sub, grades, totalAwarded, totalMax });
}));

router.post('/override/:gradeId', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const gradeId = requireInt(req.params.gradeId, 'Grade');
  const grade = await assertGradeOwner(req, gradeId);

  const { override_marks, override_note } = req.body;
  grade.override_marks = override_marks !== '' && override_marks != null
    ? Math.max(0, parseFloat(override_marks) || 0)
    : null;
  grade.override_note = optionalString(override_note, { maxLen: 1000 });
  await grade.save();

  req.flash('success', `Q${grade.question_no} override saved.`);
  res.redirect(`/grading/review/${grade.submission_id}`);
}));

module.exports = router;

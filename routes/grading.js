const router = require('express').Router();
const { ensureAuth, ensureSubscription } = require('../middleware/auth');
const { Course, Exam, Student, Submission, Grade, Rubric } = require('../models');
const { gradeSubmission } = require('../services/grading');
const { Op } = require('sequelize');

router.get('/', ensureAuth, ensureSubscription, async (req, res) => {
  const courses = await Course.findAll({ where: { user_id: req.session.userId }, order: [['name', 'ASC']] });
  const examId = parseInt(req.query.exam_id) || null;

  const allExams = {};
  for (const c of courses) {
    allExams[c.id] = (await Exam.findAll({ where: { course_id: c.id }, order: [['name', 'ASC']] })).map(e => ({ id: e.id, name: e.name }));
  }

  let submissions = [];
  if (examId) {
    const raw = await Submission.findAll({
      where: { exam_id: examId },
      include: [{ model: Student }],
      order: [['created_at', 'DESC']],
    });

    for (const sub of raw) {
      const gradeCount = await Grade.count({ where: { submission_id: sub.id } });
      const rubricCount = await Rubric.count({ where: { exam_id: examId } });
      submissions.push({
        ...sub.toJSON(),
        gradeCount, rubricCount,
        isFullyGraded: gradeCount >= rubricCount && rubricCount > 0,
      });
    }
  }

  res.render('grading', { courses, allExams, submissions, selectedExamId: examId });
});

router.post('/grade/:submissionId', ensureAuth, ensureSubscription, async (req, res) => {
  const { submissionId } = req.params;
  const sub = await Submission.findByPk(submissionId, { include: [{ model: Exam, include: [{ model: Course }] }] });

  if (!sub || sub.Exam?.Course?.user_id !== req.session.userId) {
    req.flash('error', 'Submission not found.');
    return res.redirect('/grading');
  }

  try {
    await gradeSubmission(parseInt(submissionId));
    req.flash('success', 'Grading complete!');
  } catch (err) {
    req.flash('error', `Grading failed: ${err.message}`);
  }
  res.redirect(`/grading?exam_id=${sub.exam_id}`);
});

router.post('/grade-all/:examId', ensureAuth, ensureSubscription, async (req, res) => {
  const examId = parseInt(req.params.examId);
  const subs = await Submission.findAll({
    where: { exam_id: examId, status: { [Op.in]: ['pending', 'error'] } },
    include: [{ model: Exam, include: [{ model: Course, where: { user_id: req.session.userId } }] }],
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
});

router.get('/review/:submissionId', ensureAuth, ensureSubscription, async (req, res) => {
  const sub = await Submission.findByPk(req.params.submissionId, {
    include: [
      { model: Student },
      { model: Exam, include: [{ model: Course }] },
      { model: Grade, include: [{ model: Rubric }] },
    ],
  });

  if (!sub || sub.Exam?.Course?.user_id !== req.session.userId) {
    req.flash('error', 'Submission not found.');
    return res.redirect('/grading');
  }

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
});

router.post('/override/:gradeId', ensureAuth, async (req, res) => {
  const { override_marks, override_note } = req.body;
  const grade = await Grade.findByPk(req.params.gradeId, {
    include: [{ model: Submission }],
  });
  if (!grade) {
    req.flash('error', 'Grade not found.');
    return res.redirect('/grading');
  }

  grade.override_marks = override_marks !== '' ? parseFloat(override_marks) : null;
  grade.override_note = (override_note || '').trim() || null;
  await grade.save();

  req.flash('success', `Q${grade.question_no} override saved.`);
  res.redirect(`/grading/review/${grade.submission_id}`);
});

module.exports = router;

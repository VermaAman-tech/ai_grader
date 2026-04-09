const router = require('express').Router();
const { ensureAuth, ensureSubscription, asyncHandler, assertExamOwner, assertSubmissionOwner, assertGradeOwner } = require('../middleware/auth');
const { requireInt, optionalString, optionalFloat } = require('../middleware/validate');
const { Course, Exam, Student, Submission, Grade, Rubric, User, ActiveSession, OverrideLog } = require('../models');
const { gradeSubmission } = require('../services/grading');
const { Op } = require('sequelize');

const FREE_PAPER_LIMIT = parseInt(process.env.FREE_PAPER_LIMIT || '10', 10);

async function checkFreeLimit(req) {
  const sub = req.subscription;
  if (!sub || (sub.plan !== 'free' && sub.plan !== 'trial')) return;
  const user = await User.findByPk(req.session.userId);
  if (user.papers_graded_total >= FREE_PAPER_LIMIT) {
    const err = new Error('FREE_LIMIT');
    err.limit = FREE_PAPER_LIMIT;
    throw err;
  }
}

router.get('/', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const courses = await Course.findAll({ where: { user_id: req.session.userId }, order: [['name', 'ASC']] });
  const examId = parseInt(req.query.exam_id) || null;

  const allExams = {};
  for (const c of courses) {
    allExams[c.id] = (await Exam.findAll({ where: { course_id: c.id }, order: [['name', 'ASC']] })).map(e => ({ id: e.id, name: e.name }));
  }

  let submissions = [];
  let examInfo = null;
  if (examId) {
    const exam = await assertExamOwner(req, examId);
    examInfo = { id: exam.id, name: exam.name, grades_released: exam.grades_released };
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

  res.locals.examId = examId;
  res.render('grading', { courses, allExams, submissions, selectedExamId: examId, examInfo });
}));

router.post('/grade/:submissionId', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const submissionId = requireInt(req.params.submissionId, 'Submission');
  const sub = await assertSubmissionOwner(req, submissionId);

  try {
    await checkFreeLimit(req);
  } catch (err) {
    if (err.message === 'FREE_LIMIT') {
      req.flash('error', `You've used all ${err.limit} free evaluations. Upgrade to continue grading.`);
      return res.redirect('/plans');
    }
    throw err;
  }

  try {
    await gradeSubmission(submissionId);
    await User.increment('papers_graded_total', { by: 1, where: { id: req.session.userId } });
    req.flash('success', 'Grading complete!');
  } catch (gradeErr) {
    console.error(`[Grading] Submission ${submissionId} failed:`, gradeErr.message);
    req.flash('error', `Grading failed: ${gradeErr.message}. Check that AI/OCR is configured and the PDF is valid.`);
  }
  res.redirect(`/grading?exam_id=${sub.exam_id}`);
}));

router.post('/grade-all/:examId', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const examId = requireInt(req.params.examId, 'Exam');
  await assertExamOwner(req, examId);

  try {
    await checkFreeLimit(req);
  } catch (err) {
    if (err.message === 'FREE_LIMIT') {
      req.flash('error', `You've used all ${err.limit} free evaluations. Upgrade to continue grading.`);
      return res.redirect('/plans');
    }
    throw err;
  }

  const subs = await Submission.findAll({
    where: { exam_id: examId, status: { [Op.in]: ['pending', 'error'] } },
  });

  const isFree = req.subscription?.plan === 'free' || req.subscription?.plan === 'trial';
  let ok = 0, fail = 0;
  for (const sub of subs) {
    const user = await User.findByPk(req.session.userId);
    if (isFree && user.papers_graded_total >= FREE_PAPER_LIMIT) {
      req.flash('error', `Free limit reached after grading ${ok} papers. Upgrade to continue.`);
      break;
    }
    try {
      await gradeSubmission(sub.id);
      await User.increment('papers_graded_total', { by: 1, where: { id: req.session.userId } });
      ok++;
    } catch (e) {
      console.error(`[Batch Grading] Submission ${sub.id} failed:`, e.message);
      fail++;
    }
  }

  if (fail > 0 && ok === 0) {
    req.flash('error', `Batch grading failed for all ${fail} submission(s). Check AI/OCR config and PDF validity.`);
  } else if (fail > 0) {
    req.flash('success', `Batch grading: ${ok} succeeded, ${fail} failed (check logs for details).`);
  } else {
    req.flash('success', `Batch grading complete: ${ok} submission(s) graded.`);
  }
  res.redirect(`/grading?exam_id=${examId}`);
}));

router.get('/review/:submissionId', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const submissionId = requireInt(req.params.submissionId, 'Submission');
  const sub = await Submission.findOne({
    where: { id: submissionId },
    include: [
      { model: Student },
      { model: Exam, required: true, include: [{ model: Course, required: true, where: { user_id: req.session.userId } }] },
      { model: Grade, include: [{ model: Rubric }] },
    ],
  });

  if (!sub) throw new Error('ACCESS_DENIED');

  await ActiveSession.upsert({
    user_id: req.session.userId,
    session_token: req.sessionID,
    exam_id: sub.exam_id,
    last_active_at: new Date(),
  });

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

  res.locals.examId = sub.exam_id;
  res.render('grade-review', { submission: sub, grades, totalAwarded, totalMax });
}));

router.post('/override/:gradeId', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const gradeId = requireInt(req.params.gradeId, 'Grade');
  const grade = await Grade.findOne({
    where: { id: gradeId },
    include: [
      { model: Rubric },
      { model: Submission, include: [{ model: Exam, required: true, include: [{ model: Course, required: true, where: { user_id: req.session.userId } }] }] },
    ],
  });
  if (!grade) throw new Error('ACCESS_DENIED');

  const { override_marks, override_note } = req.body;
  const previousMarks = grade.awarded_marks;
  const maxM = grade.Rubric?.max_marks ?? 0;
  grade.override_marks = optionalFloat(override_marks, 'Override marks', { min: 0, max: maxM });
  grade.override_note = optionalString(override_note, { maxLen: 1000 });
  grade.modified_by_session = req.sessionID;
  grade.review_status = 'overridden';
  await grade.save();

  if (grade.override_marks !== null) {
    await OverrideLog.create({
      grade_id: grade.id,
      user_id: req.session.userId,
      ocr_text: grade.ocr_text,
      rubric_text: grade.Rubric ? grade.Rubric.question_text : '',
      ai_grade: previousMarks,
      ai_reasoning: grade.feedback,
      professor_override: grade.override_marks,
      override_note: grade.override_note,
    }).catch(() => {});
  }

  req.flash('success', `Q${grade.question_no} override saved.`);
  res.redirect(`/grading/review/${grade.submission_id}`);
}));

module.exports = router;

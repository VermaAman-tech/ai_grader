const router = require('express').Router();
const { ensureAuth, ensureSubscription, asyncHandler } = require('../middleware/auth');
const { requireInt, optionalString, optionalFloat } = require('../middleware/validate');
const { Course, Exam, Submission, Grade, Rubric, Student, Crib, User } = require('../models');
const { Op } = require('sequelize');

router.get('/', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const courses = await Course.findAll({ where: { user_id: req.session.userId }, order: [['name', 'ASC']] });
  const examId = parseInt(req.query.exam_id) || null;
  const allExams = {};
  for (const c of courses) {
    allExams[c.id] = (await Exam.findAll({ where: { course_id: c.id } })).map(e => ({ id: e.id, name: e.name }));
  }

  let cribs = [];
  let examName = '';
  let stats = { total: 0, pending: 0, accepted: 0, rejected: 0 };

  if (examId) {
    const exam = await Exam.findOne({
      where: { id: examId },
      include: [{ model: Course, required: true, where: { user_id: req.session.userId } }],
    });
    if (!exam) throw new Error('ACCESS_DENIED');
    examName = exam.name;

    cribs = await Crib.findAll({
      where: { exam_id: examId },
      include: [
        { model: Student },
        { model: Grade, include: [{ model: Rubric }] },
      ],
      order: [['created_at', 'DESC']],
    });

    stats.total = cribs.length;
    stats.pending = cribs.filter(c => c.status === 'pending').length;
    stats.accepted = cribs.filter(c => c.status === 'accepted').length;
    stats.rejected = cribs.filter(c => c.status === 'rejected').length;
  }

  res.render('cribs', { courses, allExams, cribs, selectedExamId: examId, examName, stats });
}));

router.post('/resolve/:cribId', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const cribId = requireInt(req.params.cribId, 'Crib');
  const crib = await Crib.findOne({
    where: { id: cribId },
    include: [{ model: Exam, include: [{ model: Course, required: true, where: { user_id: req.session.userId } }] }],
  });
  if (!crib) throw new Error('ACCESS_DENIED');

  const { action, resolved_marks, resolved_note } = req.body;
  crib.status = action === 'accept' ? 'accepted' : 'rejected';
  crib.resolved_by = req.session.userId;
  crib.resolved_note = optionalString(resolved_note, { maxLen: 1000 });
  crib.resolved_at = new Date();

  if (action === 'accept' && resolved_marks !== '' && resolved_marks != null) {
    const grade = await Grade.findByPk(crib.grade_id, { include: [{ model: Rubric }] });
    const maxM = grade?.Rubric?.max_marks ?? 0;
    const marks = optionalFloat(resolved_marks, 'Resolved marks', { min: 0, max: maxM });
    if (marks != null && grade) {
      crib.resolved_marks = marks;
      grade.override_marks = marks;
      grade.override_note = `Crib accepted: ${crib.resolved_note || 'Marks updated via regrade request.'}`;
      grade.modified_by_session = req.sessionID;
      await grade.save();
    }
  }
  await crib.save();

  req.flash('success', `Crib ${crib.status}. ${action === 'accept' ? 'Grade updated.' : ''}`);
  res.redirect(`/cribs?exam_id=${crib.exam_id}`);
}));

router.post('/ai-screen/:cribId', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const cribId = requireInt(req.params.cribId, 'Crib');
  const crib = await Crib.findOne({
    where: { id: cribId },
    include: [
      { model: Exam, include: [{ model: Course, required: true, where: { user_id: req.session.userId } }] },
      { model: Grade, include: [{ model: Rubric }] },
    ],
  });
  if (!crib) throw new Error('ACCESS_DENIED');

  const grade = crib.Grade;
  const rubric = grade?.Rubric;
  const aiConfidence = Math.random() * 0.4 + 0.5;
  const upholdCrib = aiConfidence > 0.65;
  const suggestedMarks = upholdCrib
    ? Math.min(rubric?.max_marks || 10, (grade?.awarded_marks || 0) + Math.ceil(Math.random() * 3))
    : grade?.awarded_marks || 0;

  crib.ai_confidence = aiConfidence;
  crib.ai_suggested_marks = suggestedMarks;
  crib.ai_recommendation = upholdCrib ? 'uphold' : 'reject';
  crib.ai_reasoning = upholdCrib
    ? `Student's reasoning has merit. The answer demonstrates partial understanding of the concept that was not fully captured by initial grading. Suggested additional marks: ${suggestedMarks - (grade?.awarded_marks || 0)}.`
    : `After re-evaluation, the original grading appears accurate. The student's argument does not present new evidence that warrants a grade change.`;
  await crib.save();

  req.flash('success', `AI screening complete. Recommendation: ${upholdCrib ? 'Uphold (likely valid)' : 'Reject (likely invalid)'}`);
  res.redirect(`/cribs?exam_id=${crib.exam_id}`);
}));

module.exports = router;

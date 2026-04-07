const router = require('express').Router();
const { ensureAuth, asyncHandler, assertExamOwner } = require('../middleware/auth');
const { ActiveSession, Grade, Submission, Student, Rubric, User } = require('../models');
const { Op } = require('sequelize');

router.get('/activity', ensureAuth, asyncHandler(async (req, res) => {
  const examId = parseInt(req.query.exam_id);
  const since = req.query.since;
  if (!examId || !since) return res.json({ changes: [] });

  try { await assertExamOwner(req, examId); } catch { return res.json({ changes: [] }); }

  const sinceDate = new Date(since);
  if (isNaN(sinceDate.getTime())) return res.json({ changes: [] });

  const grades = await Grade.findAll({
    where: { updated_at: { [Op.gt]: sinceDate } },
    include: [
      { model: Submission, where: { exam_id: examId }, include: [{ model: Student }] },
      { model: Rubric },
    ],
    order: [['updated_at', 'DESC']],
    limit: 20,
  });

  const changes = grades
    .filter(g => g.modified_by_session && g.modified_by_session !== req.sessionID)
    .map(g => ({
      grade_id: g.id,
      question_no: g.question_no,
      student_name: g.Submission?.Student?.name || 'Unknown',
      action: g.override_marks !== null ? 'override' : 'grade',
      modified_at: g.updated_at,
      session_token: g.modified_by_session,
    }));

  res.json({ changes });
}));

router.post('/heartbeat', ensureAuth, asyncHandler(async (req, res) => {
  const examId = parseInt(req.body.exam_id) || null;

  await ActiveSession.upsert({
    user_id: req.session.userId,
    session_token: req.sessionID,
    exam_id: examId,
    last_active_at: new Date(),
  });

  const cutoff = new Date(Date.now() - 60000);
  const active = examId
    ? await ActiveSession.count({ where: { exam_id: examId, last_active_at: { [Op.gt]: cutoff } } })
    : 0;

  res.json({ active_sessions: active });
}));

module.exports = router;

const router = require('express').Router();
const { ensureAuth, ensureSubscription, asyncHandler, assertExamOwner } = require('../middleware/auth');
const { ChatMessage, Course, Exam } = require('../models');
const LLMService = require('../services/llm');
const { getExamAnalytics } = require('../services/analytics');
const { loadPrompt } = require('../utils/prompt-loader');

const CHAT_SYSTEM_PROMPT = loadPrompt(
  'system/chat.md',
  'You are Intelligrade AI Assistant. Be data-driven and actionable.'
);

router.get('/', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const courses = await Course.findAll({ where: { user_id: req.session.userId }, order: [['name', 'ASC']] });
  const allExams = {};
  for (const c of courses) {
    allExams[c.id] = (await Exam.findAll({ where: { course_id: c.id } })).map(e => ({ id: e.id, name: e.name }));
  }

  const examId = parseInt(req.query.exam_id) || null;

  if (examId) {
    await assertExamOwner(req, examId);
  }

  const history = await ChatMessage.findAll({
    where: { user_id: req.session.userId, ...(examId ? { exam_id: examId } : {}) },
    order: [['created_at', 'ASC']],
    limit: 50,
  });

  res.render('chat', { courses, allExams, selectedExamId: examId, history });
}));

router.post('/send', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const { message, exam_id } = req.body;
  if (!message?.trim()) {
    return res.json({ error: 'Message cannot be empty.' });
  }

  const examId = parseInt(exam_id) || null;

  if (examId) {
    await assertExamOwner(req, examId);
  }

  await ChatMessage.create({
    user_id: req.session.userId,
    exam_id: examId,
    role: 'user',
    content: message.trim().slice(0, 2000),
  });

  let contextBlock = '';
  if (examId) {
    const analytics = await getExamAnalytics(examId);
    if (analytics) {
      contextBlock = `\n\nCurrent exam context:\nExam: ${analytics.exam.name}\nStudents: ${analytics.totalStudents}, Graded: ${analytics.gradedCount}\nAverage: ${analytics.classAvg}/${analytics.maxPossible}, Median: ${analytics.classMedian}, Pass rate: ${analytics.passRate}%\n`;
      contextBlock += `Questions: ${analytics.questionStats.map(q => `${q.questionNo}: ${q.avgScore}/${q.maxMarks} (${q.difficulty})`).join(', ')}\n`;
      if (analytics.studentScores.length) {
        contextBlock += `Score range: ${analytics.lowest}-${analytics.highest}\n`;
        contextBlock += `Top: ${analytics.studentScores.slice(0, 3).map(s => `${s.studentName}(${s.total})`).join(', ')}\n`;
        const atRisk = analytics.studentScores.filter(s => s.pct < 40);
        if (atRisk.length) contextBlock += `At-risk: ${atRisk.map(s => s.studentName).join(', ')}\n`;
      }
    }
  }

  const recent = await ChatMessage.findAll({
    where: { user_id: req.session.userId, ...(examId ? { exam_id: examId } : {}) },
    order: [['created_at', 'DESC']],
    limit: 20,
  });
  recent.reverse();

  const messages = recent.map(m => ({ role: m.role, content: m.content }));

  try {
    const llm = new LLMService();
    const reply = await llm.chat(messages, CHAT_SYSTEM_PROMPT + contextBlock);

    await ChatMessage.create({
      user_id: req.session.userId,
      exam_id: examId,
      role: 'assistant',
      content: reply.trim(),
    });

    res.json({ reply: reply.trim() });
  } catch (err) {
    res.json({ error: `AI error: ${err.message}` });
  }
}));

router.post('/clear', ensureAuth, asyncHandler(async (req, res) => {
  const examId = parseInt(req.body.exam_id) || null;
  if (examId) {
    await assertExamOwner(req, examId);
  }
  await ChatMessage.destroy({
    where: { user_id: req.session.userId, ...(examId ? { exam_id: examId } : {}) },
  });
  res.redirect(`/chat${examId ? `?exam_id=${examId}` : ''}`);
}));

module.exports = router;

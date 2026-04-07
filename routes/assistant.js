const router = require('express').Router();
const { ensureAuth, ensureSubscription, asyncHandler, assertExamOwner } = require('../middleware/auth');
const { ChatMessage, Course, Exam } = require('../models');
const LLMService = require('../services/llm');
const { getExamAnalytics } = require('../services/analytics');

const ASSISTANT_SYSTEM_PROMPT = `You are Intelligrade AI Assistant, an expert educational technology advisor embedded in a university exam grading platform.

You have access to the professor's exam data, grading results, and analytics. You can:
1. Answer questions about students, exams, grades, and trends
2. Provide pedagogical insights and teaching recommendations
3. Help create rubrics and improve grading criteria
4. Suggest exam question improvements based on student performance
5. Identify at-risk students and recommend interventions
6. Analyze question difficulty and discrimination

Be specific, data-driven, and actionable. Reference actual numbers from context. Keep responses concise for the chat panel format. Use markdown formatting.

You may also suggest actions the professor can take. When appropriate, include an action object in your response by appending it on a new line at the very end in this exact format:
ACTION:{"type":"navigate","url":"/analytics?exam_id=1"}
Action types: navigate (go to URL), none (just chat)
Only include an ACTION line if the user explicitly asks to go somewhere or do something.`;

router.post('/action', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const { message, context } = req.body;
  if (!message?.trim()) return res.json({ error: 'Message cannot be empty.' });

  const examId = parseInt(context?.exam_id) || null;
  const courseId = parseInt(context?.course_id) || null;
  const page = context?.page || 'dashboard';

  if (examId) {
    try { await assertExamOwner(req, examId); } catch { /* non-critical context */ }
  }

  await ChatMessage.create({
    user_id: req.session.userId,
    exam_id: examId,
    role: 'user',
    content: message.trim().slice(0, 2000),
  });

  let contextBlock = `\nUser is currently on: ${page} page.`;
  if (examId) {
    const analytics = await getExamAnalytics(examId);
    if (analytics) {
      contextBlock += `\nExam: ${analytics.exam.name}, Students: ${analytics.totalStudents}, Graded: ${analytics.gradedCount}`;
      contextBlock += `\nAverage: ${analytics.classAvg}/${analytics.maxPossible}, Median: ${analytics.classMedian}, Pass rate: ${analytics.passRate}%`;
      contextBlock += `\nQuestions: ${analytics.questionStats.map(q => `${q.questionNo}: ${q.avgScore}/${q.maxMarks} (${q.difficulty})`).join(', ')}`;
      if (analytics.studentScores.length) {
        contextBlock += `\nScore range: ${analytics.lowest}-${analytics.highest}`;
        const atRisk = analytics.studentScores.filter(s => s.pct < 40);
        if (atRisk.length) contextBlock += `\nAt-risk: ${atRisk.map(s => s.studentName).join(', ')}`;
      }
    }
  }

  const recent = await ChatMessage.findAll({
    where: { user_id: req.session.userId, ...(examId ? { exam_id: examId } : {}) },
    order: [['created_at', 'DESC']],
    limit: 12,
  });
  recent.reverse();
  const messages = recent.map(m => ({ role: m.role, content: m.content }));

  try {
    const llm = new LLMService();
    const raw = await llm.chat(messages, ASSISTANT_SYSTEM_PROMPT + contextBlock);

    let reply = raw.trim();
    let action = null;

    const actionMatch = reply.match(/\nACTION:({.*})$/);
    if (actionMatch) {
      try {
        action = JSON.parse(actionMatch[1]);
        reply = reply.replace(actionMatch[0], '').trim();
      } catch {}
    }

    await ChatMessage.create({
      user_id: req.session.userId,
      exam_id: examId,
      role: 'assistant',
      content: reply,
    });

    res.json({ reply, action });
  } catch (err) {
    res.json({ error: `AI error: ${err.message}` });
  }
}));

router.get('/history', ensureAuth, asyncHandler(async (req, res) => {
  const examId = parseInt(req.query.exam_id) || null;
  const messages = await ChatMessage.findAll({
    where: { user_id: req.session.userId, ...(examId ? { exam_id: examId } : {}) },
    order: [['created_at', 'ASC']],
    limit: 50,
  });
  res.json(messages.map(m => ({ role: m.role, content: m.content, created_at: m.created_at })));
}));

router.post('/clear', ensureAuth, asyncHandler(async (req, res) => {
  const examId = parseInt(req.body.exam_id) || null;
  await ChatMessage.destroy({
    where: { user_id: req.session.userId, ...(examId ? { exam_id: examId } : {}) },
  });
  res.json({ ok: true });
}));

module.exports = router;

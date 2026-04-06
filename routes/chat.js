const router = require('express').Router();
const { ensureAuth, ensureSubscription } = require('../middleware/auth');
const { ChatMessage, Course, Exam, Grade, Rubric, Submission, Student } = require('../models');
const LLMService = require('../services/llm');
const { getExamAnalytics } = require('../services/analytics');
const { Op } = require('sequelize');

const CHAT_SYSTEM_PROMPT = `You are Intelligrade AI Assistant, an expert educational technology advisor embedded in a university exam grading platform. You have access to the professor's exam data, grading results, and analytics.

Your capabilities:
1. Answer questions about specific students, exams, grades, and trends
2. Provide pedagogical insights and teaching recommendations
3. Help create rubrics and improve grading criteria
4. Suggest exam question improvements based on student performance
5. Identify at-risk students and recommend interventions
6. Analyze question difficulty and discrimination
7. Compare performance across sections or time periods

Be specific, data-driven, and actionable. Reference actual numbers from the provided context. Format responses clearly with headers and bullet points when helpful.`;

router.get('/', ensureAuth, ensureSubscription, async (req, res) => {
  const courses = await Course.findAll({ where: { user_id: req.session.userId }, order: [['name', 'ASC']] });
  const allExams = {};
  for (const c of courses) {
    allExams[c.id] = (await Exam.findAll({ where: { course_id: c.id } })).map(e => ({ id: e.id, name: e.name }));
  }

  const examId = parseInt(req.query.exam_id) || null;
  const history = await ChatMessage.findAll({
    where: { user_id: req.session.userId, ...(examId ? { exam_id: examId } : {}) },
    order: [['created_at', 'ASC']],
    limit: 50,
  });

  res.render('chat', { courses, allExams, selectedExamId: examId, history });
});

router.post('/send', ensureAuth, ensureSubscription, async (req, res) => {
  const { message, exam_id } = req.body;
  if (!message?.trim()) {
    return res.json({ error: 'Message cannot be empty.' });
  }

  const examId = parseInt(exam_id) || null;

  await ChatMessage.create({
    user_id: req.session.userId,
    exam_id: examId,
    role: 'user',
    content: message.trim(),
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
});

router.post('/clear', ensureAuth, async (req, res) => {
  const examId = parseInt(req.body.exam_id) || null;
  await ChatMessage.destroy({
    where: { user_id: req.session.userId, ...(examId ? { exam_id: examId } : {}) },
  });
  res.redirect(`/chat${examId ? `?exam_id=${examId}` : ''}`);
});

module.exports = router;

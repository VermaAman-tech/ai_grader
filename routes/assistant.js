const router = require('express').Router();
const { ensureAuth, ensureSubscription, asyncHandler, assertExamOwner } = require('../middleware/auth');
const {
  ChatMessage, Course, Exam, Submission, Student, Grade, Rubric,
  CourseDocument, Announcement, DiscussionThread, DiscussionPost,
  ClassSession, LivePoll, PollResponse, CourseTA, Crib, ConceptNode,
  QuestionConcept, OverrideLog,
} = require('../models');
const LLMService = require('../services/llm');
const { getExamAnalytics } = require('../services/analytics');
const { executeAction } = require('../services/agent-actions');
const { Op } = require('sequelize');
const { loadPrompt } = require('../utils/prompt-loader');
const { isMongoConnected } = require('../config/mongodb');

const ASSISTANT_SYSTEM_PROMPT = loadPrompt(
  'system/assistant.md',
  'You are Intelligrade AI assistant. Help with grading, analytics, and course actions.'
);

let ChatThread;
try { ChatThread = require('../models/mongo/ChatThread'); } catch {}

async function blockNonProfessor(req, res, next) {
  const ownsCourses = await Course.count({ where: { user_id: req.session.userId } });
  if (!ownsCourses) {
    return res.status(403).json({ error: 'AI Assistant is available for course instructors only.' });
  }
  next();
}

async function getMongoThread(userId, courseId, examId) {
  if (!isMongoConnected() || !ChatThread) return null;
  try {
    return await ChatThread.getOrCreateThread(userId, courseId, examId, 'assistant');
  } catch { return null; }
}

router.post('/action', ensureAuth, blockNonProfessor, ensureSubscription, asyncHandler(async (req, res) => {
  const { message, context } = req.body;
  if (!message?.trim()) return res.json({ error: 'Message cannot be empty.' });

  const examId = parseInt(context?.exam_id) || null;
  const courseId = parseInt(context?.course_id) || null;
  const page = context?.page || 'dashboard';
  const userMsg = message.trim().slice(0, 2000);

  if (examId) {
    try { await assertExamOwner(req, examId); } catch {}
  }

  // Save user message
  const mongoThread = await getMongoThread(req.session.userId, courseId, examId);
  if (mongoThread) {
    mongoThread.addMessage('user', userMsg, { context_page: page });
    await mongoThread.save();
  } else {
    await ChatMessage.create({
      user_id: req.session.userId,
      exam_id: examId,
      role: 'user',
      content: userMsg,
    });
  }

  // Build context
  let contextBlock = `\nUser: ${req.session.userName} (${req.session.userEmail})`;
  contextBlock += `\nCurrent page: ${page}`;

  const courses = await Course.findAll({ where: { user_id: req.session.userId } });
  contextBlock += `\nProfessor's courses: ${courses.map(c => `${c.code} - ${c.name} (id:${c.id})`).join(', ')}`;

  if (courseId) {
    const course = courses.find(c => c.id === courseId);
    if (course) {
      contextBlock += `\nCurrent course: ${course.code} - ${course.name} (id:${course.id})`;
      if (course.description) contextBlock += `\nDescription: ${course.description.slice(0, 300)}`;
      if (course.objectives) contextBlock += `\nObjectives: ${course.objectives.slice(0, 400)}`;
      if (course.syllabus) contextBlock += `\nSyllabus excerpt: ${course.syllabus.slice(0, 400)}`;
    }

    const exams = await Exam.findAll({ where: { course_id: courseId } });
    contextBlock += `\nExams: ${exams.map(e => `${e.name} (id:${e.id}, type:${e.exam_type}, released:${e.grades_released})`).join(', ')}`;

    const studentCount = await Student.count({ where: { course_id: courseId } });
    contextBlock += `\nStudents enrolled: ${studentCount}`;

    const tas = await CourseTA.findAll({ where: { course_id: courseId } });
    if (tas.length) contextBlock += `\nTAs: ${tas.map(t => `${t.email} (${t.status})`).join(', ')}`;

    const concepts = await ConceptNode.findAll({ where: { course_id: courseId } });
    if (concepts.length) contextBlock += `\nConcepts: ${concepts.map(c => c.name).join(', ')}`;

    const recentSessions = await ClassSession.findAll({
      where: { course_id: courseId },
      order: [['session_date', 'DESC']],
      limit: 3,
    });
    if (recentSessions.length) {
      contextBlock += `\nRecent sessions: ${recentSessions.map(s => {
        let covered = [];
        try { covered = JSON.parse(s.concepts_covered || '[]'); } catch {}
        return `${s.title || 'Untitled'} (${s.session_date}, status:${s.status}, concepts: ${covered.join(', ')})`;
      }).join('; ')}`;
    }

    // RAG: course documents
    const docs = await CourseDocument.findAll({ where: { course_id: courseId } });
    if (docs.length) {
      const queryLower = userMsg.toLowerCase();
      let ragContext = '';
      let tokenBudget = 2000;
      const scoredDocs = docs.map(doc => {
        const text = (doc.extracted_text || '').trim();
        if (!text) return { doc, score: 0 };
        const keywords = queryLower.match(/[a-z]{4,}/g) || [];
        const textLower = text.toLowerCase();
        const score = keywords.filter(kw => textLower.includes(kw)).length;
        return { doc, score, text };
      }).filter(d => d.score > 0 || docs.length <= 3).sort((a, b) => b.score - a.score);

      for (const { doc, text } of scoredDocs) {
        if (tokenBudget <= 0 || !text) break;
        const chunk = text.slice(0, Math.min(tokenBudget, 600));
        ragContext += `\n[Document: ${doc.title}] ${chunk}`;
        tokenBudget -= chunk.length;
      }
      if (ragContext) contextBlock += `\n\n--- COURSE DOCUMENTS (RAG) ---${ragContext}`;
    }

    const pendingCribs = await Crib.count({
      where: { exam_id: { [Op.in]: exams.map(e => e.id) }, status: 'pending' },
    });
    if (pendingCribs) contextBlock += `\nPending regrade requests: ${pendingCribs}`;

    const activePolls = await LivePoll.findAll({ where: { course_id: courseId, is_active: true } });
    if (activePolls.length) {
      for (const p of activePolls) {
        const respCount = await PollResponse.count({ where: { poll_id: p.id } });
        contextBlock += `\nActive poll: "${p.question}" (code:${p.room_code}, ${respCount} responses)`;
      }
    }
  }

  if (examId) {
    const analytics = await getExamAnalytics(examId);
    if (analytics) {
      contextBlock += `\n\n--- EXAM ANALYTICS ---`;
      contextBlock += `\nExam: ${analytics.exam.name} (id:${examId}), Students: ${analytics.totalStudents}, Graded: ${analytics.gradedCount}`;
      contextBlock += `\nAvg: ${analytics.classAvg}/${analytics.maxPossible}, Median: ${analytics.classMedian}, Pass rate: ${analytics.passRate}%`;
      contextBlock += `\nQuestions: ${analytics.questionStats.map(q => `Q${q.questionNo}: avg ${q.avgScore}/${q.maxMarks} (${q.difficulty})`).join(', ')}`;
      if (analytics.studentScores.length) {
        contextBlock += `\nScore range: ${analytics.lowest}-${analytics.highest}`;
        const atRisk = analytics.studentScores.filter(s => s.pct < 40);
        if (atRisk.length) contextBlock += `\nAt-risk (below 40%): ${atRisk.map(s => `${s.studentName} (${s.pct}%)`).join(', ')}`;
        const top = analytics.studentScores.filter(s => s.pct >= 90);
        if (top.length) contextBlock += `\nTop performers (90%+): ${top.map(s => `${s.studentName} (${s.pct}%)`).join(', ')}`;
      }
    }
    const rubricCount = await Rubric.count({ where: { exam_id: examId } });
    const subCount = await Submission.count({ where: { exam_id: examId } });
    const pendingCount = await Submission.count({ where: { exam_id: examId, status: 'pending' } });
    const flaggedCount = await Grade.count({
      where: { review_status: 'flagged' },
      include: [{ model: Submission, required: true, where: { exam_id: examId }, attributes: [] }],
    });
    contextBlock += `\nRubric items: ${rubricCount}, Submissions: ${subCount}, Pending: ${pendingCount}, Flagged: ${flaggedCount}`;
  }

  // Chat history
  let messages;
  if (mongoThread) {
    messages = mongoThread.getRecentMessages(14);
  } else {
    const recent = await ChatMessage.findAll({
      where: { user_id: req.session.userId, ...(examId ? { exam_id: examId } : {}) },
      order: [['created_at', 'DESC']],
      limit: 14,
    });
    recent.reverse();
    messages = recent.map(m => ({ role: m.role, content: m.content }));
  }

  // MongoDB thread summary as extra context
  if (mongoThread?.summary) {
    contextBlock += `\n\n--- PREVIOUS CONVERSATION SUMMARY ---\n${mongoThread.summary}`;
  }

  try {
    const llm = new LLMService();
    const raw = await llm.chat(messages, ASSISTANT_SYSTEM_PROMPT + contextBlock);

    let reply = raw.trim();
    const actions = [];

    const lines = reply.split('\n');
    const cleanLines = [];
    for (const line of lines) {
      const actionMatch = line.match(/^ACTION:({.*})$/);
      if (actionMatch) {
        try { actions.push(JSON.parse(actionMatch[1])); } catch {}
      } else {
        cleanLines.push(line);
      }
    }
    reply = cleanLines.join('\n').trim();

    // Execute all actions server-side
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const executedActions = [];
    for (const action of actions) {
      const result = await executeAction(action, req.session.userId, baseUrl);
      executedActions.push(action.type);
      if (result.executed && result.message) {
        reply += `\n\n*${result.message}*`;
      } else if (!result.executed && result.message) {
        reply += `\n\n*Failed: ${result.message}*`;
      }
    }

    // Save assistant reply
    if (mongoThread) {
      mongoThread.addMessage('assistant', reply, { actions_executed: executedActions });
      await mongoThread.save();
    } else {
      await ChatMessage.create({
        user_id: req.session.userId,
        exam_id: examId,
        role: 'assistant',
        content: reply,
      });
    }

    const clientAction = actions.find(a => a.type === 'navigate' || a.type === 'grade_all');
    res.json({ reply, action: clientAction || null });
  } catch (err) {
    res.json({ error: `AI error: ${err.message}` });
  }
}));

router.get('/history', ensureAuth, blockNonProfessor, asyncHandler(async (req, res) => {
  const examId = parseInt(req.query.exam_id) || null;
  const courseId = parseInt(req.query.course_id) || null;

  if (isMongoConnected() && ChatThread) {
    try {
      const thread = await getMongoThread(req.session.userId, courseId, examId);
      if (thread) {
        return res.json(thread.getRecentMessages(50));
      }
    } catch {}
  }

  const messages = await ChatMessage.findAll({
    where: { user_id: req.session.userId, ...(examId ? { exam_id: examId } : {}) },
    order: [['created_at', 'ASC']],
    limit: 50,
  });
  res.json(messages.map(m => ({ role: m.role, content: m.content, created_at: m.created_at })));
}));

router.post('/clear', ensureAuth, blockNonProfessor, asyncHandler(async (req, res) => {
  const examId = parseInt(req.body.exam_id) || null;
  const courseId = parseInt(req.body.course_id) || null;

  if (isMongoConnected() && ChatThread) {
    try {
      await ChatThread.updateMany(
        { user_id: req.session.userId, ...(courseId ? { course_id: courseId } : {}), ...(examId ? { exam_id: examId } : {}) },
        { $set: { is_archived: true } }
      );
    } catch {}
  }

  await ChatMessage.destroy({
    where: { user_id: req.session.userId, ...(examId ? { exam_id: examId } : {}) },
  });
  res.json({ ok: true });
}));

// Summarize chat thread (AI generates summary of conversation for continuity)
router.post('/summarize', ensureAuth, blockNonProfessor, asyncHandler(async (req, res) => {
  if (!isMongoConnected() || !ChatThread) {
    return res.json({ error: 'MongoDB not connected.' });
  }

  const courseId = parseInt(req.body.course_id) || null;
  const thread = await getMongoThread(req.session.userId, courseId, null);
  if (!thread || thread.messages.length < 4) {
    return res.json({ summary: 'Not enough messages to summarize.' });
  }

  const msgs = thread.getRecentMessages(30);
  const transcript = msgs.map(m => `${m.role}: ${m.content}`).join('\n');

  try {
    const llm = new LLMService();
    const summary = await llm.chat(
      [{ role: 'user', content: `Summarize this conversation between a professor and AI assistant. Focus on key decisions, data points, and pending tasks:\n\n${transcript}` }],
      'You are a concise summarizer. Output a bullet-point summary of the key topics, decisions, and action items from this conversation.'
    );
    thread.summary = summary.trim();
    thread.last_summarized_at = new Date();
    await thread.save();
    res.json({ summary: thread.summary });
  } catch (err) {
    res.json({ error: `Summarization failed: ${err.message}` });
  }
}));

module.exports = router;

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
const { Op } = require('sequelize');

const TOOL_DEFINITIONS = `
## AGENTIC TOOLS (execute by returning ACTION JSON)

### Navigation Tools
ACTION:{"type":"navigate","url":"/path"} — Navigate to any page

### Grading Tools
ACTION:{"type":"grade_all","exam_id":N} — Trigger AI grading for an exam
ACTION:{"type":"release_grades","exam_id":N} — Release grades to students
ACTION:{"type":"set_boundaries","exam_id":N,"boundaries":[{"label":"A+","min":90,"max":100},...]}

### Course Management Tools
ACTION:{"type":"create_announcement","course_id":N,"title":"...","content":"...","type":"general"}
ACTION:{"type":"create_poll","course_id":N,"question":"...","options":["A","B","C"],"poll_type":"mcq"}
ACTION:{"type":"create_session","course_id":N,"title":"...","date":"YYYY-MM-DD","concepts":["..."]}
ACTION:{"type":"create_thread","course_id":N,"title":"...","content":"...","type":"question"}

### Analysis Tools
ACTION:{"type":"analyze_student","student_name":"...","course_id":N} — Deep student analysis
ACTION:{"type":"concept_gaps","course_id":N} — Identify weak concepts across class
ACTION:{"type":"compare_exams","exam_ids":[N,M]} — Compare performance across exams
ACTION:{"type":"generate_report","type":"class_summary|student_risk|concept_mastery","course_id":N}

### Document Tools
ACTION:{"type":"search_documents","course_id":N,"query":"..."} — RAG search across course docs
ACTION:{"type":"generate_exam","course_id":N,"topics":["..."],"difficulty":"medium","num_questions":5}
`;

const ASSISTANT_SYSTEM_PROMPT = `You are Intelligrade AI — an agentic course intelligence assistant with FULL tool access to every platform feature. You can DO things, not just advise. You help professors with grading, course management, analytics, student tracking, exam design, and any academic task.

## YOUR CAPABILITIES
1. **Grade exams** — trigger AI grading, set boundaries, release grades
2. **Create content** — announcements, polls, discussion threads, class sessions, exams
3. **Analyze data** — student performance, concept mastery gaps, at-risk students, exam comparisons
4. **Search documents** — RAG-powered search across uploaded course materials
5. **Navigate** — take the professor to any page
6. **Generate** — exam questions, rubrics, student reports, learning objectives
7. **LaTeX** — render mathematical expressions using LaTeX notation (wrap in $...$ or $$...$$)

## RESPONSE STYLE
- Be specific with data: cite student names, scores, percentages
- Be concise — this is a sidebar panel
- Be proactive — suggest the next logical action
- Use markdown formatting
- Use LaTeX for mathematical expressions: $E = mc^2$, $\\sum_{i=1}^{n} x_i$
- When doing analysis, show tables/lists with actual data
- If voice input is detected, respond professionally

${TOOL_DEFINITIONS}

## MULTI-ACTION
You can chain multiple actions. Return each on its own line:
ACTION:{"type":"create_announcement",...}
ACTION:{"type":"navigate","url":"/announcements?course_id=1"}

## RAG CONTEXT
When course documents are available, use their content to provide informed answers. Reference specific documents and page numbers when citing.

## IMPORTANT
- You work on EVERY page — even without exam context, help with general platform guidance
- If a task requires multiple steps, explain what you're doing and execute step by step
- Always confirm destructive actions before executing
- For anything involving grades, double-check with the professor before making changes`;

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

  const courses = await Course.findAll({ where: { user_id: req.session.userId } });
  contextBlock += `\nProfessor's courses: ${courses.map(c => `${c.code} - ${c.name} (id:${c.id})`).join(', ')}`;

  if (courseId) {
    const course = courses.find(c => c.id === courseId);
    if (course) {
      contextBlock += `\nCurrent course: ${course.code} - ${course.name}`;
      if (course.description) contextBlock += `\nDescription: ${course.description.slice(0, 300)}`;
      if (course.objectives) contextBlock += `\nObjectives: ${course.objectives.slice(0, 400)}`;
      if (course.syllabus) contextBlock += `\nSyllabus: ${course.syllabus.slice(0, 400)}`;
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
        return `${s.title} (${s.session_date}, ${s.status}, concepts: ${covered.join(', ')})`;
      }).join('; ')}`;
    }

    // RAG: include relevant document extracts
    const docs = await CourseDocument.findAll({ where: { course_id: courseId } });
    if (docs.length) {
      const userMsg = message.toLowerCase();
      let ragContext = '';
      let tokenBudget = 1500;
      for (const doc of docs) {
        if (tokenBudget <= 0) break;
        const text = (doc.extracted_text || '').trim();
        if (!text) continue;
        const keywords = userMsg.match(/[a-z]{4,}/g) || [];
        const textLower = text.toLowerCase();
        const relevance = keywords.filter(kw => textLower.includes(kw)).length;
        if (relevance > 0 || docs.length <= 3) {
          const chunk = text.slice(0, Math.min(tokenBudget, 500));
          ragContext += `\n[Document: ${doc.title}] ${chunk}`;
          tokenBudget -= chunk.length;
        }
      }
      if (ragContext) contextBlock += `\n\n--- COURSE DOCUMENTS (RAG) ---${ragContext}`;
    }

    const pendingCribs = await Crib.count({ where: { exam_id: { [Op.in]: exams.map(e => e.id) }, status: 'pending' } });
    if (pendingCribs) contextBlock += `\nPending cribs/regrade requests: ${pendingCribs}`;

    const activePolls = await LivePoll.findAll({ where: { course_id: courseId, is_active: true } });
    if (activePolls.length) contextBlock += `\nActive polls: ${activePolls.map(p => `"${p.question}" (code:${p.room_code}, responses:${p.id})`).join(', ')}`;
  }

  if (examId) {
    const analytics = await getExamAnalytics(examId);
    if (analytics) {
      contextBlock += `\nExam: ${analytics.exam.name} (id:${examId}), Students: ${analytics.totalStudents}, Graded: ${analytics.gradedCount}`;
      contextBlock += `\nAvg: ${analytics.classAvg}/${analytics.maxPossible}, Median: ${analytics.classMedian}, Pass rate: ${analytics.passRate}%`;
      contextBlock += `\nQuestions: ${analytics.questionStats.map(q => `${q.questionNo}: ${q.avgScore}/${q.maxMarks} (${q.difficulty})`).join(', ')}`;
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
      include: [{ model: Submission, required: true, where: { exam_id: examId } }],
    });
    contextBlock += `\nRubric items: ${rubricCount}, Submissions: ${subCount}, Pending: ${pendingCount}, Flagged for review: ${flaggedCount}`;
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

    // Execute safe actions server-side
    for (const action of actions) {
      try {
        if (action.type === 'create_announcement' && action.course_id && action.title) {
          const course = await Course.findOne({ where: { id: action.course_id, user_id: req.session.userId } });
          if (course) {
            await Announcement.create({
              course_id: action.course_id,
              user_id: req.session.userId,
              title: action.title,
              content: action.content || '',
              type: action.announcement_type || 'general',
              published_at: new Date(),
            });
            reply += '\n\n*Announcement created successfully.*';
          }
        }
        if (action.type === 'create_thread' && action.course_id && action.title) {
          const course = await Course.findOne({ where: { id: action.course_id, user_id: req.session.userId } });
          if (course) {
            await DiscussionThread.create({
              course_id: action.course_id,
              user_id: req.session.userId,
              title: action.title,
              content: action.content || '',
              thread_type: action.thread_type || 'question',
            });
            reply += '\n\n*Discussion thread created.*';
          }
        }
        if (action.type === 'release_grades' && action.exam_id) {
          const exam = await Exam.findOne({
            where: { id: action.exam_id },
            include: [{ model: Course, required: true, where: { user_id: req.session.userId } }],
          });
          if (exam) {
            exam.grades_released = true;
            exam.grades_released_at = new Date();
            await exam.save();
            reply += '\n\n*Grades released to students.*';
          }
        }
      } catch (err) {
        console.error('Action execution error:', err.message);
      }
    }

    await ChatMessage.create({
      user_id: req.session.userId,
      exam_id: examId,
      role: 'assistant',
      content: reply,
    });

    const clientAction = actions.find(a => a.type === 'navigate' || a.type === 'grade_all');
    res.json({ reply, action: clientAction || null });
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

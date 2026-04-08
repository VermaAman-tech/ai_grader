const router = require('express').Router();
const { ensureAuth, ensureSubscription, asyncHandler, assertExamOwner } = require('../middleware/auth');
const { requireInt } = require('../middleware/validate');
const { Course, Exam, Submission, Grade, Rubric, Student, EmailLog } = require('../models');
const { sendStudentReport, isConfigured } = require('../services/email');
const LLMService = require('../services/llm');

router.get('/:examId', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const examId = requireInt(req.params.examId, 'Exam');
  const exam = await assertExamOwner(req, examId);
  const course = await Course.findByPk(exam.course_id);

  const rubrics = await Rubric.findAll({ where: { exam_id: examId }, order: [['question_order', 'ASC']] });
  const maxPossible = rubrics.reduce((s, r) => s + r.max_marks, 0);

  const submissions = await Submission.findAll({
    where: { exam_id: examId, status: 'done' },
    include: [{ model: Student }, { model: Grade }],
  });

  const students = submissions.map(sub => {
    const total = (sub.Grades || []).reduce((sum, g) => sum + (g.override_marks !== null ? g.override_marks : g.awarded_marks), 0);
    return {
      id: sub.Student?.id,
      name: sub.Student?.name || 'Unknown',
      roll: sub.Student?.roll_number || '',
      email: sub.Student?.email || '',
      total: Math.round(total * 100) / 100,
      pct: maxPossible > 0 ? Math.round(total / maxPossible * 10000) / 100 : 0,
      submissionId: sub.id,
      hasEmail: !!(sub.Student?.email),
    };
  });

  const emailConfigured = await isConfigured();
  const sentLogs = await EmailLog.findAll({ where: { exam_id: examId } });
  const sentMap = {};
  for (const log of sentLogs) { sentMap[log.student_id] = log.created_at; }

  res.locals.examId = examId;
  res.render('email-grades', { exam, course, students, maxPossible, emailConfigured, sentMap });
}));

router.post('/:examId/send', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const examId = requireInt(req.params.examId, 'Exam');
  const exam = await assertExamOwner(req, examId);
  const course = await Course.findByPk(exam.course_id);

  const configured = await isConfigured();
  if (!configured) {
    req.flash('error', 'Email not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS in your .env file.');
    return res.redirect(`/grading/email/${examId}`);
  }

  const selectedIds = req.body.student_ids
    ? (Array.isArray(req.body.student_ids) ? req.body.student_ids : [req.body.student_ids]).map(Number)
    : [];

  const rubrics = await Rubric.findAll({ where: { exam_id: examId }, order: [['question_order', 'ASC']] });
  const maxPossible = rubrics.reduce((s, r) => s + r.max_marks, 0);

  const submissions = await Submission.findAll({
    where: { exam_id: examId, status: 'done' },
    include: [{ model: Student }, { model: Grade, include: [{ model: Rubric }] }],
  });

  let sent = 0, skipped = 0;
  const llm = new LLMService();

  for (const sub of submissions) {
    const student = sub.Student;
    if (!student?.email) { skipped++; continue; }
    if (selectedIds.length && !selectedIds.includes(student.id)) continue;

    const grades = (sub.Grades || []).sort((a, b) =>
      (a.Rubric?.question_order || 0) - (b.Rubric?.question_order || 0)
    );
    const total = grades.reduce((sum, g) => sum + (g.override_marks !== null ? g.override_marks : g.awarded_marks), 0);
    const pct = maxPossible > 0 ? Math.round(total / maxPossible * 10000) / 100 : 0;

    const questionResults = grades.map(g => ({
      questionNo: `Q${g.question_no}`,
      awarded: g.override_marks !== null ? g.override_marks : g.awarded_marks,
      max: g.Rubric?.max_marks || 0,
      feedback: (g.feedback || '').slice(0, 300),
    }));

    let personalFeedback = '';
    if (req.body.include_feedback === 'on' && llm.apiKey) {
      try {
        const weakAreas = grades.filter(g => {
          const marks = g.override_marks !== null ? g.override_marks : g.awarded_marks;
          return g.Rubric && marks < g.Rubric.max_marks * 0.5;
        }).map(g => `${g.question_no}: ${g.Rubric?.question_text?.slice(0, 100)}`);

        if (weakAreas.length) {
          personalFeedback = await llm.chat([{
            role: 'user',
            content: `Student ${student.name} scored ${pct}% overall. Weak areas:\n${weakAreas.join('\n')}\nWrite 2-3 sentences of actionable study recommendations.`,
          }], 'You are a helpful academic advisor. Be specific, encouraging, and concise.');
        }
      } catch {}
    }

    try {
      await sendStudentReport({
        to: student.email,
        studentName: student.name,
        examName: exam.name,
        courseName: `${course.code} - ${course.name}`,
        totalMarks: Math.round(total * 100) / 100,
        maxMarks: maxPossible,
        percentage: pct,
        questionResults,
        feedback: personalFeedback,
        professorName: req.session.userName,
      });

      await EmailLog.create({
        user_id: req.session.userId,
        student_id: student.id,
        exam_id: examId,
        subject: `[${course.code}] ${exam.name} — Your Results`,
        status: 'sent',
      });
      sent++;
    } catch (err) {
      await EmailLog.create({
        user_id: req.session.userId,
        student_id: student.id,
        exam_id: examId,
        subject: `Failed: ${err.message.slice(0, 200)}`,
        status: 'failed',
      });
      skipped++;
    }
  }

  req.flash('success', `Emails sent: ${sent} succeeded, ${skipped} skipped/failed.`);
  res.redirect(`/grading/email/${examId}`);
}));

module.exports = router;

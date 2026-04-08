const router = require('express').Router();
const { ensureAuth, ensureSubscription, asyncHandler, assertCourseOwner, assertExamOwner } = require('../middleware/auth');
const { requireInt } = require('../middleware/validate');
const { Course, Exam, Student, Submission, Grade, Rubric } = require('../models');
const LLMService = require('../services/llm');

router.get('/', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const courses = await Course.findAll({ where: { user_id: req.session.userId }, order: [['name', 'ASC']] });
  const allExams = {};
  for (const c of courses) {
    allExams[c.id] = (await Exam.findAll({ where: { course_id: c.id } })).map(e => ({ id: e.id, name: e.name }));
  }
  res.render('student-reports', { courses, allExams, report: null, selectedExamId: null, selectedStudentId: null });
}));

router.get('/generate', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const examId = requireInt(req.query.exam_id, 'Exam');
  const exam = await assertExamOwner(req, examId);
  const course = await Course.findByPk(exam.course_id);

  const rubrics = await Rubric.findAll({ where: { exam_id: examId }, order: [['question_order', 'ASC']] });
  const maxPossible = rubrics.reduce((s, r) => s + r.max_marks, 0);

  const submissions = await Submission.findAll({
    where: { exam_id: examId, status: 'done' },
    include: [{ model: Student }, { model: Grade }],
  });

  const reports = [];

  for (const sub of submissions) {
    if (!sub.Student) continue;
    const grades = (sub.Grades || []);
    const total = grades.reduce((sum, g) => sum + (g.override_marks !== null ? g.override_marks : g.awarded_marks), 0);
    const pct = maxPossible > 0 ? Math.round(total / maxPossible * 10000) / 100 : 0;

    const questionResults = rubrics.map(r => {
      const g = grades.find(gr => gr.rubric_id === r.id);
      const awarded = g ? (g.override_marks !== null ? g.override_marks : g.awarded_marks) : 0;
      return {
        questionNo: r.question_no,
        questionText: r.question_text.slice(0, 100),
        awarded,
        max: r.max_marks,
        pct: r.max_marks > 0 ? Math.round(awarded / r.max_marks * 100) : 0,
        feedback: g?.feedback || '',
        weak: r.max_marks > 0 && awarded < r.max_marks * 0.5,
      };
    });

    const weakTopics = questionResults.filter(q => q.weak).map(q => `${q.questionNo}: ${q.questionText}`);
    const strongTopics = questionResults.filter(q => q.pct >= 80).map(q => `${q.questionNo}: ${q.questionText}`);

    reports.push({
      student: sub.Student,
      total: Math.round(total * 100) / 100,
      maxPossible,
      pct,
      questionResults,
      weakTopics,
      strongTopics,
    });
  }

  const courses = await Course.findAll({ where: { user_id: req.session.userId }, order: [['name', 'ASC']] });
  const allExams = {};
  for (const c of courses) {
    allExams[c.id] = (await Exam.findAll({ where: { course_id: c.id } })).map(e => ({ id: e.id, name: e.name }));
  }

  res.locals.examId = examId;
  res.render('student-reports', {
    courses, allExams, reports, exam, course,
    selectedExamId: examId, selectedStudentId: null,
  });
}));

router.get('/detail/:studentId/:examId', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const examId = requireInt(req.params.examId, 'Exam');
  const studentId = requireInt(req.params.studentId, 'Student');
  const exam = await assertExamOwner(req, examId);
  const course = await Course.findByPk(exam.course_id);
  const student = await Student.findByPk(studentId);
  if (!student) { req.flash('error', 'Student not found.'); return res.redirect('/student-reports'); }

  const rubrics = await Rubric.findAll({ where: { exam_id: examId }, order: [['question_order', 'ASC']] });
  const maxPossible = rubrics.reduce((s, r) => s + r.max_marks, 0);

  const submission = await Submission.findOne({
    where: { exam_id: examId, student_id: studentId },
    include: [{ model: Grade }],
  });

  if (!submission) { req.flash('error', 'No submission found for this student.'); return res.redirect('/student-reports'); }

  const grades = submission.Grades || [];
  const total = grades.reduce((sum, g) => sum + (g.override_marks !== null ? g.override_marks : g.awarded_marks), 0);
  const pct = maxPossible > 0 ? Math.round(total / maxPossible * 10000) / 100 : 0;

  const questionResults = rubrics.map(r => {
    const g = grades.find(gr => gr.rubric_id === r.id);
    const awarded = g ? (g.override_marks !== null ? g.override_marks : g.awarded_marks) : 0;
    return {
      questionNo: r.question_no,
      questionText: r.question_text,
      awarded,
      max: r.max_marks,
      pct: r.max_marks > 0 ? Math.round(awarded / r.max_marks * 100) : 0,
      feedback: g?.feedback || '',
      weak: r.max_marks > 0 && awarded < r.max_marks * 0.5,
      matchedPoints: g?.matched_points ? JSON.parse(g.matched_points) : [],
      missingPoints: g?.missing_points ? JSON.parse(g.missing_points) : [],
    };
  });

  let aiReport = '';
  const llm = new LLMService();
  if (llm.apiKey) {
    try {
      const weakAreas = questionResults.filter(q => q.weak);
      const prompt = `Student: ${student.name}, Exam: ${exam.name}, Course: ${course.code} ${course.name}
Score: ${total}/${maxPossible} (${pct}%)

Question-wise performance:
${questionResults.map(q => `Q${q.questionNo}: ${q.awarded}/${q.max} (${q.pct}%) - ${q.questionText.slice(0, 80)}`).join('\n')}

Weak areas: ${weakAreas.map(q => `Q${q.questionNo}: ${q.questionText.slice(0, 80)}`).join('; ') || 'None'}

Generate a personalized learning gap report for this student. Include:
1. Overall performance summary (2 sentences)
2. Specific concept gaps identified from weak questions
3. Strengths to build on
4. 3-5 actionable study recommendations
5. Suggested focus areas for next exam

Be specific, data-driven, and encouraging. Reference actual question topics.`;

      aiReport = await llm.chat([{ role: 'user', content: prompt }],
        'You are an expert academic advisor. Generate detailed, personalized student learning reports.');
    } catch {}
  }

  const allExamsInCourse = await Exam.findAll({ where: { course_id: course.id } });
  const longitudinal = [];
  for (const e of allExamsInCourse) {
    const sub = await Submission.findOne({
      where: { exam_id: e.id, student_id: studentId, status: 'done' },
      include: [{ model: Grade }],
    });
    if (!sub) continue;
    const eRubrics = await Rubric.findAll({ where: { exam_id: e.id } });
    const eMax = eRubrics.reduce((s, r) => s + r.max_marks, 0);
    const eTotal = (sub.Grades || []).reduce((sum, g) => sum + (g.override_marks !== null ? g.override_marks : g.awarded_marks), 0);
    longitudinal.push({
      examName: e.name,
      total: Math.round(eTotal * 100) / 100,
      max: eMax,
      pct: eMax > 0 ? Math.round(eTotal / eMax * 10000) / 100 : 0,
    });
  }

  res.locals.examId = examId;
  res.render('student-report-detail', {
    student, exam, course, total: Math.round(total * 100) / 100,
    maxPossible, pct, questionResults, aiReport, longitudinal,
  });
}));

module.exports = router;

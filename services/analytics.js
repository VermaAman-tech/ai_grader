const { Grade, Rubric, Submission, Student, Exam } = require('../models');
const { Op } = require('sequelize');
const LLMService = require('./llm');

async function getExamAnalytics(examId) {
  const exam = await Exam.findByPk(examId);
  if (!exam) return null;

  const rubrics = await Rubric.findAll({
    where: { exam_id: examId },
    order: [['question_order', 'ASC']],
  });

  const submissions = await Submission.findAll({
    where: { exam_id: examId },
    include: [{ model: Student }, { model: Grade }],
  });

  const totalStudents = submissions.length;
  const gradedSubs = submissions.filter(s => s.status === 'done');
  const maxPossible = rubrics.reduce((sum, r) => sum + r.max_marks, 0);

  // Per-student totals
  const studentScores = gradedSubs.map(sub => {
    const total = (sub.Grades || []).reduce((sum, g) => {
      const marks = g.override_marks !== null ? g.override_marks : g.awarded_marks;
      return sum + marks;
    }, 0);
    return {
      studentName: sub.Student?.name || 'Unknown',
      rollNumber: sub.Student?.roll_number || '',
      total: Math.round(total * 100) / 100,
      pct: maxPossible > 0 ? Math.round(total / maxPossible * 10000) / 100 : 0,
    };
  });

  studentScores.sort((a, b) => b.total - a.total);
  const allTotals = studentScores.map(s => s.total);

  const classAvg = allTotals.length ? Math.round(allTotals.reduce((a, b) => a + b, 0) / allTotals.length * 100) / 100 : 0;
  const classMedian = allTotals.length ? allTotals[Math.floor(allTotals.length / 2)] : 0;
  const highest = allTotals.length ? allTotals[0] : 0;
  const lowest = allTotals.length ? allTotals[allTotals.length - 1] : 0;
  const passCount = studentScores.filter(s => s.pct >= 40).length;
  const passRate = gradedSubs.length > 0 ? Math.round(passCount / gradedSubs.length * 10000) / 100 : 0;

  // Per-question analysis
  const questionStats = rubrics.map(r => {
    const grades = [];
    for (const sub of gradedSubs) {
      const g = (sub.Grades || []).find(g => g.rubric_id === r.id);
      if (g) {
        const marks = g.override_marks !== null ? g.override_marks : g.awarded_marks;
        grades.push({ marks, confidence: g.confidence });
      }
    }
    const avg = grades.length ? grades.reduce((s, g) => s + g.marks, 0) / grades.length : 0;
    const avgConf = grades.length ? grades.reduce((s, g) => s + g.confidence, 0) / grades.length : 0;
    const scorePct = r.max_marks > 0 ? avg / r.max_marks * 100 : 0;
    let difficulty = 'Medium';
    if (scorePct >= 70) difficulty = 'Easy';
    else if (scorePct < 40) difficulty = 'Hard';

    return {
      questionNo: r.question_no,
      maxMarks: r.max_marks,
      avgScore: Math.round(avg * 100) / 100,
      scorePct: Math.round(scorePct * 10) / 10,
      avgConfidence: Math.round(avgConf * 100),
      difficulty,
      respondents: grades.length,
    };
  });

  // Grade distribution buckets
  const buckets = { 'A (>=80%)': 0, 'B (60-79%)': 0, 'C (40-59%)': 0, 'D (20-39%)': 0, 'F (<20%)': 0 };
  for (const s of studentScores) {
    if (s.pct >= 80) buckets['A (>=80%)']++;
    else if (s.pct >= 60) buckets['B (60-79%)']++;
    else if (s.pct >= 40) buckets['C (40-59%)']++;
    else if (s.pct >= 20) buckets['D (20-39%)']++;
    else buckets['F (<20%)']++;
  }

  return {
    exam, rubrics, totalStudents,
    gradedCount: gradedSubs.length,
    maxPossible, classAvg, classMedian,
    highest, lowest, passRate, passCount,
    studentScores, questionStats,
    distribution: buckets,
  };
}

async function generateInsights(analytics) {
  if (!analytics || !analytics.questionStats.length) return 'No grading data available for analysis.';

  const llm = new LLMService();
  if (!llm.apiKey) {
    return _buildStaticInsights(analytics);
  }

  const context = `
Exam: ${analytics.exam.name}
Students: ${analytics.totalStudents}, Graded: ${analytics.gradedCount}
Class Average: ${analytics.classAvg}/${analytics.maxPossible}
Median: ${analytics.classMedian}, Highest: ${analytics.highest}, Lowest: ${analytics.lowest}
Pass Rate: ${analytics.passRate}%

Per-question analysis:
${analytics.questionStats.map(q => `${q.questionNo}: avg ${q.avgScore}/${q.maxMarks} (${q.scorePct}%), difficulty: ${q.difficulty}, confidence: ${q.avgConfidence}%`).join('\n')}

Grade distribution: ${JSON.stringify(analytics.distribution)}
Top 3: ${analytics.studentScores.slice(0, 3).map(s => `${s.studentName}: ${s.total}`).join(', ')}
Bottom 3: ${analytics.studentScores.slice(-3).map(s => `${s.studentName}: ${s.total}`).join(', ')}
`;

  try {
    const response = await llm.chat([{
      role: 'user',
      content: `Based on this exam grading data, provide actionable insights for the professor:\n${context}\n\nProvide:\n1. Key Performance Summary (2-3 sentences)\n2. Question Analysis (which questions were too hard/easy, why)\n3. At-Risk Students (who needs help and in which topics)\n4. Teaching Recommendations (specific topics to revisit)\n5. Rubric Improvement Suggestions\n\nBe specific, data-driven, and actionable. Format with clear headings.`,
    }], 'You are an educational analytics expert. Provide specific, data-driven, actionable insights for university professors based on exam grading data. Be concise but thorough.');

    return response;
  } catch {
    return _buildStaticInsights(analytics);
  }
}

function _buildStaticInsights(a) {
  const lines = [];
  lines.push(`CLASS PERFORMANCE SUMMARY`);
  lines.push(`Average: ${a.classAvg}/${a.maxPossible} (${a.maxPossible > 0 ? Math.round(a.classAvg / a.maxPossible * 100) : 0}%) | Pass rate: ${a.passRate}% | Range: ${a.lowest}-${a.highest}`);
  lines.push('');

  const hard = a.questionStats.filter(q => q.difficulty === 'Hard');
  const easy = a.questionStats.filter(q => q.difficulty === 'Easy');
  if (hard.length) {
    lines.push(`CHALLENGING QUESTIONS: ${hard.map(q => `${q.questionNo} (${q.scorePct}% avg)`).join(', ')}`);
    lines.push('Consider revisiting these topics or adjusting the rubric difficulty.');
  }
  if (easy.length) {
    lines.push(`WELL-UNDERSTOOD: ${easy.map(q => `${q.questionNo} (${q.scorePct}% avg)`).join(', ')}`);
  }
  lines.push('');

  const atRisk = a.studentScores.filter(s => s.pct < 40);
  if (atRisk.length) {
    lines.push(`AT-RISK STUDENTS (${atRisk.length}): ${atRisk.map(s => s.studentName).join(', ')}`);
    lines.push('These students scored below 40% and may need additional support.');
  }

  return lines.join('\n');
}

module.exports = { getExamAnalytics, generateInsights };

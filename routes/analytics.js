const router = require('express').Router();
const { ensureAuth, ensureSubscription, asyncHandler, assertExamOwner } = require('../middleware/auth');
const { Course, Exam } = require('../models');
const { getExamAnalytics, generateInsights } = require('../services/analytics');

router.get('/', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const courses = await Course.findAll({ where: { user_id: req.session.userId }, order: [['name', 'ASC']] });
  const allExams = {};
  for (const c of courses) {
    allExams[c.id] = (await Exam.findAll({ where: { course_id: c.id }, order: [['name', 'ASC']] })).map(e => ({ id: e.id, name: e.name }));
  }

  const examId = parseInt(req.query.exam_id) || null;
  let analytics = null, insights = '';

  if (examId) {
    await assertExamOwner(req, examId);
    analytics = await getExamAnalytics(examId);
    if (analytics && analytics.gradedCount > 0) {
      try {
        insights = await generateInsights(analytics);
      } catch {
        insights = 'Unable to generate insights at this time.';
      }
    }
  }

  res.locals.examId = examId;
  res.render('analytics', { courses, allExams, analytics, insights, selectedExamId: examId });
}));

module.exports = router;

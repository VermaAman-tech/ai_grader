const router = require('express').Router();
const { ensureAuth, ensureSubscription, asyncHandler } = require('../middleware/auth');
const { requireInt } = require('../middleware/validate');
const { Course, ClassSession, ActiveFeedback, Student } = require('../models');
const { Op } = require('sequelize');

const FEEDBACK_CONTENT_MAX = 2000;

async function assertCourseAccess(req, courseId) {
  if (!req.session?.userId) throw new Error('ACCESS_DENIED');
  if (req.session.role === 'student') {
    const enr = await Student.findOne({ where: { course_id: courseId, email: req.session.email } });
    if (!enr) throw new Error('ACCESS_DENIED');
    return;
  }
  const course = await Course.findOne({ where: { id: courseId, user_id: req.session.userId } });
  if (!course) throw new Error('ACCESS_DENIED');
}

router.get('/', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const courses = await Course.findAll({ where: { user_id: req.session.userId }, order: [['name', 'ASC']] });
  const courseId = parseInt(req.query.course_id) || null;
  let sessions = [];
  let feedbackStats = {};
  let courseName = '';

  if (courseId) {
    const course = await Course.findOne({ where: { id: courseId, user_id: req.session.userId } });
    if (!course) throw new Error('ACCESS_DENIED');
    courseName = course.name;

    sessions = await ClassSession.findAll({
      where: { course_id: courseId },
      order: [['session_date', 'DESC']],
      limit: 20,
    });

    for (const ses of sessions) {
      const feedback = await ActiveFeedback.findAll({ where: { session_id: ses.id } });
      const ratings = feedback.filter(f => f.rating !== null).map(f => f.rating);
      const comments = feedback.filter(f => f.content && f.content.trim());
      feedbackStats[ses.id] = {
        count: feedback.length,
        avgRating: ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : null,
        comments: comments.length,
        distribution: [1, 2, 3, 4, 5].map(r => ratings.filter(v => v === r).length),
      };
    }

    const allFeedback = await ActiveFeedback.findAll({ where: { course_id: courseId } });
    const allRatings = allFeedback.filter(f => f.rating !== null).map(f => f.rating);
    feedbackStats.overall = {
      totalFeedback: allFeedback.length,
      avgRating: allRatings.length ? (allRatings.reduce((a, b) => a + b, 0) / allRatings.length).toFixed(1) : null,
      totalComments: allFeedback.filter(f => f.content).length,
    };
  }

  res.render('active-feedback', { courses, sessions, feedbackStats, selectedCourseId: courseId, courseName });
}));

router.get('/live/:sessionId', ensureAuth, asyncHandler(async (req, res) => {
  const sessionId = requireInt(req.params.sessionId, 'Session');
  const session = await ClassSession.findByPk(sessionId, { include: [{ model: Course }] });
  if (!session) return res.status(404).send('Session not found');

  await assertCourseAccess(req, session.course_id);

  res.render('active-feedback-live', { layout: false, session, course: session.Course });
}));

router.post('/submit', ensureAuth, asyncHandler(async (req, res) => {
  const courseId = requireInt(req.body.course_id, 'Course');
  await assertCourseAccess(req, courseId);

  const session_id = req.body.session_id ? requireInt(req.body.session_id, 'Session') : null;
  if (session_id) {
    const ses = await ClassSession.findByPk(session_id);
    if (!ses || ses.course_id !== courseId) throw new Error('ACCESS_DENIED');
  }

  const contentRaw = (req.body.content || '').trim();
  const content = contentRaw ? contentRaw.slice(0, FEEDBACK_CONTENT_MAX) : null;

  let rating = null;
  if (req.body.rating !== undefined && req.body.rating !== '' && req.body.rating != null) {
    const r = requireInt(req.body.rating, 'Rating');
    if (r < 1 || r > 5) return res.status(400).json({ error: 'Invalid rating' });
    rating = r;
  }

  await ActiveFeedback.create({
    session_id,
    course_id: courseId,
    user_id: req.session.userId,
    feedback_type: ['understanding', 'pace', 'clarity', 'other'].includes(req.body.feedback_type)
      ? req.body.feedback_type
      : 'understanding',
    content,
    rating,
    is_anonymous: true,
  });

  res.json({ ok: true });
}));

router.get('/api/stats/:sessionId', ensureAuth, asyncHandler(async (req, res) => {
  const sessionId = requireInt(req.params.sessionId, 'Session');
  const session = await ClassSession.findByPk(sessionId, { include: [{ model: Course }] });
  if (!session || session.Course.user_id !== req.session.userId) throw new Error('ACCESS_DENIED');

  const feedback = await ActiveFeedback.findAll({ where: { session_id: sessionId } });
  const ratings = feedback.filter(f => f.rating !== null).map(f => f.rating);
  const comments = feedback.filter(f => f.content).map(f => ({
    content: f.content,
    type: f.feedback_type,
    time: f.createdAt,
  }));

  res.json({
    count: feedback.length,
    avgRating: ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : null,
    distribution: [1, 2, 3, 4, 5].map(r => ratings.filter(v => v === r).length),
    comments: comments.slice(-20),
  });
}));

module.exports = router;

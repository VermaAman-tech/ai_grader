const router = require('express').Router();
const { ensureAuth, ensureSubscription, asyncHandler } = require('../middleware/auth');
const { requireInt, requireString } = require('../middleware/validate');
const { Course, ClassSession, ConceptNode, LivePoll, PollResponse, IntegrationConfig } = require('../models');
const { Op } = require('sequelize');

router.get('/', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const courses = await Course.findAll({ where: { user_id: req.session.userId }, order: [['name', 'ASC']] });
  const courseId = parseInt(req.query.course_id) || null;
  let sessions = [];
  let courseName = '';
  let concepts = [];

  if (courseId) {
    const course = await Course.findOne({ where: { id: courseId, user_id: req.session.userId } });
    if (!course) throw new Error('ACCESS_DENIED');
    courseName = course.name;

    sessions = await ClassSession.findAll({
      where: { course_id: courseId },
      order: [['session_date', 'DESC']],
    });

    concepts = await ConceptNode.findAll({
      where: { course_id: courseId },
      order: [['name', 'ASC']],
    });
  }

  let zoomUrl = null, teamsUrl = null;
  if (courseId) {
    const zoomCfg = await IntegrationConfig.findOne({ where: { provider: 'zoom', course_id: courseId, user_id: req.session.userId, is_active: true } });
    if (zoomCfg) { try { zoomUrl = JSON.parse(zoomCfg.config).zoom_meeting_url; } catch {} }
    const teamsCfg = await IntegrationConfig.findOne({ where: { provider: 'teams', course_id: courseId, user_id: req.session.userId, is_active: true } });
    if (teamsCfg) { try { teamsUrl = JSON.parse(teamsCfg.config).teams_meeting_url; } catch {} }
  }

  res.render('class-sessions', { courses, sessions, selectedCourseId: courseId, courseName, concepts, zoomUrl, teamsUrl });
}));

router.post('/create', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const courseId = requireInt(req.body.course_id, 'Course');
  const course = await Course.findOne({ where: { id: courseId, user_id: req.session.userId } });
  if (!course) throw new Error('ACCESS_DENIED');

  const sessionDate = req.body.session_date || new Date().toISOString().split('T')[0];
  const title = req.body.title || `Class — ${sessionDate}`;
  const conceptsPlanned = req.body.concepts_planned
    ? JSON.stringify(req.body.concepts_planned.split(',').map(c => c.trim()))
    : '[]';

  await ClassSession.create({
    course_id: courseId,
    user_id: req.session.userId,
    title,
    session_date: sessionDate,
    start_time: req.body.start_time || null,
    end_time: req.body.end_time || null,
    concepts_planned: conceptsPlanned,
    status: 'planned',
  });

  req.flash('success', 'Class session created.');
  res.redirect(`/class-sessions?course_id=${courseId}`);
}));

router.post('/update/:id', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const id = requireInt(req.params.id, 'Session');
  const session = await ClassSession.findOne({
    where: { id },
    include: [{ model: Course, required: true, where: { user_id: req.session.userId } }],
  });
  if (!session) throw new Error('ACCESS_DENIED');

  if (req.body.title) session.title = req.body.title;
  if (req.body.status) {
    const allowed = new Set(['planned', 'in_progress', 'completed']);
    if (!allowed.has(req.body.status)) {
      req.flash('error', 'Invalid session status.');
      return res.redirect(`/class-sessions?course_id=${session.course_id}`);
    }
    session.status = req.body.status;
  }
  if (req.body.start_time) session.start_time = req.body.start_time;
  if (req.body.end_time) session.end_time = req.body.end_time;
  if (req.body.concepts_covered) session.concepts_covered = JSON.stringify(req.body.concepts_covered.split(',').map(c => c.trim()));
  if (req.body.professor_notes !== undefined) session.professor_notes = req.body.professor_notes;
  if (req.body.resources_used) session.resources_used = JSON.stringify(req.body.resources_used.split(',').map(r => r.trim()));

  await session.save();
  req.flash('success', 'Session updated.');
  res.redirect(`/class-sessions?course_id=${session.course_id}`);
}));

router.post('/start/:id', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const id = requireInt(req.params.id, 'Session');
  const session = await ClassSession.findOne({
    where: { id },
    include: [{ model: Course, required: true, where: { user_id: req.session.userId } }],
  });
  if (!session) throw new Error('ACCESS_DENIED');

  session.status = 'in_progress';
  session.start_time = new Date().toTimeString().split(' ')[0];
  await session.save();
  req.flash('success', 'Class started!');
  res.redirect(`/class-sessions?course_id=${session.course_id}`);
}));

router.post('/end/:id', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const id = requireInt(req.params.id, 'Session');
  const session = await ClassSession.findOne({
    where: { id },
    include: [{ model: Course, required: true, where: { user_id: req.session.userId } }],
  });
  if (!session) throw new Error('ACCESS_DENIED');

  session.status = 'completed';
  session.end_time = new Date().toTimeString().split(' ')[0];
  await session.save();
  req.flash('success', 'Class ended.');
  res.redirect(`/class-sessions?course_id=${session.course_id}`);
}));

module.exports = router;

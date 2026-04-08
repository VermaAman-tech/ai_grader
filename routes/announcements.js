const router = require('express').Router();
const { ensureAuth, ensureSubscription, asyncHandler } = require('../middleware/auth');
const { requireInt, requireString, optionalString } = require('../middleware/validate');
const { Course, Announcement, User, Student, IntegrationConfig } = require('../models');
const { Op } = require('sequelize');

router.get('/', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const courses = await Course.findAll({ where: { user_id: req.session.userId }, order: [['name', 'ASC']] });
  const courseId = parseInt(req.query.course_id) || null;
  let announcements = [];
  let courseName = '';

  if (courseId) {
    const course = await Course.findOne({ where: { id: courseId, user_id: req.session.userId } });
    if (!course) throw new Error('ACCESS_DENIED');
    courseName = course.name;
    announcements = await Announcement.findAll({
      where: { course_id: courseId },
      include: [{ model: User, attributes: ['full_name'] }],
      order: [['is_pinned', 'DESC'], ['created_at', 'DESC']],
    });
  }

  let slackActive = false, discordActive = false;
  if (courseId) {
    const slackCfg = await IntegrationConfig.findOne({ where: { provider: 'slack', course_id: courseId, user_id: req.session.userId, is_active: true } });
    slackActive = !!slackCfg;
    const discordCfg = await IntegrationConfig.findOne({ where: { provider: 'discord', course_id: courseId, user_id: req.session.userId, is_active: true } });
    discordActive = !!discordCfg;
  }

  res.render('announcements', { courses, announcements, selectedCourseId: courseId, courseName, slackActive, discordActive });
}));

router.post('/create', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const courseId = requireInt(req.body.course_id, 'Course');
  const course = await Course.findOne({ where: { id: courseId, user_id: req.session.userId } });
  if (!course) throw new Error('ACCESS_DENIED');

  const title = requireString(req.body.title, 'Title', { maxLen: 300 });
  const content = requireString(req.body.content, 'Content', { maxLen: 5000 });
  const type = ['general', 'assignment', 'grade_release', 'deadline'].includes(req.body.type) ? req.body.type : 'general';
  const isPinned = req.body.is_pinned === 'on';
  const schedRaw = (req.body.scheduled_for || '').trim();
  let scheduledFor = null;
  if (schedRaw) {
    scheduledFor = new Date(schedRaw);
    if (Number.isNaN(scheduledFor.getTime())) {
      req.flash('error', 'Invalid scheduled date and time.');
      return res.redirect(`/announcements?course_id=${courseId}`);
    }
  }
  const publishAt = scheduledFor && scheduledFor > new Date() ? scheduledFor : new Date();

  await Announcement.create({
    course_id: courseId,
    user_id: req.session.userId,
    title,
    content,
    type,
    is_pinned: isPinned,
    published_at: publishAt,
  });

  const msg = scheduledFor && scheduledFor > new Date()
    ? `Announcement scheduled for ${scheduledFor.toLocaleDateString()}.`
    : 'Announcement published.';
  req.flash('success', msg);
  res.redirect(`/announcements?course_id=${courseId}`);
}));

router.post('/delete/:id', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const id = requireInt(req.params.id, 'Announcement');
  const ann = await Announcement.findOne({
    where: { id },
    include: [{ model: Course, required: true, where: { user_id: req.session.userId } }],
  });
  if (!ann) throw new Error('ACCESS_DENIED');

  const courseId = ann.course_id;
  await ann.destroy();
  req.flash('success', 'Announcement deleted.');
  res.redirect(`/announcements?course_id=${courseId}`);
}));

router.post('/pin/:id', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const id = requireInt(req.params.id, 'Announcement');
  const ann = await Announcement.findOne({
    where: { id },
    include: [{ model: Course, required: true, where: { user_id: req.session.userId } }],
  });
  if (!ann) throw new Error('ACCESS_DENIED');

  ann.is_pinned = !ann.is_pinned;
  await ann.save();
  res.redirect(`/announcements?course_id=${ann.course_id}`);
}));

module.exports = router;

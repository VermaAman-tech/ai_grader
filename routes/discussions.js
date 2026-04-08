const router = require('express').Router();
const { ensureAuth, ensureSubscription, asyncHandler } = require('../middleware/auth');
const { requireInt, requireString, optionalString } = require('../middleware/validate');
const { Course, DiscussionThread, DiscussionPost, User, Student, IntegrationConfig } = require('../models');
const { Op } = require('sequelize');

router.get('/', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const courses = await Course.findAll({ where: { user_id: req.session.userId }, order: [['name', 'ASC']] });
  const courseId = parseInt(req.query.course_id) || null;
  let threads = [];
  let courseName = '';

  if (courseId) {
    const course = await Course.findOne({ where: { id: courseId, user_id: req.session.userId } });
    if (!course) throw new Error('ACCESS_DENIED');
    courseName = course.name;

    threads = await DiscussionThread.findAll({
      where: { course_id: courseId },
      include: [
        { model: User, attributes: ['full_name', 'role'] },
        { model: DiscussionPost, attributes: ['id'] },
      ],
      order: [['is_pinned', 'DESC'], ['created_at', 'DESC']],
    });
  }

  let piazzaActive = false;
  if (courseId) {
    const piazzaCfg = await IntegrationConfig.findOne({ where: { provider: 'piazza', course_id: courseId, user_id: req.session.userId, is_active: true } });
    piazzaActive = !!piazzaCfg;
  }

  res.render('discussions', { courses, threads, selectedCourseId: courseId, courseName, piazzaActive });
}));

router.get('/thread/:id', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const threadId = requireInt(req.params.id, 'Thread');
  const thread = await DiscussionThread.findOne({
    where: { id: threadId },
    include: [
      { model: Course, required: true, where: { user_id: req.session.userId } },
      { model: User, attributes: ['full_name', 'role'] },
    ],
  });
  if (!thread) throw new Error('ACCESS_DENIED');

  thread.view_count += 1;
  await thread.save();

  const posts = await DiscussionPost.findAll({
    where: { thread_id: threadId },
    include: [{ model: User, attributes: ['full_name', 'role'] }],
    order: [['created_at', 'ASC']],
  });

  res.render('discussion-thread', { thread, posts, course: thread.Course });
}));

router.post('/create', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const courseId = requireInt(req.body.course_id, 'Course');
  const course = await Course.findOne({ where: { id: courseId, user_id: req.session.userId } });
  if (!course) throw new Error('ACCESS_DENIED');

  const title = requireString(req.body.title, 'Title', { maxLen: 300 });
  const content = requireString(req.body.content, 'Content', { maxLen: 10000 });
  const threadType = ['question', 'announcement', 'poll', 'resource'].includes(req.body.thread_type) ? req.body.thread_type : 'question';
  const conceptTags = req.body.concept_tags ? JSON.stringify(req.body.concept_tags.split(',').map(t => t.trim())) : '[]';

  await DiscussionThread.create({
    course_id: courseId,
    user_id: req.session.userId,
    title,
    content,
    thread_type: threadType,
    concept_tags: conceptTags,
    is_pinned: req.body.is_pinned === 'on',
  });

  req.flash('success', 'Thread created.');
  res.redirect(`/discussions?course_id=${courseId}`);
}));

router.post('/reply/:threadId', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const threadId = requireInt(req.params.threadId, 'Thread');
  const thread = await DiscussionThread.findOne({
    where: { id: threadId },
    include: [{ model: Course, required: true, where: { user_id: req.session.userId } }],
  });
  if (!thread) throw new Error('ACCESS_DENIED');

  const content = requireString(req.body.content, 'Reply', { maxLen: 10000 });
  await DiscussionPost.create({
    thread_id: threadId,
    user_id: req.session.userId,
    content,
    is_answer: req.body.is_answer === 'on',
  });

  req.flash('success', 'Reply posted.');
  res.redirect(`/discussions/thread/${threadId}`);
}));

router.post('/resolve/:threadId', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const threadId = requireInt(req.params.threadId, 'Thread');
  const thread = await DiscussionThread.findOne({
    where: { id: threadId },
    include: [{ model: Course, required: true, where: { user_id: req.session.userId } }],
  });
  if (!thread) throw new Error('ACCESS_DENIED');

  thread.is_resolved = !thread.is_resolved;
  await thread.save();
  res.redirect(`/discussions/thread/${threadId}`);
}));

module.exports = router;

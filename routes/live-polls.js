const router = require('express').Router();
const { ensureAuth, ensureSubscription, asyncHandler } = require('../middleware/auth');
const { requireInt, requireString } = require('../middleware/validate');
const { Course, LivePoll, PollResponse, Student } = require('../models');
const { Op } = require('sequelize');
const crypto = require('crypto');

function genRoomCode() {
  return crypto.randomBytes(3).toString('hex').toUpperCase().substring(0, 6);
}

router.get('/', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const courses = await Course.findAll({ where: { user_id: req.session.userId }, order: [['name', 'ASC']] });
  const courseId = parseInt(req.query.course_id) || null;
  let polls = [];
  let courseName = '';

  if (courseId) {
    const course = await Course.findOne({ where: { id: courseId, user_id: req.session.userId } });
    if (!course) throw new Error('ACCESS_DENIED');
    courseName = course.name;
    polls = await LivePoll.findAll({
      where: { course_id: courseId },
      include: [{ model: PollResponse, attributes: ['id'] }],
      order: [['created_at', 'DESC']],
    });
  }

  res.render('live-polls', { courses, polls, selectedCourseId: courseId, courseName });
}));

router.post('/create', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const courseId = requireInt(req.body.course_id, 'Course');
  const course = await Course.findOne({ where: { id: courseId, user_id: req.session.userId } });
  if (!course) throw new Error('ACCESS_DENIED');

  const question = requireString(req.body.question, 'Question', { maxLen: 1000 });
  const pollType = ['mcq', 'word_cloud', 'confidence', 'ranked'].includes(req.body.poll_type) ? req.body.poll_type : 'mcq';
  const options = req.body.options
    ? JSON.stringify(req.body.options.split('\n').map(o => o.trim()).filter(Boolean))
    : '[]';

  let roomCode = genRoomCode();
  while (await LivePoll.findOne({ where: { room_code: roomCode } })) {
    roomCode = genRoomCode();
  }

  await LivePoll.create({
    course_id: courseId,
    user_id: req.session.userId,
    room_code: roomCode,
    question,
    poll_type: pollType,
    options,
    concept_tag: req.body.concept_tag || null,
    is_active: true,
  });

  req.flash('success', `Poll created! Room code: ${roomCode}`);
  res.redirect(`/live-polls?course_id=${courseId}`);
}));

router.get('/results/:pollId', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const pollId = requireInt(req.params.pollId, 'Poll');
  const poll = await LivePoll.findOne({
    where: { id: pollId },
    include: [
      { model: Course, required: true, where: { user_id: req.session.userId } },
      { model: PollResponse },
    ],
  });
  if (!poll) throw new Error('ACCESS_DENIED');

  let options = [];
  try { options = JSON.parse(poll.options || '[]'); } catch {}

  const responseCounts = {};
  for (const opt of options) responseCounts[opt] = 0;
  for (const r of poll.PollResponses) {
    if (responseCounts[r.response] !== undefined) responseCounts[r.response]++;
    else responseCounts[r.response] = 1;
  }

  res.render('poll-results', {
    poll,
    course: poll.Course,
    options,
    responseCounts,
    totalResponses: poll.PollResponses.length,
  });
}));

router.post('/close/:pollId', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const pollId = requireInt(req.params.pollId, 'Poll');
  const poll = await LivePoll.findOne({
    where: { id: pollId },
    include: [{ model: Course, required: true, where: { user_id: req.session.userId } }],
  });
  if (!poll) throw new Error('ACCESS_DENIED');

  poll.is_active = !poll.is_active;
  poll.closed_at = poll.is_active ? null : new Date();
  await poll.save();

  req.flash('success', poll.is_active ? 'Poll re-opened.' : 'Poll closed.');
  res.redirect(`/live-polls?course_id=${poll.course_id}`);
}));

router.get('/api/results/:pollId', asyncHandler(async (req, res) => {
  const poll = await LivePoll.findByPk(req.params.pollId, { include: [{ model: PollResponse }] });
  if (!poll) return res.json({ error: 'Not found' });

  let options = [];
  try { options = JSON.parse(poll.options || '[]'); } catch {}
  const counts = {};
  for (const opt of options) counts[opt] = 0;
  for (const r of poll.PollResponses) {
    if (counts[r.response] !== undefined) counts[r.response]++;
    else counts[r.response] = 1;
  }
  res.json({ counts, total: poll.PollResponses.length, active: poll.is_active });
}));

module.exports = router;

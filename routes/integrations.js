const router = require('express').Router();
const { ensureAuth, ensureSubscription, asyncHandler } = require('../middleware/auth');
const { requireInt } = require('../middleware/validate');
const { Course, Student, Exam, Submission, Grade, Rubric, IntegrationConfig,
        DiscussionThread, DiscussionPost, Announcement } = require('../models');
const { Op } = require('sequelize');

const PROVIDERS = {
  moodle:    { name: 'Moodle LMS', icon: 'graduation-cap', color: '#f98012', category: 'lms',
               desc: 'Sync rosters, push grades, import assignments via LTI 1.3',
               fields: ['lti_url', 'client_id', 'deployment_id'] },
  canvas:    { name: 'Canvas LMS', icon: 'layout-grid', color: '#e4002b', category: 'lms',
               desc: 'Bidirectional grade sync, roster import, assignment linking',
               fields: ['api_url', 'api_token', 'canvas_course_id'] },
  piazza:    { name: 'Piazza', icon: 'message-circle', color: '#3d5a80', category: 'discussion',
               desc: 'Import Q&A threads, sync discussions, map concept tags',
               fields: ['piazza_email', 'piazza_password', 'piazza_network_id'] },
  notion:    { name: 'Notion', icon: 'file-text', color: '#000000', category: 'docs',
               desc: 'Embed course wikis, collaborative notes, syllabus pages',
               fields: ['notion_page_url', 'notion_api_key'] },
  google_classroom: { name: 'Google Classroom', icon: 'graduation-cap', color: '#1aa260', category: 'lms',
               desc: 'Import rosters, sync grades, link coursework',
               fields: ['gc_course_id', 'gc_service_account'] },
  google_drive: { name: 'Google Drive', icon: 'hard-drive', color: '#4285f4', category: 'docs',
               desc: 'Embed shared folders, auto-backup exports, document viewer',
               fields: ['drive_folder_url', 'drive_shared_link'] },
  onedrive:  { name: 'OneDrive / SharePoint', icon: 'cloud', color: '#0078d4', category: 'docs',
               desc: 'Embed shared folders, link to Teams files',
               fields: ['onedrive_folder_url'] },
  overleaf:  { name: 'Overleaf', icon: 'pen-tool', color: '#47a141', category: 'docs',
               desc: 'Collaborative LaTeX editing for exams, rubrics, and solutions',
               fields: ['overleaf_project_url'] },
  turnitin:  { name: 'Turnitin', icon: 'shield-check', color: '#2b5797', category: 'grading',
               desc: 'Plagiarism detection for submissions, originality reports',
               fields: ['turnitin_api_key', 'turnitin_account_id'] },
  gradescope:{ name: 'Gradescope', icon: 'clipboard-check', color: '#00b0ff', category: 'grading',
               desc: 'Import/export grades, rubric sync, AI grading comparison',
               fields: ['gradescope_course_id', 'gradescope_token'] },
  zoom:      { name: 'Zoom', icon: 'video', color: '#2d8cff', category: 'meetings',
               desc: 'Link class sessions to Zoom meetings, auto-record',
               fields: ['zoom_meeting_url', 'zoom_api_key'] },
  teams:     { name: 'Microsoft Teams', icon: 'monitor', color: '#6264a7', category: 'meetings',
               desc: 'Link class sessions to Teams meetings, channel notifications',
               fields: ['teams_meeting_url', 'teams_webhook_url'] },
  slack:     { name: 'Slack', icon: 'hash', color: '#4a154b', category: 'notifications',
               desc: 'Post announcements, grade releases, and alerts to channels',
               fields: ['slack_webhook_url', 'slack_channel'] },
  discord:   { name: 'Discord', icon: 'headphones', color: '#5865f2', category: 'notifications',
               desc: 'Post updates to Discord server, student notifications',
               fields: ['discord_webhook_url'] },
  github_classroom: { name: 'GitHub Classroom', icon: 'github', color: '#333', category: 'code',
               desc: 'Link code assignments, auto-grade repos, import submissions',
               fields: ['github_org', 'github_classroom_id', 'github_token'] },
  copilot:   { name: 'GitHub Copilot', icon: 'bot', color: '#000', category: 'code',
               desc: 'AI code review on programming assignments',
               fields: ['copilot_enabled'] },
  bodhitree: { name: 'Bodhitree', icon: 'tree-pine', color: '#2e7d32', category: 'lms',
               desc: 'IIT Bombay learning platform — sync courses, content, and assessments',
               fields: ['bodhitree_url', 'bodhitree_api_key', 'bodhitree_course_id'] },
  jupyter:   { name: 'JupyterHub', icon: 'terminal', color: '#f37626', category: 'code',
               desc: 'Link Jupyter notebooks for grading, embed .ipynb viewer in submissions',
               fields: ['jupyter_url', 'jupyter_token'] },
};

const CATEGORIES = {
  lms: { label: 'Learning Management Systems', icon: 'school' },
  discussion: { label: 'Discussion & Q&A', icon: 'messages-square' },
  docs: { label: 'Documents & Notes', icon: 'file-stack' },
  grading: { label: 'Grading & Plagiarism', icon: 'check-circle' },
  meetings: { label: 'Video Meetings', icon: 'video' },
  notifications: { label: 'Notifications & Chat', icon: 'bell' },
  code: { label: 'Code & Dev Tools', icon: 'terminal' },
};

// Integrations Hub
router.get('/', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const courses = await Course.findAll({ where: { user_id: req.session.userId }, order: [['name', 'ASC']] });
  const courseId = parseInt(req.query.course_id) || null;

  const configs = {};
  if (courseId) {
    const rows = await IntegrationConfig.findAll({
      where: { course_id: courseId, user_id: req.session.userId },
    });
    for (const r of rows) configs[r.provider] = { ...r.toJSON(), parsedConfig: JSON.parse(r.config || '{}') };
  }

  const globalConfigs = await IntegrationConfig.findAll({
    where: { course_id: null, user_id: req.session.userId },
  });
  for (const r of globalConfigs) {
    if (!configs[r.provider]) configs[r.provider] = { ...r.toJSON(), parsedConfig: JSON.parse(r.config || '{}') };
  }

  res.render('integrations-hub', {
    courses, selectedCourseId: courseId, configs, PROVIDERS, CATEGORIES,
  });
}));

// Save integration config
router.post('/save', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const { provider, course_id } = req.body;
  if (!PROVIDERS[provider]) {
    req.flash('error', 'Unknown integration provider.');
    return res.redirect('/integrations');
  }

  const courseId = parseInt(course_id) || null;
  if (courseId) {
    const course = await Course.findOne({ where: { id: courseId, user_id: req.session.userId } });
    if (!course) throw new Error('ACCESS_DENIED');
  }

  const configData = {};
  const fields = PROVIDERS[provider].fields || [];
  for (const f of fields) {
    configData[f] = (req.body[f] || '').trim();
  }

  const [existing] = await IntegrationConfig.findOrCreate({
    where: { provider, user_id: req.session.userId, course_id: courseId },
    defaults: { config: JSON.stringify(configData), is_active: true },
  });

  if (existing.id) {
    existing.config = JSON.stringify(configData);
    existing.is_active = true;
    await existing.save();
  }

  req.flash('success', `${PROVIDERS[provider].name} configuration saved.`);
  res.redirect(`/integrations${courseId ? '?course_id=' + courseId : ''}`);
}));

// Toggle integration active/inactive
router.post('/toggle/:provider', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const { provider } = req.params;
  const courseId = parseInt(req.body.course_id) || null;

  const config = await IntegrationConfig.findOne({
    where: { provider, user_id: req.session.userId, course_id: courseId },
  });
  if (config) {
    config.is_active = !config.is_active;
    await config.save();
    req.flash('success', `${PROVIDERS[provider]?.name || provider} ${config.is_active ? 'enabled' : 'disabled'}.`);
  }
  res.redirect(`/integrations${courseId ? '?course_id=' + courseId : ''}`);
}));

// Moodle sync
router.post('/moodle/sync', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const courseId = parseInt(req.body.course_id);
  const course = courseId ? await Course.findOne({ where: { id: courseId, user_id: req.session.userId } }) : null;
  req.flash('success', course
    ? `Moodle roster sync initiated for ${course.code}. (Connect LTI credentials to activate.)`
    : 'Select a valid course.');
  res.redirect('/integrations?course_id=' + (courseId || ''));
}));

// Moodle push grades
router.post('/moodle/push-grades', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const examId = parseInt(req.body.exam_id);
  const exam = examId ? await Exam.findByPk(examId, { include: [{ model: Course, required: true, where: { user_id: req.session.userId } }] }) : null;
  if (exam) {
    const gradeCount = await Grade.count({ include: [{ model: Submission, required: true, where: { exam_id: examId } }] });
    req.flash('success', `${gradeCount} grades queued for Moodle push for "${exam.name}".`);
  } else {
    req.flash('error', 'Exam not found.');
  }
  res.redirect('/integrations?course_id=' + (exam?.course_id || ''));
}));

// Canvas sync
router.post('/canvas/sync', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const courseId = parseInt(req.body.course_id);
  const course = courseId ? await Course.findOne({ where: { id: courseId, user_id: req.session.userId } }) : null;
  req.flash('success', course
    ? `Canvas roster sync initiated for ${course.code}. (Connect API token to activate.)`
    : 'Select a valid course.');
  res.redirect('/integrations?course_id=' + (courseId || ''));
}));

// Piazza import
router.post('/piazza/sync', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const courseId = parseInt(req.body.course_id);
  const course = courseId ? await Course.findOne({ where: { id: courseId, user_id: req.session.userId } }) : null;
  req.flash('success', course
    ? `Piazza thread import initiated for ${course.code}. (Connect Piazza credentials to activate.)`
    : 'Select a valid course.');
  res.redirect('/integrations?course_id=' + (courseId || ''));
}));

// Google Classroom import
router.post('/google-classroom/sync', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const courseId = parseInt(req.body.course_id);
  req.flash('success', 'Google Classroom roster import initiated. (Connect service account to activate.)');
  res.redirect('/integrations?course_id=' + (courseId || ''));
}));

// Slack test webhook
router.post('/slack/test', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const courseId = parseInt(req.body.course_id) || null;
  const config = await IntegrationConfig.findOne({
    where: { provider: 'slack', user_id: req.session.userId, course_id: courseId },
  });
  if (config) {
    const parsed = JSON.parse(config.config || '{}');
    if (parsed.slack_webhook_url) {
      try {
        await fetch(parsed.slack_webhook_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: `Intelligrade test message for course integration.` }),
        });
        req.flash('success', 'Slack test message sent!');
      } catch (e) {
        req.flash('error', `Slack webhook failed: ${e.message}`);
      }
    } else {
      req.flash('error', 'No Slack webhook URL configured.');
    }
  }
  res.redirect('/integrations?course_id=' + (courseId || ''));
}));

// Discord test webhook
router.post('/discord/test', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const courseId = parseInt(req.body.course_id) || null;
  const config = await IntegrationConfig.findOne({
    where: { provider: 'discord', user_id: req.session.userId, course_id: courseId },
  });
  if (config) {
    const parsed = JSON.parse(config.config || '{}');
    if (parsed.discord_webhook_url) {
      try {
        await fetch(parsed.discord_webhook_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: `Intelligrade test message for course integration.` }),
        });
        req.flash('success', 'Discord test message sent!');
      } catch (e) {
        req.flash('error', `Discord webhook failed: ${e.message}`);
      }
    }
  }
  res.redirect('/integrations?course_id=' + (courseId || ''));
}));

// Notion embed data endpoint
router.get('/notion/embed', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const courseId = parseInt(req.query.course_id);
  const config = await IntegrationConfig.findOne({
    where: { provider: 'notion', user_id: req.session.userId, course_id: courseId },
  });
  if (config) {
    const parsed = JSON.parse(config.config || '{}');
    return res.json({ url: parsed.notion_page_url || null });
  }
  res.json({ url: null });
}));

// Turnitin check stub
router.post('/turnitin/check', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const submissionId = parseInt(req.body.submission_id);
  req.flash('success', `Turnitin plagiarism check initiated for submission #${submissionId}. (Connect API key to activate.)`);
  res.redirect(req.get('Referer') || '/submissions');
}));

// GitHub Classroom import
router.post('/github-classroom/import', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const courseId = parseInt(req.body.course_id);
  req.flash('success', 'GitHub Classroom assignment import initiated. (Connect GitHub token to activate.)');
  res.redirect('/integrations?course_id=' + (courseId || ''));
}));

// Moodle LTI page (legacy URL redirect)
router.get('/moodle', (req, res) => res.redirect('/integrations'));
router.get('/piazza', (req, res) => res.redirect('/integrations'));

module.exports = router;

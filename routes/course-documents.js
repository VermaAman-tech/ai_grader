const router = require('express').Router();
const { ensureAuth, ensureSubscription, asyncHandler } = require('../middleware/auth');
const { requireInt, requireString } = require('../middleware/validate');
const { Course, CourseDocument, User, IntegrationConfig } = require('../models');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.resolve(process.env.UPLOAD_DIR || './data/uploads');
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(uploadDir, 'documents');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}_${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

router.get('/', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const courses = await Course.findAll({ where: { user_id: req.session.userId }, order: [['name', 'ASC']] });
  const courseId = parseInt(req.query.course_id) || null;
  let documents = [];
  let courseName = '';

  if (courseId) {
    const course = await Course.findOne({ where: { id: courseId, user_id: req.session.userId } });
    if (!course) throw new Error('ACCESS_DENIED');
    courseName = course.name;
    documents = await CourseDocument.findAll({
      where: { course_id: courseId },
      order: [['created_at', 'DESC']],
    });
  }

  let notionUrl = null, driveUrl = null;
  if (courseId) {
    const notionCfg = await IntegrationConfig.findOne({ where: { provider: 'notion', course_id: courseId, user_id: req.session.userId, is_active: true } });
    if (notionCfg) { try { notionUrl = JSON.parse(notionCfg.config).notion_page_url; } catch {} }
    const driveCfg = await IntegrationConfig.findOne({ where: { provider: 'google_drive', course_id: courseId, user_id: req.session.userId, is_active: true } });
    if (driveCfg) { try { driveUrl = JSON.parse(driveCfg.config).drive_folder_url; } catch {} }
  }

  res.render('course-documents', { courses, documents, selectedCourseId: courseId, courseName, notionUrl, driveUrl });
}));

router.post('/upload', ensureAuth, ensureSubscription, upload.single('document'), asyncHandler(async (req, res) => {
  const courseId = requireInt(req.body.course_id, 'Course');
  const course = await Course.findOne({ where: { id: courseId, user_id: req.session.userId } });
  if (!course) throw new Error('ACCESS_DENIED');

  if (!req.file) {
    req.flash('error', 'Please select a file to upload.');
    return res.redirect(`/course-documents?course_id=${courseId}`);
  }

  const title = requireString(req.body.title || req.file.originalname, 'Title', { maxLen: 300 });
  const docType = ['slides', 'notes', 'past_paper', 'model_answer', 'syllabus', 'assignment', 'other']
    .includes(req.body.doc_type) ? req.body.doc_type : 'other';

  let extractedText = '';
  try {
    if (req.file.mimetype === 'application/pdf') {
      const pdfParse = require('pdf-parse');
      const buffer = fs.readFileSync(req.file.path);
      const data = await pdfParse(buffer);
      extractedText = data.text || '';
    } else {
      extractedText = fs.readFileSync(req.file.path, 'utf-8').substring(0, 50000);
    }
  } catch {}

  await CourseDocument.create({
    course_id: courseId,
    user_id: req.session.userId,
    title,
    doc_type: docType,
    file_path: req.file.path,
    file_name: req.file.originalname,
    extracted_text: extractedText.substring(0, 100000),
    page_count: 0,
    allow_download: req.body.allow_download !== 'off',
    concept_tags: req.body.concept_tags ? JSON.stringify(req.body.concept_tags.split(',').map(t => t.trim())) : '[]',
  });

  req.flash('success', `"${title}" uploaded and indexed.`);
  res.redirect(`/course-documents?course_id=${courseId}`);
}));

router.post('/delete/:id', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const id = requireInt(req.params.id, 'Document');
  const doc = await CourseDocument.findOne({
    where: { id },
    include: [{ model: Course, required: true, where: { user_id: req.session.userId } }],
  });
  if (!doc) throw new Error('ACCESS_DENIED');

  const courseId = doc.course_id;
  try { if (doc.file_path) fs.unlinkSync(doc.file_path); } catch {}
  await doc.destroy();
  req.flash('success', 'Document removed.');
  res.redirect(`/course-documents?course_id=${courseId}`);
}));

module.exports = router;

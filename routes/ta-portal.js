const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Op, UniqueConstraintError } = require('sequelize');
const { ensureAuth, ensureTA, asyncTA, getTAAssignment, ensureTAPerm } = require('../middleware/auth');
const { requireInt, requireString, optionalString, optionalFloat, requireEmail } = require('../middleware/validate');
const {
  User, Course, CourseTA, Exam, Student, Submission, Grade, Rubric,
  Announcement, CourseDocument, Crib,
} = require('../models');
const { gradeSubmission } = require('../services/grading');
const { getExamAnalytics } = require('../services/analytics');

const uploadDir = path.resolve(process.env.UPLOAD_DIR || './data/uploads');
const docStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(uploadDir, 'documents');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const safe = (file.originalname || 'file').replace(/\0/g, '').replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}_${safe}`);
  },
});
const ALLOW_DOC_EXT = new Set(['.pdf', '.txt', '.md', '.doc', '.docx']);
const docUpload = multer({
  storage: docStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    const safeName = (file.originalname || '').replace(/\0/g, '').replace(/[^a-zA-Z0-9._-]/g, '_');
    const ext = path.extname(safeName).toLowerCase();
    cb(null, ALLOW_DOC_EXT.has(ext));
  },
});

/* ================================================================
   AUTH: Redirect to unified login/register
   ================================================================ */

router.get('/login', (req, res) => res.redirect('/login'));
router.get('/register', (req, res) => res.redirect('/register'));
router.get('/logout', (req, res) => { req.session.destroy(() => res.redirect('/')); });

/* ================================================================
   DASHBOARD
   ================================================================ */

router.get('/dashboard', ensureAuth, ensureTA, asyncTA(async (req, res) => {
  const assignments = await CourseTA.findAll({
    where: { user_id: req.session.userId, status: 'active' },
    include: [{ model: Course, include: [{ model: User, attributes: ['full_name'] }] }],
  });

  const stats = { totalCourses: assignments.length, pendingGrading: 0, gradedTotal: 0 };
  const courseData = [];

  for (const a of assignments) {
    const course = a.Course;
    if (!course) continue;

    let permissions;
    try {
      const stored = JSON.parse(a.assigned_students || '[]');
      const defaults = a.role === 'head_ta'
        ? { can_grade: true, can_view_analytics: true, can_manage_roster: true, can_post_announcements: true, can_access_cribs: true, can_manage_docs: true }
        : { can_grade: true, can_view_analytics: false, can_manage_roster: false, can_post_announcements: false, can_access_cribs: false, can_manage_docs: false };
      permissions = (stored && typeof stored === 'object' && !Array.isArray(stored) && stored.permissions)
        ? { ...defaults, ...stored.permissions }
        : defaults;
    } catch { permissions = { can_grade: true }; }

    const exams = await Exam.findAll({ where: { course_id: course.id } });
    const examIds = exams.map(e => e.id);
    const pending = examIds.length
      ? await Submission.count({ where: { exam_id: { [Op.in]: examIds }, status: 'pending' } })
      : 0;

    stats.pendingGrading += pending;
    stats.gradedTotal += a.submissions_graded || 0;

    courseData.push({
      assignment: a.get({ plain: true }),
      course: course.get({ plain: true }),
      professor: course.User?.full_name || 'Unknown',
      permissions,
      pendingGrading: pending,
      examCount: exams.length,
    });
  }

  res.render('ta-portal-dashboard', {
    layout: 'partials/ta-layout',
    pageTitle: 'TA Dashboard',
    currentPage: 'dashboard',
    courseData, stats,
    session: req.session,
  });
}));

/* ================================================================
   COURSE VIEW
   ================================================================ */

router.get('/course/:courseId', ensureAuth, ensureTA, asyncTA(async (req, res) => {
  const courseId = requireInt(req.params.courseId, 'Course');
  const assignment = await getTAAssignment(req.session.userId, courseId);
  if (!assignment) throw new Error('ACCESS_DENIED');

  const course = await Course.findByPk(courseId, {
    include: [{ model: User, attributes: ['full_name'] }],
  });
  if (!course) throw new Error('ACCESS_DENIED');

  const exams = await Exam.findAll({
    where: { course_id: courseId },
    order: [['created_at', 'DESC']],
  });

  const studentCount = await Student.count({ where: { course_id: courseId } });

  const recentAnnouncements = await Announcement.findAll({
    where: { course_id: courseId },
    order: [['created_at', 'DESC']],
    limit: 3,
  });

  const examIds = exams.map(e => e.id);
  const pendingCount = examIds.length
    ? await Submission.count({ where: { exam_id: { [Op.in]: examIds }, status: 'pending' } })
    : 0;
  const gradedCount = assignment.ta?.submissions_graded || 0;

  res.render('ta-portal-course', {
    layout: 'partials/ta-layout',
    pageTitle: course.code || course.name,
    currentPage: 'course',
    course: course.get({ plain: true }),
    professor: course.User?.full_name || 'Unknown',
    permissions: assignment.permissions,
    defaultExamId: exams.length ? exams[0].id : null,
    exams,
    studentCount,
    pendingCount,
    gradedCount,
    recentAnnouncements,
    assignedQuestions: assignment.assignedQuestions,
    assignedStudents: assignment.assignedStudents,
    session: req.session,
  });
}));

/* ================================================================
   GRADING
   ================================================================ */

router.get('/grading/:examId', ensureAuth, ensureTA, asyncTA(async (req, res) => {
  const examId = requireInt(req.params.examId, 'Exam');
  const exam = await Exam.findByPk(examId, { include: [{ model: Course }] });
  if (!exam) throw new Error('ACCESS_DENIED');

  const assignment = await getTAAssignment(req.session.userId, exam.course_id);
  if (!assignment || !assignment.permissions.can_grade) throw new Error('ACCESS_DENIED');

  const whereClause = { exam_id: examId };
  if (assignment.assignedStudents.length > 0) {
    whereClause.student_id = { [Op.in]: assignment.assignedStudents.map(Number).filter(Boolean) };
  }

  const raw = await Submission.findAll({
    where: whereClause,
    include: [{ model: Student }],
    order: [['created_at', 'DESC']],
  });

  const rubricCount = await Rubric.count({ where: { exam_id: examId } });
  const submissions = [];
  for (const sub of raw) {
    const gradeCount = await Grade.count({ where: { submission_id: sub.id } });
    submissions.push({
      ...sub.toJSON(),
      gradeCount,
      rubricCount,
      isFullyGraded: gradeCount >= rubricCount && rubricCount > 0,
    });
  }

  const courseObj = exam.Course.get({ plain: true });
  res.render('ta-portal-grading', {
    layout: 'partials/ta-layout',
    pageTitle: `Grade: ${exam.name}`,
    currentPage: 'grading',
    exam: exam.get({ plain: true }),
    course: courseObj,
    professor: '',
    permissions: assignment.permissions,
    defaultExamId: examId,
    submissions,
    assignedQuestions: assignment.assignedQuestions,
    session: req.session,
  });
}));

router.post('/grade/:submissionId', ensureAuth, ensureTA, asyncTA(async (req, res) => {
  const submissionId = requireInt(req.params.submissionId, 'Submission');
  const sub = await Submission.findByPk(submissionId, {
    include: [{ model: Exam, include: [{ model: Course }] }],
  });
  if (!sub) throw new Error('ACCESS_DENIED');

  const assignment = await getTAAssignment(req.session.userId, sub.Exam.course_id);
  if (!assignment || !assignment.permissions.can_grade) throw new Error('ACCESS_DENIED');

  await gradeSubmission(submissionId);

  await CourseTA.increment('submissions_graded', {
    by: 1,
    where: { user_id: req.session.userId, course_id: sub.Exam.course_id },
  });

  req.flash('success', 'Grading complete!');
  res.redirect(`/ta-portal/grading/${sub.exam_id}`);
}));

router.post('/grade-all/:examId', ensureAuth, ensureTA, asyncTA(async (req, res) => {
  const examId = requireInt(req.params.examId, 'Exam');
  const exam = await Exam.findByPk(examId, { include: [{ model: Course }] });
  if (!exam) throw new Error('ACCESS_DENIED');

  const assignment = await getTAAssignment(req.session.userId, exam.course_id);
  if (!assignment || !assignment.permissions.can_grade) throw new Error('ACCESS_DENIED');

  const whereClause = { exam_id: examId, status: { [Op.in]: ['pending', 'error'] } };
  if (assignment.assignedStudents.length > 0) {
    whereClause.student_id = { [Op.in]: assignment.assignedStudents.map(Number).filter(Boolean) };
  }

  const subs = await Submission.findAll({ where: whereClause });
  let ok = 0, fail = 0;

  for (const sub of subs) {
    try {
      await gradeSubmission(sub.id);
      ok++;
    } catch { fail++; }
  }

  if (ok > 0) {
    await CourseTA.increment('submissions_graded', {
      by: ok,
      where: { user_id: req.session.userId, course_id: exam.course_id },
    });
  }

  req.flash('success', `Batch grading: ${ok} succeeded, ${fail} failed.`);
  res.redirect(`/ta-portal/grading/${examId}`);
}));

router.get('/review/:submissionId', ensureAuth, ensureTA, asyncTA(async (req, res) => {
  const submissionId = requireInt(req.params.submissionId, 'Submission');
  const sub = await Submission.findOne({
    where: { id: submissionId },
    include: [
      { model: Student },
      { model: Exam, include: [{ model: Course }] },
      { model: Grade, include: [{ model: Rubric }] },
    ],
  });
  if (!sub) throw new Error('ACCESS_DENIED');

  const assignment = await getTAAssignment(req.session.userId, sub.Exam.course_id);
  if (!assignment || !assignment.permissions.can_grade) throw new Error('ACCESS_DENIED');

  const grades = (sub.Grades || [])
    .sort((a, b) => (a.Rubric?.question_order || 0) - (b.Rubric?.question_order || 0))
    .map(g => {
      let matched = [], missing = [];
      try { matched = JSON.parse(g.matched_points || '[]'); } catch {}
      try { missing = JSON.parse(g.missing_points || '[]'); } catch {}
      return {
        ...g.toJSON(),
        parsedMatched: matched,
        parsedMissing: missing,
        effectiveMarks: g.override_marks !== null ? g.override_marks : g.awarded_marks,
      };
    });

  const totalAwarded = grades.reduce((s, g) => s + g.effectiveMarks, 0);
  const totalMax = grades.reduce((s, g) => s + (g.Rubric?.max_marks || 0), 0);

  const reviewCourse = sub.Exam.Course.get ? sub.Exam.Course.get({ plain: true }) : sub.Exam.Course;
  res.render('ta-portal-review', {
    layout: 'partials/ta-layout',
    pageTitle: `Review: ${sub.Student?.name || 'Submission'}`,
    currentPage: 'grading',
    submission: sub,
    grades,
    totalAwarded,
    totalMax,
    course: reviewCourse,
    exam: sub.Exam,
    professor: '',
    permissions: assignment.permissions,
    defaultExamId: sub.exam_id,
    session: req.session,
  });
}));

router.post('/override/:gradeId', ensureAuth, ensureTA, asyncTA(async (req, res) => {
  const gradeId = requireInt(req.params.gradeId, 'Grade');
  const grade = await Grade.findOne({
    where: { id: gradeId },
    include: [
      { model: Rubric },
      { model: Submission, include: [{ model: Exam, include: [{ model: Course }] }] },
    ],
  });
  if (!grade) throw new Error('ACCESS_DENIED');

  const assignment = await getTAAssignment(req.session.userId, grade.Submission.Exam.course_id);
  if (!assignment || !assignment.permissions.can_grade) throw new Error('ACCESS_DENIED');

  const { override_marks, override_note } = req.body;
  const maxM = grade.Rubric?.max_marks ?? 0;
  grade.override_marks = optionalFloat(override_marks, 'Override marks', { min: 0, max: maxM });
  grade.override_note = optionalString(override_note, { maxLen: 1000 });
  grade.modified_by_session = req.sessionID;
  grade.review_status = 'overridden';
  await grade.save();

  req.flash('success', `Q${grade.question_no} override saved.`);
  res.redirect(`/ta-portal/review/${grade.submission_id}`);
}));

/* ================================================================
   ANALYTICS (read-only)
   ================================================================ */

router.get('/analytics/:courseId', ensureAuth, ensureTA, ensureTAPerm('can_view_analytics'), asyncTA(async (req, res) => {
  const courseId = requireInt(req.params.courseId, 'Course');
  const course = await Course.findByPk(courseId);

  const exams = await Exam.findAll({ where: { course_id: courseId }, order: [['name', 'ASC']] });
  const examId = parseInt(req.query.exam_id) || null;
  let analytics = null;

  if (examId) {
    const exam = await Exam.findOne({ where: { id: examId, course_id: courseId } });
    if (exam) analytics = await getExamAnalytics(examId);
  }

  const analyticsCourse = course.get({ plain: true });
  const analyticsAssignment = await getTAAssignment(req.session.userId, courseId);
  res.render('ta-portal-analytics', {
    layout: 'partials/ta-layout',
    pageTitle: 'Analytics',
    currentPage: 'analytics',
    course: analyticsCourse,
    professor: '',
    permissions: analyticsAssignment?.permissions || {},
    defaultExamId: exams.length ? exams[0].id : null,
    exams,
    analytics,
    selectedExamId: examId,
    session: req.session,
  });
}));

/* ================================================================
   ROSTER
   ================================================================ */

router.get('/roster/:courseId', ensureAuth, ensureTA, ensureTAPerm('can_manage_roster'), asyncTA(async (req, res) => {
  const courseId = requireInt(req.params.courseId, 'Course');
  const course = await Course.findByPk(courseId);
  const students = await Student.findAll({
    where: { course_id: courseId },
    order: [['roll_number', 'ASC'], ['name', 'ASC']],
  });

  const rosterCourse = course.get({ plain: true });
  const rosterAssignment = await getTAAssignment(req.session.userId, courseId);
  res.render('ta-portal-roster', {
    layout: 'partials/ta-layout',
    pageTitle: 'Roster',
    currentPage: 'roster',
    course: rosterCourse,
    professor: '',
    permissions: rosterAssignment?.permissions || {},
    defaultExamId: null,
    students,
    session: req.session,
  });
}));

router.post('/roster/:courseId/add', ensureAuth, ensureTA, ensureTAPerm('can_manage_roster'), asyncTA(async (req, res) => {
  const courseId = requireInt(req.params.courseId, 'Course');
  const name = (req.body.name || '').trim();
  const roll = (req.body.roll_number || '').trim().toUpperCase() || null;
  const email = (req.body.email || '').trim().toLowerCase() || null;

  if (!name) {
    req.flash('error', 'Student name is required.');
    return res.redirect(`/ta-portal/roster/${courseId}`);
  }

  if (roll) {
    const existing = await Student.findOne({ where: { course_id: courseId, roll_number: roll } });
    if (existing) {
      req.flash('error', `Roll number ${roll} already exists.`);
      return res.redirect(`/ta-portal/roster/${courseId}`);
    }
  }

  try {
    await Student.create({ course_id: courseId, name, roll_number: roll, email });
  } catch (e) {
    if (e instanceof UniqueConstraintError) {
      req.flash('error', 'Duplicate roll number.');
      return res.redirect(`/ta-portal/roster/${courseId}`);
    }
    throw e;
  }

  req.flash('success', `Student "${name}" added.`);
  res.redirect(`/ta-portal/roster/${courseId}`);
}));

/* ================================================================
   ANNOUNCEMENTS
   ================================================================ */

router.get('/announcements/:courseId', ensureAuth, ensureTA, ensureTAPerm('can_post_announcements'), asyncTA(async (req, res) => {
  const courseId = requireInt(req.params.courseId, 'Course');
  const course = await Course.findByPk(courseId);
  const announcements = await Announcement.findAll({
    where: { course_id: courseId },
    include: [{ model: User, attributes: ['full_name'] }],
    order: [['is_pinned', 'DESC'], ['created_at', 'DESC']],
  });

  const annCourse = course.get({ plain: true });
  const annAssignment = await getTAAssignment(req.session.userId, courseId);
  res.render('ta-portal-announcements', {
    layout: 'partials/ta-layout',
    pageTitle: 'Announcements',
    currentPage: 'announcements',
    course: annCourse,
    professor: '',
    permissions: annAssignment?.permissions || {},
    defaultExamId: null,
    announcements,
    session: req.session,
  });
}));

router.post('/announcements/:courseId', ensureAuth, ensureTA, ensureTAPerm('can_post_announcements'), asyncTA(async (req, res) => {
  const courseId = requireInt(req.params.courseId, 'Course');
  const title = requireString(req.body.title, 'Title', { maxLen: 300 });
  const content = requireString(req.body.content, 'Content', { maxLen: 5000 });
  const type = ['general', 'assignment', 'grade_release', 'deadline'].includes(req.body.type) ? req.body.type : 'general';

  await Announcement.create({
    course_id: courseId,
    user_id: req.session.userId,
    title,
    content,
    type,
    is_pinned: false,
    published_at: new Date(),
  });

  req.flash('success', 'Announcement published.');
  res.redirect(`/ta-portal/announcements/${courseId}`);
}));

/* ================================================================
   CRIBS / REGRADE
   ================================================================ */

router.get('/cribs/:courseId', ensureAuth, ensureTA, ensureTAPerm('can_access_cribs'), asyncTA(async (req, res) => {
  const courseId = requireInt(req.params.courseId, 'Course');
  const course = await Course.findByPk(courseId);
  const exams = await Exam.findAll({ where: { course_id: courseId } });
  const examId = parseInt(req.query.exam_id) || null;

  let cribs = [];
  let stats = { total: 0, pending: 0, accepted: 0, rejected: 0 };

  if (examId) {
    const exam = await Exam.findOne({ where: { id: examId, course_id: courseId } });
    if (exam) {
      cribs = await Crib.findAll({
        where: { exam_id: examId },
        include: [
          { model: Student },
          { model: Grade, include: [{ model: Rubric }] },
        ],
        order: [['created_at', 'DESC']],
      });
      stats.total = cribs.length;
      stats.pending = cribs.filter(c => c.status === 'pending').length;
      stats.accepted = cribs.filter(c => c.status === 'accepted').length;
      stats.rejected = cribs.filter(c => c.status === 'rejected').length;
    }
  }

  const cribsCourse = course.get({ plain: true });
  const cribsAssignment = await getTAAssignment(req.session.userId, courseId);
  res.render('ta-portal-cribs', {
    layout: 'partials/ta-layout',
    pageTitle: 'Cribs / Regrade',
    currentPage: 'cribs',
    course: cribsCourse,
    professor: '',
    permissions: cribsAssignment?.permissions || {},
    defaultExamId: exams.length ? exams[0].id : null,
    exams,
    cribs,
    selectedExamId: examId,
    stats,
    session: req.session,
  });
}));

router.post('/cribs/resolve/:cribId', ensureAuth, ensureTA, asyncTA(async (req, res) => {
  const cribId = requireInt(req.params.cribId, 'Crib');
  const crib = await Crib.findByPk(cribId, {
    include: [{ model: Exam, include: [{ model: Course }] }],
  });
  if (!crib) throw new Error('ACCESS_DENIED');

  const assignment = await getTAAssignment(req.session.userId, crib.Exam.course_id);
  if (!assignment || !assignment.permissions.can_access_cribs) throw new Error('ACCESS_DENIED');

  const { action, resolved_marks, resolved_note } = req.body;
  crib.status = action === 'accept' ? 'accepted' : 'rejected';
  crib.resolved_by = req.session.userId;
  crib.resolved_note = optionalString(resolved_note, { maxLen: 1000 });
  crib.resolved_at = new Date();

  if (action === 'accept' && resolved_marks !== '' && resolved_marks != null) {
    const grade = await Grade.findByPk(crib.grade_id, { include: [{ model: Rubric }] });
    const maxM = grade?.Rubric?.max_marks ?? 0;
    const marks = optionalFloat(resolved_marks, 'Resolved marks', { min: 0, max: maxM });
    if (marks != null && grade) {
      crib.resolved_marks = marks;
      grade.override_marks = marks;
      grade.override_note = `Crib accepted by TA: ${crib.resolved_note || 'Marks updated via regrade request.'}`;
      grade.modified_by_session = req.sessionID;
      await grade.save();
    }
  }
  await crib.save();

  req.flash('success', `Crib ${crib.status}.`);
  res.redirect(`/ta-portal/cribs/${crib.Exam.course_id}?exam_id=${crib.exam_id}`);
}));

/* ================================================================
   COURSE DOCUMENTS
   ================================================================ */

router.get('/documents/:courseId', ensureAuth, ensureTA, ensureTAPerm('can_manage_docs'), asyncTA(async (req, res) => {
  const courseId = requireInt(req.params.courseId, 'Course');
  const course = await Course.findByPk(courseId);
  const documents = await CourseDocument.findAll({
    where: { course_id: courseId },
    order: [['created_at', 'DESC']],
  });

  const docsCourse = course.get({ plain: true });
  const docsAssignment = await getTAAssignment(req.session.userId, courseId);
  res.render('ta-portal-documents', {
    layout: 'partials/ta-layout',
    pageTitle: 'Documents',
    currentPage: 'documents',
    course: docsCourse,
    professor: '',
    permissions: docsAssignment?.permissions || {},
    defaultExamId: null,
    documents,
    session: req.session,
  });
}));

router.post('/documents/:courseId/upload', ensureAuth, ensureTA, ensureTAPerm('can_manage_docs'), docUpload.single('document'), asyncTA(async (req, res) => {
  const courseId = requireInt(req.params.courseId, 'Course');

  if (!req.file) {
    req.flash('error', 'Please select a file to upload.');
    return res.redirect(`/ta-portal/documents/${courseId}`);
  }

  const title = requireString(req.body.title || req.file.originalname, 'Title', { maxLen: 300 });
  const docType = ['slides', 'notes', 'past_paper', 'model_answer', 'syllabus', 'assignment', 'other']
    .includes(req.body.doc_type) ? req.body.doc_type : 'other';

  let extractedText = '';
  const ext = path.extname(req.file.originalname || '').toLowerCase();
  try {
    if (ext === '.pdf') {
      const pdfParse = require('pdf-parse');
      const buffer = fs.readFileSync(req.file.path);
      const data = await pdfParse(buffer);
      extractedText = data.text || '';
    } else if (ext === '.txt' || ext === '.md') {
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
    allow_download: true,
  });

  req.flash('success', `"${title}" uploaded.`);
  res.redirect(`/ta-portal/documents/${courseId}`);
}));

/* ================================================================
   AI ASSISTANT (TA-scoped)
   ================================================================ */

let LLMService, ChatMessage, loadPrompt;
try {
  LLMService = require('../services/llm');
  ChatMessage = require('../models').ChatMessage;
  loadPrompt = require('../utils/prompt-loader').loadPrompt;
} catch {}

const TA_SYSTEM_PROMPT = (loadPrompt && loadPrompt(
  'system/assistant.md',
  'You are Intelligrade AI assistant for Teaching Assistants. Help with grading, analytics, student queries, and course management.'
)) || 'You are Intelligrade AI assistant for Teaching Assistants. Help with grading, analytics, student queries, and course management.';

router.post('/ai/action', ensureAuth, ensureTA, asyncTA(async (req, res) => {
  if (!LLMService || !ChatMessage) return res.json({ error: 'AI assistant not configured.' });

  const { message, context } = req.body;
  if (!message?.trim()) return res.json({ error: 'Message cannot be empty.' });

  const courseId = parseInt(context?.course_id) || null;
  const page = context?.page || 'ta-course';

  if (!courseId) return res.json({ error: 'No course context.' });

  const assignment = await getTAAssignment(req.session.userId, courseId);
  if (!assignment) return res.json({ error: 'You are not a TA for this course.' });

  await ChatMessage.create({
    user_id: req.session.userId,
    exam_id: null,
    role: 'user',
    content: message.trim().slice(0, 2000),
  });

  let contextBlock = `\nTA is on: ${page} page.\nRole: ${assignment.raw?.role || 'ta'}`;

  const course = await Course.findByPk(courseId);
  if (course) {
    contextBlock += `\nCourse: ${course.code} - ${course.name}`;
    if (course.description) contextBlock += `\nDescription: ${course.description.slice(0, 300)}`;
    if (course.syllabus) contextBlock += `\nSyllabus: ${course.syllabus.slice(0, 400)}`;
  }

  const exams = await Exam.findAll({ where: { course_id: courseId } });
  contextBlock += `\nExams: ${exams.map(e => `${e.name} (id:${e.id}, type:${e.exam_type}, released:${e.grades_released})`).join(', ')}`;

  const studentCount = await Student.count({ where: { course_id: courseId } });
  contextBlock += `\nStudents: ${studentCount}`;

  const examIds = exams.map(e => e.id);
  if (examIds.length) {
    const pendingCount = await Submission.count({ where: { exam_id: { [Op.in]: examIds }, status: 'pending' } });
    const gradedCount = await Submission.count({ where: { exam_id: { [Op.in]: examIds }, status: 'graded' } });
    contextBlock += `\nSubmissions pending: ${pendingCount}, graded: ${gradedCount}`;

    const { getExamAnalytics } = require('../services/analytics');
    for (const exam of exams.slice(0, 3)) {
      try {
        const analytics = await getExamAnalytics(exam.id);
        if (analytics && analytics.gradedCount > 0) {
          contextBlock += `\n${exam.name}: avg=${analytics.classAvg}/${analytics.maxPossible}, median=${analytics.classMedian}, pass=${analytics.passRate}%`;
        }
      } catch {}
    }

    const pendingCribs = await Crib.count({ where: { exam_id: { [Op.in]: examIds }, status: 'pending' } });
    if (pendingCribs) contextBlock += `\nPending cribs: ${pendingCribs}`;
  }

  const docs = await CourseDocument.findAll({ where: { course_id: courseId } });
  if (docs.length) {
    const userMsg = message.toLowerCase();
    let ragContext = '';
    let budget = 1200;
    for (const doc of docs) {
      if (budget <= 0) break;
      const text = (doc.extracted_text || '').trim();
      if (!text) continue;
      const kw = userMsg.match(/[a-z]{4,}/g) || [];
      const tl = text.toLowerCase();
      if (kw.filter(k => tl.includes(k)).length > 0 || docs.length <= 3) {
        const chunk = text.slice(0, Math.min(budget, 500));
        ragContext += `\n[${doc.title}] ${chunk}`;
        budget -= chunk.length;
      }
    }
    if (ragContext) contextBlock += `\n--- COURSE DOCS ---${ragContext}`;
  }

  const recent = await ChatMessage.findAll({
    where: { user_id: req.session.userId },
    order: [['created_at', 'DESC']],
    limit: 10,
  });
  recent.reverse();
  const messages = recent.map(m => ({ role: m.role, content: m.content }));

  try {
    const llm = new LLMService();
    const raw = await llm.chat(messages, TA_SYSTEM_PROMPT + contextBlock);
    let reply = raw.trim().split('\n').filter(l => !l.match(/^ACTION:/)).join('\n').trim();

    await ChatMessage.create({ user_id: req.session.userId, exam_id: null, role: 'assistant', content: reply });
    res.json({ reply });
  } catch (err) {
    res.json({ error: `AI error: ${err.message}` });
  }
}));

router.get('/ai/history', ensureAuth, ensureTA, asyncTA(async (req, res) => {
  if (!ChatMessage) return res.json([]);
  const messages = await ChatMessage.findAll({
    where: { user_id: req.session.userId },
    order: [['created_at', 'ASC']],
    limit: 50,
  });
  res.json(messages.map(m => ({ role: m.role, content: m.content, created_at: m.created_at })));
}));

router.post('/ai/clear', ensureAuth, ensureTA, asyncTA(async (req, res) => {
  if (!ChatMessage) return res.json({ ok: true });
  await ChatMessage.destroy({ where: { user_id: req.session.userId } });
  res.json({ ok: true });
}));

module.exports = router;

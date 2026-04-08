const router = require('express').Router();
const { ensureAuth, ensureSubscription, asyncHandler } = require('../middleware/auth');
const { requireInt, requireString, requireEmail } = require('../middleware/validate');
const { Course, CourseTA, User, Exam, Submission, Grade, Rubric, Student, IntegrationConfig } = require('../models');
const { Op, UniqueConstraintError } = require('sequelize');

const PERMISSIONS_BY_ROLE = {
  head_ta: {
    can_grade: true,
    can_view_analytics: true,
    can_manage_roster: true,
    can_post_announcements: true,
    can_access_cribs: true,
    can_manage_docs: true,
  },
  ta: {
    can_grade: true,
    can_view_analytics: false,
    can_manage_roster: false,
    can_post_announcements: false,
    can_access_cribs: false,
    can_manage_docs: false,
  },
};

function getPermissions(ta) {
  const base = PERMISSIONS_BY_ROLE[ta.role] || PERMISSIONS_BY_ROLE.ta;
  try {
    const stored = JSON.parse(ta.assigned_students || '[]');
    if (stored && typeof stored === 'object' && !Array.isArray(stored) && stored.permissions) {
      return { ...base, ...stored.permissions };
    }
  } catch {}
  return { ...base };
}

function getAssignedStudents(ta) {
  try {
    const stored = JSON.parse(ta.assigned_students || '[]');
    if (Array.isArray(stored)) return stored;
    if (stored && stored.students) return stored.students;
  } catch {}
  return [];
}

function encodeStudentsAndPermissions(studentList, permissions) {
  return JSON.stringify({ students: studentList || [], permissions: permissions || {} });
}

router.get('/', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const courses = await Course.findAll({ where: { user_id: req.session.userId }, order: [['name', 'ASC']] });
  const courseId = parseInt(req.query.course_id) || null;

  let tas = [];
  let courseName = '';
  let exams = [];
  let students = [];

  if (courseId) {
    const course = await Course.findOne({ where: { id: courseId, user_id: req.session.userId } });
    if (!course) throw new Error('ACCESS_DENIED');
    courseName = course.name;

    const [taRows, examRows, studentRows] = await Promise.all([
      CourseTA.findAll({
        where: { course_id: courseId },
        include: [{ model: User, attributes: ['full_name', 'email', 'role'] }],
        order: [['created_at', 'DESC']],
      }),
      Exam.findAll({ where: { course_id: courseId }, order: [['created_at', 'DESC']] }),
      Student.findAll({ where: { course_id: courseId }, order: [['name', 'ASC']] }),
    ]);

    tas = taRows.map(ta => {
      const plain = ta.get({ plain: true });
      plain._permissions = getPermissions(ta);
      plain._assignedStudents = getAssignedStudents(ta);
      try { plain._assignedQuestions = JSON.parse(ta.assigned_questions || '[]'); } catch { plain._assignedQuestions = []; }
      return plain;
    });
    exams = examRows;
    students = studentRows;
  }

  res.render('ta-management', { courses, tas, selectedCourseId: courseId, courseName, exams, students });
}));

router.post('/invite', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const courseId = requireInt(req.body.course_id, 'Course');
  const email = requireEmail(req.body.email);
  const role = req.body.ta_role === 'head_ta' ? 'head_ta' : 'ta';

  const course = await Course.findOne({ where: { id: courseId, user_id: req.session.userId } });
  if (!course) throw new Error('ACCESS_DENIED');

  const existing = await CourseTA.findOne({ where: { course_id: courseId, email } });
  if (existing) {
    req.flash('error', 'This person is already invited to this course.');
    return res.redirect(`/ta?course_id=${courseId}`);
  }

  const user = await User.findOne({ where: { email } });
  const defaultPerms = PERMISSIONS_BY_ROLE[role] || PERMISSIONS_BY_ROLE.ta;

  try {
    await CourseTA.create({
      course_id: courseId,
      user_id: user?.id || null,
      email,
      role,
      status: user ? 'active' : 'pending',
      assigned_students: encodeStudentsAndPermissions([], defaultPerms),
    });
  } catch (e) {
    if (e instanceof UniqueConstraintError) {
      req.flash('error', 'This person is already invited to this course.');
      return res.redirect(`/ta?course_id=${courseId}`);
    }
    throw e;
  }

  req.flash('success', `TA invitation sent to ${email}.`);
  res.redirect(`/ta?course_id=${courseId}`);
}));

router.post('/assign/:taId', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const taId = requireInt(req.params.taId, 'TA');
  const ta = await CourseTA.findOne({
    where: { id: taId },
    include: [{ model: Course, where: { user_id: req.session.userId } }],
  });
  if (!ta) throw new Error('ACCESS_DENIED');

  const { assigned_questions, assigned_students, assigned_exam } = req.body;

  if (assigned_questions !== undefined) {
    const qList = (assigned_questions || '').split(',').map(q => q.trim()).filter(Boolean);
    ta.assigned_questions = JSON.stringify(qList);
  }

  if (assigned_students !== undefined || assigned_exam !== undefined) {
    const currentPerms = getPermissions(ta);
    const sList = assigned_students
      ? (assigned_students || '').split(',').map(s => s.trim()).filter(Boolean)
      : getAssignedStudents(ta);
    ta.assigned_students = encodeStudentsAndPermissions(sList, currentPerms);
  }

  await ta.save();
  req.flash('success', 'Assignment updated.');
  res.redirect(`/ta?course_id=${ta.course_id}`);
}));

router.post('/permissions/:taId', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const taId = requireInt(req.params.taId, 'TA');
  const ta = await CourseTA.findOne({
    where: { id: taId },
    include: [{ model: Course, where: { user_id: req.session.userId } }],
  });
  if (!ta) throw new Error('ACCESS_DENIED');

  const permKeys = ['can_grade', 'can_view_analytics', 'can_manage_roster', 'can_post_announcements', 'can_access_cribs', 'can_manage_docs'];
  const newPerms = {};
  permKeys.forEach(k => { newPerms[k] = req.body[k] === 'on' || req.body[k] === 'true' || req.body[k] === true; });

  const currentStudents = getAssignedStudents(ta);
  ta.assigned_students = encodeStudentsAndPermissions(currentStudents, newPerms);
  await ta.save();

  req.flash('success', 'Permissions updated.');
  res.redirect(`/ta?course_id=${ta.course_id}`);
}));

router.post('/remove/:taId', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const taId = requireInt(req.params.taId, 'TA');
  const ta = await CourseTA.findOne({
    where: { id: taId },
    include: [{ model: Course, where: { user_id: req.session.userId } }],
  });
  if (!ta) throw new Error('ACCESS_DENIED');

  const courseId = ta.course_id;
  await ta.destroy();
  req.flash('success', 'TA removed from course.');
  res.redirect(`/ta?course_id=${courseId}`);
}));

router.post('/allot-grading/:taId', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const taId = requireInt(req.params.taId, 'TA');
  const ta = await CourseTA.findOne({
    where: { id: taId },
    include: [{ model: Course, where: { user_id: req.session.userId } }],
  });
  if (!ta) throw new Error('ACCESS_DENIED');

  const examId = requireInt(req.body.exam_id, 'Exam');
  const questionRange = requireString(req.body.question_range, 'Question range');
  const studentCount = parseInt(req.body.student_count) || 0;

  const exam = await Exam.findOne({ where: { id: examId, course_id: ta.course_id } });
  if (!exam) throw new Error('ACCESS_DENIED');

  const rangeMatch = questionRange.match(/^Q?(\d+)\s*-\s*Q?(\d+)$/i);
  let questions = [];
  if (rangeMatch) {
    const start = parseInt(rangeMatch[1]);
    const end = parseInt(rangeMatch[2]);
    for (let i = start; i <= end; i++) questions.push(`Q${i}`);
  } else {
    questions = questionRange.split(',').map(q => q.trim()).filter(Boolean);
  }

  let existingQs = [];
  try { existingQs = JSON.parse(ta.assigned_questions || '[]'); } catch {}
  const merged = [...new Set([...existingQs, ...questions])];
  ta.assigned_questions = JSON.stringify(merged);

  if (studentCount > 0) {
    const allStudents = await Student.findAll({
      where: { course_id: ta.course_id },
      order: [['name', 'ASC']],
      limit: studentCount,
    });
    const currentPerms = getPermissions(ta);
    const existingStudents = getAssignedStudents(ta);
    const newStudentIds = allStudents.map(s => String(s.id));
    const mergedStudents = [...new Set([...existingStudents, ...newStudentIds])];
    ta.assigned_students = encodeStudentsAndPermissions(mergedStudents, currentPerms);
  }

  await ta.save();
  req.flash('success', `Allotted ${questions.length} question(s) from "${exam.name}" to TA.`);
  res.redirect(`/ta?course_id=${ta.course_id}`);
}));

router.get('/performance', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const courses = await Course.findAll({ where: { user_id: req.session.userId } });
  const courseIds = courses.map(c => c.id);
  const tas = await CourseTA.findAll({
    where: { course_id: { [Op.in]: courseIds } },
    include: [
      { model: User, attributes: ['full_name', 'email'] },
      { model: Course, attributes: ['name', 'code'] },
    ],
    order: [['submissions_graded', 'DESC']],
  });

  res.render('ta-performance', { tas, courses });
}));

module.exports = router;

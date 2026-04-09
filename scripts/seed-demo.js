require('dotenv').config();

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Op } = require('sequelize');
const {
  sequelize,
  User,
  Subscription,
  Course,
  Exam,
  Student,
  Rubric,
  Submission,
  Grade,
  GradeBoundary,
  CourseDocument,
  LivePoll,
  PollResponse,
  ClassSession,
  ActiveFeedback,
  DiscussionThread,
  DiscussionPost,
  Announcement,
} = require('../models');

const DEMO_EMAIL = (process.env.DEMO_ACCOUNT_EMAIL || 'demo.prof@intelligrade.local').toLowerCase();
const DEMO_PASSWORD = process.env.DEMO_ACCOUNT_PASSWORD || 'Demo@12345';
const STUDENTS_PER_COURSE = Math.max(12, parseInt(process.env.DEMO_STUDENTS_PER_COURSE || '36', 10));

const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || './data/uploads');
const DOC_DIR = path.join(UPLOAD_DIR, 'demo-docs');
const SUBMISSION_DIR = path.join(UPLOAD_DIR, 'demo-submissions');

const COURSE_BLUEPRINTS = [
  {
    code: 'DEMO-CS501',
    name: 'Algorithm Engineering',
    semester: 'Spring 2026',
    section: 'A',
    department: 'Computer Science',
    description: 'Design and analysis of scalable algorithms with practical optimization strategies.',
    objectives: 'Master complexity analysis, graph optimization, approximation, and advanced dynamic programming.',
    topics: ['Dynamic Programming', 'Greedy Proofs', 'Network Flow', 'Approximation Algorithms'],
  },
  {
    code: 'DEMO-CS540',
    name: 'Machine Learning Systems',
    semester: 'Spring 2026',
    section: 'A',
    department: 'Computer Science',
    description: 'End-to-end ML systems covering model design, evaluation, deployment, and monitoring.',
    objectives: 'Build robust ML pipelines, evaluate models rigorously, and reason about tradeoffs.',
    topics: ['Bias-Variance Tradeoff', 'Regularization', 'Model Calibration', 'Feature Drift'],
  },
  {
    code: 'DEMO-DS520',
    name: 'Data Systems and Warehousing',
    semester: 'Spring 2026',
    section: 'B',
    department: 'Data Science',
    description: 'Relational and analytical data systems for large-scale education analytics workloads.',
    objectives: 'Design schemas, optimize queries, and build reporting-grade data pipelines.',
    topics: ['Normalization', 'Indexing Strategy', 'OLAP Cubes', 'Query Optimization'],
  },
  {
    code: 'DEMO-SE530',
    name: 'Software Reliability Engineering',
    semester: 'Spring 2026',
    section: 'B',
    department: 'Software Engineering',
    description: 'Reliability, observability, testing methodology, and incident response fundamentals.',
    objectives: 'Engineer resilient systems with measurable SLIs/SLOs and robust testing practices.',
    topics: ['Failure Modes', 'Test Pyramid', 'SLO Error Budgets', 'Root Cause Analysis'],
  },
];

const EXAM_BLUEPRINTS = [
  { name: 'Midterm Assessment', type: 'midterm', releasedDaysAgo: 24 },
  { name: 'Final Assessment', type: 'final', releasedDaysAgo: 8 },
  { name: 'Weekly Quiz', type: 'quiz', releasedDaysAgo: 2 },
];

const FIRST_NAMES = [
  'Aarav', 'Priya', 'Rohan', 'Sneha', 'Vikram', 'Ananya', 'Karan', 'Divya', 'Arjun', 'Meera',
  'Siddharth', 'Pooja', 'Ravi', 'Nisha', 'Aditya', 'Ishita', 'Rahul', 'Kavya', 'Deepak', 'Shruti',
  'Neel', 'Tanvi', 'Aryan', 'Ritika', 'Manav', 'Aditi', 'Nitin', 'Manya', 'Kabir', 'Sonal',
];

const LAST_NAMES = [
  'Sharma', 'Patel', 'Gupta', 'Reddy', 'Singh', 'Iyer', 'Mehta', 'Nair', 'Kumar', 'Joshi',
  'Rao', 'Verma', 'Teja', 'Banerjee', 'Mishra', 'Krishnan', 'Yadav', 'Agrawal', 'Chopra', 'Das',
  'Bhat', 'Kapoor', 'Jain', 'Sen', 'Pandey', 'Menon', 'Saxena', 'Tripathi', 'Malhotra', 'Sethi',
];

function hashInt(input) {
  let h = 2166136261;
  const str = String(input);
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function ratio(seed) {
  return (hashInt(seed) % 10000) / 10000;
}

function between(seed, min, max) {
  return min + (max - min) * ratio(seed);
}

function pick(arr, seed) {
  return arr[hashInt(seed) % arr.length];
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function daysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

function safeParse(text, fallback = []) {
  try {
    const parsed = JSON.parse(text || '[]');
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function ensureDummyPdf(filePath, message) {
  if (fs.existsSync(filePath)) return;
  ensureDir(path.dirname(filePath));
  const body = String(message || 'Demo submission').replace(/[^\x20-\x7E\n]/g, ' ');
  const content = `%PDF-1.1\n1 0 obj\n<< /Type /Catalog >>\nendobj\n2 0 obj\n<< /Length ${body.length} >>\nstream\n${body}\nendstream\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n`;
  fs.writeFileSync(filePath, content, 'utf8');
}

function rubricForTopic(topic, idx) {
  const questionNo = `Q${idx + 1}`;
  const maxMarks = idx < 2 ? 12 : 13;
  const keyPoints = [
    { point: `Correctly defines core concept of ${topic}`, marks: 3 },
    { point: `Provides a valid method or derivation for ${topic}`, marks: 4 },
    { point: `Applies ${topic} to a realistic scenario with justification`, marks: 3 },
    { point: `Discusses tradeoffs, assumptions, or edge cases`, marks: 2 + (idx % 2) },
  ];
  return {
    questionNo,
    maxMarks,
    questionText: `Explain and apply ${topic}. Include concise reasoning and at least one formal expression where appropriate, such as complexity bounds $O(n \\log n)$ or metric equations.`,
    keyPoints,
  };
}

async function ensureLegacySchemaCompatibility() {
  const queryInterface = sequelize.getQueryInterface();
  const models = Object.values(sequelize.models);

  for (const model of models) {
    const tableName = model.getTableName();
    let tableInfo;

    try {
      tableInfo = await queryInterface.describeTable(tableName);
    } catch {
      continue;
    }

    const existingColumns = new Set(Object.keys(tableInfo).map(c => c.toLowerCase()));
    for (const attr of Object.values(model.rawAttributes)) {
      const columnName = attr.field || attr.fieldName;
      if (!columnName || existingColumns.has(String(columnName).toLowerCase())) continue;

      await queryInterface.addColumn(tableName, columnName, {
        type: attr.type,
        allowNull: true,
      });
      existingColumns.add(String(columnName).toLowerCase());
    }
  }
}

async function getUniqueRoomCode() {
  for (let i = 0; i < 30; i++) {
    const code = crypto.randomBytes(3).toString('hex').toUpperCase();
    const exists = await LivePoll.findOne({ where: { room_code: code } });
    if (!exists) return code;
  }
  throw new Error('Could not generate unique room code');
}

async function ensureDemoProfessor() {
  const [user] = await User.findOrCreate({
    where: { email: DEMO_EMAIL },
    defaults: {
      full_name: 'Demo Professor',
      email: DEMO_EMAIL,
      password_hash: User.hashPassword(DEMO_PASSWORD),
      role: 'professor',
      department: 'Computer Science',
      is_active: true,
      email_verified: true,
      phone_verified: true,
      papers_graded_total: 0,
    },
  });

  let changed = false;
  if (user.full_name !== 'Demo Professor') { user.full_name = 'Demo Professor'; changed = true; }
  if (!user.department) { user.department = 'Computer Science'; changed = true; }
  if (!user.is_active) { user.is_active = true; changed = true; }
  if (!user.email_verified) { user.email_verified = true; changed = true; }
  if (!user.phone_verified) { user.phone_verified = true; changed = true; }
  if (!user.checkPassword(DEMO_PASSWORD)) {
    user.password_hash = User.hashPassword(DEMO_PASSWORD);
    changed = true;
  }
  if (changed) await user.save();

  const now = new Date();
  let sub = await Subscription.findOne({
    where: {
      user_id: user.id,
      scope: 'individual',
      status: 'active',
      end_date: { [Op.gt]: now },
    },
    order: [['end_date', 'DESC']],
  });

  if (!sub) {
    const end = new Date(now);
    end.setDate(end.getDate() + 365);
    sub = await Subscription.create({
      user_id: user.id,
      plan: 'monthly',
      scope: 'individual',
      start_date: now,
      end_date: end,
      status: 'active',
      amount: 0,
    });
  }

  return user;
}

async function ensureCourseForDemo(user, blueprint) {
  let course = await Course.findOne({ where: { user_id: user.id, code: blueprint.code } });
  if (!course) {
    course = await Course.create({
      user_id: user.id,
      name: blueprint.name,
      code: blueprint.code,
      semester: blueprint.semester,
      section: blueprint.section,
      description: blueprint.description,
      objectives: blueprint.objectives,
      syllabus: `Topics: ${blueprint.topics.join(', ')}. Weekly labs and applied assignments included.`,
      department: blueprint.department,
      review_threshold: 0.6,
      crib_window_hours: 72,
    });
  }
  return course;
}

async function ensureStudents(course, courseIndex) {
  const students = [];
  const codeSlug = slugify(course.code);

  for (let i = 1; i <= STUDENTS_PER_COURSE; i++) {
    const first = FIRST_NAMES[(courseIndex * 11 + i) % FIRST_NAMES.length];
    const last = LAST_NAMES[(courseIndex * 13 + i) % LAST_NAMES.length];
    const name = `${first} ${last}`;
    const roll = `${codeSlug.toUpperCase().slice(-6)}-${String(i).padStart(3, '0')}`;
    const email = `demo.${codeSlug}.${String(i).padStart(3, '0')}@intelligrade.local`;

    const [student] = await Student.findOrCreate({
      where: { course_id: course.id, roll_number: roll },
      defaults: {
        course_id: course.id,
        name,
        roll_number: roll,
        email,
      },
    });

    let changed = false;
    if (student.name !== name) { student.name = name; changed = true; }
    if (student.email !== email) { student.email = email; changed = true; }
    if (changed) await student.save();

    students.push(student);
  }

  return students;
}

async function ensureExam(course, blueprint, topics) {
  let exam = await Exam.findOne({ where: { course_id: course.id, name: blueprint.name } });
  const rubrics = topics.map((topic, idx) => rubricForTopic(topic, idx));
  const totalMarks = rubrics.reduce((sum, r) => sum + r.maxMarks, 0);

  if (!exam) {
    exam = await Exam.create({
      course_id: course.id,
      name: blueprint.name,
      exam_type: blueprint.type,
      total_marks: totalMarks,
      instructions: `Answer all questions. Use concise, clear reasoning and include equations where needed.`,
      grades_released: true,
      grades_released_at: daysAgo(blueprint.releasedDaysAgo),
    });
  }

  const rubricRows = [];
  for (const r of rubrics) {
    const [rubric] = await Rubric.findOrCreate({
      where: { exam_id: exam.id, question_no: r.questionNo },
      defaults: {
        exam_id: exam.id,
        question_no: r.questionNo,
        question_order: parseInt(r.questionNo.replace('Q', ''), 10),
        question_text: r.questionText,
        max_marks: r.maxMarks,
        key_points: JSON.stringify(r.keyPoints),
        grading_notes: 'Award partial credit for valid reasoning and penalize factual errors.',
      },
    });

    let changed = false;
    if (rubric.question_text !== r.questionText) { rubric.question_text = r.questionText; changed = true; }
    if (Number(rubric.max_marks) !== r.maxMarks) { rubric.max_marks = r.maxMarks; changed = true; }
    const kp = JSON.stringify(r.keyPoints);
    if (rubric.key_points !== kp) { rubric.key_points = kp; changed = true; }
    if (!rubric.grading_notes) { rubric.grading_notes = 'Award partial credit for valid reasoning and penalize factual errors.'; changed = true; }
    if (changed) await rubric.save();

    rubricRows.push(rubric);
  }

  const existingBoundaries = await GradeBoundary.count({ where: { exam_id: exam.id } });
  if (!existingBoundaries) {
    await GradeBoundary.bulkCreate([
      { exam_id: exam.id, label: 'A+', min_pct: 90, max_pct: 100, color: '#1a7d3f' },
      { exam_id: exam.id, label: 'A', min_pct: 80, max_pct: 89.99, color: '#2d8f4e' },
      { exam_id: exam.id, label: 'B', min_pct: 65, max_pct: 79.99, color: '#4f7fcf' },
      { exam_id: exam.id, label: 'C', min_pct: 50, max_pct: 64.99, color: '#b08600' },
      { exam_id: exam.id, label: 'D', min_pct: 40, max_pct: 49.99, color: '#d4760a' },
      { exam_id: exam.id, label: 'F', min_pct: 0, max_pct: 39.99, color: '#ba1a1a' },
    ]);
  }

  return { exam, rubricRows };
}

async function ensureSubmissionsAndGrades(course, exam, rubrics, students) {
  let createdSubmissions = 0;
  let createdGrades = 0;

  for (const student of students) {
    const fileName = `${student.roll_number}_${slugify(exam.name)}.pdf`;
    const filePath = path.join(SUBMISSION_DIR, slugify(course.code), slugify(exam.name), fileName);
    ensureDummyPdf(filePath, `Demo answer sheet for ${student.name} (${student.roll_number}) - ${exam.name}`);

    const [submission, subCreated] = await Submission.findOrCreate({
      where: { exam_id: exam.id, student_id: student.id },
      defaults: {
        exam_id: exam.id,
        student_id: student.id,
        file_name: fileName,
        file_path: filePath,
        status: 'done',
        page_count: 4,
      },
    });

    if (subCreated) createdSubmissions += 1;

    let submissionChanged = false;
    if (submission.file_name !== fileName) { submission.file_name = fileName; submissionChanged = true; }
    if (submission.file_path !== filePath) { submission.file_path = filePath; submissionChanged = true; }
    if (submission.status !== 'done') { submission.status = 'done'; submissionChanged = true; }
    if (!submission.page_count) { submission.page_count = 4; submissionChanged = true; }
    if (submissionChanged) await submission.save();

    for (const rubric of rubrics) {
      const kp = safeParse(rubric.key_points, []);
      const scorePct = between(`${submission.id}:${rubric.id}:score`, 0.38, 0.97);
      const awarded = Math.round(rubric.max_marks * scorePct * 100) / 100;
      const confidence = Math.round(between(`${submission.id}:${rubric.id}:confidence`, 0.48, 0.96) * 100) / 100;
      const matchCount = Math.max(1, Math.min(kp.length, Math.round(between(`${submission.id}:${rubric.id}:match`, 1, kp.length || 1))));
      const matched = kp.slice(0, matchCount).map(p => p.point);
      const missing = kp.slice(matchCount).map(p => p.point);

      const [grade, gradeCreated] = await Grade.findOrCreate({
        where: { submission_id: submission.id, rubric_id: rubric.id },
        defaults: { question_no: rubric.question_no },
      });
      if (gradeCreated) createdGrades += 1;

      grade.question_no = rubric.question_no;
      grade.detected_pages = '1,2,3';
      grade.ocr_text = `[Demo OCR] ${student.name} addresses ${rubric.question_no} with structured points and examples.`;
      grade.awarded_marks = awarded;
      grade.feedback = awarded >= rubric.max_marks * 0.75
        ? 'Strong answer with sound reasoning and mostly complete coverage of key points.'
        : awarded >= rubric.max_marks * 0.5
          ? 'Reasonable attempt. Main ideas are present but some explanations lack depth.'
          : 'Partial understanding shown. Several key points are missing or not justified sufficiently.';
      grade.matched_points = JSON.stringify(matched);
      grade.missing_points = JSON.stringify(missing);
      grade.confidence = confidence;
      grade.review_status = confidence < 0.58 ? 'flagged' : 'auto';
      await grade.save();
    }
  }

  return { createdSubmissions, createdGrades };
}

async function ensureCourseDocuments(course, user, topics) {
  ensureDir(DOC_DIR);
  const docs = [
    {
      title: `${course.code} - Lecture Compendium`,
      doc_type: 'slides',
      file_name: `${slugify(course.code)}_lectures.pdf`,
      text: `Core topics: ${topics.join(', ')}. Includes worked examples, complexity notes, and summary tables.`,
    },
    {
      title: `${course.code} - Solved Practice Set`,
      doc_type: 'notes',
      file_name: `${slugify(course.code)}_practice.pdf`,
      text: `Practice problems with rubric-style solutions, edge-case analysis, and grading hints for ${course.name}.`,
    },
    {
      title: `${course.code} - Past Year Review`,
      doc_type: 'past_paper',
      file_name: `${slugify(course.code)}_past_review.pdf`,
      text: `Past year pattern analysis. Frequent concepts: ${topics.slice(0, 3).join(', ')}. Contains marking strategy notes.`,
    },
  ];

  for (const doc of docs) {
    const filePath = path.join(DOC_DIR, doc.file_name);
    if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, doc.text, 'utf8');

    const existing = await CourseDocument.findOne({ where: { course_id: course.id, title: doc.title } });
    if (!existing) {
      await CourseDocument.create({
        course_id: course.id,
        user_id: user.id,
        title: doc.title,
        doc_type: doc.doc_type,
        file_path: filePath,
        file_name: doc.file_name,
        extracted_text: doc.text,
        page_count: 20,
        concept_tags: JSON.stringify(topics.slice(0, 4)),
      });
    }
  }
}

async function ensurePolls(course, user, students, topics) {
  const pollDefs = [
    {
      question: `Which topic in ${course.code} needs more examples?`,
      poll_type: 'mcq',
      options: topics.slice(0, 4),
    },
    {
      question: `How confident are you with this week's ${course.code} material?`,
      poll_type: 'confidence',
      options: ['1 - Low', '2 - Fair', '3 - Moderate', '4 - Good', '5 - High'],
    },
  ];

  for (const def of pollDefs) {
    let poll = await LivePoll.findOne({ where: { course_id: course.id, question: def.question } });
    if (!poll) {
      poll = await LivePoll.create({
        course_id: course.id,
        user_id: user.id,
        room_code: await getUniqueRoomCode(),
        question: def.question,
        poll_type: def.poll_type,
        options: JSON.stringify(def.options),
        is_active: false,
        closed_at: daysAgo(3),
      });
    }

    const existingResponses = await PollResponse.count({ where: { poll_id: poll.id } });
    if (existingResponses > 0) continue;

    const limit = Math.min(24, students.length);
    for (let i = 0; i < limit; i++) {
      const s = students[i];
      const response = pick(def.options, `${course.id}:${poll.id}:${s.id}`);
      await PollResponse.create({
        poll_id: poll.id,
        student_id: s.id,
        response,
        response_name: s.name,
      });
    }
  }
}

async function ensureSessions(course, user, students, topics) {
  for (let week = 1; week <= 10; week++) {
    const topic = topics[(week - 1) % topics.length];
    const sessionDate = daysAgo(77 - week * 7);
    const dateOnly = sessionDate.toISOString().split('T')[0];
    const title = `Week ${week} - ${topic}`;

    let session = await ClassSession.findOne({
      where: { course_id: course.id, title, session_date: dateOnly },
    });

    if (!session) {
      session = await ClassSession.create({
        course_id: course.id,
        user_id: user.id,
        title,
        session_date: dateOnly,
        start_time: '10:00',
        end_time: '11:30',
        concepts_planned: JSON.stringify([topic]),
        concepts_covered: JSON.stringify([topic]),
        resources_used: JSON.stringify(['Slides', 'Board Work', 'Live Poll']),
        polls_conducted: JSON.stringify([]),
        professor_notes: `Session covered ${topic}. Follow-up worksheet shared for practice.`,
        status: week <= 8 ? 'completed' : week === 9 ? 'in_progress' : 'planned',
      });
    }

    const existingFeedback = await ActiveFeedback.count({ where: { session_id: session.id } });
    if (existingFeedback > 0) continue;

    const sample = Math.min(14, students.length);
    for (let i = 0; i < sample; i++) {
      const student = students[i];
      const feedbackType = pick(['understanding', 'confusion', 'question', 'pace'], `${session.id}:${student.id}:type`);
      const content = pick([
        `Could we get one more worked example for ${topic}?`,
        `The session pace felt balanced and clear.`,
        `I am still unsure about one edge case in ${topic}.`,
        `The poll helped reinforce the concept well.`,
        null,
      ], `${session.id}:${student.id}:content`);

      await ActiveFeedback.create({
        session_id: session.id,
        course_id: course.id,
        student_id: student.id,
        feedback_type: feedbackType,
        content,
        rating: Math.max(1, Math.min(5, Math.round(between(`${session.id}:${student.id}:rating`, 2, 5)))),
        is_anonymous: true,
      });
    }
  }
}

async function ensureDiscussions(course, user) {
  const threadDefs = [
    {
      title: `${course.code} - General Q&A`,
      content: 'Use this thread for general conceptual questions and clarifications.',
      thread_type: 'announcement',
      posts: [
        'Welcome to the course discussion board. Ask questions any time.',
        'Please include your reasoning attempt before asking for a full solution.',
      ],
    },
    {
      title: `${course.code} - Exam Strategy`,
      content: 'Share preparation strategy and common pitfalls for upcoming assessments.',
      thread_type: 'question',
      posts: [
        'What is the best strategy for partial-credit style questions?',
        'Focus on structure: define assumptions, show steps, then conclude clearly.',
      ],
    },
  ];

  for (const def of threadDefs) {
    let thread = await DiscussionThread.findOne({ where: { course_id: course.id, title: def.title } });
    if (!thread) {
      thread = await DiscussionThread.create({
        course_id: course.id,
        user_id: user.id,
        title: def.title,
        content: def.content,
        thread_type: def.thread_type,
        is_pinned: def.thread_type === 'announcement',
      });
    }

    const postCount = await DiscussionPost.count({ where: { thread_id: thread.id } });
    if (postCount > 0) continue;

    for (let i = 0; i < def.posts.length; i++) {
      await DiscussionPost.create({
        thread_id: thread.id,
        user_id: user.id,
        content: def.posts[i],
        is_answer: i === 1,
      });
    }
  }
}

async function ensureAnnouncements(course, user) {
  const announcements = [
    {
      title: `Welcome to ${course.code}`,
      content: `Welcome to ${course.name}. Please review the shared lecture compendium and weekly schedule.`,
      type: 'general',
      days: 18,
    },
    {
      title: `${course.code} Midterm Feedback Window Open`,
      content: 'Midterm grading is published. Regrade requests can be submitted within 72 hours.',
      type: 'grade_release',
      days: 6,
    },
  ];

  for (const item of announcements) {
    const existing = await Announcement.findOne({ where: { course_id: course.id, title: item.title } });
    if (!existing) {
      await Announcement.create({
        course_id: course.id,
        user_id: user.id,
        title: item.title,
        content: item.content,
        type: item.type,
        published_at: daysAgo(item.days),
      });
    }
  }
}

async function seedDemoData() {
  ensureDir(DOC_DIR);
  ensureDir(SUBMISSION_DIR);

  await ensureLegacySchemaCompatibility();
  await sequelize.sync({ alter: false });

  const user = await ensureDemoProfessor();

  const stats = {
    courses: 0,
    exams: 0,
    students: 0,
    submissionsCreated: 0,
    gradesCreated: 0,
  };

  for (let ci = 0; ci < COURSE_BLUEPRINTS.length; ci++) {
    const bp = COURSE_BLUEPRINTS[ci];
    const course = await ensureCourseForDemo(user, bp);
    stats.courses += 1;

    const students = await ensureStudents(course, ci);
    stats.students += students.length;

    for (const examBp of EXAM_BLUEPRINTS) {
      const { exam, rubricRows } = await ensureExam(course, examBp, bp.topics);
      stats.exams += 1;

      const result = await ensureSubmissionsAndGrades(course, exam, rubricRows, students);
      stats.submissionsCreated += result.createdSubmissions;
      stats.gradesCreated += result.createdGrades;
    }

    await ensureCourseDocuments(course, user, bp.topics);
    await ensurePolls(course, user, students, bp.topics);
    await ensureSessions(course, user, students, bp.topics);
    await ensureDiscussions(course, user);
    await ensureAnnouncements(course, user);
  }

  const courseIds = (await Course.findAll({ where: { user_id: user.id }, attributes: ['id'] })).map(c => c.id);
  const examIds = (await Exam.findAll({ where: { course_id: { [Op.in]: courseIds } }, attributes: ['id'] })).map(e => e.id);
  const submissionCount = await Submission.count({ where: { exam_id: { [Op.in]: examIds } } });

  user.papers_graded_total = submissionCount;
  await user.save();

  const totals = {
    courses: courseIds.length,
    exams: examIds.length,
    students: await Student.count({ where: { course_id: { [Op.in]: courseIds } } }),
    submissions: submissionCount,
    grades: await Grade.count({ include: [{ model: Submission, required: true, where: { exam_id: { [Op.in]: examIds } } }] }),
    documents: await CourseDocument.count({ where: { course_id: { [Op.in]: courseIds } } }),
    polls: await LivePoll.count({ where: { course_id: { [Op.in]: courseIds } } }),
    sessions: await ClassSession.count({ where: { course_id: { [Op.in]: courseIds } } }),
    discussions: await DiscussionThread.count({ where: { course_id: { [Op.in]: courseIds } } }),
  };

  console.log('\n===========================================================');
  console.log('  DEMO DATA READY (idempotent seed)');
  console.log('===========================================================');
  console.log(`  Courses: ${totals.courses}`);
  console.log(`  Exams: ${totals.exams}`);
  console.log(`  Students: ${totals.students}`);
  console.log(`  Submissions: ${totals.submissions}`);
  console.log(`  Grades: ${totals.grades}`);
  console.log(`  Documents: ${totals.documents}`);
  console.log(`  Polls: ${totals.polls}`);
  console.log(`  Sessions: ${totals.sessions}`);
  console.log(`  Discussion Threads: ${totals.discussions}`);
  console.log('');
  console.log('  Demo account credentials:');
  console.log(`    Email:    ${DEMO_EMAIL}`);
  console.log(`    Password: ${DEMO_PASSWORD}`);
  console.log('===========================================================\n');
}

seedDemoData()
  .then(async () => {
    await sequelize.close();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('Demo seed failed:', err);
    try { await sequelize.close(); } catch {}
    process.exit(1);
  });

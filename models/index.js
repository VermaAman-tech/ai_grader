const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const bcrypt = require('bcryptjs');

// ── College (also used for schools) ──
const College = sequelize.define('College', {
  name:   { type: DataTypes.STRING(200), allowNull: false },
  domain: { type: DataTypes.STRING(200), allowNull: false, unique: true },
  address:{ type: DataTypes.STRING(500) },
  phone:  { type: DataTypes.STRING(50) },
  type:   { type: DataTypes.STRING(20), defaultValue: 'college' },
});

// ── User ──
const User = sequelize.define('User', {
  college_id:    { type: DataTypes.INTEGER, references: { model: College, key: 'id' } },
  full_name:     { type: DataTypes.STRING(200), allowNull: false },
  email:         { type: DataTypes.STRING(200), allowNull: false, unique: true },
  phone:         { type: DataTypes.STRING(20) },
  password_hash: { type: DataTypes.STRING(256), allowNull: false },
  role:          { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'professor' },
  department:    { type: DataTypes.STRING(200) },
  is_active:     { type: DataTypes.BOOLEAN, defaultValue: true },
  email_verified:{ type: DataTypes.BOOLEAN, defaultValue: false },
  phone_verified:{ type: DataTypes.BOOLEAN, defaultValue: false },
  papers_graded_total: { type: DataTypes.INTEGER, defaultValue: 0 },
}, {
  indexes: [
    { fields: ['email'], unique: true },
    { fields: ['college_id'] },
    { fields: ['role'] },
  ],
});

User.prototype.checkPassword = function (pw) {
  return bcrypt.compareSync(pw, this.password_hash);
};
User.hashPassword = function (pw) {
  return bcrypt.hashSync(pw, 10);
};

// ── Subscription ──
const Subscription = sequelize.define('Subscription', {
  user_id:    { type: DataTypes.INTEGER, references: { model: User, key: 'id' } },
  college_id: { type: DataTypes.INTEGER, references: { model: College, key: 'id' } },
  plan:       { type: DataTypes.STRING(30), allowNull: false },
  scope:      { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'individual' },
  start_date: { type: DataTypes.DATE, allowNull: false },
  end_date:   { type: DataTypes.DATE, allowNull: false },
  status:     { type: DataTypes.STRING(20), defaultValue: 'active' },
  amount:     { type: DataTypes.FLOAT, defaultValue: 0 },
}, {
  indexes: [
    { fields: ['user_id', 'status'] },
    { fields: ['college_id', 'status'] },
    { fields: ['end_date'] },
  ],
});

// ── Course ──
const Course = sequelize.define('Course', {
  user_id:     { type: DataTypes.INTEGER, allowNull: false, references: { model: User, key: 'id' } },
  name:        { type: DataTypes.STRING(200), allowNull: false },
  code:        { type: DataTypes.STRING(50), allowNull: false },
  semester:    { type: DataTypes.STRING(100) },
  section:     { type: DataTypes.STRING(50) },
  description: { type: DataTypes.TEXT },
  objectives:  { type: DataTypes.TEXT },
  syllabus:    { type: DataTypes.TEXT },
  credits:     { type: DataTypes.INTEGER },
  department:  { type: DataTypes.STRING(200) },
  review_threshold: { type: DataTypes.FLOAT, defaultValue: 0.6 },
  crib_window_hours: { type: DataTypes.INTEGER, defaultValue: 48 },
}, {
  indexes: [{ fields: ['user_id'] }],
});

// ── Exam ──
const Exam = sequelize.define('Exam', {
  course_id:   { type: DataTypes.INTEGER, allowNull: false, references: { model: Course, key: 'id' } },
  name:        { type: DataTypes.STRING(200), allowNull: false },
  exam_type:   { type: DataTypes.STRING(50), defaultValue: 'exam' },
  total_marks: { type: DataTypes.FLOAT, defaultValue: 100 },
  instructions:{ type: DataTypes.TEXT },
  grades_released: { type: DataTypes.BOOLEAN, defaultValue: false },
  grades_released_at: { type: DataTypes.DATE },
}, {
  indexes: [{ fields: ['course_id'] }],
});

// ── Student ──
const Student = sequelize.define('Student', {
  course_id:   { type: DataTypes.INTEGER, allowNull: false, references: { model: Course, key: 'id' } },
  user_id:     { type: DataTypes.INTEGER, references: { model: User, key: 'id' } },
  name:        { type: DataTypes.STRING(200), allowNull: false },
  roll_number: { type: DataTypes.STRING(100) },
  email:       { type: DataTypes.STRING(200) },
}, {
  indexes: [
    { fields: ['course_id'] },
    { fields: ['course_id', 'roll_number'], unique: true, name: 'students_course_roll_unique' },
    { fields: ['user_id'] },
    { fields: ['email'] },
  ],
});

// ── Rubric ──
const Rubric = sequelize.define('Rubric', {
  exam_id:        { type: DataTypes.INTEGER, allowNull: false, references: { model: Exam, key: 'id' } },
  question_no:    { type: DataTypes.STRING(50), allowNull: false },
  question_order: { type: DataTypes.INTEGER, defaultValue: 1 },
  question_text:  { type: DataTypes.TEXT, allowNull: false },
  max_marks:      { type: DataTypes.FLOAT, allowNull: false },
  key_points:     { type: DataTypes.TEXT, defaultValue: '[]' },
  grading_notes:  { type: DataTypes.TEXT },
}, {
  indexes: [
    { fields: ['exam_id'] },
    { fields: ['exam_id', 'question_order'] },
  ],
});

// ── Submission ──
const Submission = sequelize.define('Submission', {
  exam_id:       { type: DataTypes.INTEGER, allowNull: false, references: { model: Exam, key: 'id' } },
  student_id:    { type: DataTypes.INTEGER, allowNull: false, references: { model: Student, key: 'id' } },
  file_name:     { type: DataTypes.STRING(300), allowNull: false },
  file_path:     { type: DataTypes.STRING(500), allowNull: false },
  status:        { type: DataTypes.STRING(20), defaultValue: 'pending' },
  error_message: { type: DataTypes.TEXT },
  page_count:    { type: DataTypes.INTEGER, defaultValue: 0 },
}, {
  indexes: [
    { fields: ['exam_id'] },
    { fields: ['student_id'] },
    { fields: ['exam_id', 'status'] },
    { unique: true, fields: ['exam_id', 'student_id'] },
  ],
});

// ── Grade ──
const Grade = sequelize.define('Grade', {
  submission_id:  { type: DataTypes.INTEGER, allowNull: false, references: { model: Submission, key: 'id' } },
  rubric_id:      { type: DataTypes.INTEGER, allowNull: false, references: { model: Rubric, key: 'id' } },
  question_no:    { type: DataTypes.STRING(50), allowNull: false },
  detected_pages: { type: DataTypes.STRING(200) },
  ocr_text:       { type: DataTypes.TEXT, defaultValue: '' },
  awarded_marks:  { type: DataTypes.FLOAT, defaultValue: 0 },
  feedback:       { type: DataTypes.TEXT, defaultValue: '' },
  matched_points: { type: DataTypes.TEXT, defaultValue: '[]' },
  missing_points: { type: DataTypes.TEXT, defaultValue: '[]' },
  confidence:     { type: DataTypes.FLOAT, defaultValue: 0 },
  raw_response:   { type: DataTypes.TEXT },
  override_marks: { type: DataTypes.FLOAT },
  override_note:  { type: DataTypes.TEXT },
  modified_by_session: { type: DataTypes.STRING(100) },
  review_status:  { type: DataTypes.STRING(20), defaultValue: 'auto' },
}, {
  indexes: [
    { fields: ['submission_id'] },
    { fields: ['rubric_id'] },
    { fields: ['submission_id', 'rubric_id'], unique: true },
    { fields: ['review_status'] },
  ],
});

// ── ChatMessage ──
const ChatMessage = sequelize.define('ChatMessage', {
  user_id:  { type: DataTypes.INTEGER, allowNull: false, references: { model: User, key: 'id' } },
  exam_id:  { type: DataTypes.INTEGER },
  role:     { type: DataTypes.STRING(20), allowNull: false },
  content:  { type: DataTypes.TEXT, allowNull: false },
}, {
  indexes: [
    { fields: ['user_id', 'exam_id'] },
    { fields: ['user_id', 'created_at'] },
  ],
});

// ── GradeBoundary ──
const GradeBoundary = sequelize.define('GradeBoundary', {
  exam_id:    { type: DataTypes.INTEGER, allowNull: false, references: { model: Exam, key: 'id' } },
  label:      { type: DataTypes.STRING(20), allowNull: false },
  min_pct:    { type: DataTypes.FLOAT, allowNull: false },
  max_pct:    { type: DataTypes.FLOAT, allowNull: false },
  color:      { type: DataTypes.STRING(20), defaultValue: '#666' },
}, {
  indexes: [{ fields: ['exam_id'] }],
});

// ── EmailLog ──
const EmailLog = sequelize.define('EmailLog', {
  user_id:    { type: DataTypes.INTEGER, allowNull: false, references: { model: User, key: 'id' } },
  student_id: { type: DataTypes.INTEGER, references: { model: Student, key: 'id' } },
  exam_id:    { type: DataTypes.INTEGER, references: { model: Exam, key: 'id' } },
  subject:    { type: DataTypes.STRING(500) },
  status:     { type: DataTypes.STRING(20), defaultValue: 'sent' },
}, {
  indexes: [{ fields: ['exam_id'] }, { fields: ['student_id'] }],
});

// ── ConceptNode (knowledge graph) ──
const ConceptNode = sequelize.define('ConceptNode', {
  course_id:    { type: DataTypes.INTEGER, allowNull: false, references: { model: Course, key: 'id' } },
  name:         { type: DataTypes.STRING(200), allowNull: false },
  category:     { type: DataTypes.STRING(100) },
}, {
  indexes: [{ fields: ['course_id'] }],
});

// ── QuestionConcept ──
const QuestionConcept = sequelize.define('QuestionConcept', {
  rubric_id:    { type: DataTypes.INTEGER, allowNull: false, references: { model: Rubric, key: 'id' } },
  concept_id:   { type: DataTypes.INTEGER, allowNull: false, references: { model: ConceptNode, key: 'id' } },
}, {
  indexes: [{ fields: ['rubric_id'] }, { fields: ['concept_id'] }],
});

// ── ActiveSession ──
const ActiveSession = sequelize.define('ActiveSession', {
  user_id:        { type: DataTypes.INTEGER, allowNull: false, references: { model: User, key: 'id' } },
  session_token:  { type: DataTypes.STRING(100), allowNull: false },
  exam_id:        { type: DataTypes.INTEGER },
  last_active_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
}, {
  indexes: [
    { fields: ['user_id'] },
    { fields: ['exam_id', 'last_active_at'] },
  ],
});

// ═══════════════════════════════════════════
// NEW MODELS — features2.md
// ═══════════════════════════════════════════

// ── OverrideLog (RLHF data collection — 3.2.2) ──
const OverrideLog = sequelize.define('OverrideLog', {
  grade_id:         { type: DataTypes.INTEGER, allowNull: false, references: { model: Grade, key: 'id' } },
  user_id:          { type: DataTypes.INTEGER, allowNull: false, references: { model: User, key: 'id' } },
  ocr_text:         { type: DataTypes.TEXT },
  rubric_text:      { type: DataTypes.TEXT },
  ai_grade:         { type: DataTypes.FLOAT },
  ai_reasoning:     { type: DataTypes.TEXT },
  professor_override: { type: DataTypes.FLOAT },
  override_note:    { type: DataTypes.TEXT },
  model_version:    { type: DataTypes.STRING(50), defaultValue: 'v1' },
}, {
  indexes: [{ fields: ['grade_id'] }, { fields: ['user_id'] }],
});

// ── CourseTA (TA workflow — 3.3) ──
const CourseTA = sequelize.define('CourseTA', {
  course_id:    { type: DataTypes.INTEGER, allowNull: false, references: { model: Course, key: 'id' } },
  user_id:      { type: DataTypes.INTEGER, references: { model: User, key: 'id' } },
  email:        { type: DataTypes.STRING(200), allowNull: false },
  role:         { type: DataTypes.STRING(20), defaultValue: 'ta' },
  status:       { type: DataTypes.STRING(20), defaultValue: 'pending' },
  assigned_questions: { type: DataTypes.TEXT, defaultValue: '[]' },
  assigned_students:  { type: DataTypes.TEXT, defaultValue: '[]' },
  submissions_graded: { type: DataTypes.INTEGER, defaultValue: 0 },
  avg_grading_time:   { type: DataTypes.FLOAT, defaultValue: 0 },
  override_rate:      { type: DataTypes.FLOAT, defaultValue: 0 },
  consistency_score:  { type: DataTypes.FLOAT, defaultValue: 1.0 },
}, {
  indexes: [
    { fields: ['course_id'] },
    { fields: ['user_id'] },
    { fields: ['course_id', 'user_id'], unique: true },
    { fields: ['course_id', 'email'], unique: true, name: 'course_ta_course_email_unique' },
  ],
});

// ── Crib / Regrade Request (3.4) ──
const Crib = sequelize.define('Crib', {
  grade_id:       { type: DataTypes.INTEGER, allowNull: false, references: { model: Grade, key: 'id' } },
  student_id:     { type: DataTypes.INTEGER, allowNull: false, references: { model: Student, key: 'id' } },
  exam_id:        { type: DataTypes.INTEGER, allowNull: false, references: { model: Exam, key: 'id' } },
  question_no:    { type: DataTypes.STRING(50), allowNull: false },
  student_reasoning: { type: DataTypes.TEXT, allowNull: false },
  attachment_path: { type: DataTypes.STRING(500) },
  status:         { type: DataTypes.STRING(20), defaultValue: 'pending' },
  ai_recommendation: { type: DataTypes.TEXT },
  ai_suggested_marks: { type: DataTypes.FLOAT },
  ai_confidence:  { type: DataTypes.FLOAT },
  ai_reasoning:   { type: DataTypes.TEXT },
  resolved_by:    { type: DataTypes.INTEGER, references: { model: User, key: 'id' } },
  resolved_marks: { type: DataTypes.FLOAT },
  resolved_note:  { type: DataTypes.TEXT },
  resolved_at:    { type: DataTypes.DATE },
}, {
  indexes: [
    { fields: ['grade_id'] },
    { fields: ['student_id'] },
    { fields: ['exam_id'] },
    { fields: ['status'] },
    { unique: true, fields: ['grade_id', 'student_id'] },
  ],
});

// ── Announcement (3.5.6) ──
const Announcement = sequelize.define('Announcement', {
  course_id:    { type: DataTypes.INTEGER, allowNull: false, references: { model: Course, key: 'id' } },
  user_id:      { type: DataTypes.INTEGER, allowNull: false, references: { model: User, key: 'id' } },
  title:        { type: DataTypes.STRING(300), allowNull: false },
  content:      { type: DataTypes.TEXT, allowNull: false },
  type:         { type: DataTypes.STRING(20), defaultValue: 'general' },
  is_pinned:    { type: DataTypes.BOOLEAN, defaultValue: false },
  email_sent:   { type: DataTypes.BOOLEAN, defaultValue: false },
  scheduled_at: { type: DataTypes.DATE },
  published_at: { type: DataTypes.DATE },
}, {
  indexes: [{ fields: ['course_id'] }, { fields: ['user_id'] }],
});

// ── CourseDocument (3.1 RAG foundation + 3.5.4 Resource Management) ──
const CourseDocument = sequelize.define('CourseDocument', {
  course_id:    { type: DataTypes.INTEGER, allowNull: false, references: { model: Course, key: 'id' } },
  user_id:      { type: DataTypes.INTEGER, allowNull: false, references: { model: User, key: 'id' } },
  title:        { type: DataTypes.STRING(300), allowNull: false },
  doc_type:     { type: DataTypes.STRING(30), defaultValue: 'slides' },
  file_path:    { type: DataTypes.STRING(500) },
  file_name:    { type: DataTypes.STRING(300) },
  extracted_text: { type: DataTypes.TEXT },
  page_count:   { type: DataTypes.INTEGER, defaultValue: 0 },
  allow_download: { type: DataTypes.BOOLEAN, defaultValue: true },
  concept_tags: { type: DataTypes.TEXT, defaultValue: '[]' },
}, {
  indexes: [{ fields: ['course_id'] }, { fields: ['doc_type'] }],
});

// ── DiscussionThread (3.5.3) ──
const DiscussionThread = sequelize.define('DiscussionThread', {
  course_id:    { type: DataTypes.INTEGER, allowNull: false, references: { model: Course, key: 'id' } },
  user_id:      { type: DataTypes.INTEGER, allowNull: false, references: { model: User, key: 'id' } },
  title:        { type: DataTypes.STRING(300), allowNull: false },
  content:      { type: DataTypes.TEXT, allowNull: false },
  thread_type:  { type: DataTypes.STRING(20), defaultValue: 'question' },
  is_anonymous: { type: DataTypes.BOOLEAN, defaultValue: false },
  is_pinned:    { type: DataTypes.BOOLEAN, defaultValue: false },
  is_resolved:  { type: DataTypes.BOOLEAN, defaultValue: false },
  concept_tags: { type: DataTypes.TEXT, defaultValue: '[]' },
  view_count:   { type: DataTypes.INTEGER, defaultValue: 0 },
}, {
  indexes: [{ fields: ['course_id'] }, { fields: ['thread_type'] }],
});

// ── DiscussionPost (replies to threads) ──
const DiscussionPost = sequelize.define('DiscussionPost', {
  thread_id:    { type: DataTypes.INTEGER, allowNull: false, references: { model: DiscussionThread, key: 'id' } },
  user_id:      { type: DataTypes.INTEGER, allowNull: false, references: { model: User, key: 'id' } },
  content:      { type: DataTypes.TEXT, allowNull: false },
  is_anonymous: { type: DataTypes.BOOLEAN, defaultValue: false },
  is_answer:    { type: DataTypes.BOOLEAN, defaultValue: false },
  is_ai_generated: { type: DataTypes.BOOLEAN, defaultValue: false },
  upvotes:      { type: DataTypes.INTEGER, defaultValue: 0 },
}, {
  indexes: [{ fields: ['thread_id'] }, { fields: ['user_id'] }],
});

// ── LivePoll (3.6.1) ──
const LivePoll = sequelize.define('LivePoll', {
  course_id:    { type: DataTypes.INTEGER, allowNull: false, references: { model: Course, key: 'id' } },
  user_id:      { type: DataTypes.INTEGER, allowNull: false, references: { model: User, key: 'id' } },
  room_code:    { type: DataTypes.STRING(6), allowNull: false, unique: true },
  question:     { type: DataTypes.TEXT, allowNull: false },
  poll_type:    { type: DataTypes.STRING(20), defaultValue: 'mcq' },
  options:      { type: DataTypes.TEXT, defaultValue: '[]' },
  concept_tag:  { type: DataTypes.STRING(200) },
  is_active:    { type: DataTypes.BOOLEAN, defaultValue: true },
  closed_at:    { type: DataTypes.DATE },
}, {
  indexes: [{ fields: ['room_code'] }, { fields: ['course_id'] }, { fields: ['is_active'] }],
});

// ── PollResponse ──
const PollResponse = sequelize.define('PollResponse', {
  poll_id:      { type: DataTypes.INTEGER, allowNull: false, references: { model: LivePoll, key: 'id' } },
  student_id:   { type: DataTypes.INTEGER, references: { model: Student, key: 'id' } },
  user_id:      { type: DataTypes.INTEGER, references: { model: User, key: 'id' } },
  response:     { type: DataTypes.TEXT, allowNull: false },
  response_name: { type: DataTypes.STRING(200) },
}, {
  indexes: [{ fields: ['poll_id'] }],
});

// ── LearningObjective ──
const LearningObjective = sequelize.define('LearningObjective', {
  course_id:    { type: DataTypes.INTEGER, allowNull: false, references: { model: Course, key: 'id' } },
  title:        { type: DataTypes.STRING(300), allowNull: false },
  description:  { type: DataTypes.TEXT },
  bloom_level:  { type: DataTypes.STRING(30), defaultValue: 'understand' },
  status:       { type: DataTypes.STRING(20), defaultValue: 'active' },
  target_date:  { type: DataTypes.DATEONLY },
  mastery_threshold: { type: DataTypes.FLOAT, defaultValue: 70 },
}, {
  indexes: [{ fields: ['course_id'] }],
});

// ── ActiveFeedback (live engagement during class) ──
const ActiveFeedback = sequelize.define('ActiveFeedback', {
  session_id:   { type: DataTypes.INTEGER },
  course_id:    { type: DataTypes.INTEGER, allowNull: false, references: { model: Course, key: 'id' } },
  student_id:   { type: DataTypes.INTEGER, references: { model: Student, key: 'id' } },
  user_id:      { type: DataTypes.INTEGER, references: { model: User, key: 'id' } },
  feedback_type: { type: DataTypes.STRING(30), defaultValue: 'understanding' },
  content:      { type: DataTypes.TEXT },
  rating:       { type: DataTypes.INTEGER },
  is_anonymous: { type: DataTypes.BOOLEAN, defaultValue: true },
}, {
  indexes: [{ fields: ['session_id'] }, { fields: ['course_id'] }],
});

// ── ClassSession (3.6.4) ──
const ClassSession = sequelize.define('ClassSession', {
  course_id:        { type: DataTypes.INTEGER, allowNull: false, references: { model: Course, key: 'id' } },
  user_id:          { type: DataTypes.INTEGER, allowNull: false, references: { model: User, key: 'id' } },
  title:            { type: DataTypes.STRING(300) },
  session_date:     { type: DataTypes.DATEONLY, allowNull: false },
  start_time:       { type: DataTypes.TIME },
  end_time:         { type: DataTypes.TIME },
  concepts_planned: { type: DataTypes.TEXT, defaultValue: '[]' },
  concepts_covered: { type: DataTypes.TEXT, defaultValue: '[]' },
  resources_used:   { type: DataTypes.TEXT, defaultValue: '[]' },
  polls_conducted:  { type: DataTypes.TEXT, defaultValue: '[]' },
  exit_ticket_summary: { type: DataTypes.TEXT },
  professor_notes:  { type: DataTypes.TEXT },
  status:           { type: DataTypes.STRING(20), defaultValue: 'planned' },
}, {
  indexes: [{ fields: ['course_id'] }, { fields: ['session_date'] }],
});

// ── IntegrationConfig (per-course or global tool credentials) ──
const IntegrationConfig = sequelize.define('IntegrationConfig', {
  course_id:    { type: DataTypes.INTEGER, references: { model: Course, key: 'id' } },
  user_id:      { type: DataTypes.INTEGER, allowNull: false, references: { model: User, key: 'id' } },
  provider:     { type: DataTypes.STRING(50), allowNull: false },
  config:       { type: DataTypes.TEXT, defaultValue: '{}' },
  is_active:    { type: DataTypes.BOOLEAN, defaultValue: true },
  last_synced:  { type: DataTypes.DATE },
}, {
  indexes: [
    { fields: ['course_id', 'provider'] },
    { fields: ['user_id', 'provider'] },
  ],
});

// ═══════════════════════════════════════════
// Relationships
// ═══════════════════════════════════════════
College.hasMany(User, { foreignKey: 'college_id', onDelete: 'SET NULL' });
User.belongsTo(College, { foreignKey: 'college_id' });

College.hasMany(Subscription, { foreignKey: 'college_id', onDelete: 'CASCADE' });
Subscription.belongsTo(College, { foreignKey: 'college_id' });
User.hasMany(Subscription, { foreignKey: 'user_id', onDelete: 'CASCADE' });
Subscription.belongsTo(User, { foreignKey: 'user_id' });

User.hasMany(Course, { foreignKey: 'user_id', onDelete: 'CASCADE' });
Course.belongsTo(User, { foreignKey: 'user_id' });

Course.hasMany(Exam, { foreignKey: 'course_id', onDelete: 'CASCADE' });
Exam.belongsTo(Course, { foreignKey: 'course_id' });

Course.hasMany(Student, { foreignKey: 'course_id', onDelete: 'CASCADE' });
Student.belongsTo(Course, { foreignKey: 'course_id' });
Student.belongsTo(User, { foreignKey: 'user_id' });
User.hasMany(Student, { foreignKey: 'user_id' });

Exam.hasMany(Rubric, { foreignKey: 'exam_id', onDelete: 'CASCADE' });
Rubric.belongsTo(Exam, { foreignKey: 'exam_id' });

Exam.hasMany(Submission, { foreignKey: 'exam_id', onDelete: 'CASCADE' });
Submission.belongsTo(Exam, { foreignKey: 'exam_id' });
Student.hasMany(Submission, { foreignKey: 'student_id', onDelete: 'CASCADE' });
Submission.belongsTo(Student, { foreignKey: 'student_id' });

Submission.hasMany(Grade, { foreignKey: 'submission_id', onDelete: 'CASCADE' });
Grade.belongsTo(Submission, { foreignKey: 'submission_id' });
Rubric.hasMany(Grade, { foreignKey: 'rubric_id', onDelete: 'CASCADE' });
Grade.belongsTo(Rubric, { foreignKey: 'rubric_id' });

User.hasMany(ChatMessage, { foreignKey: 'user_id', onDelete: 'CASCADE' });
ChatMessage.belongsTo(User, { foreignKey: 'user_id' });

User.hasMany(ActiveSession, { foreignKey: 'user_id', onDelete: 'CASCADE' });
ActiveSession.belongsTo(User, { foreignKey: 'user_id' });

Exam.hasMany(GradeBoundary, { foreignKey: 'exam_id', onDelete: 'CASCADE' });
GradeBoundary.belongsTo(Exam, { foreignKey: 'exam_id' });

User.hasMany(EmailLog, { foreignKey: 'user_id', onDelete: 'CASCADE' });
EmailLog.belongsTo(User, { foreignKey: 'user_id' });
Student.hasMany(EmailLog, { foreignKey: 'student_id', onDelete: 'SET NULL' });
EmailLog.belongsTo(Student, { foreignKey: 'student_id' });
Exam.hasMany(EmailLog, { foreignKey: 'exam_id', onDelete: 'SET NULL' });
EmailLog.belongsTo(Exam, { foreignKey: 'exam_id' });

Course.hasMany(ConceptNode, { foreignKey: 'course_id', onDelete: 'CASCADE' });
ConceptNode.belongsTo(Course, { foreignKey: 'course_id' });
Rubric.hasMany(QuestionConcept, { foreignKey: 'rubric_id', onDelete: 'CASCADE' });
QuestionConcept.belongsTo(Rubric, { foreignKey: 'rubric_id' });
ConceptNode.hasMany(QuestionConcept, { foreignKey: 'concept_id', onDelete: 'CASCADE' });
QuestionConcept.belongsTo(ConceptNode, { foreignKey: 'concept_id' });

// New relationships
Grade.hasMany(OverrideLog, { foreignKey: 'grade_id', onDelete: 'CASCADE' });
OverrideLog.belongsTo(Grade, { foreignKey: 'grade_id' });
User.hasMany(OverrideLog, { foreignKey: 'user_id', onDelete: 'CASCADE' });
OverrideLog.belongsTo(User, { foreignKey: 'user_id' });

Course.hasMany(CourseTA, { foreignKey: 'course_id', onDelete: 'CASCADE' });
CourseTA.belongsTo(Course, { foreignKey: 'course_id' });
User.hasMany(CourseTA, { foreignKey: 'user_id', onDelete: 'SET NULL' });
CourseTA.belongsTo(User, { foreignKey: 'user_id' });

Grade.hasMany(Crib, { foreignKey: 'grade_id', onDelete: 'CASCADE' });
Crib.belongsTo(Grade, { foreignKey: 'grade_id' });
Student.hasMany(Crib, { foreignKey: 'student_id', onDelete: 'CASCADE' });
Crib.belongsTo(Student, { foreignKey: 'student_id' });
Exam.hasMany(Crib, { foreignKey: 'exam_id', onDelete: 'CASCADE' });
Crib.belongsTo(Exam, { foreignKey: 'exam_id' });

Course.hasMany(Announcement, { foreignKey: 'course_id', onDelete: 'CASCADE' });
Announcement.belongsTo(Course, { foreignKey: 'course_id' });
User.hasMany(Announcement, { foreignKey: 'user_id', onDelete: 'CASCADE' });
Announcement.belongsTo(User, { foreignKey: 'user_id' });

Course.hasMany(CourseDocument, { foreignKey: 'course_id', onDelete: 'CASCADE' });
CourseDocument.belongsTo(Course, { foreignKey: 'course_id' });
User.hasMany(CourseDocument, { foreignKey: 'user_id', onDelete: 'CASCADE' });
CourseDocument.belongsTo(User, { foreignKey: 'user_id' });

Course.hasMany(DiscussionThread, { foreignKey: 'course_id', onDelete: 'CASCADE' });
DiscussionThread.belongsTo(Course, { foreignKey: 'course_id' });
User.hasMany(DiscussionThread, { foreignKey: 'user_id', onDelete: 'CASCADE' });
DiscussionThread.belongsTo(User, { foreignKey: 'user_id' });

DiscussionThread.hasMany(DiscussionPost, { foreignKey: 'thread_id', onDelete: 'CASCADE' });
DiscussionPost.belongsTo(DiscussionThread, { foreignKey: 'thread_id' });
User.hasMany(DiscussionPost, { foreignKey: 'user_id', onDelete: 'CASCADE' });
DiscussionPost.belongsTo(User, { foreignKey: 'user_id' });

Course.hasMany(LivePoll, { foreignKey: 'course_id', onDelete: 'CASCADE' });
LivePoll.belongsTo(Course, { foreignKey: 'course_id' });
User.hasMany(LivePoll, { foreignKey: 'user_id', onDelete: 'CASCADE' });
LivePoll.belongsTo(User, { foreignKey: 'user_id' });
LivePoll.hasMany(PollResponse, { foreignKey: 'poll_id', onDelete: 'CASCADE' });
PollResponse.belongsTo(LivePoll, { foreignKey: 'poll_id' });

Course.hasMany(ClassSession, { foreignKey: 'course_id', onDelete: 'CASCADE' });
ClassSession.belongsTo(Course, { foreignKey: 'course_id' });

Course.hasMany(LearningObjective, { foreignKey: 'course_id', onDelete: 'CASCADE' });
LearningObjective.belongsTo(Course, { foreignKey: 'course_id' });

ClassSession.hasMany(ActiveFeedback, { foreignKey: 'session_id', onDelete: 'SET NULL' });
ActiveFeedback.belongsTo(ClassSession, { foreignKey: 'session_id' });

Course.hasMany(ActiveFeedback, { foreignKey: 'course_id', onDelete: 'CASCADE' });
ActiveFeedback.belongsTo(Course, { foreignKey: 'course_id' });

Course.hasMany(IntegrationConfig, { foreignKey: 'course_id', onDelete: 'CASCADE' });
IntegrationConfig.belongsTo(Course, { foreignKey: 'course_id' });
User.hasMany(IntegrationConfig, { foreignKey: 'user_id', onDelete: 'CASCADE' });
IntegrationConfig.belongsTo(User, { foreignKey: 'user_id' });

module.exports = {
  sequelize,
  College, User, Subscription,
  Course, Exam, Student, Rubric,
  Submission, Grade, ChatMessage,
  ActiveSession, GradeBoundary, EmailLog,
  ConceptNode, QuestionConcept,
  OverrideLog, CourseTA, Crib,
  Announcement, CourseDocument,
  DiscussionThread, DiscussionPost,
  LivePoll, PollResponse, ClassSession,
  LearningObjective, ActiveFeedback, IntegrationConfig,
};

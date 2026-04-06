const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const bcrypt = require('bcryptjs');

// ── College ──
const College = sequelize.define('College', {
  name:   { type: DataTypes.STRING(200), allowNull: false },
  domain: { type: DataTypes.STRING(200), allowNull: false, unique: true },
  address:{ type: DataTypes.STRING(500) },
  phone:  { type: DataTypes.STRING(50) },
});

// ── User ──
const User = sequelize.define('User', {
  college_id:    { type: DataTypes.INTEGER, references: { model: College, key: 'id' } },
  full_name:     { type: DataTypes.STRING(200), allowNull: false },
  email:         { type: DataTypes.STRING(200), allowNull: false, unique: true },
  password_hash: { type: DataTypes.STRING(256), allowNull: false },
  role:          { type: DataTypes.ENUM('admin', 'professor'), allowNull: false, defaultValue: 'professor' },
  department:    { type: DataTypes.STRING(200) },
  is_active:     { type: DataTypes.BOOLEAN, defaultValue: true },
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
  plan:       { type: DataTypes.ENUM('trial', 'monthly', 'quarterly', 'semiannual', 'annual'), allowNull: false },
  scope:      { type: DataTypes.ENUM('individual', 'college'), allowNull: false, defaultValue: 'individual' },
  start_date: { type: DataTypes.DATE, allowNull: false },
  end_date:   { type: DataTypes.DATE, allowNull: false },
  status:     { type: DataTypes.ENUM('active', 'expired', 'cancelled'), defaultValue: 'active' },
  amount:     { type: DataTypes.FLOAT, defaultValue: 0 },
});

// ── Course ──
const Course = sequelize.define('Course', {
  user_id:  { type: DataTypes.INTEGER, allowNull: false, references: { model: User, key: 'id' } },
  name:     { type: DataTypes.STRING(200), allowNull: false },
  code:     { type: DataTypes.STRING(50), allowNull: false },
  semester: { type: DataTypes.STRING(100) },
  section:  { type: DataTypes.STRING(50) },
});

// ── Exam ──
const Exam = sequelize.define('Exam', {
  course_id:   { type: DataTypes.INTEGER, allowNull: false, references: { model: Course, key: 'id' } },
  name:        { type: DataTypes.STRING(200), allowNull: false },
  exam_type:   { type: DataTypes.STRING(50), defaultValue: 'exam' },
  total_marks: { type: DataTypes.FLOAT, defaultValue: 100 },
  instructions:{ type: DataTypes.TEXT },
});

// ── Student ──
const Student = sequelize.define('Student', {
  course_id:   { type: DataTypes.INTEGER, allowNull: false, references: { model: Course, key: 'id' } },
  name:        { type: DataTypes.STRING(200), allowNull: false },
  roll_number: { type: DataTypes.STRING(100) },
  email:       { type: DataTypes.STRING(200) },
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
});

// ── ChatMessage ──
const ChatMessage = sequelize.define('ChatMessage', {
  user_id:  { type: DataTypes.INTEGER, allowNull: false, references: { model: User, key: 'id' } },
  exam_id:  { type: DataTypes.INTEGER },
  role:     { type: DataTypes.STRING(20), allowNull: false },
  content:  { type: DataTypes.TEXT, allowNull: false },
});

// ── Relationships ──
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

module.exports = {
  sequelize,
  College, User, Subscription,
  Course, Exam, Student, Rubric,
  Submission, Grade, ChatMessage,
};

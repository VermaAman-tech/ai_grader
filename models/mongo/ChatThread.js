const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
  content: { type: String, required: true },
  metadata: {
    actions_executed: [{ type: String }],
    context_page: String,
    tokens_used: Number,
  },
}, { timestamps: true });

const chatThreadSchema = new mongoose.Schema({
  user_id: { type: Number, required: true, index: true },
  course_id: { type: Number, index: true },
  exam_id: { type: Number, sparse: true },
  thread_type: {
    type: String,
    enum: ['assistant', 'course_chat', 'ta_assistant'],
    default: 'assistant',
  },
  title: { type: String, default: '' },
  messages: [messageSchema],
  summary: { type: String, default: '' },
  last_summarized_at: Date,
  is_archived: { type: Boolean, default: false },
  message_count: { type: Number, default: 0 },
}, {
  timestamps: true,
  collection: 'chat_threads',
});

chatThreadSchema.index({ user_id: 1, course_id: 1, thread_type: 1 });
chatThreadSchema.index({ course_id: 1, updatedAt: -1 });
chatThreadSchema.index({ user_id: 1, updatedAt: -1 });

chatThreadSchema.methods.addMessage = function (role, content, metadata = {}) {
  this.messages.push({ role, content, metadata });
  this.message_count = this.messages.length;
  return this;
};

chatThreadSchema.methods.getRecentMessages = function (limit = 20) {
  const msgs = this.messages.slice(-limit);
  return msgs.map(m => ({ role: m.role, content: m.content, createdAt: m.createdAt }));
};

chatThreadSchema.statics.getOrCreateThread = async function (userId, courseId, examId, threadType = 'assistant') {
  const query = { user_id: userId, thread_type: threadType, is_archived: false };
  if (courseId) query.course_id = courseId;
  if (examId) query.exam_id = examId;

  let thread = await this.findOne(query).sort({ updatedAt: -1 });
  if (!thread) {
    thread = new this({
      user_id: userId,
      course_id: courseId || null,
      exam_id: examId || null,
      thread_type: threadType,
    });
    await thread.save();
  }
  return thread;
};

chatThreadSchema.statics.getCourseThreads = async function (courseId, limit = 50) {
  return this.find({ course_id: courseId, is_archived: false })
    .sort({ updatedAt: -1 })
    .limit(limit)
    .select('user_id thread_type title message_count summary updatedAt')
    .lean();
};

module.exports = mongoose.model('ChatThread', chatThreadSchema);

# Intelligrade — Feature Build Plan

**Version:** 2.0  
**Stack:** Node.js + Express + EJS + SQLite/Sequelize + HuggingFace Inference API  
**Agent instructions:** Implement features in strict phase/feature order. Each feature includes DB schema changes, backend routes/services, and frontend view changes. Do not break existing functionality. All AI calls go through `services/llm.js` with retry logic. All new routes follow existing auth middleware patterns (`ensureAuth`, `ensureSubscription`). After each feature, verify the app starts and existing pages render without errors.

---

## Phase 0 — Backend Hardening ✅ COMPLETED

All critical security, data integrity, and reliability fixes have been implemented. Summary of changes:
- `middleware/auth.js`: `asyncHandler`, `assertCourseOwner`, `assertExamOwner`, `assertSubmissionOwner`, `assertGradeOwner`, `assertStudentOwner`
- `middleware/validate.js`: `requireInt`, `requireFloat`, `requireString`, `optionalString`, `requireEmail`
- All 11 route files: wrapped in `asyncHandler`, ownership checks on every mutation/read, `ensureSubscription` on all routes, input validation
- `config/database.js`: WAL mode, busy timeout, foreign keys
- `models/index.js`: Indexes on all foreign keys and frequent query columns
- `server.js`: Session hardening (httpOnly, sameSite, secure), global + auth + grading rate limiters, export file auto-cleanup
- `services/ocr.js`: Improved page splitting with form-feed detection
- `services/analytics.js`: Fixed pass rate to use graded count, not total students
- `routes/export.js`: Files deleted after download

---

### 0.1 Resource ownership middleware (fixes all IDOR vulnerabilities)

**Problem:** Most routes trust `course_id`, `exam_id`, `student_id` from query/body without verifying the resource belongs to the logged-in user. Any authenticated user can view/modify another user's data by guessing IDs.

**Affected routes:** `routes/exams.js` (GET, POST create), `routes/roster.js` (POST upload, POST delete), `routes/rubric.js` (GET, POST create, POST delete), `routes/submissions.js` (POST upload, POST delete), `routes/analytics.js` (GET), `routes/chat.js` (GET, POST send), `routes/grading.js` (POST override).

**Solution — add helper functions to `middleware/auth.js`:**

```js
async function assertCourseOwner(req, courseId) {
  const course = await Course.findOne({
    where: { id: courseId, user_id: req.session.userId }
  });
  if (!course) throw new Error('ACCESS_DENIED');
  return course;
}

async function assertExamOwner(req, examId) {
  const exam = await Exam.findOne({
    where: { id: examId },
    include: { model: Course, where: { user_id: req.session.userId } }
  });
  if (!exam) throw new Error('ACCESS_DENIED');
  return exam;
}

async function assertSubmissionOwner(req, submissionId) {
  const sub = await Submission.findOne({
    where: { id: submissionId },
    include: { model: Exam, include: { model: Course, where: { user_id: req.session.userId } } }
  });
  if (!sub) throw new Error('ACCESS_DENIED');
  return sub;
}

async function assertGradeOwner(req, gradeId) {
  const grade = await Grade.findOne({
    where: { id: gradeId },
    include: { model: Submission, include: { model: Exam, include: { model: Course, where: { user_id: req.session.userId } } } }
  });
  if (!grade) throw new Error('ACCESS_DENIED');
  return grade;
}
```

**Changes per route file — replace every raw `findByPk` or unscoped query with the appropriate assert function:**

| Route file | Handler | Fix |
|------------|---------|-----|
| `routes/exams.js` | `GET /` | Call `assertCourseOwner(req, course_id)` before loading exams |
| `routes/exams.js` | `POST /` | Call `assertCourseOwner(req, course_id)` before creating exam |
| `routes/roster.js` | `POST /upload` | Call `assertCourseOwner(req, course_id)` before CSV processing |
| `routes/roster.js` | `POST /student/:id/delete` | Load student, then `assertCourseOwner(req, student.course_id)` |
| `routes/rubric.js` | `GET /` | Call `assertExamOwner(req, exam_id)` before loading rubrics |
| `routes/rubric.js` | `POST /` | Call `assertExamOwner(req, exam_id)` before creating rubric |
| `routes/rubric.js` | `POST /:id/delete` | Load rubric, then `assertExamOwner(req, rubric.exam_id)` |
| `routes/submissions.js` | `POST /upload` | Call `assertExamOwner(req, exam_id)` before processing files |
| `routes/submissions.js` | `POST /:id/delete` | Call `assertSubmissionOwner(req, id)` before deletion |
| `routes/analytics.js` | `GET /` | Call `assertExamOwner(req, exam_id)` before loading analytics |
| `routes/chat.js` | `GET /`, `POST /send` | If `exam_id` set, call `assertExamOwner(req, exam_id)` |
| `routes/grading.js` | `POST /override/:gradeId` | Call `assertGradeOwner(req, gradeId)` before updating |

**Error handling for ACCESS_DENIED:** Wrap each handler in try/catch. On `ACCESS_DENIED`, flash error and redirect to dashboard. On other errors, flash generic error and redirect back.

---

### 0.2 Wrap all async route handlers in try/catch

**Problem:** Many route handlers are `async` but lack try/catch. Unhandled promise rejections can crash the process or return unhelpful 500 errors.

**Solution — create a utility wrapper in `middleware/auth.js`:**

```js
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(err => {
      if (err.message === 'ACCESS_DENIED') {
        req.flash('error', 'You do not have permission to access that resource.');
        return res.redirect('/dashboard');
      }
      console.error(`[${req.method} ${req.originalUrl}]`, err);
      req.flash('error', 'Something went wrong. Please try again.');
      return res.redirect('back');
    });
  };
}
```

**Apply to every route handler across all files.** Change:
```js
router.get('/', ensureAuth, ensureSubscription, async (req, res) => { ... });
```
To:
```js
router.get('/', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => { ... }));
```

---

### 0.3 Input validation and sanitisation

**Problem:** No input validation beyond presence checks. `parseInt` can produce `NaN`, float fields accept garbage, no max-length enforcement.

**Solution — add a validation utility `middleware/validate.js`:**

```js
function requireInt(value, fieldName) {
  const n = parseInt(value, 10);
  if (isNaN(n) || n < 0) throw new Error(`Invalid ${fieldName}`);
  return n;
}

function requireFloat(value, fieldName, { min = 0, max = Infinity } = {}) {
  const n = parseFloat(value);
  if (isNaN(n) || n < min || n > max) throw new Error(`Invalid ${fieldName}`);
  return n;
}

function requireString(value, fieldName, { maxLen = 500 } = {}) {
  const s = (value || '').trim();
  if (!s) throw new Error(`${fieldName} is required`);
  if (s.length > maxLen) throw new Error(`${fieldName} is too long`);
  return s;
}

function optionalString(value, { maxLen = 500 } = {}) {
  const s = (value || '').trim();
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function requireEmail(value) {
  const s = (value || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) throw new Error('Invalid email address');
  return s;
}
```

**Apply validators in every route that reads user input:**
- Course create: `requireString(name)`, `requireString(code, { maxLen: 50 })`
- Exam create: `requireString(name)`, `requireInt(course_id)`, `requireFloat(total_marks, { min: 1 })`
- Rubric create: `requireString(question_no)`, `requireFloat(max_marks, { min: 0.5 })`, `requireString(question_text, { maxLen: 5000 })`
- Override: `requireFloat(override_marks, { min: 0, max: rubric.max_marks })`
- Registration: `requireEmail(email)`, `requireString(password, { maxLen: 128 })`, password min 8 chars
- Login: `requireEmail(email)`

---

### 0.4 Consistent middleware on all protected routes

**Problem:** Some destructive actions (course delete, student delete, chat clear, grade override) use only `ensureAuth` without `ensureSubscription`. Expired users can still modify data.

**Solution:** Add `ensureSubscription` to every state-changing route except auth routes (login, register, plans, subscribe, logout). Audit every `router.post(...)` and `router.get(...)` call:

| Route | Current | Fix |
|-------|---------|-----|
| `courses/:id/delete` | `ensureAuth` | Add `ensureSubscription` |
| `exams/:id/delete` | `ensureAuth` | Add `ensureSubscription` |
| `roster/student/:id/delete` | `ensureAuth` | Add `ensureSubscription` |
| `roster/upload` | `ensureAuth` | Add `ensureSubscription` |
| `rubric/:id/delete` | `ensureAuth` | Add `ensureSubscription` |
| `submissions/:id/delete` | `ensureAuth` | Add `ensureSubscription` |
| `grading/override/:gradeId` | `ensureAuth` | Add `ensureSubscription` |
| `chat/clear` | `ensureAuth` | Add `ensureSubscription` |

---

### 0.5 Transaction safety for multi-step operations

**Problem:** Subscription creation (expire old + create new), grading (multi-question loop), and batch operations have no transaction wrapping. Failures mid-operation leave inconsistent state.

**Solution:**

```js
const { sequelize } = require('../models');

// In auth.js subscribe handler:
await sequelize.transaction(async (t) => {
  await Subscription.update(
    { status: 'expired' },
    { where: { /* existing active */ }, transaction: t }
  );
  await Subscription.create({ /* new sub */ }, { transaction: t });
});

// In grading.js grade-all handler:
// Keep individual question grading non-transactional (partial progress is desired)
// but wrap the submission status update in the same save as the last grade
```

---

### 0.6 Rate limiting on sensitive endpoints

**Problem:** No rate limiting. Login, registration, grading, and chat can be abused.

**Solution — add `express-rate-limit` (new dependency):**

```js
// server.js
const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 20,                     // 20 attempts per window
  message: 'Too many attempts. Please try again later.',
  standardHeaders: true,
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,   // 1 minute
  max: 30,                // 30 requests per minute
  standardHeaders: true,
});
```

Apply:
- `authLimiter` to `POST /login`, `POST /register`
- `apiLimiter` to `POST /chat/send`, `POST /grading/grade/*`, `POST /grading/grade-all/*`

---

### 0.7 Fix export file accumulation

**Problem:** Every export writes an `.xlsx` to `EXPORT_DIR` and never deletes it. Disk fills over time. Concurrent exports can overwrite.

**Solution:**
- Use a UUID or timestamp+userId in the filename: `export_${userId}_${examId}_${Date.now()}.xlsx`
- After `res.download()` completes (in the callback), `fs.unlink()` the temp file
- Add a startup cleanup: on app start, delete any `.xlsx` files in `EXPORT_DIR` older than 1 hour

---

### 0.8 Fix OCR page splitting heuristic

**Problem:** `services/ocr.js` `_splitByPages` splits the full extracted text evenly by line count across pages. This is incorrect — page 1 might have 50 lines and page 2 might have 10. Question routing sends wrong text to the LLM.

**Solution:**
- `pdf-parse` does not expose per-page text natively, but it provides a `pagerender` callback
- Override the render function to collect text per page:

```js
async function extractText(filePath) {
  const dataBuffer = fs.readFileSync(filePath);
  const pages = [];
  let currentPage = '';

  const options = {
    pagerender: function(pageData) {
      return pageData.getTextContent().then(function(textContent) {
        let pageText = '';
        for (const item of textContent.items) {
          pageText += item.str + (item.hasEOL ? '\n' : ' ');
        }
        pages.push(pageText.trim());
        return pageText;
      });
    }
  };

  const data = await pdfParse(dataBuffer, options);
  return {
    fullText: data.text,
    pageCount: data.numpages,
    pages: pages,  // actual per-page text
  };
}
```

This gives accurate per-page text for question routing, significantly improving grading accuracy for multi-page submissions.

---

### 0.9 Session security hardening

**Problem:** Session cookie has no `secure` or `sameSite` flags configured. No session regeneration on login (session fixation risk).

**Solution in `server.js`:**

```js
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  },
}));
```

**In `routes/auth.js` login handler — regenerate session on login:**
```js
req.session.regenerate((err) => {
  if (err) { /* handle */ }
  req.session.userId = user.id;
  req.session.userName = user.full_name;
  // ... rest of session setup
  req.session.save(() => res.redirect('/dashboard'));
});
```

---

### 0.10 Database indexes for query performance

**Problem:** No explicit indexes beyond Sequelize auto-generated PK and unique constraints. Dashboard runs 6+ separate count queries. Analytics loads all grades for an exam.

**Solution — add indexes in `models/index.js` after model definitions:**

```js
// Composite indexes for common query patterns
Course.addIndex && sequelize.getQueryInterface().addIndex('Courses', ['user_id']);
Exam.addIndex && sequelize.getQueryInterface().addIndex('Exams', ['course_id']);
Student.addIndex && sequelize.getQueryInterface().addIndex('Students', ['course_id']);
Submission.addIndex && sequelize.getQueryInterface().addIndex('Submissions', ['exam_id', 'student_id']);
Submission.addIndex && sequelize.getQueryInterface().addIndex('Submissions', ['exam_id', 'status']);
Grade.addIndex && sequelize.getQueryInterface().addIndex('Grades', ['submission_id']);
Grade.addIndex && sequelize.getQueryInterface().addIndex('Grades', ['rubric_id']);
Subscription.addIndex && sequelize.getQueryInterface().addIndex('Subscriptions', ['user_id', 'status']);
Subscription.addIndex && sequelize.getQueryInterface().addIndex('Subscriptions', ['college_id', 'status']);
```

Use Sequelize model-level indexes:
```js
const Submission = sequelize.define('Submission', { ... }, {
  indexes: [
    { fields: ['exam_id', 'student_id'] },
    { fields: ['exam_id', 'status'] },
  ]
});
```

Also enable SQLite WAL mode for better concurrent read performance:
```js
// config/database.js
sequelize.query('PRAGMA journal_mode=WAL;');
```

---

## Phase 1 — Architectural Changes

### 1.1 Replace sidebar chat with floating AI assistant

**What it does:** Remove the dedicated chat page from the sidebar. Replace with a floating action button (bottom-right, always visible in app shell) that opens a compact AI assistant panel. The assistant has full context of the current page (exam, course) and can both answer questions and trigger frontend actions.

**Remove:**
- Delete sidebar chat link from `views/partials/layout.ejs`
- Keep `routes/chat.js` and `ChatMessage` model intact — the floating assistant reuses them

**New route: `POST /assistant/action`**
```
Request body: {
  message: string,
  context: {
    page: 'dashboard' | 'courses' | 'exams' | 'roster' | 'rubric' | 'submissions' | 'grading' | 'analytics' | 'export',
    exam_id: integer | null,
    course_id: integer | null
  }
}

System prompt includes:
- Current page context
- If exam_id set: exam analytics summary (class avg, question stats, at-risk students)
- Capability to return structured actions:
  { message: 'text', action: { type: 'navigate' | 'trigger_grade' | 'open_modal' | 'export' | null, payload: {} } }
```

**Changes to `views/partials/layout.ejs`:**
- Remove chat nav link from sidebar
- Add floating assistant HTML before closing `</div>` of app-shell:

```html
<div id="ai-assistant"
     data-exam-id="<%= typeof examId !== 'undefined' ? examId : '' %>"
     data-course-id="<%= typeof courseId !== 'undefined' ? courseId : '' %>"
     data-page="<%= currentPath.replace('/', '') || 'dashboard' %>">
  <button id="assistant-toggle" class="assistant-fab">
    <i data-lucide="sparkles"></i>
  </button>
  <div id="assistant-panel" class="assistant-panel" style="display:none;">
    <div class="assistant-header">
      <span>AI Assistant</span>
      <span class="assistant-context" id="assistant-context-badge"></span>
      <button id="assistant-close" class="modal-close">&times;</button>
    </div>
    <div class="assistant-messages" id="assistant-messages"></div>
    <form id="assistant-form" class="assistant-input">
      <input type="text" id="assistant-input" placeholder="Ask anything..." autocomplete="off">
      <button type="submit" class="btn btn-primary btn-sm"><i data-lucide="send"></i></button>
    </form>
  </div>
</div>
```

**Add CSS for assistant in `public/css/style.css`:**
- `.assistant-fab`: 56px circle, gradient primary bg, fixed bottom-right, shadow-lg, z-index 1000
- `.assistant-panel`: 380px wide, 500px tall, fixed bottom-right (above fab), white bg, shadow-float, rounded-xl, flex column, glassmorphism
- `.assistant-messages`: flex-1 overflow-y, message bubbles matching chat design
- `.assistant-input`: bottom bar with input + send button

**Add JS to `public/js/app.js`:**
- Toggle panel visibility on fab click
- Read `data-exam-id`, `data-course-id`, `data-page` from `#ai-assistant`
- On form submit: POST to `/assistant/action` with message + context
- Render response message
- If `action` in response: dispatch (navigate, trigger form submit, open modal, etc.)

**Pass context from routes:** Each route that renders a page should set `res.locals.examId` and `res.locals.courseId` where applicable. Add to:
- `routes/exams.js`: `res.locals.courseId = selectedCourseId`
- `routes/rubric.js`: `res.locals.examId = selectedExamId`
- `routes/grading.js`: `res.locals.examId = selectedExamId`
- `routes/analytics.js`: `res.locals.examId = selectedExamId`
- `routes/submissions.js`: `res.locals.examId = selectedExamId; res.locals.courseId = selectedCourseId`

---

### 1.2 Free trial gate — 10 papers limit

**DB changes:**
```sql
ALTER TABLE User ADD COLUMN papers_graded_total INTEGER DEFAULT 0;
```

Add to `User` model in `models/index.js`:
```js
papers_graded_total: { type: DataTypes.INTEGER, defaultValue: 0 },
```

**Changes to `routes/grading.js`:**
- Before starting any grading job (single or batch), check:

```js
const user = await User.findByPk(req.session.userId);
const sub = req.subscription; // set by ensureSubscription middleware
if (sub.plan === 'trial' && user.papers_graded_total >= (parseInt(process.env.TRIAL_PAPER_LIMIT) || 10)) {
  req.flash('error', `You've used all ${process.env.TRIAL_PAPER_LIMIT || 10} papers in your free trial. Upgrade to continue grading.`);
  return res.redirect('/plans');
}
```

- After each successful submission grading, increment:
```js
await User.increment('papers_graded_total', { by: 1, where: { id: req.session.userId } });
```

**Changes to `routes/dashboard.js`:**
- If user is on trial plan, add a KPI card showing `X / 10 papers used`
- Pass `trialPapersUsed` and `trialPaperLimit` to the dashboard view

**Changes to `views/dashboard.ejs`:**
- Conditionally render trial usage KPI card with amber icon

---

### 1.3 Multi-session awareness for collaborative grading

**DB changes — new model `ActiveSession`:**
```js
const ActiveSession = sequelize.define('ActiveSession', {
  user_id:       { type: DataTypes.INTEGER, allowNull: false },
  session_token: { type: DataTypes.STRING(100), allowNull: false },
  exam_id:       { type: DataTypes.INTEGER },
  last_active_at:{ type: DataTypes.DATE, defaultValue: DataTypes.NOW },
});
```

**Add to `Grade` model:**
```js
modified_by_session: { type: DataTypes.STRING(100) },
```

**New route: `GET /api/session/activity`**
```
Query: ?exam_id=X&since=ISO_TIMESTAMP
Returns: {
  changes: [
    { grade_id, question_no, student_name, action: 'override', modified_at, session_token }
  ]
}
```
- Single query: `Grade.findAll({ where: { updated_at: { [Op.gt]: since } }, include: [Submission with Student, Rubric] })` filtered to exam
- Lightweight — designed for 15-second polling

**Changes to `routes/grading.js` override handler:**
- Set `grade.modified_by_session = req.sessionID` on save
- Upsert `ActiveSession` row on every grading page load and override action

**Changes to `views/grade-review.ejs`:**
- Add a small JS snippet that polls `/api/session/activity?exam_id=X&since=LAST_CHECK` every 15 seconds
- On change detected: show toast notification "Another session updated Q3 for [student name]" and refresh the affected grade card via a targeted fetch

---

## Phase 2 — Tier 1 Features (Deal-closers)

### Feature 1: RAG-powered grading memory

**What it does:** Retrieves the 5 most similar previously-graded answers for the same course+question and injects them as few-shot examples into the grading prompt. Professor overrides are weighted as gold examples. Grading becomes more consistent across batches and improves over time — silently, with no UI changes.

**DB changes — new model `AnswerEmbedding`:**
```js
const AnswerEmbedding = sequelize.define('AnswerEmbedding', {
  course_id:      { type: DataTypes.INTEGER, allowNull: false },
  exam_id:        { type: DataTypes.INTEGER, allowNull: false },
  question_number:{ type: DataTypes.STRING(50), allowNull: false },
  student_id:     { type: DataTypes.INTEGER, allowNull: false },
  grade_id:       { type: DataTypes.INTEGER, allowNull: false, references: { model: 'Grades', key: 'id' } },
  answer_text:    { type: DataTypes.TEXT, allowNull: false },
  embedding:      { type: DataTypes.TEXT, allowNull: false },  // JSON float array
  marks_awarded:  { type: DataTypes.FLOAT, allowNull: false },
  max_marks:      { type: DataTypes.FLOAT, allowNull: false },
  was_overridden: { type: DataTypes.BOOLEAN, defaultValue: false },
  override_marks: { type: DataTypes.FLOAT },
  override_note:  { type: DataTypes.TEXT },
}, {
  indexes: [{ fields: ['course_id', 'question_number'] }]
});
```

**New service: `services/rag.js`**
```
Functions:
- embedText(text) → POST to HF inference API with EMBEDDING_MODEL ('BAAI/bge-small-en-v1.5')
    returns float[] (384 dimensions)
    on failure: return null (RAG is optional, grading continues without it)

- storeAnswerEmbedding({ courseId, examId, questionNumber, studentId, gradeId, answerText, embedding, marksAwarded, maxMarks })
    → insert into AnswerEmbedding

- cosineSimilarity(a, b) → pure JS dot product / (magnitude_a * magnitude_b)

- retrieveSimilarAnswers(courseId, questionNumber, queryEmbedding, topK = 5)
    → load all embeddings for course+question from DB
    → compute cosine similarity in JS
    → overridden answers get 1.3x similarity boost
    → return top K sorted DESC

- buildRAGContext(similarAnswers) → format as few-shot examples:
    "Previously graded similar answers for reference:
     Example 1 (Score: 7/10, Confidence: 85%): [answer excerpt 200 chars]
       Feedback: [feedback excerpt]
       Matched: [points], Missing: [points]
     ..."
```

**Changes to `services/grading.js`:**
- After OCR extracts answer text, call `embedText(answerText)` (skip if null/fails)
- Call `retrieveSimilarAnswers(courseId, questionNo, embedding)`
- If similar answers found, inject `buildRAGContext(similar)` before rubric in the grading prompt
- After grade saved, call `storeAnswerEmbedding(...)` in background (don't await — fire and forget)

**Changes to `routes/grading.js` override handler:**
- On override: update matching `AnswerEmbedding` row → `was_overridden = true`, `override_marks`, `override_note`

---

### Feature 2: Auto-rubric generation from question paper / model answer

**What it does:** Professor uploads a question paper PDF, a model answer PDF (or types text), and the system generates a complete rubric draft with questions, key points, mark allocations, and question types. Works with handwritten documents via the existing vision OCR pipeline.

**DB changes:** None. Uses existing Rubric model.

**New route: `POST /rubric/:examId/generate`**
```
Multipart body:
  - source_type: 'model_answer' | 'past_paper' | 'question_paper'
  - file: PDF (question paper, model answer, or past paper)
  - typed_answer: optional text alternative to file upload

Pipeline:
1. Run PDF through services/ocr.js extractText() (handles handwritten via vision)
2. Build LLM prompt:
   "You are a university rubric designer. Given the following [source_type]:
    [extracted text]
    
    Extract each question, identify key concepts for correct answers,
    assign marks, and classify question type.
    
    Return ONLY valid JSON:
    { questions: [{ question_number, question_text, max_marks, key_points: [{point, marks}], grading_notes, question_type }] }"
3. Parse JSON response, validate structure
4. Return JSON to frontend for professor review (do NOT save yet)
```

**New route: `POST /rubric/:examId/save-generated`**
- Accepts reviewed JSON array from frontend
- Deletes existing rubric rows for that exam (with confirmation)
- Bulk-inserts new Rubric rows

**Changes to `views/rubric.ejs`:**
- Add "Generate with AI" button next to "Add Question" button
- Opens a modal with:
  - Source type radio buttons (Question Paper + Model Answer / Past Marked Paper / Type Answer)
  - File upload input (accepts PDF)
  - Typed answer textarea (shown when "Type Answer" selected)
  - "Generate" button → POST to generate endpoint
- On response: render editable preview table in the modal:
  - Each row: question number (editable), question text (editable textarea), marks (editable input), question type badge, key points as editable list
  - "Accept All" and "Accept Selected" (checkbox per row) buttons
  - Acceptance calls save-generated endpoint then reloads page

---

### Feature 3: Smart normalisation and grade curve engine

**What it does:** After grading, professor can apply grade curves (linear scaling, percentile, standard deviation, or custom cutoffs), preview the before/after distribution, and commit the normalisation. Both raw and normalised scores are preserved.

**DB changes — new model `NormalisationPolicy`:**
```js
const NormalisationPolicy = sequelize.define('NormalisationPolicy', {
  exam_id:    { type: DataTypes.INTEGER, allowNull: false, unique: true },
  method:     { type: DataTypes.STRING(20), allowNull: false }, // 'linear' | 'percentile' | 'stddev' | 'custom' | 'none'
  params:     { type: DataTypes.TEXT, allowNull: false },        // JSON
  applied_at: { type: DataTypes.DATE },
  applied_by: { type: DataTypes.INTEGER },
});
```

**Add to `Grade` model:**
```js
normalised_marks: { type: DataTypes.FLOAT },
```

**Add to `Exam` model:**
```js
pass_mark_percent: { type: DataTypes.FLOAT, defaultValue: 35 },
```

**New service: `services/normalisation.js`**
```
Functions:
- previewNormalisation(examId, method, params) →
    loads all student totals (raw)
    applies method to produce normalised totals
    returns { before: { distribution, mean, median, passRate, gradeBuckets }, after: { same } }

- applyNormalisation(examId, method, params, userId) →
    computes normalised marks per student
    updates Grade.normalised_marks for all grades in the exam
    upserts NormalisationPolicy
    returns { studentsAffected }

Methods:
- linear: newScore = (rawScore / currentMax) * targetMax
- percentile: rank → percentile cutoff → grade
- stddev: mean ± N*σ defines grade boundaries
- custom: professor-defined cutoff percentages for A/B/C/D/F
```

**New routes:**
- `GET /analytics/:examId/normalise` — render normalisation page (not a modal — full page)
- `POST /analytics/:examId/normalise/preview` — returns before/after JSON
- `POST /analytics/:examId/normalise/apply` — applies and redirects to analytics

**New view: `views/normalise.ejs`**
- Left panel: method selector (radio cards), parameter inputs per method
- Right panel: before/after distribution bars (CSS-rendered, matching existing dist-bar style)
- Stats comparison row: mean, median, pass rate, std dev (before → after)
- Preview button (fetches and re-renders right panel)
- Apply button with confirmation dialog

**Changes to `routes/export.js`:**
- If normalisation applied, add "Normalised" columns to gradebook sheet

---

### Feature 4: Personalised student reports with email delivery

**What it does:** After grading, professor sends personalised email reports to students. Each email contains marks per question, AI feedback, missed key points, and an AI-generated learning recommendation.

**DB changes — new model `EmailLog`:**
```js
const EmailLog = sequelize.define('EmailLog', {
  exam_id:       { type: DataTypes.INTEGER, allowNull: false },
  student_id:    { type: DataTypes.INTEGER, allowNull: false },
  status:        { type: DataTypes.STRING(20), defaultValue: 'pending' }, // pending | sent | failed
  error_message: { type: DataTypes.TEXT },
  sent_at:       { type: DataTypes.DATE },
});
```

**New dependency:** `nodemailer`

**New service: `services/email.js`**
```
Config from env: EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS, EMAIL_FROM

Functions:
- isConfigured() → returns true if EMAIL_HOST is set

- generateStudentReport(studentId, examId) →
    fetch all grades for student+exam with rubric info
    call LLM: "Generate a 3-sentence learning recommendation for this student based on:
      [per-question scores, matched/missed points]
      Focus on strengths, weaknesses, and specific improvement actions."
    build HTML email body with:
      - Header: course name, exam name, student name
      - Score summary: total marks, percentage
      - Per-question table: question, marks, key points matched/missed
      - AI recommendation paragraph
    return { html, totalMarks, percentage }

- sendReportEmail(to, studentName, examName, courseName, html) →
    send via nodemailer transporter
    return { success: boolean, error?: string }

- sendBatchReports(examId, studentIds) →
    loop with 500ms delay between sends (rate limiting)
    log each attempt to EmailLog
    return { sent, failed, skipped }
```

**New routes:**
- `POST /grading/:examId/email` — send reports (body: `{ mode: 'all' | 'selected', student_ids: [] }`)
- `GET /grading/:examId/email-status` — returns email log for the exam (for UI status)

**Changes to `views/grading.ejs`:**
- If exam has graded submissions, show "Send Reports" button
- If `EMAIL_HOST` not configured, button is disabled with tooltip "Email not configured in server settings"
- Opens modal:
  - Toggle: "All students" / "Selected students"
  - Student list with checkboxes, email indicator (green = has email, gray = none)
  - Warning: "X students have no email — they will be skipped"
  - Send button → POST, show progress, then summary toast

**Add to `.env.example`:**
```
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=
EMAIL_PASS=
EMAIL_FROM=Intelligrade <noreply@intelligrade.app>
```

---

## Phase 3 — Tier 2 Features (Differentiators)

### Feature 5: Multimodal answer grading (diagrams, circuits, equations)

**What it does:** Extends grading to handle questions where answers are diagrams, circuit schematics, graphs, or mathematical derivations. The vision model describes the drawn answer, and the grading prompt checks for required structural elements from the rubric.

**DB changes — add to `Rubric` model:**
```js
question_type:   { type: DataTypes.STRING(20), defaultValue: 'text' },
  // values: 'text' | 'diagram' | 'equation' | 'circuit' | 'graph' | 'mixed'
visual_elements: { type: DataTypes.TEXT },
  // JSON array of required visual elements
```

**Changes to `services/ocr.js`:**
- New function `extractVisualDescription(filePath, pageNumber, questionType)`:
  - Always uses vision model (regardless of text char threshold)
  - Specialised prompts per question type:
    - `diagram`: "Describe all components, connections, labels, and arrows"
    - `circuit`: "List all circuit elements, connections, labels, and values"
    - `equation`: "Transcribe all mathematical expressions, steps, and final answers exactly"
    - `graph`: "Describe axes, scale, plotted curves, key points, and annotations"
  - Returns structured description text

**Changes to `services/grading.js`:**
- When `rubric.question_type !== 'text'`:
  - Call `extractVisualDescription` instead of regular text extraction for that question's pages
  - Modify grading prompt to include visual elements checklist:
    ```
    "This is a [type] question. The student's answer has been described as:
     [vision description]
     
     Required elements: [visual_elements from rubric]
     
     Check each required element against the description. Award marks proportionally."
    ```

**Changes to `views/rubric.ejs`:**
- Add question type dropdown to rubric form (both manual add and auto-generated)
- When non-text type selected, show "Required visual elements" textarea
- Helper: "List structural elements the answer must contain, one per line"

**Changes to `views/grade-review.ejs`:**
- For non-text questions, label the OCR section: "Vision model extracted:" with a distinct badge

---

### Feature 6: Agentic exam design assistant

**What it does:** Professor uploads a syllabus, sets difficulty/marks/question count, and AI generates a complete question paper with matching rubric. Optionally accepts past papers or handwritten templates as input.

**New routes:**
- `GET /exams/:courseId/design` — render exam design page
- `POST /exams/:courseId/design/generate` — generate questions (multipart: syllabus PDF, past papers, settings)
- `POST /exams/:courseId/design/save` — save as exam + rubric

**New view: `views/exam-design.ejs`**

Layout: two-panel (left: inputs, right: generated preview)

Left panel inputs:
- Syllabus: file upload (PDF) or textarea
- Past papers: up to 3 PDF uploads (optional)
- Template: handwritten/typed question template PDF (optional)
- Settings: difficulty (radio cards: Easy/Medium/Hard/Mixed), total marks (number), question count (number), duration (number), question types (checkboxes: Text, Diagram, Equation, Circuit, Graph)

Right panel (after generation):
- Each question as an editable card:
  - Question text (editable textarea)
  - Marks (editable number input)
  - Type badge
  - Key points (editable chip list)
  - "Regenerate this question" button (re-runs LLM for just that one)
  - Delete button
- "Add question" button
- Uncovered syllabus topics shown as warning badges at top
- "Save as Exam" button → creates Exam + Rubric rows, redirects to rubric page

**Pipeline in generate route:**
1. OCR all uploaded PDFs (syllabus, past papers, template)
2. Build agent prompt with all extracted context
3. Parse JSON response: `{ questions: [...], uncovered_topics: [...] }`
4. Return to frontend

---

### Feature 7: Longitudinal student knowledge graph

**What it does:** After multiple exams are graded, builds a concept-level performance map. Each rubric question is tagged to syllabus concepts (auto-extracted by LLM). Student performance per concept is tracked across exams. Professor sees a heatmap of class concept mastery.

**DB changes — new models:**
```js
const ConceptTag = sequelize.define('ConceptTag', {
  course_id:    { type: DataTypes.INTEGER, allowNull: false },
  concept_name: { type: DataTypes.STRING(200), allowNull: false },
}, {
  indexes: [{ unique: true, fields: ['course_id', 'concept_name'] }]
});

const RubricConceptMap = sequelize.define('RubricConceptMap', {
  rubric_id:  { type: DataTypes.INTEGER, allowNull: false },
  concept_id: { type: DataTypes.INTEGER, allowNull: false },
}, {
  indexes: [{ unique: true, fields: ['rubric_id', 'concept_id'] }]
});

const StudentConceptScore = sequelize.define('StudentConceptScore', {
  student_id:    { type: DataTypes.INTEGER, allowNull: false },
  concept_id:    { type: DataTypes.INTEGER, allowNull: false },
  exam_id:       { type: DataTypes.INTEGER, allowNull: false },
  score_percent: { type: DataTypes.FLOAT, allowNull: false },
}, {
  indexes: [{ fields: ['student_id', 'concept_id'] }]
});
```

**New service: `services/knowledge-graph.js`**
```
Functions:
- extractConcepts(courseId, rubricRows) →
    call LLM: "Given these exam questions, identify core academic concepts being tested.
    Return JSON: { question_id: ['concept1', 'concept2'] }"
    upsert ConceptTag rows, insert RubricConceptMap rows

- computeStudentConceptScores(examId) →
    for each graded student, for each rubric question:
      fetch linked concepts, compute score_percent
      upsert StudentConceptScore

- getClassConceptHeatmap(courseId) →
    aggregate across all exams in course
    return { concepts: [], students: [], matrix: [[score_percent]] }

- getStudentConceptTimeline(studentId, courseId) →
    per-concept performance over time (across exams)
    identifies consistently weak concepts (avg < 50% across 2+ exams)
```

**New route: `GET /analytics/:courseId/concepts`**

**Changes to `views/analytics.ejs`:**
- Add "Concept Map" button linking to the concept analytics page
- Concept page shows:
  - Heatmap grid (rows: concepts, columns: students or percentile groups)
  - Color scale: red → yellow → green
  - "At-risk concepts" sidebar (class avg < 40%)
  - Student dropdown for individual concept timeline view

---

### Feature 8: Plagiarism / similarity detection between submissions (OPTIONAL)

**This feature is entirely optional.** It degrades gracefully — if RAG embeddings don't exist or the feature is never triggered, nothing changes. The similarity button only appears when embeddings are available. No other feature depends on this.

**What it does:** After grading, run pairwise similarity detection between student answers for the same question. Flag suspicious pairs where cosine similarity exceeds a threshold. Uses the same embedding infrastructure as the RAG feature.

**DB changes — new model `SimilarityFlag`:**
```js
const SimilarityFlag = sequelize.define('SimilarityFlag', {
  exam_id:      { type: DataTypes.INTEGER, allowNull: false },
  question_no:  { type: DataTypes.STRING(50), allowNull: false },
  student_a_id: { type: DataTypes.INTEGER, allowNull: false },
  student_b_id: { type: DataTypes.INTEGER, allowNull: false },
  similarity:   { type: DataTypes.FLOAT, allowNull: false },
  status:       { type: DataTypes.STRING(20), defaultValue: 'flagged' }, // flagged | reviewed | dismissed
  reviewed_by:  { type: DataTypes.INTEGER },
  review_note:  { type: DataTypes.TEXT },
});
```

**New service: `services/similarity.js`**
```
Functions:
- detectSimilarity(examId, threshold = 0.92) →
    for each question in the exam rubric:
      load all AnswerEmbedding rows for that question
      compute pairwise cosine similarity
      flag pairs exceeding threshold
      insert SimilarityFlag rows
    return { flagged_pairs: count, questions_checked: count }

- getSimilarityReport(examId) →
    load all flags for exam, grouped by question
    include student names
    return structured report
```

**New routes:**
- `POST /analytics/:examId/similarity` — trigger detection
- `GET /analytics/:examId/similarity` — view report
- `POST /analytics/:examId/similarity/:flagId/review` — mark as reviewed/dismissed

**Changes to `views/analytics.ejs`:**
- Add "Check Similarity" button (visible when exam is graded and RAG embeddings exist)
- Similarity report view:
  - Per-question collapsible sections
  - Each flagged pair: Student A name, Student B name, similarity %, answer excerpts side-by-side
  - Actions: "Dismiss" (false positive) or "Mark Reviewed" with note field
  - Summary badge on analytics page: "3 similarity flags"

---

## Phase 4 — Export and Polish

### Feature 9: Enhanced Excel export with analytics sheet

**Changes to `routes/export.js`:**

Sheet 1 — Gradebook:
- Columns: Roll Number | Student Name | Q1 | Q2 | ... | Total Raw | Total Normalised (if applicable) | Percentage | Grade Letter
- Sorted by roll number
- Conditional formatting: red fill for scores below pass mark

Sheet 2 — Detailed Feedback:
- Columns: Roll Number | Student Name | Question | Marks Awarded | Max Marks | AI Feedback | Key Points Matched | Key Points Missed | Confidence % | Overridden (Y/N) | Override Note
- One row per student per question

Sheet 3 — Class Analytics:
- Question difficulty table: Q number, avg score %, difficulty label (Easy/Medium/Hard)
- Grade distribution: count of A/B/C/D/F
- Top 5 and bottom 5 performers
- Concepts most frequently missed (if knowledge graph data exists)
- Similarity flags summary (if any)

---

### Feature 10: Batch re-grade with updated rubric

**What it does:** When a professor modifies the rubric (adds key points, changes marks) after initial grading, they can trigger a batch re-grade that re-evaluates all submissions against the updated rubric. Preserves old grades as a version for comparison.

**DB changes — add to `Grade` model:**
```js
grade_version: { type: DataTypes.INTEGER, defaultValue: 1 },
previous_marks:{ type: DataTypes.FLOAT },
```

**New route: `POST /grading/:examId/regrade`**
- For each submission in the exam:
  - For each rubric question:
    - Save current `awarded_marks` to `previous_marks`
    - Increment `grade_version`
    - Re-run the grading pipeline (OCR is cached in `ocr_text`, skip re-extraction)
    - Store new marks, feedback, matched/missing points
- Flash summary: "Re-graded X submissions. Y questions changed by > 10%."

**Changes to `views/rubric.ejs`:**
- After rubric modification, if grading already done, show warning: "Rubric changed after grading. Re-grade submissions?"
- Button: "Re-grade All" with confirmation dialog

**Changes to `views/grade-review.ejs`:**
- If `previous_marks` exists and differs from current, show comparison: "Previous: X → Current: Y (v2)"

---

## Environment variables (complete list for `.env.example`)

```env
# Server
PORT=4000
SESSION_SECRET=change-this-to-a-random-64-char-string
NODE_ENV=development

# Database
DATABASE_PATH=./data/intelligrade.db

# Hugging Face — LLM for grading and chat
HF_TOKEN=
HF_PROVIDER=auto
LLM_MODEL=Qwen/Qwen2.5-7B-Instruct
LLM_FALLBACK_MODELS=meta-llama/Llama-3.1-8B-Instruct
LLM_TIMEOUT=30000
LLM_MAX_RETRIES=2

# Vision OCR model
OCR_MODEL=Qwen/Qwen3-VL-8B-Instruct
OCR_TIMEOUT=60000
OCR_MIN_TEXT_CHARS=20

# RAG embedding model
EMBEDDING_MODEL=BAAI/bge-small-en-v1.5
EMBEDDING_DIM=384

# Email delivery (optional — features degrade gracefully if not set)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=
EMAIL_PASS=
EMAIL_FROM=Intelligrade <noreply@intelligrade.app>

# Free trial
TRIAL_PAPER_LIMIT=10

# Normalisation
DEFAULT_PASS_MARK_PERCENT=35

# File storage
UPLOAD_DIR=./data/uploads
EXPORT_DIR=./data/exports
```

---

## Database migration order

Run strictly in this order (Sequelize `sync({ alter: true })` handles these during development):

1. Add `papers_graded_total` to `User`
2. Create `ActiveSession` model
3. Add `modified_by_session` to `Grade`
4. Create `AnswerEmbedding` model
5. Create `NormalisationPolicy` model
6. Add `normalised_marks` to `Grade`
7. Add `pass_mark_percent` to `Exam`
8. Add `question_type` and `visual_elements` to `Rubric`
9. Create `EmailLog` model
10. Create `ConceptTag`, `RubricConceptMap`, `StudentConceptScore` models
11. Create `SimilarityFlag` model
12. Add `grade_version` and `previous_marks` to `Grade`

---

## Implementation rules for agent

1. **Never hardcode API keys.** All secrets from `process.env`.
2. **All LLM calls go through `services/llm.js`** — no raw fetch calls to HuggingFace in routes.
3. **All new routes must use `ensureAuth`, `ensureSubscription`, and the ownership assert functions** except public landing and auth routes.
4. **All async route handlers must use `asyncHandler` wrapper** from Phase 0.2.
5. **All user input must be validated** using the validation functions from Phase 0.3.
6. **RAG embedding calls** go through `services/rag.js` — never in routes.
7. **Reuse `services/ocr.js`** for all PDF processing (rubric upload, exam design, past papers). Never duplicate OCR logic.
8. **EJS templates use the "Digital Scholar" design system** — use existing CSS variables, component patterns, card layouts. No new CSS frameworks.
9. **SQLite via Sequelize** — all models in `models/index.js` with proper associations and indexes.
10. **Multer** is already configured — reuse existing upload middleware.
11. **Error handling** — `asyncHandler` catches everything. LLM failures must fall back gracefully (show manual entry option, never crash).
12. **Free trial gate** is checked in `routes/grading.js` before any grading job, not at middleware level.
13. **Multi-session polling** is a single SQL query on Grade filtered by `exam_id` and `updated_at > lastCheck`. No Redis, no websockets.
14. **Email is optional** — if `EMAIL_HOST` not set, disable the button in UI with tooltip. Never throw on missing email config.
15. **Floating assistant** reads `data-exam-id` and `data-course-id` from the container div's data attributes (set via EJS locals). No extra API call for context.
16. **Similarity detection** requires RAG embeddings to exist — button is hidden until at least one exam has been graded with RAG enabled.
17. **After implementing each phase**, run the app and verify all existing pages still render. Run through the core workflow: create course → add students → create exam → add rubric → upload PDF → grade → review → export.

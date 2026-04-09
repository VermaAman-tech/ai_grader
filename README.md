# Intelligrade

**AI-Powered Exam Grading Platform for Educators**

Intelligrade transforms how professors grade exams. Upload scanned answer sheets, define your rubric, and let AI read handwritten answers, award marks against key points, and deliver detailed per-question feedback — cutting grading time by up to 80%.

Built for universities and individual professors. Supports college-wide deployment with domain-based onboarding.

---

## How It Works

```
Create Course → Import Roster → Define Exam & Rubric → Upload PDFs → AI Grades → Review & Export
```

1. **Set up** your course, import students via CSV, and create an exam with a detailed rubric (questions, key points, marks allocation).
2. **Upload** scanned answer sheets as PDFs — one per student, with batch upload support (up to 100 files at once).
3. **Grade** with one click. The AI pipeline extracts text via OCR, maps answers to rubric questions, evaluates against key points, and assigns marks with confidence scores.
4. **Review** every grade with full transparency: matched/missing key points, AI feedback, extracted answer text, and confidence indicators. Override any score with a note.
5. **Export** a polished Excel gradebook with per-question breakdowns and detailed feedback sheets.

---

## Key Features

### Intelligent OCR
PDF answer sheets are parsed with `pdf-parse` for typed text. When pages contain sparse or handwritten content (below a configurable character threshold), a vision-language model reads the page image and extracts structured text — handling handwriting, diagrams, and mixed layouts.

### AI-Powered Grading
Each student answer is evaluated against the rubric using an LLM. The AI:
- Maps answers to specific rubric key points
- Awards partial credit proportionally
- Identifies matched and missing concepts
- Provides written feedback explaining the grade
- Reports a confidence score (0–100%) for every evaluation

A heuristic fallback engine handles edge cases when the LLM is unavailable or returns malformed output, using keyword overlap and answer length analysis.

### Smart Question Detection
Regex-based page routing automatically identifies which pages of a submission correspond to which rubric questions (`Q1`, `Question 2a`, etc.). When auto-detection fails, the system gracefully falls back to grading against all pages.

### Professor Override
Full human-in-the-loop control. Review every AI grade, inspect the extracted OCR text, and override any score with a custom mark and note. Overrides are clearly marked in exports.

### Deep Analytics
Per-exam analytics dashboard with:
- Class average, median, score range, and pass rate
- Grade distribution (A–F buckets)
- Per-question difficulty analysis (Easy / Medium / Hard based on class performance)
- Student leaderboard with at-risk identification
- AI-generated teaching insights and recommendations (powered by LLM analysis of class data)

### AI Teaching Assistant
Context-aware chat interface. Select an exam to ground the conversation in real class data, then ask:
- *"Which questions were hardest?"*
- *"Identify at-risk students"*
- *"Suggest rubric improvements"*
- *"How did students perform overall?"*

Conversation history is preserved per session with the last 20 messages sent as context.

### Excel Export
Download a professional `.xlsx` gradebook with two sheets:
- **Gradebook** — per-question scores, totals, and percentages for every student
- **Detailed Feedback** — AI feedback, confidence scores, and override notes per question per student

### College-Wide Plans
Admins register their institution and activate a subscription that covers all professors with a matching email domain. Professors joining with a `@university.edu` email are automatically linked to the college.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Runtime** | Node.js |
| **Framework** | Express with EJS templates and express-ejs-layouts |
| **Database** | SQLite via Sequelize ORM |
| **AI / LLM** | Hugging Face Inference Router (chat + vision models) |
| **OCR** | pdf-parse + vision-language model fallback (Qwen3-VL) |
| **Auth** | bcryptjs, express-session, connect-flash |
| **Uploads** | Multer (up to 100 PDFs, 50 MB each) |
| **Export** | ExcelJS |
| **Icons** | Lucide |
| **Design** | Custom "Digital Scholar" design system — Public Sans + Inter typography |

---

## Database Schema

| Model | Purpose |
|-------|---------|
| **College** | Institution with unique email domain |
| **User** | Professor or admin, linked to college |
| **Subscription** | Plan activation (trial / monthly / quarterly / semiannual / annual) |
| **Course** | Owned by a user; has name, code, semester, section |
| **Exam** | Linked to a course; type, total marks, instructions |
| **Student** | Enrolled in a course; name, roll number, email |
| **Rubric** | Per-exam questions with key points (JSON), marks, grading notes |
| **Submission** | PDF upload per student per exam; tracks status and page count |
| **Grade** | Per-question result: marks, feedback, matched/missing points, confidence, OCR text, overrides |
| **ChatMessage** | AI chat history per user, optionally scoped to an exam |

---

## Setup

### Prerequisites

- Node.js 18+
- npm

### Install

```bash
git clone https://github.com/VermaAman-tech/ai_grader.git
cd ai_grader
git checkout intelligrade-web-app
npm install
```

### Configure

Copy the example environment file and fill in your values:

```bash
cp .env.example .env
```

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `4000` |
| `SESSION_SECRET` | Session cookie secret | (required) |
| `DATABASE_PATH` | SQLite file location | `./data/intelligrade.db` |
| `HF_TOKEN` | Hugging Face API token | (required for AI features) |
| `HF_REASONING_TOKEN` | Optional token used only for reasoning calls | `HF_TOKEN` |
| `HF_PROVIDER` | Inference provider routing | `auto` |
| `HF_REASONING_PROVIDER` | Optional provider override for reasoning calls | `HF_PROVIDER` |
| `LLM_MODEL` | Primary grading/chat model | `Qwen/Qwen2.5-7B-Instruct` |
| `LLM_FALLBACK_MODELS` | Comma-separated fallback models | (optional) |
| `REASONING_MODEL` | Primary model for assistant reasoning calls | `LLM_MODEL` |
| `REASONING_FALLBACK_MODELS` | Comma-separated reasoning fallback models | `LLM_FALLBACK_MODELS` |
| `LLM_TIMEOUT` | LLM request timeout (ms) | `30000` |
| `LLM_MAX_RETRIES` | Retries per model | `2` |
| `OCR_MODEL` | Vision model for handwritten text | `Qwen/Qwen2.5-VL-3B-Instruct` |
| `OCR_TIMEOUT` | Vision request timeout (ms) | `60000` |
| `OCR_MIN_TEXT_CHARS` | Minimum chars before vision OCR triggers | `20` |
| `UPLOAD_DIR` | PDF upload storage path | `./data/uploads` |
| `EXPORT_DIR` | Generated Excel file path | `./data/exports` |

**Getting a Hugging Face token:**
1. Sign in at [huggingface.co](https://huggingface.co)
2. Go to Settings → Access Tokens
3. Create a token with read + inference access
4. Paste into `HF_TOKEN` in your `.env` (optionally also set `HF_REASONING_TOKEN` for a separate reasoning key)

### Run

```bash
npm run dev
```

Open [http://localhost:4000](http://localhost:4000) in your browser.

### Seed Demo Account And Data (Idempotent)

This command creates or updates a dedicated demo professor account and seeds a large dataset on your existing database (without force-dropping tables):

```bash
npm run seed:demo
```

Default demo credentials (configurable in `.env`):

- Email: `demo.prof@intelligrade.local`
- Password: `Demo@12345`

The script populates courses, exams, students, submissions, grades, documents, polls, class sessions, discussions, and announcements.

---

## Editing System Prompts

System prompts are now stored in dedicated files so you can view and edit them directly:

- `prompts/system/grading.md` - AI grading behavior for rubric evaluation
- `prompts/system/assistant.md` - Sidebar AI assistant behavior and ACTION tool instructions
- `prompts/system/chat.md` - Chat page assistant behavior
- `prompts/system/rubric.md` - Rubric generator behavior

These are loaded by `utils/prompt-loader.js` and consumed by:

- `services/llm.js`
- `routes/assistant.js`
- `routes/chat.js`
- `services/rubric-generator.js`

After editing prompt files, restart the Node process (or let `node --watch` restart) to apply changes.

---

## Project Structure

```
intelligrade/
├── server.js                  # Express app entry point
├── package.json
├── .env.example
├── DESIGN.md                  # Design system specification
│
├── config/
│   └── database.js            # Sequelize SQLite connection
│
├── models/
│   └── index.js               # All Sequelize models & associations
│
├── middleware/
│   └── auth.js                # ensureAuth + ensureSubscription guards
│
├── routes/
│   ├── auth.js                # Login, register, plans, subscribe, logout
│   ├── dashboard.js           # Dashboard with KPIs and workflow checklist
│   ├── courses.js             # Course CRUD
│   ├── exams.js               # Exam CRUD per course
│   ├── roster.js              # CSV student import
│   ├── rubric.js              # Rubric builder with key points
│   ├── submissions.js         # PDF upload and management
│   ├── grading.js             # AI grading, review, overrides
│   ├── analytics.js           # Performance analytics + AI insights
│   ├── chat.js                # AI teaching assistant
│   └── export.js              # Excel gradebook export
│
├── services/
│   ├── ocr.js                 # PDF text extraction + vision model fallback
│   ├── llm.js                 # Hugging Face chat completions with retry logic
│   ├── grading.js             # Grading pipeline orchestration
│   └── analytics.js           # Statistics computation + AI insight generation
│
├── views/
│   ├── partials/layout.ejs    # App shell (sidebar, topbar, alerts)
│   ├── landing.ejs            # Marketing landing page
│   ├── login.ejs / register.ejs / plans.ejs
│   ├── dashboard.ejs          # KPI cards, checklist, recent activity
│   ├── courses.ejs            # Course cards with stats
│   ├── exams.ejs              # Exam table with actions
│   ├── roster.ejs             # Student table + CSV import modal
│   ├── rubric.ejs             # Question cards with key points
│   ├── submissions.ejs        # Submission table + upload modal
│   ├── grading.ejs            # Grading queue with batch action
│   ├── grade-review.ejs       # Detailed per-question grade review
│   ├── analytics.ejs          # Charts, tables, AI insights
│   ├── chat.ejs               # AI chat interface
│   ├── export.ejs             # Excel download form
│   └── 404.ejs / 500.ejs     # Error pages
│
└── public/
    ├── css/style.css          # Digital Scholar design system
    └── js/app.js              # Client-side utilities
```

---

## Grading Pipeline Detail

```
PDF Upload
    │
    ▼
┌─────────────┐     sparse text?     ┌──────────────────┐
│  pdf-parse   │ ──────────────────► │  Vision LLM       │
│  (text)      │                     │  (Qwen3-VL-8B)    │
└──────┬──────┘                     └────────┬─────────┘
       │                                      │
       └──────────┬───────────────────────────┘
                  ▼
        ┌─────────────────┐
        │ Question Router  │  regex page detection
        │ (per rubric Q)   │  with full-page fallback
        └────────┬────────┘
                 ▼
        ┌─────────────────┐
        │  LLM Grading     │  rubric + key points + answer → JSON
        │  (Qwen2.5-7B)   │  with retry, fallback models,
        │                  │  and heuristic fallback
        └────────┬────────┘
                 ▼
        ┌─────────────────┐
        │  Grade Storage   │  marks, feedback, matched/missing
        │  + Clamping      │  points, confidence, OCR text
        └─────────────────┘
```

---

## Subscription Plans

| Plan | Duration | Scope |
|------|----------|-------|
| **Trial** | 7 days | One per user/college |
| **Monthly** | 30 days | Individual or college |
| **Quarterly** | 90 days | Individual or college |
| **Semi-Annual** | 180 days | Individual or college |
| **Annual** | 365 days | Individual or college |

College-scoped subscriptions (admin only) cover all professors whose email domain matches the registered institution.

---

## License

All rights reserved. &copy; 2026 Intelligrade.

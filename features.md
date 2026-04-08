# Intelligrade — Feature Documentation

## Product Overview

Intelligrade is an AI-powered exam grading platform purpose-built for handwritten answer evaluation. It replaces manual grading workflows with a pipeline that reads answer scripts, grades them against rubrics with per-question precision, and generates deep analytics — while keeping the professor in full control with transparent overrides and audit trails.

The platform serves three audiences with a single codebase: **individual educators** (tutors, coaching centres, freelancers), **K-12 schools**, and **colleges/universities** — each with role-based access, institution-wide licensing, and tiered pricing.

---

## Core Grading Pipeline

### 1. Hybrid OCR Engine

The OCR system combines text extraction with vision-model fallback for real classroom conditions.

- **Primary extraction:** `pdf-parse` extracts text content from uploaded PDF answer sheets
- **Vision fallback:** When a page has insufficient text (common with handwritten/scanned PDFs), the system automatically invokes a vision model via Hugging Face's inference API, sending the page as a base64 image for optical recognition
- **Question-page heuristics:** The system detects which pages contain answers for which question numbers using pattern matching (`Q1`, `Question 1`, `Ans 1`, etc.), so grading operates on the relevant pages rather than the entire document
- **Full-document fallback:** If question detection fails for a particular question, all pages are used and the feedback explicitly notes this

**Why this matters:** Generic OCR tools fail on handwriting, diagrams, and poor scans. The two-stage approach (text first, vision fallback) handles the full spectrum from typed PDFs to phone-photographed answer sheets.

### 2. AI Rubric Grading

Each submission is graded question-by-question against a structured rubric.

- **Structured output:** The LLM returns a JSON object per question with: `score`, `feedback`, `matched_points` (array of rubric key points the student addressed), `missing_points` (what they missed), and `confidence` (0–1 float)
- **Partial credit:** The model is instructed to award partial credit for correct reasoning even with minor errors, not just binary right/wrong
- **Keyword heuristic fallback:** If the LLM API is unavailable or returns malformed JSON, a keyword-matching heuristic grades based on rubric key points found in the OCR text — ensuring the pipeline never completely fails
- **Per-question granularity:** Every question gets its own Grade record with `detected_pages`, `ocr_text`, `awarded_marks`, `feedback`, `matched_points`, `missing_points`, `confidence`, and `raw_response` for full transparency
- **Configurable LLM:** Supports any Hugging Face-hosted model via `HF_TOKEN` and `LLM_MODEL` environment variables, with automatic retry and model fallback

### 3. Bulk Evaluation

- **Individual grading:** Grade one submission at a time with a single click
- **Batch grading ("Grade All"):** Grade all pending/error submissions for an exam in one operation, with per-paper progress and automatic free-tier enforcement
- **ZIP upload:** Upload a ZIP file containing all student PDFs. The system extracts them, matches filenames to the student roster by roll number (with fuzzy matching — normalised case, partial matches, name-based fallback), and creates submission records automatically
- **Multi-file upload:** Upload multiple PDFs at once (up to 100 files) and map them to students
- **Status tracking:** Each submission tracks its status (`pending` → `grading` → `done` / `error`) with error messages preserved for debugging

### 4. Professor Override & Audit

- **Override any grade:** For each question, the professor can set `override_marks` and add an `override_note` explaining the adjustment
- **Audit trail:** Every override records `modified_by_session` — linking the change to the specific browser session
- **Multi-session awareness:** The `ActiveSession` model tracks who is grading what exam in real-time. A polling API (`/api/session/activity`) lets the UI warn if another user modified a grade since you last loaded the page
- **Heartbeat system:** Active sessions send periodic heartbeats; the system reports concurrent session count so professors know if colleagues are grading the same exam

---

## AI-Powered Tools

### 5. Auto-Rubric Generator

Instead of manually typing rubric criteria, professors can generate rubrics from existing materials.

- **From past papers + model answers:** Upload a question paper PDF and/or a model answer. The AI extracts implied key points and generates a rubric draft with question numbers, text, max marks, and key point arrays
- **From syllabus text:** Paste or type syllabus content, and the AI generates exam-ready rubric templates for expected topics
- **Multi-file support:** Upload up to 10 files (PDFs, images, ZIPs of papers). The system extracts text from all of them and feeds it to the LLM as context
- **Edit after generation:** The generated rubric is fully editable — add, remove, or modify questions and key points before grading begins

**Differentiator:** This cuts rubric setup from 30+ minutes to under 3 minutes. It's the single biggest friction point that causes professors to abandon grading tools after one exam.

### 6. AI Exam Designer

- **Input:** Course syllabus, optional past papers (up to 10 files), and optionally past exam analytics data
- **Output:** A complete new exam with balanced question distribution, marking scheme, and full rubric — created as actual `Exam` + `Rubric` records in the database, ready for immediate use
- **Context-aware:** If past analytics are available (from previously graded exams in the same course), the designer can factor in which topics students struggled with

### 7. AI Teaching Assistant (Copilot Sidebar)

A floating panel available on every page in the app, not a separate chat page.

- **Context-aware:** The assistant automatically knows which page the user is on, which course/exam is selected, and can access computed analytics (class average, distribution, question difficulty) for the current exam
- **Actionable responses:** The assistant can return structured `action` JSON (e.g., `navigate` to a page, trigger `grade_all`) that the UI can execute — not just text responses
- **Voice input:** Built-in Web Speech API integration for hands-free interaction via a mic button
- **Persistent history:** Chat messages are stored per-user per-exam in the `ChatMessage` model, with clear/reset capability
- **Exam-grounded:** Unlike generic chatbots, responses reference actual grade data, student performance, and rubric criteria

### 8. Course Planner

Each course supports structured planning fields:

- **Objectives:** Learning outcomes and goals
- **Syllabus:** Full syllabus content (used as input for AI exam design and rubric generation)
- **Credits, department, semester, section** metadata
- **Description:** Course overview

These fields feed into the AI tools — the exam designer and rubric generator use syllabus content as primary input.

---

## Analytics & Insights

### 9. Exam Analytics

Per-exam analytics computed from all graded submissions:

- **Class statistics:** Mean, median, max, min, standard deviation, pass rate
- **Grade distribution:** Histogram buckets (0–20%, 20–40%, etc.) with visual bar charts
- **Question difficulty analysis:** Per-question average score, difficulty rating (Easy/Medium/Hard), and score distribution
- **At-risk student flagging:** Students scoring below threshold are highlighted
- **AI-generated insights:** The LLM analyzes the aggregate data and produces teaching recommendations — which topics need reinforcement, which questions were poorly understood, and suggested interventions
- **Actionable summary:** KPI-driven cards with specific recommendations (e.g., "3 students below 40% — consider remedial sessions")
- **PDF download:** `window.print()` with print-optimized CSS for clean PDF output

### 10. Knowledge Graph

Cross-exam concept mastery analytics for a course:

- **Concept extraction:** The system auto-generates `ConceptNode` records from rubric question text using keyword matching across common academic domains (data structures, algorithms, calculus, physics, etc.)
- **Concept-question linking:** Each rubric question is linked to relevant concepts via `QuestionConcept` junction records
- **Mastery computation:** Per-concept mastery percentages computed across all exams and all students in a course
- **Exam-concept heatmap:** A matrix showing how each exam tested each concept, with color-coded mastery levels (high/medium/low)
- **Student concept performance:** Per-student breakdown of concept mastery across all exams
- **Weak/strong concept identification:** Automatically identifies the weakest and strongest concepts for the batch, with actionable recommendations

**Differentiator:** This turns individual exam grades into a longitudinal learning map — professors can see which concepts are actually being retained across the semester, not just per-exam scores.

### 11. Student Reports

- **Class-level report picker:** Select course and exam, see all students with scores
- **Individual student detail:** Per-question breakdown with marks, feedback, matched/missing points, and OCR text
- **AI narrative report:** An optional LLM-generated learning gap analysis for each student, highlighting strengths, weaknesses, and specific recommendations
- **Longitudinal view:** Bar chart showing the student's scores across all exams in the course, enabling trend analysis
- **Weak student flagging:** Students performing below average are visually flagged

### 12. Smart Normalisation & Grade Boundaries

- **Grade boundaries:** Define letter grades (A+ through F) with percentage ranges and colors
- **Normalisation methods:**
  - **Linear scaling:** Scale all scores proportionally to a target range
  - **Standard deviation curve:** Apply a bell curve adjustment
  - **Percentile-based grading:** Assign grades based on class percentile ranks
- **Preview before applying:** See the distribution shift before committing
- **Custom boundaries:** Fully editable grade boundary definitions per exam

---

## Platform & Operations

### 13. Multi-Tenant Institution Model

- **College/University registration:** Admin registers the institution with a domain (e.g., `techacademy.edu`). Professors with matching email domains can join
- **School registration:** Same flow for K-12 schools
- **Individual accounts:** No institution needed — sign up with any email
- **Role-based access:** `admin` (institution management), `professor` (college faculty), `teacher` (school staff), `individual` (personal use)
- **Institutional subscriptions:** A single subscription covers all users under a college or school domain
- **Individual subscriptions:** Personal plans for independent educators

### 14. Authentication & Security

- **OTP email verification:** New registrations go through a 6-digit OTP flow (mock OTP shown in dev mode for testing)
- **Password hashing:** bcrypt with automatic salting
- **Session management:** Express sessions with 24-hour TTL, `httpOnly` cookies, `sameSite: 'lax'`, `secure` flag in production
- **Rate limiting:**
  - Global: 300 requests per 15 minutes per IP
  - Auth routes: 20 attempts per 15 minutes (prevents brute force)
  - Grading routes: 10 per minute (prevents API abuse)
- **Resource ownership guards:** Every data access operation verifies that the requesting user owns the resource through the Course → Exam → Submission → Grade chain (using `required: true` inner joins)
- **Input validation:** Dedicated middleware for integer, float, string, and email validation with sanitisation
- **SQL injection protection:** Sequelize parameterised queries throughout
- **XSS protection:** EJS auto-escaping of all user-provided content

### 15. Subscription & Payment

- **Free tier:** 10 paper evaluations forever, no credit card required. All AI features included
- **Paid plans:** Individual (₹999/$12/month), School (₹7,499/$99/month), College (₹39,999/$549/month)
- **Annual discounts:** 17% savings on yearly plans
- **Currency support:** INR and USD pricing with frontend toggle
- **Stripe integration:** Full Checkout Session flow with webhook support; automatic subscription activation on successful payment
- **Demo mode:** When Stripe keys aren't configured, subscriptions activate immediately for development/demo
- **Coupon system:** Backend-defined coupons (e.g., `WELCOME20` for 20% off, `LAUNCH50` for 50% off) with AJAX validation
- **Display pricing markup:** Prices shown on the website are 20% higher than base; coupons bring them to actual rates

### 16. Email Results

- **Bulk email:** Send grade results to all students in an exam at once
- **HTML templates:** Professional email format with score summary, per-question breakdown, and grade letter
- **Optional AI feedback:** Each email can include an LLM-generated personalised feedback paragraph
- **Email logging:** Every sent email is tracked in `EmailLog` with status
- **SMTP configuration:** Supports any SMTP provider (Gmail, SendGrid, etc.) via environment variables

### 17. Export

- **Excel gradebook:** Complete spreadsheet with student names, roll numbers, per-question marks, totals, percentages, and grade letters
- **Feedback sheet:** Second worksheet with per-question feedback text for each student
- **Auto-cleanup:** Generated files are deleted after download; background cleanup runs every 30 minutes for any orphaned exports

---

## User Interface

### 18. Design System ("Digital Scholar")

- **Typography:** Public Sans (display), Inter (body), JetBrains Mono (code/data)
- **Tonal surface layering:** Five surface levels creating depth without harsh borders
- **Ambient shadows:** Tinted, high-spread, low-opacity shadows for a soft, editorial feel
- **Glassmorphism modals:** 80% opacity + backdrop blur
- **Dark/Light theme:** Full theme toggle with CSS custom properties, persisted via `localStorage`
- **Responsive layout:** Collapsible sidebar, mobile-friendly tables, responsive grids

### 19. Landing Page

- **Transparent-to-blur navbar:** Navigation gains backdrop blur on scroll
- **Brand logo:** Custom SVG clipboard with gradient (purple → green), paper sheet with coloured grading lines
- **Hero section:** Dual gradient glows, fine-tuned model messaging, metric counters
- **Feature carousel:** Horizontal sliding cards with arrow navigation, dot pagination, touch swipe support, responsive breakpoints (4/3/2/1 visible cards)
- **AI model section:** Dedicated section explaining the fine-tuned evaluation engine (handwriting recognition, reasoning-first grading, multimodal understanding, RLHF alignment, continuous improvement)
- **Audience cards:** Individual / School / College cards with "Most Popular" badge
- **Pricing grid:** 4-tier pricing with currency toggle (INR/USD)
- **Social proof bar, trust section, CTA section**
- **Legal pages:** Terms & Conditions, Privacy Policy

### 20. Voice Interaction

- **Web Speech API integration:** Built into the floating AI assistant
- **Mic button with visual feedback:** Pulses red when actively recording
- **Browser-native:** No external service required — works in Chrome, Edge, and other browsers supporting the Web Speech API
- **Hands-free grading:** Dictate questions, ask for analytics, trigger actions by voice

---

## Data Model Highlights

### 21. Transparency-First Grading Schema

Every `Grade` record stores:

| Field | Purpose |
|-------|---------|
| `detected_pages` | Which PDF pages the OCR system identified for this question |
| `ocr_text` | The raw text extracted from those pages |
| `awarded_marks` | AI-assigned score (capped to max marks) |
| `feedback` | Detailed grading rationale |
| `matched_points` | JSON array of rubric key points the student addressed |
| `missing_points` | JSON array of key points the student missed |
| `confidence` | AI confidence in its grading (0.0 – 1.0) |
| `raw_response` | The raw LLM response (up to 8000 chars) for debugging |
| `override_marks` | Professor's manual override (null if AI grade accepted) |
| `override_note` | Professor's explanation for the override |
| `modified_by_session` | Which session made the last override |

This level of transparency is rare in AI grading tools. Every grade is fully auditable — the professor can see exactly what the AI read, what it matched, and why it scored the way it did.

---

## Key Differentiators

### vs. Generic LLM Chat Tools
- **Rubric-first architecture:** Not "ask AI to grade" — structured rubric with explicit key-point accounting
- **Transparency fields:** Every grade shows OCR text, matched points, missing points, confidence
- **Professor override with audit trail:** AI assists, professor decides

### vs. Traditional LMS Grading
- **Handwriting-aware OCR pipeline:** Vision model fallback for scanned/photographed answer sheets
- **AI rubric generation:** 3 minutes vs. 30 minutes for rubric setup
- **Auto exam design:** Generate balanced papers from syllabus
- **Knowledge graph:** Cross-exam concept mastery tracking

### vs. Other AI Grading Startups
- **Fine-tuned evaluation messaging:** Model adapted for handwritten answer scripts specifically
- **Multi-audience platform:** Individual + School + College in one product with appropriate licensing
- **Teaching copilot grounded in data:** Assistant references computed analytics, not generic advice
- **Bulk pipeline:** ZIP upload with auto roll-number matching + batch grading
- **Smart normalisation:** Multiple curve methods with preview, not just raw scores

### vs. Manual Grading
- **80% time reduction:** Grade 50 papers in minutes vs. hours
- **Consistency:** Same rubric applied identically to every student
- **Actionable insights:** Automatically surfaces weak topics, at-risk students, concept gaps
- **Zero infrastructure:** Web-based, no installation, works on any device

---

## Technical Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js + Express |
| Views | EJS with `express-ejs-layouts` |
| Database | SQLite via Sequelize ORM (WAL mode, foreign keys, indexes) |
| AI/LLM | Hugging Face Inference Router (chat + vision models) |
| OCR | `pdf-parse` + vision model fallback |
| Auth | bcrypt, express-session, OTP verification |
| Payments | Stripe Checkout + webhooks |
| Email | Nodemailer (configurable SMTP) |
| File handling | Multer (uploads), adm-zip (ZIP processing), ExcelJS (exports) |
| Security | express-rate-limit, input validation middleware, ownership assertions |
| Frontend | Vanilla JS, Lucide icons, CSS custom properties, Web Speech API |

---

## Environment Configuration

| Variable | Purpose |
|----------|---------|
| `HF_TOKEN` | Hugging Face API token for LLM and vision models |
| `LLM_MODEL` | Primary LLM model ID (defaults to Hugging Face router) |
| `SESSION_SECRET` | Express session encryption key |
| `DATABASE_PATH` | SQLite database file location |
| `UPLOAD_DIR` | Directory for uploaded PDFs |
| `EXPORT_DIR` | Directory for generated Excel files |
| `FREE_PAPER_LIMIT` | Number of free evaluations (default: 10) |
| `STRIPE_SECRET_KEY` | Stripe API secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Email configuration |
| `PORT` | Server port (default: 4000) |
| `NODE_ENV` | `development` (shows mock OTP) or `production` |

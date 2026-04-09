# Intelligrade — Comprehensive Testing Checklist

> **Purpose**: Verify every feature, integration, and edge case before deployment.  
> **Date**: April 2026  
> **How to use**: Go through each section. Mark `[x]` when verified. Every single checkbox must pass.

---

## Table of Contents

1. [Environment Setup & Prerequisites](#1-environment-setup--prerequisites)
2. [Authentication & Registration](#2-authentication--registration)
3. [SSO Integration](#3-sso-integration)
4. [Professor Portal — Dashboard](#4-professor-portal--dashboard)
5. [Course Management](#5-course-management)
6. [Exam Management](#6-exam-management)
7. [Rubric & AI Rubric Generator](#7-rubric--ai-rubric-generator)
8. [Student Roster](#8-student-roster)
9. [Submissions & File Upload](#9-submissions--file-upload)
10. [AI Grading Pipeline](#10-ai-grading-pipeline)
11. [Grade Review & Override](#11-grade-review--override)
12. [Analytics & Reports](#12-analytics--reports)
13. [Grade Boundaries & Curves](#13-grade-boundaries--curves)
14. [Email Grade Reports](#14-email-grade-reports)
15. [Export (Excel/PDF)](#15-export-excelpdf)
16. [AI Assistant (Professor)](#16-ai-assistant-professor)
17. [TA Management & Workflow](#17-ta-management--workflow)
18. [TA Portal](#18-ta-portal)
19. [AI Assistant (TA)](#19-ai-assistant-ta)
20. [Student Portal](#20-student-portal)
21. [Course Join System](#21-course-join-system)
22. [Announcements](#22-announcements)
23. [Discussion Board](#23-discussion-board)
24. [Course Documents (RAG)](#24-course-documents-rag)
25. [Crib / Regrade Requests](#25-crib--regrade-requests)
26. [Live Polls](#26-live-polls)
27. [Class Sessions](#27-class-sessions)
28. [Active Feedback](#28-active-feedback)
29. [Knowledge Graph](#29-knowledge-graph)
30. [Learning Objectives](#30-learning-objectives)
31. [Notification System (Email)](#31-notification-system-email)
32. [Stripe Payment & Subscriptions](#32-stripe-payment--subscriptions)
33. [LMS Integration (Canvas)](#33-lms-integration-canvas)
34. [LMS Integration (Moodle)](#34-lms-integration-moodle)
35. [Other Integrations](#35-other-integrations)
36. [MongoDB Chat Storage](#36-mongodb-chat-storage)
37. [Security & Auth Hardening](#37-security--auth-hardening)
38. [Rate Limiting](#38-rate-limiting)
39. [File Upload Security](#39-file-upload-security)
40. [Session Management](#40-session-management)
41. [Cross-Role Access Control](#41-cross-role-access-control)
42. [UI/UX Consistency](#42-uiux-consistency)
43. [Responsive Design](#43-responsive-design)
44. [Error Handling](#44-error-handling)
45. [Performance & Load](#45-performance--load)
46. [Database Integrity](#46-database-integrity)
47. [Deployment Readiness](#47-deployment-readiness)

---

## 1. Environment Setup & Prerequisites

### Required Services
- [ ] PostgreSQL running and accessible
- [ ] MongoDB running and accessible (optional — chat falls back to PostgreSQL)
- [ ] `.env` file created from `.env.example` with all values filled

### Environment Variables Verification
- [ ] `DATABASE_URL` — PostgreSQL connects successfully on startup
- [ ] `MONGODB_URI` — MongoDB connects (or graceful fallback logged)
- [ ] `SESSION_SECRET` — Set to strong random 64-char string (not default)
- [ ] `HF_TOKEN` or `HF_REASONING_TOKEN` — LLM API key valid
- [ ] `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` — Email sends (test with OTP)
- [ ] `STRIPE_SECRET_KEY` — Stripe initialized (or graceful "not configured" message)
- [ ] `STRIPE_WEBHOOK_SECRET` — Webhook signature validation works
- [ ] `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` — Google OAuth button appears on login
- [ ] `SAML_ENTRY_POINT` + `SAML_ISSUER` — SAML button appears on login (if configured)
- [ ] App starts without errors: `npm start`
- [ ] Console shows "PostgreSQL synced." and "MongoDB Connected" (or fallback warning)

### Database
- [ ] All tables created automatically on first run (`sequelize.sync()`)
- [ ] Legacy schema migration runs without errors (`ensureLegacySchemaCompatibility`)
- [ ] Seed script runs: `npm run seed` (creates demo data)
- [ ] Seed-demo script runs: `npm run seed:demo`

---

## 2. Authentication & Registration

### Registration Flow
- [ ] `GET /register` — Page loads with all fields (name, email, phone, password, role, institution, department)
- [ ] Submit with valid data — User created, OTP email sent (or console log in dev)
- [ ] Submit with duplicate email — Error "already exists"
- [ ] Submit with weak password (<6 chars) — Error shown
- [ ] Submit with mismatched passwords — Error shown
- [ ] Submit with invalid email format — Error shown
- [ ] `GET /verify-email` — OTP input page loads after registration
- [ ] Enter correct OTP — Email verified, redirected to dashboard
- [ ] Enter wrong OTP — Error shown, attempt counted
- [ ] Resend OTP — New code sent, old one still valid briefly
- [ ] OTP brute-force lockout — After 10 wrong attempts, locked for 15 minutes
- [ ] Free subscription auto-created for non-student, non-college users

### Login Flow (Password)
- [ ] `GET /login` — Page loads with email/password fields
- [ ] Login with correct credentials — Redirected to dashboard
- [ ] Login with wrong password — Error "Invalid email or password"
- [ ] Login with unverified email — Error "verify your email"
- [ ] Login with deactivated account — Error "deactivated"
- [ ] Session regenerated on login (session fixation prevention)
- [ ] TA invitations auto-linked on login (by email match)
- [ ] Student roster entries auto-linked on login

### Login Flow (OTP / Passwordless)
- [ ] Click "Sign in without password" — OTP section appears
- [ ] Submit email — OTP sent, redirected to `/otp-verify`
- [ ] Enter correct OTP — Logged in, redirected to dashboard
- [ ] Enter wrong OTP — Error shown
- [ ] OTP expires after 5 minutes

### Password Reset
- [ ] `GET /forgot-password` — Form loads
- [ ] Submit email — Reset link sent (or console log in dev)
- [ ] Submit non-existent email — Still says "check your inbox" (no enumeration)
- [ ] Click reset link — `GET /reset-password/:token` loads
- [ ] Submit new password — Password changed, all tokens invalidated
- [ ] Use expired/invalid token — Error shown
- [ ] Token format validation (`/^[a-f0-9]{64}$/`) — Invalid tokens rejected before DB query

### Logout
- [ ] `GET /logout` — Session destroyed, redirected to login

---

## 3. SSO Integration

### Google OAuth
- [ ] Login page shows "Google" button when `GOOGLE_CLIENT_ID` is set
- [ ] Click Google button → Redirected to Google consent screen
- [ ] After consent → User created (if new) or logged in (if existing)
- [ ] Email auto-verified for Google-authenticated users
- [ ] Free subscription created for new Google-auth users
- [ ] Pending TA invites linked on Google auth

### SAML SSO
- [ ] Login page shows institution SSO button when `SAML_ENTRY_POINT` is set
- [ ] Button label shows `SAML_IDP_NAME` value
- [ ] Click SAML button → Redirected to IdP
- [ ] After SAML assertion → User created/logged in
- [ ] `GET /auth/saml/metadata` — Returns XML SP metadata
- [ ] `GET /auth/status` — Returns JSON with SSO enabled flags

### SSO Edge Cases
- [ ] SSO with no email in profile — Error "No email" shown
- [ ] SSO creates user with random password (can still set one later via reset)
- [ ] SSO respects `pendingJoinCode` in session (join course after SSO)
- [ ] Google and SAML buttons hidden when not configured

---

## 4. Professor Portal — Dashboard

- [ ] `GET /dashboard` — Loads with course list, KPI cards
- [ ] Shows total courses, total students, exams, graded papers
- [ ] Quick-action buttons work (create course, view analytics, etc.)
- [ ] Recent activity section shows latest actions
- [ ] Theme toggle (light/dark) works and persists
- [ ] Sidebar navigation links all functional

---

## 5. Course Management

### Create Course
- [ ] `GET /courses/create` — Form loads
- [ ] Submit with name, code, semester, section — Course created
- [ ] `join_code` auto-generated (8-char unique)
- [ ] `allow_join` defaults to true
- [ ] Redirected to course detail page

### Edit Course
- [ ] `GET /courses/:id/edit` — Form loads with existing data
- [ ] Update name, code, section, description, objectives, syllabus — Saved
- [ ] Update `review_threshold`, `crib_window_hours` — Saved
- [ ] Cannot edit another professor's course (ownership check)

### Delete Course
- [ ] Delete course — Cascades to exams, students, submissions, grades, etc.
- [ ] Confirmation required before deletion

### Course Detail
- [ ] `GET /courses/:id` — Shows course info, exam list, student count, TA list
- [ ] All sub-navigation links work (exams, roster, analytics, etc.)

---

## 6. Exam Management

- [ ] `GET /exams?course_id=X` — Lists exams for the course
- [ ] Create exam with name, type, total marks, instructions — Exam created
- [ ] Edit exam — All fields updateable
- [ ] Delete exam — Cascades to rubric, submissions, grades
- [ ] Exam types: exam, quiz, assignment, midterm, final, project, homework, lab

---

## 7. Rubric & AI Rubric Generator

### Manual Rubric
- [ ] Add question with question_no, text, max_marks, key_points — Saved
- [ ] Edit question — All fields updateable
- [ ] Delete question — Grades for that rubric item deleted
- [ ] Reorder questions (question_order)
- [ ] Key points: JSON array of `{point, marks}` pairs
- [ ] Grading notes per question

### AI Rubric Generator
- [ ] Upload exam PDF → AI extracts questions and generates rubric
- [ ] Generated rubric appears with editable questions
- [ ] Accept/reject individual AI-generated items
- [ ] Filename sanitization on uploaded PDF (null bytes, special chars)

---

## 8. Student Roster

### Manual Entry
- [ ] Add student with name, roll number, email — Student created
- [ ] Duplicate roll number in same course — Error shown

### CSV Import
- [ ] Upload CSV with headers (name, roll_number, email) — Students imported
- [ ] Duplicate handling — Skips or updates existing
- [ ] Invalid CSV format — Error message shown

### Auto-enrollment
- [ ] Students auto-linked when they register with matching email

---

## 9. Submissions & File Upload

### Individual Upload
- [ ] Upload single PDF for a student — Submission created
- [ ] Status set to "pending"
- [ ] Page count extracted from PDF

### Zip Upload
- [ ] Upload ZIP containing multiple PDFs — Each extracted, matched to students
- [ ] File naming convention matching (roll number, name)
- [ ] Large ZIP handling (within limits)

### File Security
- [ ] Max file size enforced (Multer limit)
- [ ] Only allowed file types (PDF, ZIP)
- [ ] Null byte in filename — Sanitized, no crash
- [ ] Path traversal in filename — Sanitized
- [ ] Multer errors redirect with flash message (not 500 page)

---

## 10. AI Grading Pipeline

- [ ] Trigger grading for an exam — All pending submissions processed
- [ ] Each question graded against rubric key points
- [ ] LLM returns JSON: score, feedback, matched_points, missing_points, confidence
- [ ] Scores capped at max_marks per question
- [ ] Heuristic fallback when LLM unavailable or returns non-JSON
- [ ] Grading rate limit enforced (10/minute)
- [ ] Status updated to "graded" after completion
- [ ] Low-confidence grades auto-flagged for review
- [ ] Multiple retry with fallback models on LLM failure

---

## 11. Grade Review & Override

### Review Queue
- [ ] `GET /review-queue?course_id=X` — Lists flagged grades
- [ ] Filter by exam, status, confidence
- [ ] Review individual grade — See OCR text, rubric, AI reasoning

### Override
- [ ] Professor can override marks — `override_marks` saved
- [ ] Override note required — Saved to `override_note`
- [ ] Override logged to `OverrideLog` (RLHF data)
- [ ] Review status updated (flagged → reviewed, auto → manual)

---

## 12. Analytics & Reports

- [ ] `GET /analytics?exam_id=X` — Exam analytics page loads
- [ ] Class average, median, pass rate displayed
- [ ] Question-wise difficulty analysis
- [ ] Score distribution histogram
- [ ] At-risk students identified (below 40%)
- [ ] Top performers identified (above 90%)
- [ ] Student-level detail table with scores

### Student Reports
- [ ] `GET /student-reports/:studentId?course_id=X` — Individual student report
- [ ] Cross-exam performance comparison
- [ ] Concept mastery analysis

---

## 13. Grade Boundaries & Curves

- [ ] Set grade boundaries (A+, A, B+, ... F) with percentage ranges
- [ ] Boundaries saved per exam
- [ ] Visual grade distribution with boundary colors
- [ ] AI assistant can set boundaries via action

---

## 14. Email Grade Reports

- [ ] `POST /grading/email/send` — Sends grade emails to students
- [ ] Email contains: student name, exam name, total marks, question breakdown, feedback
- [ ] Optional LLM-generated personal feedback
- [ ] EmailLog created per send
- [ ] SMTP configuration required (graceful error if not configured)

---

## 15. Export (Excel/PDF)

- [ ] Export grades as Excel (.xlsx) — All students, all questions, scores
- [ ] Export grades as PDF — Formatted report
- [ ] Export includes override notes and review status
- [ ] Export files auto-cleaned after 1 hour

---

## 16. AI Assistant (Professor)

### Basic Chat
- [ ] AI assistant FAB button visible on course pages
- [ ] Click → Panel opens with welcome message
- [ ] Type message → AI responds with context-aware answer
- [ ] Chat history preserved across page navigations
- [ ] Clear chat — All messages deleted

### Context Awareness
- [ ] AI knows current page, course, exam context
- [ ] AI has access to: courses list, student count, TA list, exam list
- [ ] AI has access to: exam analytics (avg, median, pass rate, at-risk students)
- [ ] AI has RAG access to uploaded course documents
- [ ] AI can cite specific document content
- [ ] AI includes previous conversation summary (MongoDB)

### Agent Actions (execute via AI)
- [ ] `create_announcement` — AI creates announcement, confirmed in UI
- [ ] `create_thread` — AI creates discussion thread
- [ ] `release_grades` — AI releases grades, sends email notifications
- [ ] `set_boundaries` — AI sets grade boundaries
- [ ] `create_poll` — AI creates live poll with room code
- [ ] `create_session` — AI creates class session
- [ ] `send_email` — AI sends email to all/at_risk/top_performers
- [ ] `send_invite` — AI sends TA or student invite email
- [ ] `analyze_student` — AI returns detailed student analysis table
- [ ] `compare_exams` — AI compares multiple exams
- [ ] `search_documents` — AI searches course documents by keyword
- [ ] `navigate` — AI navigates professor to specific page
- [ ] `grade_all` — AI triggers grading for an exam
- [ ] Multi-action chaining (multiple actions in one response)

### Summarization
- [ ] `POST /assistant/summarize` — AI summarizes conversation thread
- [ ] Summary stored in MongoDB for future context

---

## 17. TA Management & Workflow

### Invite TAs
- [ ] `POST /ta/invite` — Send TA invitation by email
- [ ] Email notification sent with professional template
- [ ] TA roles: `ta`, `head_ta`
- [ ] Permissions configurable: grade, analytics, roster, announcements, cribs, docs

### TA Assignment
- [ ] Assign specific questions to TAs
- [ ] Assign specific students to TAs
- [ ] TA performance tracking: submissions_graded, avg_grading_time, override_rate, consistency_score

### TA Permissions
- [ ] `can_grade` — TA can grade assigned submissions
- [ ] `can_view_analytics` — TA can see analytics page
- [ ] `can_manage_roster` — TA can add/edit students
- [ ] `can_post_announcements` — TA can create announcements
- [ ] `can_access_cribs` — TA can view/respond to cribs
- [ ] `can_manage_docs` — TA can upload course documents

---

## 18. TA Portal

### Access
- [ ] `GET /ta-portal` — TA dashboard loads with assigned courses
- [ ] Only accessible to users with CourseTA assignments
- [ ] UI matches professor portal design system

### Course View
- [ ] `GET /ta-portal/course/:id` — Course detail with stats
- [ ] KPI cards: students, submissions, pending, graded

### Grading
- [ ] `GET /ta-portal/grading/:courseId` — Exam/submission list
- [ ] Grade individual submission — OCR text, rubric, score input
- [ ] Override functionality respects TA permissions

### Review
- [ ] `GET /ta-portal/review/:courseId` — Flagged grades for review

### Analytics
- [ ] `GET /ta-portal/analytics/:courseId` — Only if `can_view_analytics`

### Roster
- [ ] `GET /ta-portal/roster/:courseId` — Only if `can_manage_roster`

### Announcements
- [ ] `GET /ta-portal/announcements/:courseId` — Only if `can_post_announcements`
- [ ] Create announcement — Saved to database

### Cribs
- [ ] `GET /ta-portal/cribs/:courseId` — Only if `can_access_cribs`

### Documents
- [ ] `GET /ta-portal/documents/:courseId` — Only if `can_manage_docs`
- [ ] Upload document — File sanitized, saved

---

## 19. AI Assistant (TA)

- [ ] AI FAB visible on TA course pages
- [ ] AI knows TA's permissions and scope
- [ ] AI provides course-specific answers with RAG
- [ ] AI can execute limited actions (navigate, create announcement if permitted, analyze student, search docs)
- [ ] AI CANNOT execute professor-only actions (release grades, set boundaries)
- [ ] Chat stored in MongoDB (course-scoped, `ta_assistant` type)
- [ ] Chat history and clear work correctly

---

## 20. Student Portal

### Authentication
- [ ] `GET /student/login` — OTP-based login page loads
- [ ] Enter email → OTP sent → Verify → Logged in
- [ ] Wrong OTP → Error shown
- [ ] Brute-force lockout after 10 failed attempts

### Dashboard
- [ ] `GET /student/dashboard` — Shows enrolled courses, recent grades
- [ ] Course cards with latest exam scores

### Course View
- [ ] `GET /student/course/:id` — Course detail with exams, announcements
- [ ] Only sees courses they're enrolled in

### Grades
- [ ] `GET /student/grades/:courseId` — All exam grades for the course
- [ ] Only sees released grades
- [ ] Question-wise breakdown with feedback
- [ ] Percentage and total displayed

### Crib / Regrade
- [ ] Submit crib with reasoning text — Crib created
- [ ] Optional attachment upload
- [ ] See crib status (pending, approved, rejected)
- [ ] Crib window enforced (configurable per course)

### Announcements
- [ ] View course announcements sorted by date
- [ ] Pinned announcements shown first

### Discussions
- [ ] View discussion threads for the course
- [ ] Create new thread (question, discussion, resource)
- [ ] Reply to threads
- [ ] Anonymous posting option
- [ ] Mark answer (by instructor/TA)

### Live Polls
- [ ] `GET /student/poll/:roomCode` — Participate in active polls
- [ ] Submit response — Saved
- [ ] See results after poll closes

### TA Panel
- [ ] `GET /student/ta-panel/:courseId` — View assigned TAs

---

## 21. Course Join System

- [ ] `GET /courses/join` — Join course by code form
- [ ] `GET /courses/join/:code` — Direct join link
- [ ] Role selection: student or TA
- [ ] Student join → CourseEnrollment created + Student record
- [ ] TA join → Links to existing CourseTA invitation
- [ ] Works for logged-in and not-logged-in users (stores pending join in session)
- [ ] After login/register → Automatically completes join

---

## 22. Announcements

### Professor
- [ ] Create announcement — Title, content, type (general/grade/exam/urgent)
- [ ] Pin/unpin announcements
- [ ] Schedule announcements for future
- [ ] Email notification to all students (optional)

### Visibility
- [ ] Students see published announcements only
- [ ] TAs see announcements if `can_post_announcements`

---

## 23. Discussion Board

- [ ] Create thread — Title, content, type, optional concept tags
- [ ] Reply to thread — Content, anonymous option
- [ ] Mark as answered
- [ ] Pin threads
- [ ] Filter by type (question, discussion, resource)
- [ ] View count incrementing
- [ ] AI-generated replies flagged with `is_ai_generated`

---

## 24. Course Documents (RAG)

- [ ] Upload document (PDF, images) — Extracted text saved
- [ ] Title, doc_type classification (slides, notes, textbook, etc.)
- [ ] Allow/disallow download toggle
- [ ] Concept tags extracted or manually added
- [ ] AI assistant uses document content for RAG responses
- [ ] Student can view allowed documents

---

## 25. Crib / Regrade Requests

### Student Side
- [ ] Submit crib for a specific question grade
- [ ] Must provide reasoning text
- [ ] Optional attachment
- [ ] View status of pending cribs

### Professor/TA Side
- [ ] `GET /cribs?course_id=X` — List all cribs with filters
- [ ] AI recommendation displayed (suggested marks, confidence, reasoning)
- [ ] Accept/reject/modify crib resolution
- [ ] Resolved marks update the grade
- [ ] Resolution note saved

---

## 26. Live Polls

### Create
- [ ] Create poll — Question, options, poll type (MCQ)
- [ ] Room code auto-generated (6-char)
- [ ] Poll set to active

### Participate
- [ ] Students join with room code
- [ ] Submit response — Saved
- [ ] Real-time response count

### Close
- [ ] Close poll — `closed_at` set, `is_active` false
- [ ] Results viewable after close

---

## 27. Class Sessions

- [ ] Create session — Title, date, planned concepts
- [ ] Update status: planned → in_progress → completed
- [ ] Log covered concepts, resources used, polls conducted
- [ ] Exit ticket summary
- [ ] Professor notes

---

## 28. Active Feedback

- [ ] Create feedback session for a course
- [ ] Students submit anonymous feedback (understanding rating, comments)
- [ ] Professor sees aggregated feedback
- [ ] Linked to class sessions

---

## 29. Knowledge Graph

- [ ] Create concept nodes for a course
- [ ] Link rubric questions to concepts (QuestionConcept)
- [ ] Visualize concept mastery across students
- [ ] Identify weak concepts based on grade data

---

## 30. Learning Objectives

- [ ] Create learning objectives with Bloom's level
- [ ] Set mastery threshold
- [ ] Track objective completion based on exam data
- [ ] Target dates for objectives

---

## 31. Notification System (Email)

### Templates
- [ ] `ta_invite` — Professional TA invitation with accept button
- [ ] `student_invite` — Student enrollment notification
- [ ] `grades_released` — Grade notification with score summary
- [ ] `announcement` — Course announcement forwarded by email
- [ ] `password_reset` — Reset link with button
- [ ] `course_join` — Join course invitation with code

### Delivery
- [ ] SMTP configured → Emails sent successfully
- [ ] SMTP not configured → Graceful fallback (console warning, no crash)
- [ ] Bulk sending works (sendBulkNotification)
- [ ] Failed sends logged and counted

### Triggered By
- [ ] TA invitation → `ta_invite` email sent
- [ ] Grade release → `grades_released` emails to all students
- [ ] AI assistant `send_email` action → Emails sent
- [ ] AI assistant `send_invite` action → Invite email sent

---

## 32. Stripe Payment & Subscriptions

### Plans
- [ ] `GET /plans` — Pricing page loads with Assess, Academic, Enterprise plans
- [ ] Monthly, semester, yearly billing options
- [ ] Individual and college scopes
- [ ] Per-100-student batch pricing displayed correctly
- [ ] Bundle discount (buy 12 profs, get 2 free) calculated

### Checkout
- [ ] `POST /checkout/create-session` — Stripe session created, URL returned
- [ ] Redirected to Stripe checkout page
- [ ] Successful payment → `GET /checkout/success` → Subscription activated
- [ ] Failed payment → Redirected to plans page with error

### Coupons
- [ ] `POST /checkout/validate-coupon` — Valid coupon returns discount
- [ ] Invalid coupon returns error
- [ ] Coupon restrictions enforced (billing type, scope)
- [ ] LAUNCH30 (30%), WELCOME20 (20%), EDUCATOR50 (50%), ANNUAL15 (yearly only), COLLEGE25 (college only)

### Webhooks
- [ ] `POST /checkout/webhook` — Receives Stripe events
- [ ] Raw body parsed correctly (express.raw middleware)
- [ ] Signature validation with `STRIPE_WEBHOOK_SECRET`
- [ ] `checkout.session.completed` → Subscription activated
- [ ] Prior subscriptions expired on new activation

### Subscription Enforcement
- [ ] `ensureSubscription` middleware blocks expired users
- [ ] Free plan created on registration (100-year duration)
- [ ] Subscription status: active, expired

### Stripe Not Configured
- [ ] Without `STRIPE_SECRET_KEY` → Checkout returns 503 with helpful message
- [ ] No crash if Stripe module missing

---

## 33. LMS Integration (Canvas)

### Configuration
- [ ] `GET /integrations` — Canvas appears in LMS category
- [ ] Save Canvas config: api_url, api_token, canvas_course_id
- [ ] Toggle Canvas active/inactive

### Roster Sync
- [ ] `POST /integrations/canvas/sync` — Imports students from Canvas
- [ ] Students matched by email, new ones created
- [ ] Last synced timestamp updated
- [ ] Error handling for invalid API token

### Grade Push
- [ ] `POST /integrations/canvas/push-grades` — Pushes grades to Canvas
- [ ] Grades matched by student roll_number (Canvas student ID)
- [ ] Count of pushed vs total reported

### Error Cases
- [ ] Invalid API URL → Error message shown
- [ ] Expired token → Error message shown
- [ ] Canvas not configured → Error "Configure Canvas first"

---

## 34. LMS Integration (Moodle)

### Configuration
- [ ] Save Moodle config: lti_url (site URL), client_id (WS token), deployment_id
- [ ] Toggle Moodle active/inactive

### Roster Sync
- [ ] `POST /integrations/moodle/sync` — Imports enrolled users
- [ ] Students created with name, email, roll_number from Moodle

### Grade Push
- [ ] `POST /integrations/moodle/push-grades` — Pushes grades to Moodle
- [ ] Uses `core_grades_update_grades` webservice function

---

## 35. Other Integrations

- [ ] Piazza — Config save, stub sync
- [ ] Google Classroom — Config save, stub sync
- [ ] Notion — Config save, embed URL endpoint
- [ ] Turnitin — Config save, check stub
- [ ] Gradescope — Config save
- [ ] Zoom — Config save (meeting URL)
- [ ] Teams — Config save (meeting + webhook URL)
- [ ] Slack — Config save, **real webhook test** (sends test message)
- [ ] Discord — Config save, **real webhook test** (sends test message)
- [ ] GitHub Classroom — Config save, import stub
- [ ] Overleaf — Config save (project URL)
- [ ] Bodhitree — Config save
- [ ] JupyterHub — Config save

---

## 36. MongoDB Chat Storage

### Connection
- [ ] `MONGODB_URI` set → MongoDB connects on startup
- [ ] `MONGODB_URI` not set → Graceful fallback to PostgreSQL ChatMessage table
- [ ] Connection failure → Warning logged, app still starts

### Chat Threads
- [ ] Professor AI chat → Messages stored in MongoDB `chat_threads` collection
- [ ] TA AI chat → Messages stored as `ta_assistant` thread type
- [ ] Course-scoped threads (separate per course)
- [ ] Exam-scoped threads (separate per exam context)
- [ ] Message history retrieved from MongoDB
- [ ] Clear chat → Thread archived in MongoDB + PostgreSQL fallback cleared

### Summarization
- [ ] `POST /assistant/summarize` — AI generates conversation summary
- [ ] Summary stored in thread document
- [ ] Summary injected as context in future conversations
- [ ] Minimum 4 messages required for summarization

---

## 37. Security & Auth Hardening

### OTP Security
- [ ] OTPs generated with `crypto.randomInt()` (not Math.random)
- [ ] OTPs expire after 5 minutes
- [ ] Brute-force lockout after 10 failed attempts (15-minute lock)
- [ ] Lockout applied to: `/verify-login-otp`, `/verify-email`

### Password Reset Security
- [ ] Token is 64-char hex (`crypto.randomBytes(32)`)
- [ ] Token regex validated before DB query
- [ ] Tokens expire after 1 hour
- [ ] All tokens invalidated after successful reset
- [ ] Session regenerated after password change

### Headers
- [ ] `helmet` enabled with CSP
- [ ] CSP allows: self, unpkg, jsdelivr, Google Fonts
- [ ] CSP blocks: frames, objects, inline scripts (with unsafe-inline for EJS)
- [ ] No X-Powered-By header

### Prototype Pollution
- [ ] TA permissions merge uses allowlisted keys only
- [ ] No direct `Object.assign` from user-controlled JSON

### Session
- [ ] `httpOnly: true` on session cookie
- [ ] `sameSite: 'lax'`
- [ ] `secure: true` in production
- [ ] Session regenerated on login
- [ ] Session destroyed on logout

---

## 38. Rate Limiting

- [ ] Global: 300 requests / 15 minutes per IP
- [ ] Auth (login/register): 20 requests / 15 minutes per IP
- [ ] Sensitive auth (OTP, forgot password): 10 requests / 15 minutes per IP
- [ ] Grading: 10 requests / 1 minute per IP
- [ ] Rate limit headers returned (RateLimit-*)
- [ ] Rate limit message displayed on 429 response

---

## 39. File Upload Security

For each upload route (course-documents, submissions, rubric-ai, exam-design, ta-portal docs):
- [ ] `file.originalname` sanitized: null bytes removed, special chars replaced
- [ ] Filename prefixed with timestamp
- [ ] File size limits enforced
- [ ] File type filtering (PDF, ZIP, images as appropriate)
- [ ] Multer errors caught by global error handler → Flash message + redirect

---

## 40. Session Management

- [ ] Login → Session created with userId, userName, userEmail, role, collegeId
- [ ] Session persists across requests
- [ ] Session destroyed on logout
- [ ] Session regenerated on login (prevent fixation)
- [ ] `maxAge: 24 hours`
- [ ] Concurrent sessions allowed (no single-session enforcement)

---

## 41. Cross-Role Access Control

### Professor Routes (ensureProfessor)
- [ ] Student accessing `/courses` → Blocked (redirect to dashboard)
- [ ] TA accessing `/grading` → Blocked
- [ ] Unauthenticated user → Redirect to login

### TA Routes (ensureTA)
- [ ] Professor accessing `/ta-portal` → Only if they have TA assignments
- [ ] Student accessing `/ta-portal` → Blocked
- [ ] TA without `can_grade` → Cannot access grading page
- [ ] TA without `can_view_analytics` → Cannot access analytics

### Student Routes
- [ ] Professor accessing `/student/dashboard` → Blocked or separate view
- [ ] Student accessing another student's data → Blocked
- [ ] Student can only see courses they're enrolled in
- [ ] Student only sees released grades

### IDOR Prevention
- [ ] Professor A cannot edit Professor B's courses
- [ ] Professor A cannot view Professor B's exam analytics
- [ ] TA cannot access courses they're not assigned to
- [ ] Student cannot view grades for courses they're not in

---

## 42. UI/UX Consistency

- [ ] Professor portal uses `style.css` with `.app-shell` layout
- [ ] TA portal uses same design system as professor (ta-layout.ejs)
- [ ] Student portal uses `student-portal.css` with consistent theme
- [ ] Theme toggle works on all portals (light/dark)
- [ ] `theme-init.ejs` partial included on all pages
- [ ] Lucide icons render correctly on all pages
- [ ] Flash messages (success/error) displayed properly on all pages
- [ ] Navigation highlights current page
- [ ] Empty states shown when no data (courses, exams, etc.)
- [ ] Badge colors consistent (success=green, warning=amber, danger=red, info=blue)

---

## 43. Responsive Design

- [ ] Dashboard responsive on mobile (< 768px)
- [ ] Sidebar collapses on mobile
- [ ] Tables scroll horizontally on mobile
- [ ] Forms usable on mobile
- [ ] AI assistant panel usable on mobile
- [ ] Login/register pages centered and readable on mobile

---

## 44. Error Handling

- [ ] `404` — Custom 404 page rendered
- [ ] `500` — Custom 500 page rendered (no stack trace in production)
- [ ] Multer file upload errors → Flash message + redirect
- [ ] File size limit exceeded → Flash message
- [ ] Database connection error → Error logged, app attempts reconnection
- [ ] LLM API error → Fallback message shown, no crash
- [ ] Stripe API error → Error logged, user sees "Payment service error"
- [ ] Invalid route parameters → Validation errors shown

---

## 45. Performance & Load

- [ ] PostgreSQL connection pooling configured (max 10, min 2)
- [ ] MongoDB connection pooling configured
- [ ] Sequelize indexes on frequently queried columns
- [ ] Static files served with `express.static`
- [ ] Export files auto-cleaned every 30 minutes
- [ ] No N+1 query issues in analytics (check query counts)
- [ ] Grading pipeline processes submissions sequentially with timeouts

---

## 46. Database Integrity

### PostgreSQL
- [ ] All foreign keys valid (referencing existing records)
- [ ] Unique constraints enforced (email, join_code, course+roll_number, etc.)
- [ ] `onDelete: CASCADE` for parent-child relationships
- [ ] `onDelete: SET NULL` for optional references
- [ ] Indexes created for all frequently queried columns

### MongoDB
- [ ] Chat threads indexed on `user_id`, `course_id`, `thread_type`
- [ ] Archived threads excluded from active queries
- [ ] Message count stays in sync with messages array length

---

## 47. Deployment Readiness

### Pre-deployment Checklist
- [ ] `NODE_ENV=production` set
- [ ] `SESSION_SECRET` is strong random string (not default)
- [ ] `DATABASE_URL` points to production PostgreSQL
- [ ] `MONGODB_URI` points to production MongoDB (or empty for fallback)
- [ ] All SMTP credentials configured for production email
- [ ] `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` set for live mode
- [ ] SSO credentials configured (if applicable)
- [ ] `secure: true` on session cookie (requires HTTPS)
- [ ] HTTPS configured on reverse proxy (nginx/caddy)
- [ ] Stripe webhook endpoint registered in Stripe dashboard
- [ ] SAML callback URL registered with IdP
- [ ] Google OAuth callback URL registered in Google Cloud Console
- [ ] Upload and export directories writable
- [ ] Log rotation configured
- [ ] Database backups scheduled
- [ ] Health check endpoint responds

### Smoke Test (run these after deploying)
1. [ ] Home page loads (`/`)
2. [ ] Register a new professor account
3. [ ] Verify email with OTP
4. [ ] Create a course
5. [ ] Create an exam with rubric
6. [ ] Import student roster (CSV)
7. [ ] Upload a submission PDF
8. [ ] Trigger AI grading
9. [ ] Review grades in analytics
10. [ ] Override a grade
11. [ ] Export grades as Excel
12. [ ] Invite a TA by email
13. [ ] Login as TA, verify TA portal
14. [ ] Login as student (OTP), view grades
15. [ ] Submit a crib/regrade request
16. [ ] Create an announcement → Verify email sent
17. [ ] Use AI assistant → Verify context and actions
18. [ ] Process a Stripe payment (test mode)
19. [ ] Join a course via join link
20. [ ] Test Google SSO login (if configured)

---

## Integration Testing Procedures

### Test Canvas Integration
1. Create a Canvas sandbox course at `https://canvas.instructure.com`
2. Generate API token: Account > Settings > New Access Token
3. In Intelligrade: Integrations > Canvas > Enter api_url, api_token, canvas_course_id
4. Click "Sync Roster" → Verify students imported
5. Grade an exam → Click "Push Grades to Canvas" → Verify grades appear in Canvas

### Test Moodle Integration
1. Set up Moodle sandbox at `https://sandbox.moodledemo.net/`
2. Enable webservices: Site Admin > Plugins > Web services > Enable
3. Create webservice token with `core_enrol_get_enrolled_users` + `core_grades_update_grades`
4. In Intelligrade: Integrations > Moodle > Enter lti_url, client_id (WS token), deployment_id
5. Click "Sync Roster" → Verify students imported
6. Click "Push Grades" → Verify grades in Moodle gradebook

### Test Stripe Integration
1. Use Stripe test mode keys (`sk_test_...`)
2. Set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`
3. Install Stripe CLI: `stripe listen --forward-to localhost:4000/checkout/webhook`
4. Go to Plans page → Select a plan → Complete checkout with test card `4242 4242 4242 4242`
5. Verify subscription activated in dashboard
6. Test coupons: LAUNCH30, WELCOME20, EDUCATOR50
7. Verify webhook logs in Stripe dashboard

### Test Google SSO
1. Go to Google Cloud Console > APIs & Services > Credentials
2. Create OAuth 2.0 Client ID (Web application)
3. Add authorized redirect URI: `https://yourdomain.com/auth/google/callback`
4. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env`
5. Restart app → Verify Google button appears on login page
6. Click Google → Complete consent → Verify user created/logged in

### Test SAML SSO
1. Use a test IdP (e.g., Okta developer, Auth0, or `https://samltest.id/`)
2. Get IdP metadata: entry point URL, certificate
3. Set `SAML_ENTRY_POINT`, `SAML_ISSUER`, `SAML_CERT` in `.env`
4. Register SP metadata with IdP: `GET /auth/saml/metadata`
5. Restart app → Verify SAML button appears on login page
6. Click SSO → Complete IdP login → Verify user created/logged in

### Test Email Notifications
1. For development: Use Mailtrap, Ethereal, or Gmail App Password
2. Set `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`, `SMTP_USER`, `SMTP_PASS`
3. Register → Verify OTP email received
4. Reset password → Verify reset email received
5. Invite TA → Verify invitation email received
6. Release grades → Verify grade notification emails received
7. Create announcement → Verify announcement email sent

### Test MongoDB Chat
1. Run MongoDB locally: `mongod` or `docker run -p 27017:27017 mongo`
2. Set `MONGODB_URI=mongodb://localhost:27017/intelligrade`
3. Start app → Verify "MongoDB Connected" in console
4. Open AI assistant → Send messages → Verify stored in MongoDB
5. Clear chat → Verify thread archived
6. Summarize chat → Verify summary generated and stored
7. Stop MongoDB → Verify app still works (falls back to PostgreSQL)

---

## Authentication Credentials Needed for Testing

| Service | What You Need | Where to Get |
|---------|--------------|--------------|
| PostgreSQL | Connection string | Local install or cloud (Neon, Supabase, Railway) |
| MongoDB | Connection string | Local install or cloud (MongoDB Atlas free tier) |
| Hugging Face | API token | https://huggingface.co/settings/tokens |
| Stripe | Test secret key + webhook secret | https://dashboard.stripe.com/test/apikeys |
| Gmail SMTP | App password | Google Account > Security > 2FA > App Passwords |
| Google OAuth | Client ID + secret | https://console.cloud.google.com/apis/credentials |
| SAML IdP | Entry point + cert | Okta/Auth0 dev account or samltest.id |
| Canvas | API URL + token | https://canvas.instructure.com > Account > Settings |
| Moodle | Site URL + WS token | Moodle Admin > Plugins > Web Services |

---

**Total Checkboxes: ~350+**  
**Every single one must pass before production deployment.**

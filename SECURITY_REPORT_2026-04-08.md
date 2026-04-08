# Intelligrade Security Assessment Report
Date: 2026-04-08
Assessor: GitHub Copilot (GPT-5.3-Codex)
Scope: Full web application security validation (auth, authorization, payments, grading flow, student portal, integrations, uploads, analytics, polling)
Environment: Local dev instance at http://localhost:3000

## Executive Summary
This assessment found multiple critical vulnerabilities that currently block safe production deployment.

- Total confirmed vulnerabilities: 39
- Critical: 6
- High: 11
- Medium: 18
- Low: 4
- Additional high-confidence latent risks: 5

Most serious themes:
1. Authentication and verification bypasses
2. Payment/subscription bypasses
3. Broken object-level authorization (IDOR)
4. Stored XSS sinks
5. Public/unauthenticated write/read APIs
6. SSRF-capable outbound webhook tests
7. Race-condition integrity failures and grade tampering paths
8. ZIP ingestion abuse (decompression amplification and ambiguous student mapping)
9. Unverified institution onboarding and domain squatting risk

## Methodology
- Manual route/code audit across routes, middleware, and EJS templates.
- Automated exploit harnesses executed against the running app with DB state verification.
- Multi-user adversarial tests using newly created professor and student accounts.
- Cross-tenant/cross-resource access checks.
- Upload abuse tests with malformed and unexpected file types.
- Valid-input vs malformed-input behavioral testing across numeric, enum, date, and large-body fields.
- Identifier enumeration probes and strictness checks (sequential IDs vs opaque identifiers).
- External tool-assisted testing with npm audit (SCA), autocannon, Artillery, and fast-check property-based fuzzing.

## Test Artifacts Created
- Base course id: 4
- Base exam id: 4
- Class session id: 1
- Poll id: 2
- Additional professor account used for cross-user abuse:
  - unverified.prof.1775651199305@example.com
- Additional student accounts used for authz tests:
  - victim.1775651199272@example.com
  - attacker.1775651199272@example.com
- Input validation scan artifacts:
  - course id 7
  - exam id 6
  - class session id 2
  - poll id 3
- ZIP abuse scan artifacts:
  - course id 9
  - exam id 9
- Domain squatting scan artifacts:
  - squatted domain: squatted-1775654341982.edu

## Confirmed Findings (Ordered by Severity)

### C1. Email Verification Bypass on Professor Login
Severity: Critical
Impact: Newly registered users can access professor dashboard without completing OTP verification.
Exploit Evidence:
- Register redirected to /verify-email
- Immediate login redirected to /dashboard
Affected Code:
- routes/auth.js:43
- routes/auth.js:52
- routes/auth.js:56
- routes/auth.js:137
- routes/auth.js:197
Fix:
- Enforce user.email_verified check in /login before session creation.
- Return explicit verification-required message and block access until OTP complete.

### C2. Paid Plan Activation Without Payment (Checkout Fallback)
Severity: Critical
Impact: Any authenticated user can activate paid subscriptions for free when Stripe is not configured.
Exploit Evidence:
- POST /checkout/create-session returned {"url":"/dashboard"}
- New active enterprise subscription created with amount: 0
Affected Code:
- routes/checkout.js:27
- routes/checkout.js:34
- routes/checkout.js:35
- routes/checkout.js:135
- routes/checkout.js:140
Fix:
- Remove direct activation fallback in production paths.
- If Stripe unavailable, fail closed with error.
- Gate payment-dependent plans behind successful verified payment intent/webhook.

### C3. Direct /subscribe Plan Activation Bypass
Severity: Critical
Impact: User can activate paid plans directly from /subscribe without payment processing.
Exploit Evidence:
- POST /subscribe plan=annual scope=individual created new active annual plan amount: 0
Affected Code:
- routes/auth.js:273
- routes/auth.js:284
- routes/auth.js:291
- routes/auth.js:312
Fix:
- Restrict /subscribe to free/trial only, or deprecate endpoint.
- Move all paid plan activations behind checkout success verification.

### C4. Cross-Course Submission Assignment Allowed
Severity: Critical
Impact: Submission records can bind exam from course A to student from course B.
Exploit Evidence:
- Submission created for examId=4 with studentId=11 (student belongs to a different course)
Affected Code:
- routes/submissions.js:62
- routes/submissions.js:72
- routes/submissions.js:80
- routes/submissions.js:86
Fix:
- On upload, verify every student_id belongs to exam.course_id.
- Reject request on any mismatch.

### C5. Student Can Submit Crib for Another Student and Before Grade Release
Severity: Critical
Impact: Student can submit regrade requests on someone else’s grade and before grades are released.
Exploit Evidence:
- Crib created with attacker student_id against victim grade_id while exam.grades_released=false
Affected Code:
- routes/student-portal.js:318
- routes/student-portal.js:331
- routes/student-portal.js:337
- release/deadline checks only in read flow: routes/student-portal.js:266, routes/student-portal.js:305
Fix:
- In POST /student/crib:
  - Load grade and verify grade -> submission -> student_id == enrollment.id
  - Verify grade belongs to exam_id in request
  - Enforce exam.grades_released and crib deadline server-side
  - Reject if ownership/release/deadline fails

### C6. Institution Domain Squatting Before Verification
Severity: Critical
Impact: Attacker can claim arbitrary institution domains and create admin-linked college records before proving email/domain ownership, blocking legitimate admins.
Exploit Evidence:
- Registering role=admin with attacker@squatted-1775654341982.edu redirected to /verify-email.
- College row for squatted-1775654341982.edu was created immediately while user.email_verified=false.
- Second admin registration attempt on same domain was blocked (redirect /register), demonstrating lockout impact.
Affected Code:
- routes/auth.js:80
- routes/auth.js:107
- routes/auth.js:117
Fix:
- Do not create College records during pre-verification register flow.
- Store pending institution request in temporary state; create College only after successful OTP verification and domain proof.
- Add cleanup/expiry for unverified pending registrations.
- Consider explicit domain-ownership verification for institution onboarding (e.g., DNS or email-admin challenge).

### H1. Student OTP Disclosed in Login Page
Severity: High
Impact: OTP secrecy is broken when dev mode OTP rendering is enabled.
Exploit Evidence:
- OTP visible in HTML after /student/request-otp
Affected Code:
- routes/student-portal.js:73
- routes/student-portal.js:88
- routes/student-portal.js:118
- views/student-login.ejs:51
- views/student-login.ejs:53
- views/student-login.ejs:54
Fix:
- Never render OTP in UI outside controlled local test mode.
- Add strict env gating (NODE_ENV + explicit DEV_OTP_EXPOSE=false default).

### H2. Professor Verification OTP Disclosed in Verify Page
Severity: High
Impact: Registration OTP visible in page body (same-session attacker or shoulder-surfing risk, critical in deployed debug mode).
Exploit Evidence:
- OTP displayed under “DEV MODE — Your OTP code”
Affected Code:
- routes/auth.js:149
- routes/auth.js:180
- views/verify-email.ejs:29
- views/verify-email.ejs:31
- views/verify-email.ejs:32
Fix:
- Remove OTP display in frontend in all non-test builds.

### H3. Session Fixation in Student OTP Login
Severity: High
Impact: Session ID does not rotate on authentication, enabling fixation attacks.
Exploit Evidence:
- connect.sid identical before and after /student/verify-otp success
Affected Code:
- routes/student-portal.js:79
- routes/student-portal.js:96
- routes/student-portal.js:98
Fix:
- Use req.session.regenerate() on successful student login before setting auth fields.

### H4. No OTP Brute-Force Throttling on Student Verify Endpoint
Severity: High
Impact: Unlimited OTP guesses; no lockout/backoff.
Exploit Evidence:
- 25 wrong OTP attempts, 0 rate-limited responses, correct OTP still accepted
Affected Code:
- routes/student-portal.js:79
- routes/student-portal.js:84
- server.js:85
- server.js:86
Fix:
- Apply rate limiter to /student/request-otp and /student/verify-otp.
- Add per-email and per-IP attempt counters with temporary lockout.

### H5. Unauthenticated Feedback Submission Accepted
Severity: High
Impact: Anyone can inject feedback records to active sessions/courses.
Exploit Evidence:
- POST /active-feedback/submit without auth returned success and created DB row
- autocannon POST run: 300 successful 2xx unauthenticated writes in 10s before global limiter started returning 429
- DB verification: 300 rows inserted with marker content=toolload
Affected Code:
- routes/active-feedback.js:57
Fix:
- Require authentication and enrollment/ownership checks.
- Validate session_id belongs to course_id and active session context.
- Add per-endpoint anti-spam controls (tight limits on unauth routes, not only global limiter).

### H6. Feedback Stats IDOR Across Professors
Severity: High
Impact: Any logged-in user can view feedback statistics for sessions they do not own.
Exploit Evidence:
- Secondary professor read stats for sessionId=1 of another professor
Affected Code:
- routes/active-feedback.js:73
Fix:
- In /api/stats/:sessionId, assert session.course.user_id == req.session.userId.

### H7. Stored XSS via Script-Embedded Exam JSON
Severity: High
Impact: Persistent JavaScript execution in professor pages by crafting exam names containing script-break payloads.
Exploit Evidence:
- Payload reflected in /grading and /analytics script context
Affected Code:
- views/grading.ejs:75
- views/analytics.ejs:157
- Similar sinks:
  - views/chat.ejs:61
  - views/exam-design.ejs:90
  - views/export.ejs:44
  - views/student-reports.ejs:54
Fix:
- Serialize data safely for script contexts (e.g., JSON.stringify + escaping of <, >, /, U+2028/U+2029).
- Prefer embedding JSON in data attributes or script[type="application/json"] with escaping helper.

### H8. Stored XSS in Course Detail Objectives/Syllabus
Severity: High
Impact: Persistent HTML/JS injection via objectives/syllabus fields.
Exploit Evidence:
- Payload reflected unescaped in /courses/:id
Affected Code:
- views/course-detail.ejs:27
- views/course-detail.ejs:35
Fix:
- Escape user content before HTML insertion.
- If formatting required, sanitize allowlist HTML server-side (e.g., DOMPurify on render pipeline).

### H9. SSRF Primitive in Slack/Discord Integration Test Hooks
Severity: High
Impact: User-controlled URLs are fetched by server, enabling internal network probing.
Exploit Evidence:
- Slack webhook set to http://127.0.0.1:1 and server attempted fetch
Affected Code:
- routes/integrations.js:202
- routes/integrations.js:211
- routes/integrations.js:228
- routes/integrations.js:237
Fix:
- Validate webhook host against strict allowlist.
- Block localhost/private CIDR/link-local/meta-data endpoints.
- Resolve DNS and re-check IP before connect.

### H10. Override Marks Not Capped to Rubric Maximum
Severity: High
Impact: Grade integrity can be arbitrarily inflated by setting override marks far above rubric limits.
Exploit Evidence:
- Override accepted with value 9999 on a question with rubric max 10; effective totals exceeded configured limits.
Affected Code:
- routes/review-queue.js:64
- routes/grading.js:164
- routes/grading.js:165
- routes/cribs.js:60
- routes/cribs.js:63
Fix:
- Enforce 0 <= override_marks <= rubric.max_marks everywhere override input is accepted.
- Validate against rubric context before save in all override/regrade paths.
- Add a final server-side invariant check when calculating persisted totals.

### H11. Open Redirect via Global Async Error Handler
Severity: High
Impact: A crafted failing request with attacker-controlled Referer can redirect authenticated users to external phishing domains.
Exploit Evidence:
- Triggered route error with Referer set to attacker domain; response redirected to external URL.
Affected Code:
- middleware/auth.js:80
- middleware/auth.js:81
Fix:
- Never redirect directly to raw Referer.
- Restrict redirects to relative in-app paths only.
- Fall back to a fixed safe route (e.g., /dashboard) when source is invalid.

### H12. ZIP Upload Allows Extreme Decompression Amplification (Archive Bomb Vector)
Severity: High
Impact: Small uploads can expand to very large extracted payloads, enabling disk/CPU pressure while staying below configured upload limits.
Exploit Evidence:
- ZIP of 81,795 bytes accepted and expanded to 83,886,080 bytes (ratio ~1025x) through /submissions/upload-zip.
- Expanded payload persisted as submission file without uncompressed-size guard.
Affected Code:
- routes/zip-upload.js:36
- routes/zip-upload.js:64
Fix:
- Enforce per-entry and total uncompressed byte limits before extraction.
- Reject archives above a maximum compression-ratio threshold.
- Stream extract with hard quotas and fail-safe cleanup on limit breach.

### M1. Active Feedback Live Page Publicly Accessible
Severity: Medium
Impact: Session details readable by unauthenticated users.
Exploit Evidence:
- GET /active-feedback/live/:sessionId returned 200 without auth
Affected Code:
- routes/active-feedback.js:49
Fix:
- Require authenticated and authorized viewer context, or use expiring public tokens.

### M2. Live Poll Results API Exposed Publicly
Severity: Medium
Impact: Poll participation totals and distribution can be enumerated without auth.
Exploit Evidence:
- GET /live-polls/api/results/:pollId returned counts and totals unauthenticated
Affected Code:
- routes/live-polls.js:109
Fix:
- Require auth/ownership or signed room token.

### M3. Unauthenticated Poll Response Spam
Severity: Medium
Impact: Poll integrity can be manipulated by bots.
Exploit Evidence:
- 20 unauthenticated responses accepted in burst
Affected Code:
- routes/student-portal.js:354
Fix:
- Require signed one-time poll participant token or authenticated session.
- Add per-room/IP throttling and duplicate suppression.

### M4. Cross-User Heartbeat Pollution
Severity: Medium
Impact: Active session metrics can be inflated for arbitrary exam IDs.
Exploit Evidence:
- Prof2 heartbeat for Prof1 exam; Prof1 observed active_sessions=2
Affected Code:
- routes/session-activity.js:40
- routes/session-activity.js:41
- routes/session-activity.js:46
- routes/session-activity.js:52
Fix:
- Enforce exam ownership in /heartbeat using assertExamOwner.

### M5. Submission Upload Accepts Non-PDF Content by Filename
Severity: Medium
Impact: Malformed payloads stored as submissions, causing pipeline failures and abuse.
Exploit Evidence:
- text/plain uploaded as .pdf accepted and persisted
Affected Code:
- routes/submissions.js:24
- routes/submissions.js:62
Fix:
- Validate MIME + magic bytes + parser probe before accept.

### M6. Course Documents Accept Arbitrary File Types
Severity: Medium
Impact: Unexpected file ingestion/storage; potential future exploit chain if downloaded/served.
Exploit Evidence:
- .js file uploaded and indexed successfully
Affected Code:
- routes/course-documents.js:20
- routes/course-documents.js:49
Fix:
- Add strict extension/mime allowlist and magic-byte checks.

### M7. CSV Parser Corrupts Valid Quoted Fields
Severity: Medium
Impact: Data integrity bug in roster import (name/roll/email shifted).
Exploit Evidence:
- "Doe, John",FIN001,john.final@example.com became name=Doe, roll=JOHN, email=fin001
Affected Code:
- routes/roster.js:23
- routes/roster.js:26
- routes/roster.js:29
Fix:
- Replace manual split(',') parser with robust CSV parser library supporting quoted fields.

### M8. Lenient Integer Parsing Accepts Malformed Identifiers
Severity: Medium
Impact: Malformed IDs are coerced and treated as valid records, weakening strict input contracts.
Exploit Evidence:
- /grading/boundaries/6abc returned 200 (same behavior as valid numeric id)
- /student-reports/generate?exam_id=6junk returned 200
- /submissions/upload accepted exam_id=6abc and created submission
- fast-check property fuzzing counterexample: requireInt accepted "60l" and returned 60
Affected Code:
- middleware/validate.js:2
- routes/submissions.js:63
- routes/student-reports.js:17
Fix:
- Replace parseInt-based permissive parsing with strict integer checks:
  - Accept only /^\d+$/
  - Use Number() and Number.isSafeInteger
  - Reject non-canonical forms (suffix/prefix garbage).

### M9. Lenient Float Parsing Accepts Malformed Numeric Input
Severity: Medium
Impact: Numeric fields partially parse malformed values (e.g., 77.5abc), causing silent coercion.
Exploit Evidence:
- /exams accepted total_marks=77.5abc and persisted 77.5
- /rubric accepted max_marks=4abc and persisted 4
- fast-check property fuzzing counterexample: requireFloat accepted "60l" and returned 60
Affected Code:
- middleware/validate.js:7
- routes/exams.js:31
- routes/rubric.js:43
Fix:
- Enforce strict decimal format with regex + finite numeric checks.
- Reject non-canonical numeric strings instead of truncating at first invalid character.

### M10. Unbounded Large Input Accepted on Public Write Endpoints
Severity: Medium
Impact: Public endpoints allow large payload writes, creating storage and abuse/DoS pressure.
Exploit Evidence:
- /active-feedback/submit accepted content length 500000
- /student/poll/:roomCode/respond accepted response length 500000
- Cross-tool load tests showed global limiter is reachable but still allowed first 300 unauthenticated writes in one 15-minute window per source IP
Affected Code:
- routes/active-feedback.js:57
- routes/student-portal.js:354
Fix:
- Add hard max length validation on content fields.
- Add strict route-level rate limiting and anti-abuse controls on public write endpoints.
- Consider async moderation/queueing for public inputs.

### M11. Predictable Numeric IDs Enable Public Enumeration
Severity: Medium
Impact: Public endpoints keyed by sequential IDs are easy to enumerate and scrape.
Exploit Evidence:
- Enumerating ids 1..10 found accessible resources on:
  - /active-feedback/live/:sessionId
  - /live-polls/api/results/:pollId
Affected Code:
- routes/active-feedback.js:49
- routes/live-polls.js:109
Fix:
- Replace public-facing sequential IDs with opaque identifiers (UUID/ULID/signed tokens).
- Keep internal numeric keys private; expose only non-guessable public IDs.

### M12. Race Condition Allows Duplicate Roll Numbers in Roster Add
Severity: Medium
Impact: Concurrent requests can create multiple students with same roll number in one course, corrupting roster integrity.
Exploit Evidence:
- Parallel /roster/add requests for identical roll_number created duplicate rows.
Affected Code:
- routes/roster.js:148
- routes/roster.js:161
- models/index.js:101
Fix:
- Add DB unique constraint for (course_id, roll_number) with null-safe policy.
- Wrap add flow in transaction and handle unique-constraint violations deterministically.

### M13. Race Condition Allows Duplicate TA Invites by Email
Severity: Medium
Impact: Same TA email can be invited multiple times to same course under concurrent requests.
Exploit Evidence:
- Parallel /ta/invite requests created duplicate invitation records.
Affected Code:
- routes/ta.js:96
- routes/ta.js:105
- models/index.js:267
Fix:
- Add unique constraint on normalized (course_id, email).
- Keep app-level pre-check but rely on DB uniqueness as source of truth.

### M14. Race Condition Allows Duplicate Crib Requests
Severity: Medium
Impact: Multiple pending crib records can be created for same grade/student pair, causing duplicate review workload and inconsistent outcomes.
Exploit Evidence:
- Parallel /student/crib requests created multiple crib rows despite duplicate check.
Affected Code:
- routes/student-portal.js:331
- routes/student-portal.js:337
- models/index.js:290
- models/index.js:291
Fix:
- Add unique constraint on (grade_id, student_id).
- Use transactional find-or-create semantics and return idempotent success for duplicates.

### M15. Unbounded Student Discussion Reply Size
Severity: Medium
Impact: Student discussion endpoints accept very large bodies, enabling storage abuse and application pressure.
Exploit Evidence:
- /student/discussion-reply/:threadId accepted ~400k character content and persisted it.
Affected Code:
- routes/student-portal.js:425
- routes/student-portal.js:431
- models/index.js:348
Fix:
- Enforce max content length and reject oversized replies.
- Apply route-level throttling and body-size safeguards.

### M16. Malformed course_id Coercion in Integrations Save
Severity: Medium
Impact: Non-canonical identifiers (e.g., 8garbage) are coerced to numeric IDs and accepted, weakening ID strictness and auditability.
Exploit Evidence:
- /integrations/save accepted malformed course_id and saved config under coerced numeric course.
Affected Code:
- routes/integrations.js:108
- routes/integrations.js:120
- routes/integrations.js:132
Fix:
- Replace parseInt coercion with strict integer validation (full-string numeric match).
- Reject non-canonical IDs with explicit validation errors.

### M17. ZIP Filename Fuzzy Matching Can Misassign Submissions to Wrong Student
Severity: Medium
Impact: Ambiguous filenames can map to less specific roll numbers, attaching submissions to incorrect student records.
Exploit Evidence:
- Filename 1234_extra.pdf mapped to student roll 123 instead of more specific roll 1234.
- Submission persisted under wrong student_id after /submissions/upload-zip.
Affected Code:
- routes/zip-upload.js:48
Fix:
- Remove substring-based fuzzy matching for identity-critical assignment.
- Require exact roll-number match or explicit mapping file (CSV/manifest).
- Route unmatched/ambiguous files to a manual review queue.

### M18. Student Email Enumeration via OTP Request Flow
Severity: Medium
Impact: Attackers can determine whether an email is enrolled as a student, enabling targeted phishing and account takeover attempts.
Exploit Evidence:
- POST /student/request-otp with known enrolled email returned 200 and OTP step page.
- Same endpoint with unknown email returned 302 redirect to /student/login.
- Distinct status/flow behavior leaks enrollment existence.
Affected Code:
- routes/student-portal.js:38
- routes/student-portal.js:47
- routes/student-portal.js:71
Fix:
- Return uniform response for both existing and non-existing emails (same status/body shape).
- Use generic message (e.g., "If this email exists, an OTP has been sent").
- Normalize timing and apply per-email/IP throttling.

### L1. Invalid Announcement Schedule Date Is Silently Coerced
Severity: Low
Impact: Invalid scheduled_for values publish immediately without validation error.
Exploit Evidence:
- scheduled_for=not-a-date-value accepted and announcement published now
Affected Code:
- routes/announcements.js:44
Fix:
- Validate ISO date-time format strictly; reject invalid schedule values.

### L2. Class Session Status Accepts Arbitrary Values
Severity: Low
Impact: Workflow state can be corrupted by unrecognized status strings.
Exploit Evidence:
- status=evil_state_123 persisted through /class-sessions/update/:id
Affected Code:
- routes/class-sessions.js:76
Fix:
- Enforce status allowlist (planned, in_progress, completed).

### L3. Grade Boundaries Allow Inverted/Invalid Ranges
Severity: Low
Impact: Boundary logic may become semantically invalid and produce incorrect grading outcomes.
Exploit Evidence:
- Boundaries saved with min_pct > max_pct
Affected Code:
- routes/grade-boundaries.js:53
- routes/grade-boundaries.js:63
Fix:
- Validate ranges, ordering, overlap, and 0..100 constraints before persistence.

### L4. Multiple Submissions Allowed per Student/Exam Without Version Policy
Severity: Low
Impact: Repeated uploads for same student/exam create parallel submissions without explicit attempt/version semantics, increasing grading ambiguity.
Exploit Evidence:
- Repeated uploads for same student and exam produced multiple active submission rows.
Affected Code:
- routes/submissions.js:62
- routes/submissions.js:86
- models/index.js:124
- models/index.js:136
Fix:
- Define policy explicitly:
  - either enforce one active submission per (exam_id, student_id), or
  - add attempt_no/versioning with deterministic latest-attempt selection.
- Add matching DB constraints for chosen policy.

## Additional High-Confidence Risks (Not Exploited in Current Runtime)

### R1. AI Report Rendering Sink (Conditional on LLM Enabled)
Risk: High
Reason:
- aiReport is rendered unescaped with HTML substitutions.
- If LLM output includes HTML/script-like payload and no sanitizer is applied, XSS is possible.
Affected Code:
- views/student-report-detail.ejs:68
Mitigation:
- Sanitize markdown/HTML output with a strict allowlist renderer.

### R2. Missing CSRF Protection Across State-Changing Endpoints
Risk: High
Reason:
- No CSRF middleware/tokens found in server/routes/views.
- Numerous POST endpoints mutate sensitive state.
Affected Scope:
- server.js, routes/*.js, views/*.ejs (no _csrf tokens observed)
Mitigation:
- Add CSRF middleware and hidden tokens to forms; enforce same-site protections and origin checks.

### R3. Insecure Session Secret Fallback
Risk: Medium-High
Reason:
- Runtime fallback secret string is hardcoded; environment observed with SESSION_SECRET unset.
Affected Code:
- server.js:27
Mitigation:
- Fail startup if SESSION_SECRET is absent in non-dev environments.

### R4. Known High-Severity Dependency CVEs in sqlite3 Toolchain
Risk: High
Reason:
- npm audit reports 7 vulnerabilities (5 high, 2 low), including tar path traversal/symlink issues in transitive chain via sqlite3 -> node-gyp -> make-fetch-happen/cacache/tar.
- Current direct dependency sqlite3@5.1.7 is flagged; suggested fix path requires major upgrade.
Affected Scope:
- package.json (sqlite3)
- transitive deps: node-gyp, make-fetch-happen, cacache, tar
Mitigation:
- Plan sqlite3 major-version upgrade in a compatibility branch and run full regression tests.
- Enable dependency scanning in CI with blocking policy for high/critical CVEs.
- Pin or override vulnerable transitives where safe until full upgrade is complete.

### R5. Vulnerable Embedded pdf.js Versions in pdf-parse Dependency Tree
Risk: High
Reason:
- Retire.js detected multiple high-severity pdf.js vulnerabilities (including CVE-2024-4367 and CVE-2018-5158 ranges) in versions bundled under pdf-parse.
- Affected parser code is used in document and submission processing paths.
Affected Scope:
- package.json (pdf-parse)
- bundled pdf.js artifacts under node_modules/pdf-parse/lib/pdf.js/*
Mitigation:
- Upgrade pdf-parse (or migrate to maintained parser stack) that bundles patched pdf.js versions.
- Add defense-in-depth for untrusted PDF handling (sandboxing, strict resource/time limits).
- Include Retire.js (or equivalent) in CI to catch embedded vendored-library CVEs.

## Identifier Hardening Strategy (Input-to-ID Design)
To satisfy strict valid-input behavior and reduce direct object reference abuse, use this model:

1. Internal IDs:
- Keep numeric auto-increment IDs only for internal joins.

2. External/Public IDs:
- Add public_id columns (UUIDv4 or ULID) for user-exposed resources.
- Route all public endpoints by public_id, not integer id.

3. Canonical Validation:
- For integer-only internal params, require exact numeric strings.
- For public IDs, require exact UUID/ULID regex and length.

4. Authorization Binding:
- Every ID lookup must be combined with ownership/enrollment scope in the same query.

5. Migration Order:
- Add public_id nullable + backfill + unique index
- Update routes to resolve by public_id
- Deprecate numeric ID exposure in templates and APIs

Priority candidates:
- active feedback live and stats identifiers
- poll results identifiers
- any endpoint currently accepting externally supplied sequential IDs without opaque mapping

## Race Conditions and DB Constraint Gaps
Observed pattern:
- Multiple write endpoints perform check-then-create logic without atomic DB enforcement, enabling duplicate records under concurrency.

Confirmed affected flows:
- Roster add duplicate roll numbers: app pre-check in routes/roster.js but no unique DB guarantee in Student model.
- TA invite duplicate email per course: app pre-check in routes/ta.js but no unique (course_id, email) guarantee.
- Student crib duplicate requests: app pre-check in routes/student-portal.js but no unique (grade_id, student_id) guarantee.
- Submission duplicates: no one-submission policy enforced at route or DB level.

Required hardening:
- Add unique constraints for invariants that must hold under concurrency.
- Keep app-level checks for UX, but treat DB uniqueness + transaction handling as authoritative.
- Catch and map unique-constraint errors to deterministic user-facing responses.

## Root Cause Patterns
1. Security checks concentrated in some routes but missing in adjacent APIs.
2. UI-level guards not mirrored by server-side authorization constraints.
3. Dev-mode conveniences (OTP display, direct subscriptions) not safely gated.
4. Unescaped rendering in HTML/script contexts for user-controlled data.
5. Inconsistent input validation for file uploads and CSV parsing.
6. Permissive numeric parsing (parseInt/parseFloat) leading to malformed input coercion.
7. Missing enum/date/range schema validation on several write paths.
8. Public-facing sequential IDs enabling enumeration.
9. Non-atomic check-then-create flows without enforcing DB uniqueness constraints.
10. Trust of unvalidated request metadata (Referer) in redirect decisions.
11. Missing upper-bound validation against rubric-defined scoring limits.
12. Dependency hygiene gaps allowing known high-severity transitive or embedded-library CVEs to persist.
13. ZIP archive processing lacks decompression quotas and deterministic identity mapping rules.
14. Privileged institution resources are created before identity/domain verification completes.
15. Authentication flows leak account existence through response differences.

## Priority Remediation Plan

### Phase 0 (Immediate Hotfixes: Block Production Release)
- Fix C1, C2, C3, C4, C5 first.
- Fix C6 by deferring institution creation until verification and domain proof.
- Disable OTP display in all non-local environments.
- Disable integration test webhooks or enforce allowlist immediately.
- Cap override marks by rubric max in all override/regrade routes.
- Remove external redirect possibility from global error handler.

### Phase 1 (Within 48-72 hours)
- Add authz checks for active feedback and session heartbeat endpoints.
- Patch script-context and HTML-context XSS sinks.
- Add OTP rate limiting and session regeneration in student login.
- Add DB uniqueness + transactional handling for roster roll numbers, TA invites, and crib dedup.
- Harden /submissions/upload-zip with extraction quotas and exact/manifest-based student mapping.
- Make OTP request flows enumeration-safe with uniform responses and timing.

### Phase 2 (Within 1 week)
- Introduce CSRF protections globally.
- Harden upload validation using magic-byte checks.
- Replace roster CSV parser with robust library.
- Replace permissive numeric parsing with strict validators.
- Add schema validation for enums, dates, and boundary ranges.
- Introduce opaque public identifiers for externally reachable resources.
- Add strict length limits on student discussion/public text endpoints.
- Define and enforce submission versioning/uniqueness policy.
- Execute dependency upgrade plan for sqlite3 chain and patch known high-severity CVEs.
- Upgrade PDF parsing stack to remove vulnerable embedded pdf.js builds.

### Phase 3 (Hardening)
- Add central authorization helpers and policy tests for all routes.
- Add security integration tests in CI for all discovered exploit patterns.
- Add deployment guardrails: mandatory secrets, strict env checks, secure defaults.

## Suggested Regression Test Matrix (Must-Pass Before Deploy)
1. Unverified user cannot login.
2. Paid plan cannot activate without verified payment event.
3. Student cannot crib other student grade and cannot crib before release/deadline.
4. Cross-course student submission blocked.
5. Script payloads in course/exam fields remain inert.
6. Public endpoints cannot write sensitive data without auth.
7. OTP verify endpoints enforce throttling and lockout.
8. Upload rejects malformed or disallowed files.
9. CSV quoted fields import correctly.
10. Malformed numeric IDs like 6abc are rejected on all strict-ID endpoints.
11. Malformed numeric floats like 77.5abc are rejected everywhere.
12. Invalid scheduled dates and invalid status enums are rejected with explicit validation errors.
13. Public endpoints enforce opaque non-enumerable identifiers and cannot be scraped by sequential probing.
14. Override marks above rubric max are rejected in review queue, grading review, and crib resolution.
15. Any route error ignores external Referer and redirects only to internal safe paths.
16. Parallel roster add requests cannot create duplicate (course_id, roll_number) rows.
17. Parallel TA invite requests cannot create duplicate (course_id, email) rows.
18. Parallel crib submissions cannot create duplicate (grade_id, student_id) rows.
19. Repeated uploads follow explicit single-submission or versioned-attempt policy.
20. CI dependency scan fails builds when high/critical CVEs are introduced.
21. ZIP uploads exceeding decompression ratio or uncompressed-size quotas are rejected safely.
22. ZIP file-to-student mapping never uses substring heuristics; ambiguous names require manual mapping.
23. Admin/institution registration cannot create or reserve domain-owned college records before verification.
24. OTP request endpoint returns indistinguishable responses for known vs unknown student emails.

## Final Deployment Verdict
Current status: Not safe for production deployment.
Required: Remediate all Critical and High findings, then re-run full security regression before release.

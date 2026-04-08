Part 2: Core Platform Architecture — The New Vision
Intelligrade must evolve from "AI grading tool" to Course Intelligence Platform. The product has three layers:
Layer 1 — GRADING ENGINE      (what you have)
Layer 2 — COURSE OPERATING SYSTEM   (what you're building)
Layer 3 — LEARNING INTELLIGENCE NETWORK  (the moat)
Every feature below maps to one of these layers.

Part 3: Feature Blueprint — New and Enhanced Features
3.1 RAG CORE — Course Knowledge Base (Foundation for Everything)
Every AI feature in Intelligrade must be grounded in RAG over a per-course document corpus. This is the architectural spine.
What goes into the RAG index per course:

All uploaded lecture slides (PDF/PPT extracted as text + slide-by-slide chunks)
Assignment question papers and model answers
Student submissions (anonymized, for concept gap analysis)
Past exam papers
Course syllabus and objectives
Discussion board threads (from native board or Moodle import)
Professor-authored notes and announcements
Rubric key points and grading history

How it works:

On upload, each document is chunked, embedded (using a sentence-transformer model), and stored in a vector store (Chroma or pgvector in PostgreSQL)
Every AI call (grading, assistant, analytics, exam design) retrieves relevant chunks before generating output
This means the AI assistant is no longer generic — it answers questions grounded in what was actually taught in this course

Why this is new: No grading platform currently does retrieval-augmented grading. Gradescope does not use course material as context. Intelligrade can grade a student's answer not just against a rubric, but against the actual lecture content — detecting when a student uses a concept from a later slide the professor had not yet taught, or when they apply a method from the textbook that was not covered.

3.2 GRADING ENGINE — Upgraded
3.2.1 Multi-Modal Assignment Types
Extend grading beyond handwritten PDFs:

Code assignments: Upload source files (.py, .java, .cpp, .js). Run sandboxed execution against professor-supplied test cases (Docker container per submission). Score on test case pass rate + static analysis (code style, complexity). Partial credit for logic correctness if syntax errors prevent execution.
Jupyter Notebooks: Accept .ipynb files. Execute cells, capture outputs, compare against expected outputs. Grade data science and ML assignments properly.
CAD/diagram assignments: Accept images of circuit diagrams, ER diagrams, flowcharts. Use vision model to identify components and match against rubric criteria (e.g., "contains a primary key", "resistor in series").
Math and physics derivations: Detect LaTeX-style notation in handwritten scans. The vision model already handles this partially — extend to recognize integral signs, matrices, Greek symbols, and verify steps in multi-step derivations.
Short audio submissions: Accept voice recordings (MP3/WAV). Transcribe via Whisper, then grade the transcript. Useful for language courses and oral examination scenarios.

3.2.2 RLHF Pipeline — The Self-Improving Grader
Every time a professor overrides an AI grade, that event is captured as a training signal.
The pipeline:

Override event fires → captured as: {ocr_text, rubric, ai_grade, ai_reasoning, professor_override, override_note}
Data is stored in an OverrideLog table
Periodically (weekly batch), override logs are formatted as preference pairs: the AI's original response vs. a corrected response derived from the override
These pairs are used to fine-tune the grading LLM using Direct Preference Optimization (DPO) or supervised fine-tuning on the corrected output
The fine-tuned model version is tagged and deployed; the system tracks which model version produced each grade

Why this is a moat: Every grading session makes the model better. After 6 months of usage across 50 professors, Intelligrade has a proprietary fine-tuned model that no competitor can replicate. This is the data flywheel that makes the product defensible.
Implementation note: Start with collecting data aggressively. Even before formal fine-tuning, use override data to build a retrieval-augmented correction system — when grading a new answer, retrieve the 3 most similar past answers that were overridden and include those corrections as few-shot examples in the prompt.
3.2.3 Confidence-Gated Human Review
Introduce a review queue based on confidence thresholds:

Grades with confidence < 0.6 are flagged for mandatory human review before being finalized
A "Review Queue" dashboard shows all flagged grades with one-click approve/override
Professors can set their confidence threshold per exam (strict vs. lenient review)
This reduces AI errors that reach students and builds trust in the system



3.3 TA WORKFLOW — Collaborative Grading Engine
This is a major gap in every competitor. Build it properly.
3.3.1 TA Registration and Role Model

Professors invite TAs by email. TAs accept and are linked to the course.
TA roles: head_ta (can assign work, see all grades), ta (can grade assigned submissions only)
Professors can have multiple TAs per course. TAs can be assigned to multiple courses.

3.3.2 Smart Assignment Engine
Three modes for assigning submissions to TAs:

Question-based assignment: Professor assigns Q3 and Q4 to TA Riya, Q5 and Q6 to TA Arjun. Each TA only sees their assigned questions across all submissions. This is the standard Gradescope-style model.
Student-batch assignment: Professor uploads a roll-number list per TA (or uses enrollment sections). Each TA grades all questions for their assigned students. Useful for tutorial-section-based TA structures.
AI-suggested assignment: The system analyzes TA performance history (grading speed, override rate, subject matter of past cribs) and suggests optimal question-to-TA mapping. A TA who has been overridden frequently on theory questions gets assigned numerical/computational questions instead.

3.3.3 TA Calibration Session
Before batch grading begins, run a calibration flow:

Professor grades 5 sample submissions
Each TA independently grades the same 5 submissions
System computes inter-rater reliability (Cohen's Kappa or simple agreement %)
Flags TAs who are outliers (too lenient or too strict vs. professor baseline)
Professor can recalibrate before opening the full batch

This is genuinely novel — no grading platform currently has automated TA calibration.
3.3.4 TA Performance Dashboard

Per-TA metrics: submissions graded, average time per submission, override rate (how often their grades get changed by professor or crib), consistency score
Helps professors identify TAs who need guidance
TA can see their own metrics


3.4 CRIB / REGRADE PORTAL — Industry First
No platform handles this systematically. This is a massive pain point in Indian universities.
3.4.1 Student Crib Submission

Students log into the student portal (see Section 3.6), view their graded paper, and submit a crib for specific questions
Crib form captures: question number, student's reasoning for why they deserve more marks, optional file attachment (additional working, reference material)
Deadline-gated: professor sets a crib window (e.g., 48 hours after grade release)

3.4.2 AI Pre-Screening of Cribs
Before any human sees the crib:

AI re-reads the student's answer using the original rubric
AI re-reads the student's crib reasoning
AI produces a recommendation: {uphold_crib: bool, suggested_marks: int, reasoning: string, confidence: float}
High-confidence recommendations (> 0.8) are flagged as "likely valid" or "likely invalid"
This pre-screening reduces the crib review workload by 60-70%

3.4.3 Crib Routing

AI-resolved cribs (high confidence, small mark changes) → routed to TA for rubber-stamp approval
Complex cribs (conceptual disagreements, low AI confidence) → routed directly to professor
Professor can override AI routing at any point

3.4.4 Crib Analytics

Which questions generate the most cribs? (signals poorly written rubric or ambiguous question)
What is the crib acceptance rate per question, per TA?
Are certain students repeatedly filing cribs? (signals at-risk students who need counseling)
Trend over exams: is the crib rate increasing? (signals course delivery issues)


3.5 COURSE MANAGEMENT LAYER
3.5.1 Student Portal
Students get a read-only but rich view of their academic life in the course:

Enrolled courses (imported from Moodle or manually added)
Assignments dashboard: pending, submitted, graded. Each shows deadline, submission status, grade (when released).
Graded paper viewer: Student can see their scanned answer, with AI annotations overlaid — green highlights on matched rubric points, red highlights on missing points, feedback inline.
Score timeline: Line chart of their performance across all exams in the course.
Concept mastery view: Which concepts are they strong/weak on, based on the knowledge graph.
Crib portal: Submit and track cribs (see above).
Announcements feed: Notifications from professor.

Critical: Students should never see other students' grades, answers, or names. Strict row-level security enforced at the database layer.
3.5.2 Moodle Integration — Proper LTI + REST
Instead of scraping, implement two integration modes:
Mode 1 — LTI 1.3 Provider: Intelligrade registers as an LTI tool. From inside Moodle, faculty launch Intelligrade for any assignment. Grades automatically write back to the Moodle gradebook via the LTI Advantage Grades service. Students are auto-enrolled via LTI roster sync. This is the standard, robust, non-fragile integration method.
Mode 2 — Moodle REST API: For institutions where LTI setup is not feasible, use Moodle's web services REST API (which most Moodle instances expose) to: pull enrolled student lists, pull submitted assignments, push grades back. Requires a Moodle API token from the institution's admin.
What to sync:

Student roster (name, roll number, email, section)
Assignment submissions (PDF attachments)
Grade passback after grading is complete
Course announcements (send from Intelligrade, appear in Moodle too)

3.5.3 Piazza Replacement — Native Discussion Board
Build a lightweight but powerful discussion board inside Intelligrade:

Thread types: Question, Announcement, Poll, Resource
Concept tagging: Every thread can be tagged with concepts from the knowledge graph. Over time, this builds a per-concept discussion archive that feeds RAG.
AI moderation: The AI assistant monitors new posts, can auto-answer common questions using RAG over course material, and flags posts that require professor attention.
Anonymous posting: Students can post anonymously to professor but identity is visible to the professor (Piazza-style). Peer responses are fully visible.
Piazza import: One-time import of existing Piazza class folders via JSON export (Piazza allows this). Parse threads, tag them to concepts, ingest into the native board.
Moodle forum sync: Optionally mirror posts to the Moodle forum via REST API.

3.5.4 Slides and Resource Management

Upload lecture slides (PDF, PPTX). The system extracts text per slide, generates a thumbnail, and indexes content for RAG.
Tag slides with concepts (AI auto-suggests, professor confirms).
Students can view slides inside the portal (no download if professor disables it).
Slide-to-concept mapping: Each slide set is linked to the concepts it covers. The knowledge graph shows which lectures covered which concepts. If a student scores low on a concept, the portal shows them which slides to revisit.
Slide annotation: Professors can attach notes to specific slides that are visible to students after class.

3.5.5 Google Calendar Integration

Every assignment deadline, exam date, grade release, and crib window creates a Google Calendar event.
Events are pushed to a shared course calendar (professor sees all, students see their own deadlines).
OAuth 2.0 flow to connect professor's Google account. Students can subscribe to the course calendar via a one-click ICS link (no OAuth required for students — just a calendar feed URL).
Reminder emails 24 hours before deadline (uses existing Nodemailer infrastructure).
No hard dependency: If Google Calendar is not connected, deadlines still show in the native Intelligrade calendar view.

3.5.6 Announcements and Email Workflow

Professor composes announcements inside Intelligrade.
Announcement is: (1) posted to the native discussion board, (2) emailed to all enrolled students, (3) synced to Moodle forum if connected, (4) posted as a Google Calendar event if date-specific.
Assignment activity triggers: When a new assignment is created, or when grades are released, automated notifications fire through all connected channels.
Smart scheduling: Professor can schedule announcements for a future time. Useful for releasing assignment details at the start of class.


3.6 ACTIVE ENGAGEMENT LAYER
3.6.1 Live Polls (Clicker Replacement)

Professor opens a poll during class (from the copilot sidebar or dedicated Engagement tab).
Students join via a 6-character room code on their phone (no app needed — mobile-web).
Poll types: MCQ, word-cloud (free text aggregated), confidence rating (1-5 on "how well do you understand this concept"), ranked choice.
Results update in real-time (WebSocket). Professor sees live response rate and distribution on their screen.
Concept-linked: Each poll question is tagged to a concept. Results are stored in the knowledge graph as engagement data points.
Post-class storage: All poll data is saved. The engagement timeline shows which concepts students felt confident about vs. confused by.

3.6.2 Exit Tickets (Post-Concept Feedback)
After marking a concept as "covered" in a class session:

System auto-generates a 3-question exit ticket: 1 factual recall question, 1 conceptual understanding question, 1 confidence self-rating.
Questions are AI-generated using RAG over the slides for that concept.
Students complete it on their phone in under 2 minutes.
Professor receives a real-time summary: average understanding score, most common misconception (extracted from free-text responses), recommended follow-up action.

3.6.3 Pre-Class Readiness Check
Before each class session, professor can trigger a 2-question readiness poll:

"Did you complete the assigned reading for today?"
One conceptual question on prerequisite material.
Helps professor adjust their lecture depth in real-time based on actual student readiness.

3.6.4 Class Session Manager
A structured record for each class meeting:

Start and end time
Concepts planned to cover (pulled from syllabus/course plan)
Concepts actually covered (professor marks during/after class)
Resources used (linked slides, links)
Polls conducted and results
Exit ticket summary
Professor's notes for the session

This creates a structured teaching journal. Over the semester, the professor can see which topics were covered when, how long each took vs. planned, and how student understanding tracked.
3.6.5 Concept Coverage Health Dashboard
A visual dashboard showing:

Which concepts from the syllabus have been covered, and in how many class sessions.
Concept understanding score (from polls + exit tickets + assignment performance).
Concepts "at risk" — covered but showing low understanding signals.
Pacing indicator: Are you on track to cover all syllabus concepts before the end of semester?
AI recommendation: "Students show low understanding of Dynamic Programming after 2 coverage sessions. Consider an additional worked example before the next assignment."


3.7 KNOWLEDGE GRAPH — LEVEL 2
Extend the existing knowledge graph from a grading analytics tool to a full learning intelligence system.
3.7.1 Multi-Source Concept Evidence
Currently concepts are extracted only from rubric questions. Expand evidence sources:

Slides: Concept appears in lecture → concept has a "taught" evidence node
Polls/Exit tickets: Concept was tested for live understanding → adds engagement evidence
Assignments: Concept appeared in assignment → adds assessment evidence
Discussions: Concept was discussed in the forum → adds discussion evidence
Student submissions: Concept appeared in student answer → adds application evidence

Each concept node now has a richness score based on how many evidence types it has. A concept that was taught, discussed, assessed, and appears in student work is well-integrated. A concept that only appears in one assignment with no slide coverage is a syllabus gap.
3.7.2 Prerequisite Graph
Professor defines (or AI suggests) concept prerequisites. E.g., "Binary Search Trees" requires "Tree Traversal" which requires "Recursion."
The knowledge graph becomes a directed acyclic graph (DAG). This enables:

Root cause analysis: Student is weak on Binary Search Trees → trace back through prerequisite chain → root weakness is actually Recursion, not BST specifically.
Learning path recommendations: Surface the prerequisite path a student needs to address.
Lecture ordering validation: If slides cover BST before Recursion, flag the ordering conflict.

3.7.3 Cohort vs. Individual Concept View

Cohort view: Heatmap of concept mastery across all students. Identifies class-wide gaps vs. individual gaps.
Individual view: Student sees their own concept mastery profile (no other students' data).
Section comparison: If multiple sections of the same course exist, compare concept mastery across sections to identify TA or teaching quality differences.

3.7.4 Concept Trajectory Over Time
Plot concept mastery across all exams in a semester. This shows:

Is mastery improving across the semester (learning is happening)?
Is mastery declining on previously strong concepts (forgetting curve)?
Concepts that peak at exam time and drop after (cramming vs. retention).

No platform shows this. It is the difference between a gradebook and a learning diagnostic.
3.7.5 End-of-Course Concept Report
Auto-generated PDF at semester end:

Which concepts the cohort mastered, partially mastered, or failed to grasp.
Which teaching interventions (slides, extra sessions, assignments) correlated with mastery improvement.
Recommendations for next semester: concepts to spend more time on, concepts that can be reduced.
Per-student learning gap summary for academic counselors.


3.8 AI ASSISTANT — UPGRADED COPILOT
The existing floating copilot is a good start. Extend it significantly.
3.8.1 Full Voice Control with Action Execution
The existing Web Speech API integration is a foundation. Upgrade to full action execution:
Voice command → intent classification → action executed on screen, with visual confirmation.
Supported voice actions:

"Grade all pending submissions for Exam 2" → triggers batch grading
"Show me the students below 40% in this exam" → filters and highlights them
"Create a new exam called Mid-Semester with 5 questions" → opens exam creation pre-filled
"Send grade results to all students" → triggers bulk email with confirmation dialog
"What is the class average for Question 3?" → reads answer aloud and shows chart
"Flag Ravi Kumar's submission for review" → adds a review flag
"Show me the knowledge graph for this course" → navigates to knowledge graph view
"Add a poll question: What is the time complexity of merge sort?" → creates a live poll
"Generate a rubric for this question paper" → triggers auto-rubric generation

Feedback loop: Every voice command that fails or is misunderstood is logged. Professor can correct the interpretation. This data trains the intent classifier over time.
3.8.2 Pre-Class Briefing
At the start of each class session (triggered by professor clicking "Start Class"), the assistant generates a 60-second briefing:

"Last class you covered Dijkstra's Algorithm. Exit ticket showed 62% confidence. 3 students asked follow-up questions on negative weights. Today you're planning to cover Bellman-Ford. Recommend spending 5 minutes revisiting the limitation of Dijkstra before introducing Bellman-Ford."

This is grounded in actual class data. It is the equivalent of a research assistant who reads all your notes before every meeting.
3.8.3 Post-Class Debrief
After ending a class session:

"Today you covered Dynamic Programming (Memoization). Average exit ticket score: 3.2/5. Main confusion: students conflated memoization with tabulation. 7 students did not complete the exit ticket. Suggested action: post a short clarification note and assign a practice problem before next class."

3.8.4 Assignment Design Assistant
Professor describes what they want to test: "I want to test students on graph algorithms with a focus on time complexity analysis, medium difficulty, 20 marks total."
The assistant:

Retrieves relevant slides and past paper questions via RAG
Drafts 3 candidate questions with mark distributions
Suggests a rubric for each
Highlights which concepts from the knowledge graph each question covers
Warns if the assignment over-tests concepts that were already heavily covered in the last exam


3.9.3 Integrity Analytics

Submission timing patterns: Did 20 students submit within 2 minutes of each other? (Possible sharing)
IP address clustering: Did multiple submissions originate from the same IP?
Edit history anomalies: For digital submissions, were all edits made in a 10-minute window before deadline? (Copy-paste signal)

These are data points, not verdicts. Present them transparently.

3.10 COURSE NOTEBOOK
A native rich-text notebook per course, replacing the Notion embed idea.

Structure: Each notebook is organized by concept (pulled from the knowledge graph). Each concept has a page where professor can write notes, embed images, link to slides, and attach example problems.
Student access: Professor can selectively publish notebook pages to students (e.g., "release after lecture on this concept").
RAG indexing: Every notebook entry is embedded and indexed. The AI assistant draws from notebook content when answering student questions.
Collaborative: TAs can contribute to notebook pages (with professor approval before publishing).
Version history: Every edit is versioned. Professor can see what changed and when.
Notion import: One-time import from Notion via their API (Notion has a proper documented API). Converts pages to the notebook format.


Part 4: Pricing Model
Principles

India-first, INR only for now. No USD toggle needed until you have international demand.
Transparent, self-serve. A professor should be able to sign up and pay with a credit/UPI without talking to anyone.
Based on two dimensions: (1) number of students in the course, (2) number of months the course runs.
Colleges pay per faculty seat, not per institution. This lets you sell to individual HODs without waiting for university-wide procurement.

Plan Structure
PlanTargetBase PriceInclusionsStarterSingle faculty, 1 course₹0 forever1 course, 1 exam, 10 paper evaluations, no student portalFaculty ProIndividual faculty₹499/monthUp to 3 courses, unlimited exams, 200 evaluations/month, student portal, TA workflow, knowledge graphFaculty Pro — ExtendedPer course add-on₹199/month/course beyond 3Same features, additional coursesDepartment5-15 faculty in a dept₹3,999/monthUp to 15 faculty seats, all features, Moodle LTI integration, priority supportInstitutionUniversity-wideCustom / ₹14,999–₹49,999/monthUnlimited faculty, SSO, dedicated instance option, API access, RLHF contribution program
Student-Count Pricing Add-on
Courses with large enrollments consume more compute. Apply a usage surcharge:

1–60 students: included in base plan
61–150 students: +₹199/month per course
151–300 students: +₹499/month per course
300+ students: custom pricing

Course Duration Pricing
Courses are activated for a semester (defined as 4 or 6 months). Faculty selects duration on course creation. The system charges the monthly rate × selected months upfront, with a 10% discount for full-semester payment.
Annual Discount
20% discount on Faculty Pro and Department plans when billed annually.
Coupons

LAUNCH30: 30% off first 3 months
DEPT2025: First month free for department plans

What to Remove from Free Tier
The current free tier is too generous (all AI features included, just limited to 10 evaluations). This trains users to expect everything free. Revised free tier:

1 course, 1 exam, 10 evaluations only
No student portal, no TA workflow, no knowledge graph, no engagement tools
Show the premium features as previews with a clear upgrade prompt


Part 5: Technical Architecture Decisions
5.1 Database Migration (Priority 1)
Move from SQLite to PostgreSQL immediately. Use pgvector extension for RAG embeddings. This is not optional for a production system. Sequelize supports PostgreSQL with minimal model changes.
5.2 Background Job Queue
Batch grading, RAG indexing, RLHF data processing, and email sending are all async operations. Add a proper job queue (Bull + Redis, or Bree for a Node-native option). Never run long operations in Express request handlers.
5.3 Sandboxed Code Execution
For code grading, run student submissions in isolated containers. Use Docker with resource limits (CPU, memory, time) per execution. Never run untrusted code on the main application server.
5.4 Vector Store for RAG
Add pgvector to PostgreSQL. Embed all course documents using a sentence-transformer model (e.g., all-MiniLM-L6-v2 via Hugging Face). Store embeddings in the vector store. Use cosine similarity retrieval before every LLM call.
5.5 WebSocket for Live Features
Live polls, real-time grading progress, and multi-session awareness all need WebSockets. Add socket.io to the Express server. The existing heartbeat polling API should be replaced with a proper WebSocket connection.
5.6 Mobile-Responsive Student Portal
The student portal is a mobile-first use case. Students check grades and complete polls on phones. Ensure the student-facing pages are fully responsive and work on low-end Android devices.

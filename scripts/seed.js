require('dotenv').config();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const {
  sequelize, College, User, Subscription, Course, Exam, Student, Rubric,
  Submission, Grade, ChatMessage, GradeBoundary, ConceptNode, QuestionConcept,
  OverrideLog, CourseTA, Crib, Announcement, CourseDocument,
  DiscussionThread, DiscussionPost, LivePoll, PollResponse, ClassSession,
  LearningObjective, ActiveFeedback, IntegrationConfig,
} = require('../models');

function rand(min, max) { return Math.random() * (max - min) + min; }
function randInt(min, max) { return Math.floor(rand(min, max + 1)); }
function pick(arr) { return arr[randInt(0, arr.length - 1)]; }
function roomCode() { return crypto.randomBytes(3).toString('hex').toUpperCase().substring(0, 6); }
function daysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return d; }
function daysFromNow(n) { const d = new Date(); d.setDate(d.getDate() + n); return d; }

const MOCK_STUDENTS = [
  { name: 'Aarav Sharma', roll: 'CS2024001', email: 'aarav.s@techacademy.edu' },
  { name: 'Priya Patel', roll: 'CS2024002', email: 'priya.p@techacademy.edu' },
  { name: 'Rohan Gupta', roll: 'CS2024003', email: 'rohan.g@techacademy.edu' },
  { name: 'Sneha Reddy', roll: 'CS2024004', email: 'sneha.r@techacademy.edu' },
  { name: 'Vikram Singh', roll: 'CS2024005', email: 'vikram.s@techacademy.edu' },
  { name: 'Ananya Iyer', roll: 'CS2024006', email: 'ananya.i@techacademy.edu' },
  { name: 'Karan Mehta', roll: 'CS2024007', email: 'karan.m@techacademy.edu' },
  { name: 'Divya Nair', roll: 'CS2024008', email: 'divya.n@techacademy.edu' },
  { name: 'Arjun Kumar', roll: 'CS2024009', email: 'arjun.k@techacademy.edu' },
  { name: 'Meera Joshi', roll: 'CS2024010', email: 'meera.j@techacademy.edu' },
  { name: 'Siddharth Rao', roll: 'CS2024011', email: 'sid.r@techacademy.edu' },
  { name: 'Pooja Verma', roll: 'CS2024012', email: 'pooja.v@techacademy.edu' },
  { name: 'Ravi Teja', roll: 'CS2024013', email: 'ravi.t@techacademy.edu' },
  { name: 'Nisha Gupta', roll: 'CS2024014', email: 'nisha.g@techacademy.edu' },
  { name: 'Aditya Chopra', roll: 'CS2024015', email: 'aditya.c@techacademy.edu' },
  { name: 'Ishita Banerjee', roll: 'CS2024016', email: 'ishita.b@techacademy.edu' },
  { name: 'Rahul Mishra', roll: 'CS2024017', email: 'rahul.m@techacademy.edu' },
  { name: 'Kavya Krishnan', roll: 'CS2024018', email: 'kavya.k@techacademy.edu' },
  { name: 'Deepak Yadav', roll: 'CS2024019', email: 'deepak.y@techacademy.edu' },
  { name: 'Shruti Agrawal', roll: 'CS2024020', email: 'shruti.a@techacademy.edu' },
];

const COURSES = [
  { name: 'Data Structures & Algorithms', code: 'CS301', semester: 'Fall 2025', section: 'A', description: 'Fundamental data structures and algorithmic paradigms.', objectives: 'Master arrays, linked lists, trees, graphs, sorting, searching, dynamic programming, and algorithmic complexity analysis.', department: 'Computer Science', syllabus: 'Week 1-2: Arrays, Strings. Week 3-4: Linked Lists, Stacks, Queues. Week 5-6: Trees (BST, AVL, RB). Week 7-8: Graphs, BFS/DFS. Week 9-10: Dynamic Programming. Week 11-12: Greedy Algorithms. Week 13-14: Advanced Topics & NP-completeness.' },
  { name: 'Database Management Systems', code: 'CS302', semester: 'Fall 2025', section: 'A', description: 'Relational database design, SQL, normalization, transactions, and distributed systems.', objectives: 'Design normalized schemas, write complex SQL, understand ACID properties, indexing, and query optimization.', department: 'Computer Science', syllabus: 'Week 1-3: ER Modeling, Relational Algebra. Week 4-6: SQL Deep Dive. Week 7-8: Normalization (1NF-BCNF). Week 9-10: Transactions, ACID, Concurrency. Week 11-12: Indexing, B+ Trees. Week 13-14: NoSQL, NewSQL, Distributed DB.' },
  { name: 'Operating Systems', code: 'CS303', semester: 'Fall 2025', section: 'B', description: 'Process management, memory, file systems, synchronization, and system design.', objectives: 'Understand processes, threads, deadlocks, paging, virtual memory, and file system internals.', department: 'Computer Science', syllabus: 'Week 1-2: System Calls, OS Architecture. Week 3-4: Processes, Threads. Week 5-6: CPU Scheduling Algorithms. Week 7-8: Synchronization, Deadlocks. Week 9-10: Memory Management, Paging. Week 11-12: File Systems, I/O. Week 13-14: Security, Virtualization.' },
  { name: 'Machine Learning Foundations', code: 'CS401', semester: 'Fall 2025', section: 'A', description: 'Statistical learning theory, supervised and unsupervised methods, neural networks.', objectives: 'Implement regression, classification, clustering, and deep learning from scratch. Understand bias-variance tradeoff, regularization, and model evaluation.', department: 'Computer Science', syllabus: 'Week 1-2: Probability & Statistics Review. Week 3-4: Linear Regression, Gradient Descent. Week 5-6: Classification (Logistic, SVM). Week 7-8: Decision Trees, Random Forests. Week 9-10: Neural Networks, Backprop. Week 11-12: Unsupervised Learning. Week 13-14: Deep Learning, CNNs, Transformers.' },
];

const CONCEPTS = {
  CS301: ['Arrays', 'Linked Lists', 'Stacks', 'Queues', 'Binary Trees', 'AVL Trees', 'Red-Black Trees', 'Graphs', 'BFS', 'DFS', 'Dijkstra', 'Dynamic Programming', 'Memoization', 'QuickSort', 'MergeSort', 'Greedy Algorithms', 'Hashing', 'Heaps', 'Recursion', 'Complexity Analysis'],
  CS302: ['ER Modeling', 'Relational Algebra', 'SQL', 'Normalization', '1NF', '2NF', '3NF', 'BCNF', 'Transactions', 'ACID', 'Concurrency Control', 'Indexing', 'B+ Trees', 'Query Optimization', 'Functional Dependencies'],
  CS303: ['Processes', 'Threads', 'CPU Scheduling', 'FCFS', 'SJF', 'Round Robin', 'Synchronization', 'Mutex', 'Semaphores', 'Deadlocks', 'Bankers Algorithm', 'Paging', 'Segmentation', 'Virtual Memory', 'File Systems'],
  CS401: ['Linear Regression', 'Gradient Descent', 'Logistic Regression', 'SVM', 'Decision Trees', 'Random Forests', 'Neural Networks', 'Backpropagation', 'CNNs', 'Transformers', 'K-Means', 'PCA', 'Bias-Variance', 'Regularization', 'Cross Validation'],
};

const RUBRICS = {
  CS301: [
    { no: 'Q1', order: 1, text: 'Explain the time complexity of QuickSort in best, average, and worst cases. Derive the recurrence relation $T(n) = T(k) + T(n-k-1) + \\Theta(n)$ for each.', marks: 10, keyPoints: [{ point: 'Best case: O(n log n) with balanced partitions', marks: 2 }, { point: 'Average case: O(n log n)', marks: 2 }, { point: 'Worst case: O(n²) when pivot is always smallest/largest', marks: 2 }, { point: 'Recurrence: T(n) = T(k) + T(n-k-1) + Θ(n)', marks: 2 }, { point: 'Explanation of partition role in complexity', marks: 2 }] },
    { no: 'Q2', order: 2, text: 'Write a function to detect a cycle in a linked list using Floyd\'s algorithm. Prove that the two pointers will meet if a cycle exists.', marks: 15, keyPoints: [{ point: "Floyd's cycle detection (tortoise and hare)", marks: 4 }, { point: 'Correct code with two pointers', marks: 5 }, { point: 'Time complexity O(n), Space O(1)', marks: 3 }, { point: 'Mathematical proof of meeting point', marks: 3 }] },
    { no: 'Q3', order: 3, text: 'Compare AVL trees and Red-Black trees. Analyze the amortized insertion cost $O(\\log n)$ for both.', marks: 10, keyPoints: [{ point: 'AVL: strictly balanced (height diff ≤ 1)', marks: 2 }, { point: 'Red-Black: relaxed balance (2x height diff)', marks: 2 }, { point: 'AVL better for lookup-heavy workloads', marks: 2 }, { point: 'Red-Black better for insert/delete-heavy', marks: 2 }, { point: 'Real-world examples (Linux CFS uses RB tree)', marks: 2 }] },
    { no: 'Q4', order: 4, text: 'Implement Dijkstra\'s algorithm. Show step-by-step execution on a 6-node weighted graph. What is $O((V+E) \\log V)$ with a min-heap?', marks: 15, keyPoints: [{ point: 'Greedy approach using priority queue', marks: 3 }, { point: 'Step-by-step example with at least 5 nodes', marks: 4 }, { point: 'Time complexity: O((V+E) log V) with min-heap', marks: 3 }, { point: 'Cannot handle negative edge weights', marks: 3 }, { point: 'Bellman-Ford alternative for negative weights', marks: 2 }] },
  ],
  CS302: [
    { no: 'Q1', order: 1, text: 'Explain the ACID properties of database transactions with real-world examples for each.', marks: 10, keyPoints: [{ point: 'Atomicity: all-or-nothing execution', marks: 2.5 }, { point: 'Consistency: maintains DB invariants', marks: 2.5 }, { point: "Isolation: concurrent txns don't interfere", marks: 2.5 }, { point: 'Durability: committed data survives crashes', marks: 2.5 }] },
    { no: 'Q2', order: 2, text: 'Normalize the relation R(A, B, C, D, E) with FDs {A→B, BC→D, D→E} to BCNF.', marks: 15, keyPoints: [{ point: 'Identify all functional dependencies', marks: 3 }, { point: '1NF: atomic values, no repeating groups', marks: 3 }, { point: '2NF: remove partial dependencies', marks: 3 }, { point: '3NF: remove transitive dependencies', marks: 3 }, { point: 'BCNF decomposition is correct and lossless', marks: 3 }] },
    { no: 'Q3', order: 3, text: 'Write SQL: (a) Find students enrolled in more than 3 courses using $\\text{HAVING COUNT(*)} > 3$, (b) Average grade per department with LEFT JOIN.', marks: 10, keyPoints: [{ point: 'Correct GROUP BY with HAVING for part (a)', marks: 3 }, { point: 'Correct JOIN + AVG + GROUP BY for part (b)', marks: 3 }, { point: 'Proper use of aliases', marks: 2 }, { point: 'Handles NULL values', marks: 2 }] },
  ],
  CS303: [
    { no: 'Q1', order: 1, text: 'Explain processes vs. threads with memory layout diagrams showing heap, stack, and shared regions.', marks: 10, keyPoints: [{ point: 'Process: independent, own memory space', marks: 2 }, { point: 'Thread: lightweight, shares memory', marks: 2 }, { point: 'Context switching cost comparison', marks: 2 }, { point: 'Memory layout diagram', marks: 2 }, { point: 'Use cases for each', marks: 2 }] },
    { no: 'Q2', order: 2, text: "Trace the Banker's Algorithm for deadlock avoidance with the given allocation matrix. Show the safety sequence.", marks: 15, keyPoints: [{ point: 'Safety algorithm explained', marks: 3 }, { point: 'Resource request algorithm', marks: 3 }, { point: 'Need matrix = Max - Allocation', marks: 3 }, { point: 'Complete trace with safe sequence', marks: 4 }, { point: 'When request should be denied', marks: 2 }] },
  ],
  CS401: [
    { no: 'Q1', order: 1, text: 'Derive the gradient descent update rule for linear regression: $\\theta_j := \\theta_j - \\alpha \\frac{\\partial}{\\partial \\theta_j} J(\\theta)$. Show that the cost function $J(\\theta) = \\frac{1}{2m}\\sum_{i=1}^{m}(h_\\theta(x^{(i)}) - y^{(i)})^2$ is convex.', marks: 15, keyPoints: [{ point: 'Correct cost function definition', marks: 3 }, { point: 'Partial derivative computation', marks: 4 }, { point: 'Update rule derivation', marks: 3 }, { point: 'Convexity proof (Hessian positive semi-definite)', marks: 3 }, { point: 'Learning rate discussion', marks: 2 }] },
    { no: 'Q2', order: 2, text: 'Compare bias-variance tradeoff. For a model with polynomial features of degree $d$, explain how training error and test error change as $d$ increases.', marks: 10, keyPoints: [{ point: 'Bias = underfitting, variance = overfitting', marks: 2 }, { point: 'Low d = high bias, high d = high variance', marks: 2 }, { point: 'Training error decreases with d', marks: 2 }, { point: 'Test error is U-shaped', marks: 2 }, { point: 'Regularization to balance', marks: 2 }] },
    { no: 'Q3', order: 3, text: 'Explain backpropagation in a 3-layer neural network. Compute $\\frac{\\partial L}{\\partial w_{ij}}$ using the chain rule.', marks: 15, keyPoints: [{ point: 'Forward pass computation', marks: 3 }, { point: 'Loss function definition', marks: 2 }, { point: 'Chain rule application', marks: 4 }, { point: 'Weight update equations', marks: 3 }, { point: 'Vanishing gradient problem', marks: 3 }] },
  ],
};

const FEEDBACKS_GOOD = ['Excellent understanding demonstrated. All key concepts covered with clear examples.', 'Strong answer with rigorous technical terminology and correct mathematical notation.', 'Well-structured response covering all major points with good depth.', 'Comprehensive answer with proper derivations and examples.'];
const FEEDBACKS_MED = ['Reasonable attempt but some key points missing.', 'Partially correct. Basic idea right but mathematical details need precision.', 'Good start but misses important edge cases and proofs.', 'Acceptable answer. Covers basics but lacks depth in analysis.'];
const FEEDBACKS_LOW = ['Limited understanding demonstrated. Most key points missing.', 'Significant gaps in knowledge. Formulas stated without derivation.', 'Very brief answer with several factual errors.', 'Minimal effort — does not address the question adequately.'];

async function createGradedSubmissions(exam, rubricRecords, students, uploadDir) {
  const subStudents = students.slice(0, Math.min(students.length, randInt(Math.ceil(students.length * 0.8), students.length)));
  for (const student of subStudents) {
    const dummyPath = path.join(uploadDir, `mock_${exam.id}_${student.id}.pdf`);
    if (!fs.existsSync(dummyPath)) fs.writeFileSync(dummyPath, `Mock PDF for ${student.name} - ${exam.name}`);

    const sub = await Submission.create({
      exam_id: exam.id, student_id: student.id,
      file_name: `${student.roll_number}_${exam.exam_type}.pdf`, file_path: dummyPath,
      status: 'done', page_count: randInt(3, 8),
    });

    for (const rubric of rubricRecords) {
      const quality = rand(0, 1);
      let awardedPct, confidence, feedback, matchedCount;
      if (quality > 0.65) {
        awardedPct = rand(0.7, 1.0); confidence = rand(0.75, 0.95);
        feedback = pick(FEEDBACKS_GOOD); matchedCount = Math.ceil(rubric.max_marks > 10 ? 3 : 2);
      } else if (quality > 0.3) {
        awardedPct = rand(0.35, 0.7); confidence = rand(0.55, 0.8);
        feedback = pick(FEEDBACKS_MED); matchedCount = Math.ceil(rubric.max_marks > 10 ? 2 : 1);
      } else {
        awardedPct = rand(0.05, 0.35); confidence = rand(0.3, 0.6);
        feedback = pick(FEEDBACKS_LOW); matchedCount = randInt(0, 1);
      }
      const awarded = Math.round(rubric.max_marks * awardedPct * 100) / 100;
      let keyPoints = [];
      try { keyPoints = JSON.parse(rubric.key_points || '[]'); } catch {}
      const matched = keyPoints.slice(0, matchedCount).map(k => k.point);
      const missing = keyPoints.slice(matchedCount).map(k => k.point);

      await Grade.create({
        submission_id: sub.id, rubric_id: rubric.id, question_no: rubric.question_no,
        detected_pages: Array.from({ length: randInt(1, 3) }, (_, i) => i + 1).join(','),
        ocr_text: `[Mock OCR text for ${student.name}'s answer to ${rubric.question_no}]`,
        awarded_marks: awarded, feedback,
        matched_points: JSON.stringify(matched), missing_points: JSON.stringify(missing),
        confidence, raw_response: '',
        review_status: confidence < 0.6 ? 'flagged' : 'auto',
      });
    }
  }
  return subStudents.length;
}

async function seed() {
  console.log('Syncing database (force recreate)...');
  await sequelize.sync({ force: true });

  const uploadDir = path.resolve(process.env.UPLOAD_DIR || './data/uploads');
  fs.mkdirSync(uploadDir, { recursive: true });
  fs.mkdirSync(path.join(uploadDir, 'documents'), { recursive: true });

  // ═══════════════════════════════════════════
  // COLLEGE — Tech Academy of Sciences
  // ═══════════════════════════════════════════
  console.log('\n=== Creating College: Tech Academy of Sciences ===');
  const college = await College.create({
    name: 'Tech Academy of Sciences', domain: 'techacademy.edu',
    address: '42 Innovation Drive, Bengaluru, Karnataka 560001', phone: '+91-80-555-TECH',
    type: 'college',
  });

  const collegeAdmin = await User.create({
    college_id: college.id, full_name: 'Dr. Rajesh Kumar',
    email: 'admin@techacademy.edu', phone: '+919876543210',
    password_hash: User.hashPassword('password123'), role: 'admin',
    department: 'Computer Science', email_verified: true, papers_graded_total: 150,
  });

  const prof1 = await User.create({
    college_id: college.id, full_name: 'Dr. Neha Agarwal',
    email: 'neha@techacademy.edu', phone: '+919876543211',
    password_hash: User.hashPassword('password123'), role: 'professor',
    department: 'Computer Science', email_verified: true, papers_graded_total: 87,
  });

  const prof2 = await User.create({
    college_id: college.id, full_name: 'Prof. Amit Desai',
    email: 'amit@techacademy.edu', phone: '+919876543212',
    password_hash: User.hashPassword('password123'), role: 'professor',
    department: 'Computer Science', email_verified: true, papers_graded_total: 65,
  });

  const prof3 = await User.create({
    college_id: college.id, full_name: 'Dr. Sunita Rao',
    email: 'sunita@techacademy.edu', phone: '+919876543215',
    password_hash: User.hashPassword('password123'), role: 'professor',
    department: 'Computer Science', email_verified: true, papers_graded_total: 42,
  });

  const ta1 = await User.create({
    college_id: college.id, full_name: 'Riya Sharma',
    email: 'riya.ta@techacademy.edu',
    password_hash: User.hashPassword('password123'), role: 'professor',
    department: 'Computer Science', email_verified: true,
  });

  const ta2 = await User.create({
    college_id: college.id, full_name: 'Arjun Nair',
    email: 'arjun.ta@techacademy.edu',
    password_hash: User.hashPassword('password123'), role: 'professor',
    department: 'Computer Science', email_verified: true,
  });

  // Student user accounts (OTP-based login)
  const studentUsers = [];
  for (const s of MOCK_STUDENTS) {
    studentUsers.push(await User.create({
      college_id: college.id, full_name: s.name,
      email: s.email, password_hash: User.hashPassword('auto-' + Date.now()),
      role: 'student', department: 'Computer Science', email_verified: true,
    }));
  }

  // Enterprise subscription for the college
  await Subscription.create({
    user_id: collegeAdmin.id, college_id: college.id,
    plan: 'enterprise', scope: 'college',
    start_date: daysAgo(30), end_date: daysFromNow(335), status: 'active', amount: 19999,
  });

  const profs = [prof1, prof2, prof3];
  const allCourseData = [];

  for (let ci = 0; ci < COURSES.length; ci++) {
    const cd = COURSES[ci];
    const owner = profs[ci % profs.length];
    console.log(`  Course: ${cd.code} ${cd.name} (${owner.full_name})`);

    const course = await Course.create({
      user_id: owner.id, name: cd.name, code: cd.code,
      semester: cd.semester, section: cd.section,
      description: cd.description, objectives: cd.objectives,
      department: cd.department, syllabus: cd.syllabus,
      review_threshold: 0.6, crib_window_hours: 48,
    });

    const studentRecords = [];
    for (let si = 0; si < MOCK_STUDENTS.length; si++) {
      const sd = MOCK_STUDENTS[si];
      const stuUser = studentUsers.find(u => u.email === sd.email);
      studentRecords.push(await Student.create({
        course_id: course.id, name: sd.name,
        roll_number: cd.code.replace('CS', '') + String(si + 1).padStart(3, '0'),
        email: sd.email, user_id: stuUser?.id || null,
      }));
    }

    const conceptNames = CONCEPTS[cd.code] || [];
    const conceptRecords = [];
    for (const cn of conceptNames) {
      conceptRecords.push(await ConceptNode.create({ course_id: course.id, name: cn, category: cd.department }));
    }

    // Learning objectives
    const bloomLevels = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'];
    const objectiveTitles = [
      `Explain core ${cd.code} concepts with examples`,
      `Apply ${conceptNames[0]} and ${conceptNames[1]} to solve problems`,
      `Analyze performance tradeoffs in ${conceptNames[2] || cd.code}`,
      `Design solutions using ${conceptNames[3] || 'advanced'} techniques`,
      `Evaluate different approaches for ${cd.code} problems`,
    ];
    for (let oi = 0; oi < objectiveTitles.length; oi++) {
      await LearningObjective.create({
        course_id: course.id,
        title: objectiveTitles[oi],
        description: `Students should demonstrate mastery through exams and assignments.`,
        bloom_level: bloomLevels[Math.min(oi, bloomLevels.length - 1)],
        mastery_threshold: 65 + oi * 5,
      });
    }

    // Exams
    const rubricDefs = RUBRICS[cd.code] || [];
    const examTypes = [
      { name: 'Midterm Exam', type: 'midterm' },
      { name: 'Final Exam', type: 'final' },
      { name: 'Quiz 1', type: 'quiz' },
      { name: 'Assignment 1', type: 'assignment' },
    ];

    for (const et of examTypes) {
      const useRubrics = et.type === 'quiz' ? rubricDefs.slice(0, 2) : rubricDefs;
      const totalMarks = useRubrics.reduce((s, r) => s + r.marks, 0);
      const exam = await Exam.create({
        course_id: course.id, name: et.name, exam_type: et.type,
        total_marks: totalMarks,
        instructions: `${et.name} for ${cd.code}. Answer all questions. Time: ${et.type === 'quiz' ? '30' : '120'} minutes. Use LaTeX for mathematical notation.`,
        grades_released: true, grades_released_at: daysAgo(randInt(2, 14)),
      });

      const rubricRecords = [];
      for (const rd of useRubrics) {
        const rub = await Rubric.create({
          exam_id: exam.id, question_no: rd.no, question_order: rd.order,
          question_text: rd.text, max_marks: rd.marks, key_points: JSON.stringify(rd.keyPoints),
        });
        rubricRecords.push(rub);
        const linked = conceptRecords.slice(0, randInt(1, 3));
        for (const c of linked) await QuestionConcept.create({ rubric_id: rub.id, concept_id: c.id });
      }

      const count = await createGradedSubmissions(exam, rubricRecords, studentRecords, uploadDir);
      console.log(`    ${et.name}: ${count} graded submissions`);

      await GradeBoundary.bulkCreate([
        { exam_id: exam.id, label: 'A+', min_pct: 90, max_pct: 100, color: '#1a7d3f' },
        { exam_id: exam.id, label: 'A',  min_pct: 80, max_pct: 89.99, color: '#2d8f4e' },
        { exam_id: exam.id, label: 'B+', min_pct: 70, max_pct: 79.99, color: '#3a9d5c' },
        { exam_id: exam.id, label: 'B',  min_pct: 60, max_pct: 69.99, color: '#5b8fd9' },
        { exam_id: exam.id, label: 'C',  min_pct: 50, max_pct: 59.99, color: '#b08600' },
        { exam_id: exam.id, label: 'D',  min_pct: 40, max_pct: 49.99, color: '#d4760a' },
        { exam_id: exam.id, label: 'F',  min_pct: 0,  max_pct: 39.99, color: '#ba1a1a' },
      ]);
    }

    allCourseData.push({ course, studentRecords, owner, conceptRecords });

    // TAs with permissions
    if (ci < 2) {
      const headTaPerms = JSON.stringify({ students: [], permissions: { can_grade: true, can_view_analytics: true, can_manage_roster: true, can_post_announcements: true, can_access_cribs: true, can_manage_docs: true } });
      const taPerms = JSON.stringify({ students: [], permissions: { can_grade: true, can_view_analytics: true, can_manage_roster: false, can_post_announcements: false, can_access_cribs: true, can_manage_docs: false } });
      await CourseTA.create({ course_id: course.id, user_id: ta1.id, email: ta1.email, role: 'head_ta', status: 'active', assigned_questions: '["Q1","Q2","Q3"]', assigned_students: headTaPerms, submissions_graded: randInt(30, 55), avg_grading_time: 2.4 + rand(0, 1), override_rate: 0.04 + rand(0, 0.08), consistency_score: 0.9 + rand(0, 0.08) });
      await CourseTA.create({ course_id: course.id, user_id: ta2.id, email: ta2.email, role: 'ta', status: 'active', assigned_questions: '["Q3","Q4"]', assigned_students: taPerms, submissions_graded: randInt(18, 35), avg_grading_time: 3.0 + rand(0, 1.5), override_rate: 0.08 + rand(0, 0.12), consistency_score: 0.82 + rand(0, 0.12) });
    }
    if (ci === 2) {
      const ta3Perms = JSON.stringify({ students: [], permissions: { can_grade: true, can_view_analytics: false, can_manage_roster: false, can_post_announcements: false, can_access_cribs: false, can_manage_docs: false } });
      await CourseTA.create({ course_id: course.id, user_id: ta1.id, email: ta1.email, role: 'ta', status: 'active', assigned_questions: '["Q1"]', assigned_students: ta3Perms, submissions_graded: randInt(10, 20), avg_grading_time: 4.0 + rand(0, 2), override_rate: 0.15 + rand(0, 0.1), consistency_score: 0.75 + rand(0, 0.15) });
    }

    // Announcements
    await Announcement.create({ course_id: course.id, user_id: owner.id, title: `Welcome to ${cd.code} — ${cd.name}`, content: `Welcome! Please review the syllabus and learning objectives.\n\nOffice Hours: Tuesdays 2-4 PM\nTA Office Hours: Thursdays 3-5 PM\n\nAll submissions through Intelligrade. Students: log in at /student/login with your enrolled email + OTP.`, type: 'general', is_pinned: true, published_at: daysAgo(60) });
    await Announcement.create({ course_id: course.id, user_id: owner.id, title: 'Midterm Grades Released', content: 'Midterm grades are now available in the student portal.\n\nRegrade window: 48 hours. Submit cribs through the portal with detailed reasoning.\n\nClass average: see analytics for detailed breakdown.', type: 'grade_release', published_at: daysAgo(14) });
    await Announcement.create({ course_id: course.id, user_id: owner.id, title: 'Assignment 1 Due Next Week', content: `Assignment 1 for ${cd.code} is due next Monday.\n\nTopics: ${conceptNames.slice(0, 4).join(', ')}\nFormat: PDF upload through Intelligrade.\nLate penalty: -10% per day.`, type: 'deadline', published_at: daysAgo(7) });
    await Announcement.create({ course_id: course.id, user_id: owner.id, title: 'Guest Lecture: Industry Perspectives', content: `We have a guest lecture this Friday by a senior engineer from Google discussing real-world applications of ${conceptNames[0]} and ${conceptNames[1]}.\n\nAttendance is mandatory. Location: Lecture Hall 3.`, type: 'general', published_at: daysAgo(3) });

    // Course documents
    const docPath = path.join(uploadDir, 'documents', `${cd.code}_slides.txt`);
    fs.writeFileSync(docPath, `Lecture slides for ${cd.code} — ${cd.name}\n\n${cd.syllabus}\n\nKey Topics:\n${conceptNames.join('\n')}\n\nLearning Objectives:\n${cd.objectives}`);
    await CourseDocument.create({ course_id: course.id, user_id: owner.id, title: `${cd.code} — Complete Lecture Slides`, doc_type: 'slides', file_path: docPath, file_name: `${cd.code}_slides.pdf`, extracted_text: `${cd.description}\n${cd.syllabus}\n${conceptNames.join(', ')}\n${cd.objectives}`, page_count: 140, concept_tags: JSON.stringify(conceptNames.slice(0, 6)) });
    await CourseDocument.create({ course_id: course.id, user_id: owner.id, title: `${cd.code} — Past Year Paper 2024`, doc_type: 'past_paper', file_path: docPath, file_name: `${cd.code}_pyp_2024.pdf`, extracted_text: `Past year paper covering: ${conceptNames.join(', ')}. Contains ${rubricDefs.length} questions with detailed solutions.`, page_count: 10, concept_tags: JSON.stringify(conceptNames.slice(2, 7)) });
    await CourseDocument.create({ course_id: course.id, user_id: owner.id, title: `${cd.code} — Reference Notes (Prof)`, doc_type: 'notes', file_path: docPath, file_name: `${cd.code}_notes.pdf`, extracted_text: `Professor's reference notes for ${cd.name}. Covers advanced topics: ${conceptNames.slice(-5).join(', ')}.`, page_count: 45, concept_tags: JSON.stringify(conceptNames.slice(-5)) });

    // Discussion threads
    const thread1 = await DiscussionThread.create({ course_id: course.id, user_id: owner.id, title: `${cd.code} — General Q&A`, content: 'Use this thread for general questions about the course.', thread_type: 'announcement', is_pinned: true, concept_tags: '[]', view_count: 67 });
    await DiscussionPost.create({ thread_id: thread1.id, user_id: owner.id, content: 'Feel free to ask questions here. TAs and I respond within 24 hours. Use LaTeX for math: $O(n \\log n)$' });

    if (studentUsers[0]) {
      const thread2 = await DiscussionThread.create({ course_id: course.id, user_id: studentUsers[0].id, title: `Confused about ${conceptNames[0]} vs ${conceptNames[1]}`, content: `Can someone explain the key difference? I understand the basic idea but get confused during implementation. Specifically, when should I use ${conceptNames[0]} vs ${conceptNames[1]}?`, thread_type: 'question', concept_tags: JSON.stringify([conceptNames[0], conceptNames[1]]), view_count: 34 });
      await DiscussionPost.create({ thread_id: thread2.id, user_id: owner.id, content: `Great question! ${conceptNames[0]} focuses on sequential access patterns while ${conceptNames[1]} provides random access. I'll cover this in detail in the next lecture.`, is_answer: true });
      await DiscussionPost.create({ thread_id: thread2.id, user_id: ta1.id, content: `Think of it this way: ${conceptNames[0]} is like a train (fixed, sequential) and ${conceptNames[1]} is like a treasure hunt (each clue points to the next).` });
      if (studentUsers[1]) {
        await DiscussionPost.create({ thread_id: thread2.id, user_id: studentUsers[1].id, content: 'Thanks! That analogy really helps. Could you also clarify the time complexity difference?' });
      }

      const thread3 = await DiscussionThread.create({ course_id: course.id, user_id: studentUsers[2]?.id || studentUsers[0].id, title: `Practice problems for ${conceptNames[3] || 'upcoming exam'}`, content: `Does anyone have extra practice problems for the upcoming exam? The textbook problems aren't enough.`, thread_type: 'question', concept_tags: JSON.stringify([conceptNames[3] || conceptNames[0]]), view_count: 45, is_resolved: true });
      await DiscussionPost.create({ thread_id: thread3.id, user_id: owner.id, content: 'I\'ve uploaded additional practice problems to Course Documents. Check the "Reference Notes" section.', is_answer: true });
    }

    // Live polls
    const poll1 = await LivePoll.create({ course_id: course.id, user_id: owner.id, room_code: roomCode(), question: `What is the time complexity of binary search on a sorted array?`, poll_type: 'mcq', options: JSON.stringify(['$O(1)$', '$O(\\log n)$', '$O(n)$', '$O(n \\log n)$', '$O(n^2)$']), concept_tag: conceptNames[0], is_active: false, closed_at: daysAgo(5) });
    for (let i = 0; i < 15; i++) {
      await PollResponse.create({ poll_id: poll1.id, response: pick(['$O(1)$', '$O(\\log n)$', '$O(n)$', '$O(\\log n)$', '$O(\\log n)$']), response_name: MOCK_STUDENTS[i % MOCK_STUDENTS.length].name });
    }

    const poll2 = await LivePoll.create({ course_id: course.id, user_id: owner.id, room_code: roomCode(), question: 'How confident are you with today\'s concepts?', poll_type: 'confidence', options: JSON.stringify(['1 - Not at all', '2 - Somewhat', '3 - Moderate', '4 - Good', '5 - Very confident']), concept_tag: conceptNames[randInt(2, 5)], is_active: ci === 0 });
    for (let i = 0; i < 12; i++) {
      await PollResponse.create({ poll_id: poll2.id, response: pick(['3 - Moderate', '4 - Good', '5 - Very confident', '2 - Somewhat', '4 - Good']), response_name: MOCK_STUDENTS[i].name });
    }

    const poll3 = await LivePoll.create({ course_id: course.id, user_id: owner.id, room_code: roomCode(), question: 'Which topic should we revisit before the final?', poll_type: 'mcq', options: JSON.stringify(conceptNames.slice(0, 5)), concept_tag: null, is_active: ci === 0 });
    for (let i = 0; i < 10; i++) {
      await PollResponse.create({ poll_id: poll3.id, response: pick(conceptNames.slice(0, 5)), response_name: MOCK_STUDENTS[i].name });
    }

    // Class sessions with active feedback
    for (let d = 0; d < 10; d++) {
      const sesDate = daysAgo(70 - d * 7);
      const covered = conceptNames.slice(d * 2, d * 2 + 2);
      const session = await ClassSession.create({
        course_id: course.id, user_id: owner.id,
        title: `Lecture ${d + 1} — ${covered.join(', ') || 'Review'}`,
        session_date: sesDate.toISOString().split('T')[0],
        start_time: '10:00', end_time: '11:30',
        concepts_planned: JSON.stringify(covered),
        concepts_covered: JSON.stringify(covered),
        professor_notes: d < 7 ? `Covered ${covered.join(' and ')}. Students ${pick(['were engaged and asked good questions', 'seemed confused on the second topic — will revisit', 'were well-prepared from reading material', 'need more practice problems'])}. ${pick(['Will assign a practice set.', 'Extra office hours offered.', 'Good session overall.', 'Need to revisit in tutorial.', 'Used live poll — 70% got it right.'])}` : '',
        status: d < 8 ? 'completed' : d === 8 ? 'in_progress' : 'planned',
      });

      if (d < 7) {
        for (let fi = 0; fi < randInt(5, 12); fi++) {
          await ActiveFeedback.create({
            session_id: session.id,
            course_id: course.id,
            user_id: studentUsers[fi % studentUsers.length]?.id || null,
            feedback_type: pick(['understanding', 'confusion', 'question', 'pace']),
            content: fi < 3 ? pick([
              'Could you explain the recursion tree more slowly?',
              'The example was really helpful!',
              'Going too fast on the mathematical derivation.',
              'Can we do more practice problems in class?',
              'I understand the concept but struggle with implementation.',
              null,
            ]) : null,
            rating: randInt(2, 5),
            is_anonymous: true,
          });
        }
      }
    }
  }

  // Cribs
  const cs301Exams = await Exam.findAll({ where: { course_id: allCourseData[0].course.id }, order: [['id', 'ASC']] });
  if (cs301Exams.length > 0) {
    const midterm = cs301Exams[0];
    const grades = await Grade.findAll({
      include: [{ model: Submission, required: true, where: { exam_id: midterm.id } }, { model: Rubric }],
      limit: 25,
    });
    for (let i = 0; i < Math.min(8, grades.length); i++) {
      const g = grades[i];
      const student = await Student.findByPk(g.Submission.student_id);
      if (!student) continue;
      await Crib.create({
        grade_id: g.id, student_id: student.id, exam_id: midterm.id,
        question_no: g.question_no,
        student_reasoning: pick([
          'I believe my answer covered the key points but the AI missed my explanation in the second paragraph. I clearly stated the $O(n \\log n)$ complexity with proof.',
          'My diagram on page 2 shows the correct approach. The grading seems to have missed this visual explanation.',
          'I used an alternative but valid approach supported by Cormen et al. (Chapter 5, p.112).',
          'The feedback says I missed edge cases, but I handled them in my code. Please re-check page 3.',
          'I wrote the correct formula $\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}$ but made a minor arithmetic error. The approach was fully correct.',
          'My answer uses the Master Theorem approach which is equally valid. $T(n) = aT(n/b) + f(n)$ correctly applied.',
          'I believe the rubric key point about time complexity was addressed in my third paragraph where I derive $O(V + E)$.',
          'The OCR may have misread my handwriting. My answer clearly states the correct algorithm.',
        ]),
        status: i < 3 ? 'accepted' : i < 6 ? 'pending' : 'rejected',
        ai_confidence: rand(0.4, 0.9),
        ai_recommendation: i < 4 ? 'uphold' : 'reject',
        ai_suggested_marks: Math.min(g.Rubric.max_marks, g.awarded_marks + randInt(0, 3)),
        ai_reasoning: i < 4 ? 'Student reasoning has merit. Answer shows understanding that was partially captured by OCR.' : 'Original grading appears accurate. No substantial new evidence.',
        resolved_by: i < 3 ? prof1.id : null,
        resolved_marks: i < 3 ? g.awarded_marks + randInt(1, 3) : null,
        resolved_note: i === 0 ? 'Diagram on page 2 correctly shows the algorithm. Adding 2 marks.' : i === 1 ? 'Partial credit for valid alternative approach.' : i === 2 ? 'OCR missed handwritten derivation. Full credit restored.' : null,
        resolved_at: i < 3 ? daysAgo(3) : null,
      });
    }
    console.log('    8 cribs/regrade requests created for CS301 Midterm');
  }

  // More cribs for CS302
  if (allCourseData.length > 1) {
    const cs302Exams = await Exam.findAll({ where: { course_id: allCourseData[1].course.id }, order: [['id', 'ASC']] });
    if (cs302Exams.length > 0) {
      const exam2 = cs302Exams[0];
      const grades2 = await Grade.findAll({
        include: [{ model: Submission, required: true, where: { exam_id: exam2.id } }, { model: Rubric }],
        limit: 15,
      });
      for (let i = 0; i < Math.min(5, grades2.length); i++) {
        const g = grades2[i];
        const student = await Student.findByPk(g.Submission.student_id);
        if (!student) continue;
        await Crib.create({
          grade_id: g.id, student_id: student.id, exam_id: exam2.id,
          question_no: g.question_no,
          student_reasoning: pick([
            'My SQL query produces the correct output. I tested it in MySQL Workbench.',
            'The ER diagram on page 1 captures all entities and relationships. Please re-evaluate.',
            'I applied BCNF decomposition correctly — the decomposition is lossless as proved by the chase algorithm.',
            'My ACID explanation includes real-world banking examples for each property.',
            'The JOIN query uses proper LEFT JOIN syntax. The grading penalized me unfairly.',
          ]),
          status: i < 2 ? 'pending' : i < 4 ? 'accepted' : 'rejected',
          ai_confidence: i < 2 ? null : rand(0.5, 0.9),
          ai_recommendation: i < 2 ? null : (i < 4 ? 'uphold' : 'reject'),
          ai_suggested_marks: i < 2 ? null : Math.min(g.Rubric.max_marks, g.awarded_marks + randInt(0, 2)),
          ai_reasoning: i < 2 ? null : (i < 4 ? 'Valid reasoning detected. Student approach is correct.' : 'Original grading stands. No new evidence.'),
          resolved_by: i >= 2 ? prof2.id : null,
          resolved_marks: i >= 2 && i < 4 ? g.awarded_marks + randInt(1, 2) : null,
          resolved_note: i === 2 ? 'SQL query verified correct.' : i === 3 ? 'ER diagram has valid alternative notation.' : i === 4 ? 'BCNF decomposition has a lossy join.' : null,
          resolved_at: i >= 2 ? daysAgo(2) : null,
        });
      }
      console.log('    5 cribs/regrade requests created for CS302 Midterm');
    }
  }

  // Override logs (RLHF data)
  const someGrades = await Grade.findAll({ where: { override_marks: null }, limit: 8 });
  for (const g of someGrades) {
    const overrideMarks = Math.round((g.awarded_marks + rand(-2, 3)) * 100) / 100;
    g.override_marks = Math.max(0, overrideMarks);
    g.override_note = pick(['Adjusted after careful review of student work', 'Partial credit for correct methodology despite wrong final answer', 'Added marks for diagram quality', 'Reduced: answer copied verbatim from textbook without understanding']);
    g.review_status = 'overridden';
    await g.save();
    await OverrideLog.create({
      grade_id: g.id, user_id: prof1.id, ocr_text: g.ocr_text, rubric_text: 'Mock rubric text',
      ai_grade: g.awarded_marks, ai_reasoning: g.feedback,
      professor_override: g.override_marks, override_note: g.override_note,
    });
  }
  console.log('    8 override logs (RLHF data) created');

  // ═══════════════════════════════════════════
  // INDIVIDUAL — Independent Professor
  // ═══════════════════════════════════════════
  console.log('\n=== Creating Individual Professor ===');
  const individual = await User.create({
    full_name: 'Prof. Alex Rivera', email: 'alex.prof@gmail.com',
    password_hash: User.hashPassword('password123'), role: 'professor',
    department: 'Physics', email_verified: true, papers_graded_total: 12,
  });

  await Subscription.create({
    user_id: individual.id, plan: 'assess', scope: 'individual',
    start_date: daysAgo(10), end_date: daysFromNow(20), status: 'active', amount: 799,
  });

  const indCourse = await Course.create({
    user_id: individual.id, name: 'Engineering Physics', code: 'PHY201',
    semester: 'Spring 2026', section: 'Batch A',
    description: 'Engineering physics covering mechanics, thermodynamics, optics, and modern physics.',
    objectives: 'Master Newtonian mechanics, thermodynamic laws, wave optics, and quantum basics.',
    department: 'Physics',
  });

  const indStudents = [];
  const indNames = [
    { n: 'Ravi Teja', e: 'ravi@example.com' }, { n: 'Sana Ahmed', e: 'sana@example.com' },
    { n: 'Ethan Park', e: 'ethan@example.com' }, { n: 'Mia Zhang', e: 'mia@example.com' },
    { n: 'Carlos Diaz', e: 'carlos@example.com' }, { n: 'Priya Sen', e: 'priya2@example.com' },
  ];
  for (let i = 0; i < indNames.length; i++) {
    indStudents.push(await Student.create({
      course_id: indCourse.id, name: indNames[i].n,
      roll_number: `PHY${String(i + 1).padStart(3, '0')}`, email: indNames[i].e,
    }));
  }

  const indExam = await Exam.create({
    course_id: indCourse.id, name: 'Weekly Test 1', exam_type: 'test',
    total_marks: 30, instructions: 'Answer all 3 questions. Use LaTeX for equations.',
    grades_released: true, grades_released_at: daysAgo(2),
  });

  const indRubrics = [
    await Rubric.create({ exam_id: indExam.id, question_no: 'Q1', question_order: 1, question_text: 'Derive $v^2 = u^2 + 2as$ from the first two equations of motion.', max_marks: 10, key_points: JSON.stringify([{ point: 'Starts from v = u + at', marks: 3 }, { point: 'Uses s = ut + ½at²', marks: 3 }, { point: 'Eliminates t correctly', marks: 2 }, { point: 'Final equation derived', marks: 2 }]) }),
    await Rubric.create({ exam_id: indExam.id, question_no: 'Q2', question_order: 2, question_text: 'State and explain the first law of thermodynamics: $\\Delta U = Q - W$. Draw a PV diagram.', max_marks: 10, key_points: JSON.stringify([{ point: 'ΔU = Q - W stated correctly', marks: 3 }, { point: 'Internal energy explanation', marks: 2 }, { point: 'PV diagram drawn correctly', marks: 3 }, { point: 'Real-world example', marks: 2 }]) }),
    await Rubric.create({ exam_id: indExam.id, question_no: 'Q3', question_order: 3, question_text: 'A projectile launched at $45°$ with $v_0 = 20$ m/s. Find max height $H = \\frac{v_0^2 \\sin^2\\theta}{2g}$ and range $R = \\frac{v_0^2 \\sin 2\\theta}{g}$.', max_marks: 10, key_points: JSON.stringify([{ point: 'Max height formula correct', marks: 3 }, { point: 'H ≈ 10.2m', marks: 2 }, { point: 'Range formula correct', marks: 3 }, { point: 'R ≈ 40.8m', marks: 2 }]) }),
  ];

  const indCount = await createGradedSubmissions(indExam, indRubrics, indStudents, uploadDir);
  console.log(`  Weekly Test 1: ${indCount} graded submissions`);

  await GradeBoundary.bulkCreate([
    { exam_id: indExam.id, label: 'A+', min_pct: 90, max_pct: 100, color: '#1a7d3f' },
    { exam_id: indExam.id, label: 'A',  min_pct: 80, max_pct: 89.99, color: '#2d8f4e' },
    { exam_id: indExam.id, label: 'B',  min_pct: 60, max_pct: 79.99, color: '#5b8fd9' },
    { exam_id: indExam.id, label: 'C',  min_pct: 40, max_pct: 59.99, color: '#b08600' },
    { exam_id: indExam.id, label: 'F',  min_pct: 0,  max_pct: 39.99, color: '#ba1a1a' },
  ]);

  // ═══════════════════════════════════════════
  // Summary
  // ═══════════════════════════════════════════
  // ── Seed Integration Configs ──
  const allCourses = await Course.findAll();
  const profUser = await User.findOne({ where: { email: 'neha@techacademy.edu' } });
  if (profUser && allCourses.length) {
    const firstCourse = allCourses[0];
    const integrations = [
      { provider: 'notion', config: JSON.stringify({ notion_page_url: 'https://notion.so/intelligrade-course-wiki', notion_api_key: '' }) },
      { provider: 'zoom', config: JSON.stringify({ zoom_meeting_url: 'https://zoom.us/j/1234567890', zoom_api_key: '' }) },
      { provider: 'slack', config: JSON.stringify({ slack_webhook_url: 'https://hooks.slack.com/services/DEMO/WEBHOOK', slack_channel: '#course-updates' }) },
      { provider: 'google_drive', config: JSON.stringify({ drive_folder_url: 'https://drive.google.com/drive/folders/demo', drive_shared_link: '' }) },
      { provider: 'overleaf', config: JSON.stringify({ overleaf_project_url: 'https://www.overleaf.com/project/demo123' }) },
      { provider: 'piazza', config: JSON.stringify({ piazza_email: 'neha@techacademy.edu', piazza_password: '', piazza_network_id: 'cs201_spring2026' }) },
      { provider: 'turnitin', config: JSON.stringify({ turnitin_api_key: 'demo-key', turnitin_account_id: 'TA-12345' }) },
      { provider: 'discord', config: JSON.stringify({ discord_webhook_url: 'https://discord.com/api/webhooks/demo' }) },
      { provider: 'moodle', config: JSON.stringify({ lti_url: 'https://moodle.techacademy.edu', client_id: 'ig-client-001', deployment_id: 'dep-001' }) },
      { provider: 'canvas', config: JSON.stringify({ api_url: 'https://canvas.techacademy.edu', api_token: '', canvas_course_id: 'CS201-S26' }) },
      { provider: 'github_classroom', config: JSON.stringify({ github_org: 'techacademy-cs', github_classroom_id: 'cs201-assignments', github_token: '' }) },
      { provider: 'bodhitree', config: JSON.stringify({ bodhitree_url: 'https://bodhitree.cse.iitb.ac.in', bodhitree_api_key: '', bodhitree_course_id: 'CS301-2025' }) },
      { provider: 'jupyter', config: JSON.stringify({ jupyter_url: 'https://jupyter.techacademy.edu', jupyter_token: '' }) },
    ];
    for (const intg of integrations) {
      await IntegrationConfig.create({
        course_id: firstCourse.id,
        user_id: profUser.id,
        provider: intg.provider,
        config: intg.config,
        is_active: true,
      });
    }
    console.log(`  Created ${integrations.length} integration configs for ${firstCourse.code}`);
  }

  const counts = {
    exams: await Exam.count(), students: await Student.count(),
    submissions: await Submission.count(), grades: await Grade.count(),
    cribs: await Crib.count(), tas: await CourseTA.count(),
    announcements: await Announcement.count(), docs: await CourseDocument.count(),
    threads: await DiscussionThread.count(), polls: await LivePoll.count(),
    sessions: await ClassSession.count(), overrides: await OverrideLog.count(),
    objectives: await LearningObjective.count(), feedback: await ActiveFeedback.count(),
  };

  console.log('\n===========================================================');
  console.log('  SEED COMPLETE — Full Platform Demo Data');
  console.log('===========================================================');
  console.log(`  Exams: ${counts.exams} | Students: ${counts.students} | Submissions: ${counts.submissions} | Grades: ${counts.grades}`);
  console.log(`  Cribs: ${counts.cribs} | TAs: ${counts.tas} | Announcements: ${counts.announcements} | Docs: ${counts.docs}`);
  console.log(`  Threads: ${counts.threads} | Polls: ${counts.polls} | Sessions: ${counts.sessions} | Overrides: ${counts.overrides}`);
  const intCount = await IntegrationConfig.count();
  console.log(`  Learning Objectives: ${counts.objectives} | Active Feedback: ${counts.feedback} | Integrations: ${intCount}`);
  console.log('');
  console.log('  PRICING: Assess (Rs799/mo) | Academic (Rs1,499/mo) | Enterprise (Rs1,999/mo)');
  console.log('  College bundle: 10 profs included. 12-prof bundle = 2 free.');
  console.log('');
  console.log('  PROFESSOR LOGIN:');
  console.log('    College Admin: admin@techacademy.edu  / password123');
  console.log('    Professor 1:   neha@techacademy.edu   / password123');
  console.log('    Professor 2:   amit@techacademy.edu   / password123');
  console.log('    Professor 3:   sunita@techacademy.edu / password123');
  console.log('    Individual:    alex.prof@gmail.com    / password123');
  console.log('');
  console.log('  TA LOGIN (same as professor login — TAs are CourseTA records):');
  console.log('    Head TA:       riya.ta@techacademy.edu  / password123');
  console.log('    TA:            arjun.ta@techacademy.edu / password123');
  console.log('');
  console.log('  STUDENT LOGIN (/student/login → OTP based):');
  console.log('    aarav.s@techacademy.edu (enter email → get OTP shown in console)');
  console.log('    priya.p@techacademy.edu, rohan.g@techacademy.edu, etc.');
  console.log('');
  console.log('  COUPONS: LAUNCH30, WELCOME20, EDUCATOR50, ANNUAL15, COLLEGE25');
  console.log('===========================================================\n');

  await sequelize.close();
  process.exit(0);
}

seed().catch(async err => {
  console.error('Seed failed:', err);
  try { await sequelize.close(); } catch {}
  process.exit(1);
});

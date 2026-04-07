require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { sequelize, College, User, Subscription, Course, Exam, Student, Rubric, Submission, Grade, ChatMessage } = require('../models');

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
];

const COURSES = [
  { name: 'Data Structures & Algorithms', code: 'CS301', semester: 'Fall 2025', section: 'A' },
  { name: 'Database Management Systems', code: 'CS302', semester: 'Fall 2025', section: 'A' },
  { name: 'Operating Systems', code: 'CS303', semester: 'Fall 2025', section: 'B' },
];

const RUBRICS = {
  CS301: [
    { no: 'Q1', order: 1, text: 'Explain the time complexity of QuickSort in best, average, and worst cases. Provide the recurrence relation for each.', marks: 10, keyPoints: [{ point: 'Best case: O(n log n) with balanced partitions', marks: 2 }, { point: 'Average case: O(n log n)', marks: 2 }, { point: 'Worst case: O(n²) when pivot is always smallest/largest', marks: 2 }, { point: 'Recurrence: T(n) = T(k) + T(n-k-1) + O(n)', marks: 2 }, { point: 'Explanation of partition role in complexity', marks: 2 }] },
    { no: 'Q2', order: 2, text: 'Write a function to detect a cycle in a linked list. Explain your approach and its complexity.', marks: 15, keyPoints: [{ point: 'Floyd\'s cycle detection (tortoise and hare)', marks: 4 }, { point: 'Correct code with two pointers', marks: 5 }, { point: 'Time complexity O(n), Space O(1)', marks: 3 }, { point: 'Handles edge cases (empty list, single node)', marks: 3 }] },
    { no: 'Q3', order: 3, text: 'Compare AVL trees and Red-Black trees. When would you prefer one over the other?', marks: 10, keyPoints: [{ point: 'AVL: strictly balanced (height diff ≤ 1)', marks: 2 }, { point: 'Red-Black: relaxed balance (2x height diff allowed)', marks: 2 }, { point: 'AVL better for lookup-heavy workloads', marks: 2 }, { point: 'Red-Black better for insert/delete-heavy workloads', marks: 2 }, { point: 'Real-world examples (e.g., Linux CFS uses RB tree)', marks: 2 }] },
    { no: 'Q4', order: 4, text: 'Explain Dijkstra\'s algorithm with an example. What are its limitations?', marks: 15, keyPoints: [{ point: 'Greedy approach using priority queue', marks: 3 }, { point: 'Step-by-step example with at least 5 nodes', marks: 4 }, { point: 'Time complexity: O((V+E) log V) with min-heap', marks: 3 }, { point: 'Cannot handle negative edge weights', marks: 3 }, { point: 'Alternative: Bellman-Ford for negative weights', marks: 2 }] },
  ],
  CS302: [
    { no: 'Q1', order: 1, text: 'Explain the ACID properties of database transactions with examples.', marks: 10, keyPoints: [{ point: 'Atomicity: all-or-nothing execution', marks: 2.5 }, { point: 'Consistency: maintains DB invariants', marks: 2.5 }, { point: 'Isolation: concurrent txns don\'t interfere', marks: 2.5 }, { point: 'Durability: committed data survives crashes', marks: 2.5 }] },
    { no: 'Q2', order: 2, text: 'Normalize the following relation to 3NF: Student(ID, Name, CourseID, CourseName, ProfessorName, ProfessorDept)', marks: 15, keyPoints: [{ point: 'Identify functional dependencies', marks: 3 }, { point: '1NF: atomic values, no repeating groups', marks: 3 }, { point: '2NF: remove partial dependencies', marks: 3 }, { point: '3NF: remove transitive dependencies', marks: 3 }, { point: 'Final decomposed relations are correct', marks: 3 }] },
    { no: 'Q3', order: 3, text: 'Write SQL queries for: (a) Find students enrolled in more than 3 courses, (b) Find the average grade per department.', marks: 10, keyPoints: [{ point: 'Correct GROUP BY with HAVING for part (a)', marks: 3 }, { point: 'Correct JOIN + AVG + GROUP BY for part (b)', marks: 3 }, { point: 'Proper use of aliases and column names', marks: 2 }, { point: 'Handles NULL values appropriately', marks: 2 }] },
  ],
  CS303: [
    { no: 'Q1', order: 1, text: 'Explain the difference between processes and threads. Include diagrams.', marks: 10, keyPoints: [{ point: 'Process: independent, own memory space', marks: 2 }, { point: 'Thread: lightweight, shares memory with parent', marks: 2 }, { point: 'Context switching cost comparison', marks: 2 }, { point: 'Diagram showing memory layout', marks: 2 }, { point: 'Use cases for each', marks: 2 }] },
    { no: 'Q2', order: 2, text: 'Describe the Banker\'s Algorithm for deadlock avoidance. Trace through an example.', marks: 15, keyPoints: [{ point: 'Safety algorithm explained', marks: 3 }, { point: 'Resource request algorithm', marks: 3 }, { point: 'Need matrix = Max - Allocation', marks: 3 }, { point: 'Complete trace with safe sequence', marks: 4 }, { point: 'Identify when request should be denied', marks: 2 }] },
    { no: 'Q3', order: 3, text: 'Compare paging and segmentation. What is a page fault and how is it handled?', marks: 10, keyPoints: [{ point: 'Paging: fixed-size blocks', marks: 2 }, { point: 'Segmentation: variable-size logical units', marks: 2 }, { point: 'Page fault: requested page not in memory', marks: 2 }, { point: 'Handling: trap → find frame → disk read → update table → restart', marks: 2 }, { point: 'Thrashing and working set concept', marks: 2 }] },
  ],
};

function rand(min, max) { return Math.random() * (max - min) + min; }
function randInt(min, max) { return Math.floor(rand(min, max + 1)); }
function pick(arr) { return arr[randInt(0, arr.length - 1)]; }

const FEEDBACKS_GOOD = [
  'Excellent understanding demonstrated. All key concepts covered with clear examples.',
  'Strong answer with good use of technical terminology. Minor formatting issues.',
  'Well-structured response covering all major points. Good code example provided.',
  'Comprehensive answer with proper explanations. Shows deep understanding of the topic.',
];
const FEEDBACKS_MED = [
  'Reasonable attempt but some key points are missing. The explanation of the core concept is correct but incomplete.',
  'Partially correct. The basic idea is right but the details need more precision.',
  'Good start but the answer misses important edge cases and complexity analysis.',
  'Acceptable answer. Covers the basics but lacks depth in the analysis section.',
];
const FEEDBACKS_LOW = [
  'The answer demonstrates limited understanding. Most key points are missing or incorrect.',
  'Significant gaps in knowledge. The fundamental concept was not properly explained.',
  'Very brief answer with several factual errors. Needs to review the foundational material.',
  'Minimal effort shown. The answer barely addresses the question requirements.',
];

async function seed() {
  console.log('Syncing database...');
  await sequelize.sync({ alter: true });

  console.log('Clearing existing data...');
  await ChatMessage.destroy({ where: {} });
  await Grade.destroy({ where: {} });
  await Submission.destroy({ where: {} });
  await Rubric.destroy({ where: {} });
  await Student.destroy({ where: {} });
  await Exam.destroy({ where: {} });
  await Course.destroy({ where: {} });
  await Subscription.destroy({ where: {} });
  await User.destroy({ where: {} });
  await College.destroy({ where: {} });

  console.log('Creating college...');
  const college = await College.create({
    name: 'Tech Academy of Sciences',
    domain: 'techacademy.edu',
    address: '42 Innovation Drive, Silicon Valley, CA 94025',
    phone: '+1-555-TECH-EDU',
  });

  console.log('Creating users...');
  const admin = await User.create({
    college_id: college.id,
    full_name: 'Dr. Rajesh Kumar',
    email: 'admin@techacademy.edu',
    password_hash: User.hashPassword('password123'),
    role: 'admin',
    department: 'Computer Science',
  });

  const prof1 = await User.create({
    college_id: college.id,
    full_name: 'Dr. Neha Agarwal',
    email: 'neha@techacademy.edu',
    password_hash: User.hashPassword('password123'),
    role: 'professor',
    department: 'Computer Science',
  });

  const prof2 = await User.create({
    college_id: college.id,
    full_name: 'Prof. Amit Desai',
    email: 'amit@techacademy.edu',
    password_hash: User.hashPassword('password123'),
    role: 'professor',
    department: 'Information Technology',
  });

  console.log('Creating subscription (monthly PRO)...');
  const now = new Date();
  const end = new Date(now);
  end.setDate(end.getDate() + 30);
  await Subscription.create({
    user_id: admin.id,
    college_id: college.id,
    plan: 'monthly',
    scope: 'college',
    start_date: now,
    end_date: end,
    status: 'active',
  });

  const uploadDir = path.resolve(process.env.UPLOAD_DIR || './data/uploads');
  fs.mkdirSync(uploadDir, { recursive: true });

  const users = [prof1, prof2];

  for (let ci = 0; ci < COURSES.length; ci++) {
    const cd = COURSES[ci];
    const owner = users[ci % users.length];
    console.log(`Creating course: ${cd.code} ${cd.name} (owner: ${owner.full_name})...`);

    const course = await Course.create({
      user_id: owner.id,
      name: cd.name,
      code: cd.code,
      semester: cd.semester,
      section: cd.section,
    });

    const studentCount = ci === 0 ? 12 : (ci === 1 ? 8 : 6);
    const studentRecords = [];
    for (let si = 0; si < studentCount; si++) {
      const sd = MOCK_STUDENTS[si % MOCK_STUDENTS.length];
      const roll = cd.code.replace('CS', '') + String(si + 1).padStart(3, '0');
      const s = await Student.create({
        course_id: course.id,
        name: sd.name,
        roll_number: roll,
        email: sd.email,
      });
      studentRecords.push(s);
    }
    console.log(`  → ${studentRecords.length} students enrolled`);

    const examTypes = ci === 0
      ? [{ name: 'Midterm Exam', type: 'midterm' }, { name: 'Final Exam', type: 'final' }]
      : [{ name: 'Midterm Exam', type: 'midterm' }];

    const rubricDefs = RUBRICS[cd.code] || [];

    for (const et of examTypes) {
      const totalMarks = rubricDefs.reduce((s, r) => s + r.marks, 0);
      const exam = await Exam.create({
        course_id: course.id,
        name: et.name,
        exam_type: et.type,
        total_marks: totalMarks,
        instructions: `${et.name} for ${cd.code}. Answer all questions. Show your work.`,
      });
      console.log(`  → Exam: ${et.name} (${totalMarks} marks, ${rubricDefs.length} questions)`);

      const rubricRecords = [];
      for (const rd of rubricDefs) {
        const r = await Rubric.create({
          exam_id: exam.id,
          question_no: rd.no,
          question_order: rd.order,
          question_text: rd.text,
          max_marks: rd.marks,
          key_points: JSON.stringify(rd.keyPoints),
          grading_notes: null,
        });
        rubricRecords.push(r);
      }

      const subStudents = studentRecords.slice(0, Math.min(studentRecords.length, randInt(5, studentRecords.length)));
      for (const student of subStudents) {
        const dummyPath = path.join(uploadDir, `mock_${exam.id}_${student.id}.pdf`);
        if (!fs.existsSync(dummyPath)) {
          fs.writeFileSync(dummyPath, `Mock PDF for ${student.name} - ${exam.name}`);
        }

        const sub = await Submission.create({
          exam_id: exam.id,
          student_id: student.id,
          file_name: `${student.roll_number}_${et.type}.pdf`,
          file_path: dummyPath,
          status: 'done',
          page_count: randInt(3, 8),
        });

        for (const rubric of rubricRecords) {
          const quality = rand(0, 1);
          let awardedPct, confidence, feedback, matchedCount;

          if (quality > 0.65) {
            awardedPct = rand(0.7, 1.0);
            confidence = rand(0.75, 0.95);
            feedback = pick(FEEDBACKS_GOOD);
            matchedCount = Math.ceil(rubric.max_marks > 10 ? 3 : 2);
          } else if (quality > 0.3) {
            awardedPct = rand(0.35, 0.7);
            confidence = rand(0.55, 0.8);
            feedback = pick(FEEDBACKS_MED);
            matchedCount = Math.ceil(rubric.max_marks > 10 ? 2 : 1);
          } else {
            awardedPct = rand(0.05, 0.35);
            confidence = rand(0.4, 0.65);
            feedback = pick(FEEDBACKS_LOW);
            matchedCount = randInt(0, 1);
          }

          const awarded = Math.round(rubric.max_marks * awardedPct * 100) / 100;
          let keyPoints = [];
          try { keyPoints = JSON.parse(rubric.key_points || '[]'); } catch {}

          const matched = keyPoints.slice(0, matchedCount).map(k => k.point);
          const missing = keyPoints.slice(matchedCount).map(k => k.point);

          await Grade.create({
            submission_id: sub.id,
            rubric_id: rubric.id,
            question_no: rubric.question_no,
            detected_pages: Array.from({ length: randInt(1, 3) }, (_, i) => i + 1).join(','),
            ocr_text: `[Mock OCR text for ${student.name}'s answer to ${rubric.question_no}]`,
            awarded_marks: awarded,
            feedback,
            matched_points: JSON.stringify(matched),
            missing_points: JSON.stringify(missing),
            confidence,
            raw_response: '',
          });
        }
      }
      console.log(`  → ${subStudents.length} submissions graded`);
    }
  }

  console.log('\n===================================');
  console.log('  SEED COMPLETE');
  console.log('===================================');
  console.log(`College: Tech Academy of Sciences`);
  console.log(`Admin:   admin@techacademy.edu / password123`);
  console.log(`Prof 1:  neha@techacademy.edu  / password123`);
  console.log(`Prof 2:  amit@techacademy.edu  / password123`);
  console.log(`Plan:    Monthly PRO (college-wide)`);
  console.log('===================================\n');

  process.exit(0);
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});

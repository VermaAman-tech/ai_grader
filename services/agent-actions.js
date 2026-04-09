const {
  Course, Exam, Student, Grade, Submission, Rubric, Announcement,
  DiscussionThread, LivePoll, ClassSession, CourseTA, Crib,
  ConceptNode, CourseDocument, GradeBoundary, User,
} = require('../models');
const { getExamAnalytics } = require('./analytics');
const { sendNotification, sendBulkNotification } = require('./notification');
const { Op } = require('sequelize');

async function executeAction(action, userId, baseUrl) {
  const result = { executed: false, message: '', data: null };

  try {
    switch (action.type) {
      case 'create_announcement': {
        const course = await Course.findOne({ where: { id: action.course_id, user_id: userId } });
        if (!course) { result.message = 'Course not found or access denied.'; break; }
        const ann = await Announcement.create({
          course_id: action.course_id,
          user_id: userId,
          title: action.title || 'Untitled',
          content: action.content || '',
          type: action.announcement_type || 'general',
          published_at: new Date(),
        });
        result.executed = true;
        result.message = `Announcement "${ann.title}" created.`;
        result.data = { id: ann.id };
        break;
      }

      case 'create_thread': {
        const course = await Course.findOne({ where: { id: action.course_id, user_id: userId } });
        if (!course) { result.message = 'Course not found.'; break; }
        const thread = await DiscussionThread.create({
          course_id: action.course_id,
          user_id: userId,
          title: action.title || 'Untitled',
          content: action.content || '',
          thread_type: action.thread_type || 'discussion',
        });
        result.executed = true;
        result.message = `Discussion thread "${thread.title}" created.`;
        result.data = { id: thread.id };
        break;
      }

      case 'release_grades': {
        const exam = await Exam.findOne({
          where: { id: action.exam_id },
          include: [{ model: Course, required: true, where: { user_id: userId } }],
        });
        if (!exam) { result.message = 'Exam not found.'; break; }
        exam.grades_released = true;
        exam.grades_released_at = new Date();
        await exam.save();
        result.executed = true;
        result.message = `Grades released for "${exam.name}".`;

        const students = await Student.findAll({
          where: { course_id: exam.course_id },
          include: [{ model: User, attributes: ['email', 'full_name'] }],
        });
        const emailRecipients = students
          .filter(s => s.User?.email || s.email)
          .map(s => ({
            email: s.User?.email || s.email,
            studentName: s.User?.full_name || s.name,
            courseName: exam.Course.name,
            courseCode: exam.Course.code,
            examName: exam.name,
            baseUrl,
          }));
        if (emailRecipients.length) {
          sendBulkNotification('grades_released', emailRecipients).catch(() => {});
          result.message += ` Email notifications queued for ${emailRecipients.length} students.`;
        }
        break;
      }

      case 'set_boundaries': {
        const exam = await Exam.findOne({
          where: { id: action.exam_id },
          include: [{ model: Course, required: true, where: { user_id: userId } }],
        });
        if (!exam) { result.message = 'Exam not found.'; break; }
        const boundaries = action.boundaries || [];
        await GradeBoundary.destroy({ where: { exam_id: action.exam_id } });
        for (const b of boundaries) {
          await GradeBoundary.create({
            exam_id: action.exam_id,
            label: b.label,
            min_pct: b.min_pct,
            max_pct: b.max_pct,
            color: b.color || '#666',
          });
        }
        result.executed = true;
        result.message = `Set ${boundaries.length} grade boundaries for "${exam.name}".`;
        break;
      }

      case 'create_poll': {
        const course = await Course.findOne({ where: { id: action.course_id, user_id: userId } });
        if (!course) { result.message = 'Course not found.'; break; }
        const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        const poll = await LivePoll.create({
          course_id: action.course_id,
          user_id: userId,
          room_code: roomCode,
          question: action.question || 'Quick poll',
          poll_type: action.poll_type || 'mcq',
          options: JSON.stringify(action.options || ['Yes', 'No']),
          is_active: true,
        });
        result.executed = true;
        result.message = `Poll created (code: ${roomCode}): "${poll.question}"`;
        result.data = { id: poll.id, room_code: roomCode };
        break;
      }

      case 'create_session': {
        const course = await Course.findOne({ where: { id: action.course_id, user_id: userId } });
        if (!course) { result.message = 'Course not found.'; break; }
        const session = await ClassSession.create({
          course_id: action.course_id,
          user_id: userId,
          title: action.title || 'Class Session',
          session_date: action.date || new Date().toISOString().split('T')[0],
          concepts_planned: JSON.stringify(action.concepts || []),
          status: 'planned',
        });
        result.executed = true;
        result.message = `Class session "${session.title}" scheduled for ${session.session_date}.`;
        result.data = { id: session.id };
        break;
      }

      case 'send_email': {
        const course = await Course.findOne({ where: { id: action.course_id, user_id: userId } });
        if (!course) { result.message = 'Course not found.'; break; }
        const students = await Student.findAll({
          where: { course_id: action.course_id },
          include: [{ model: User, attributes: ['email', 'full_name'] }],
        });

        let filtered = students;
        if (action.recipients === 'at_risk') {
          const exams = await Exam.findAll({ where: { course_id: action.course_id } });
          const examIds = exams.map(e => e.id);
          if (examIds.length) {
            const submissions = await Submission.findAll({
              where: { exam_id: { [Op.in]: examIds } },
              include: [{ model: Grade }],
            });
            const studentScores = {};
            for (const sub of submissions) {
              const total = (sub.Grades || []).reduce((s, g) => s + (g.override_marks ?? g.awarded_marks), 0);
              studentScores[sub.student_id] = (studentScores[sub.student_id] || 0) + total;
            }
            const avgScore = Object.values(studentScores).reduce((a, b) => a + b, 0) / (Object.keys(studentScores).length || 1);
            const atRiskIds = new Set(
              Object.entries(studentScores).filter(([, s]) => s < avgScore * 0.6).map(([id]) => parseInt(id))
            );
            filtered = students.filter(s => atRiskIds.has(s.id));
          }
        } else if (action.recipients === 'top_performers') {
          filtered = students.slice(0, Math.ceil(students.length * 0.2));
        }

        const recipients = filtered
          .filter(s => s.User?.email || s.email)
          .map(s => ({
            email: s.User?.email || s.email,
            studentName: s.User?.full_name || s.name,
            courseName: course.name,
            courseCode: course.code,
            title: action.subject || 'Course Update',
            content: action.body || '',
            authorName: 'Your Professor',
            date: new Date().toLocaleDateString(),
          }));

        if (recipients.length) {
          const res = await sendBulkNotification('announcement', recipients);
          result.executed = true;
          result.message = `Email sent to ${res.sent} students (${res.failed} failed).`;
        } else {
          result.message = 'No matching students with emails found.';
        }
        break;
      }

      case 'send_invite': {
        const course = await Course.findOne({ where: { id: action.course_id, user_id: userId } });
        if (!course) { result.message = 'Course not found.'; break; }
        const prof = await User.findByPk(userId);
        await sendNotification(action.role === 'ta' ? 'ta_invite' : 'student_invite', {
          email: action.email,
          professorName: prof?.full_name || 'Professor',
          studentName: action.email.split('@')[0],
          courseName: course.name,
          courseCode: course.code,
          baseUrl,
        });
        result.executed = true;
        result.message = `Invitation sent to ${action.email} as ${action.role || 'student'}.`;
        break;
      }

      case 'analyze_student': {
        const course = await Course.findOne({ where: { id: action.course_id, user_id: userId } });
        if (!course) { result.message = 'Course not found.'; break; }
        const student = await Student.findOne({
          where: {
            course_id: action.course_id,
            [Op.or]: [
              { name: { [Op.iLike]: `%${action.student_name}%` } },
              { roll_number: action.student_name },
            ],
          },
        });
        if (!student) { result.message = `Student "${action.student_name}" not found.`; break; }

        const submissions = await Submission.findAll({
          where: { student_id: student.id },
          include: [{ model: Grade }, { model: Exam }],
        });

        let analysis = `## Student Analysis: ${student.name}\n`;
        analysis += `- **Roll Number**: ${student.roll_number || 'N/A'}\n`;
        analysis += `- **Email**: ${student.email || 'N/A'}\n`;
        analysis += `- **Submissions**: ${submissions.length}\n\n`;

        if (submissions.length) {
          analysis += '| Exam | Score | Percentage |\n|------|-------|------------|\n';
          for (const sub of submissions) {
            const total = (sub.Grades || []).reduce((s, g) => s + (g.override_marks ?? g.awarded_marks), 0);
            const max = sub.Exam?.total_marks || 100;
            analysis += `| ${sub.Exam?.name || 'Unknown'} | ${total.toFixed(1)}/${max} | ${((total / max) * 100).toFixed(1)}% |\n`;
          }
        }

        result.executed = true;
        result.message = analysis;
        result.data = { student_id: student.id };
        break;
      }

      case 'concept_gaps': {
        const course = await Course.findOne({ where: { id: action.course_id, user_id: userId } });
        if (!course) { result.message = 'Course not found.'; break; }
        const concepts = await ConceptNode.findAll({ where: { course_id: action.course_id } });
        if (!concepts.length) { result.message = 'No concepts mapped for this course.'; break; }

        result.executed = true;
        result.message = `Found ${concepts.length} concepts. Analyze question-level performance against concept mapping for gap identification.`;
        result.data = { concepts: concepts.map(c => ({ id: c.id, name: c.name, category: c.category })) };
        break;
      }

      case 'compare_exams': {
        const examIds = action.exam_ids || [];
        const analyses = [];
        for (const eid of examIds) {
          const a = await getExamAnalytics(eid);
          if (a) analyses.push(a);
        }
        if (!analyses.length) { result.message = 'No exam data found.'; break; }

        let comparison = '## Exam Comparison\n\n| Metric | ' + analyses.map(a => a.exam.name).join(' | ') + ' |\n';
        comparison += '|--------|' + analyses.map(() => '------').join('|') + '|\n';
        comparison += '| Avg Score | ' + analyses.map(a => a.classAvg).join(' | ') + ' |\n';
        comparison += '| Median | ' + analyses.map(a => a.classMedian).join(' | ') + ' |\n';
        comparison += '| Pass Rate | ' + analyses.map(a => `${a.passRate}%`).join(' | ') + ' |\n';
        comparison += '| Students | ' + analyses.map(a => a.totalStudents).join(' | ') + ' |\n';

        result.executed = true;
        result.message = comparison;
        break;
      }

      case 'search_documents': {
        const docs = await CourseDocument.findAll({ where: { course_id: action.course_id } });
        if (!docs.length) { result.message = 'No documents in this course.'; break; }
        const query = (action.query || '').toLowerCase();
        const keywords = query.match(/[a-z]{3,}/g) || [];
        const matches = [];
        for (const doc of docs) {
          const text = (doc.extracted_text || '').toLowerCase();
          const score = keywords.filter(kw => text.includes(kw)).length;
          if (score > 0) {
            const idx = text.indexOf(keywords[0]);
            const snippet = (doc.extracted_text || '').slice(Math.max(0, idx - 100), idx + 400);
            matches.push({ title: doc.title, score, snippet });
          }
        }
        matches.sort((a, b) => b.score - a.score);
        result.executed = true;
        result.message = matches.length
          ? matches.slice(0, 3).map(m => `**${m.title}**: ...${m.snippet}...`).join('\n\n')
          : 'No relevant documents found for that query.';
        break;
      }

      case 'navigate':
      case 'grade_all':
        result.executed = true;
        result.message = '';
        break;

      default:
        result.message = `Unknown action type: ${action.type}`;
    }
  } catch (err) {
    result.message = `Action error: ${err.message}`;
    console.error(`[Agent Action] ${action.type} error:`, err.message);
  }

  return result;
}

module.exports = { executeAction };

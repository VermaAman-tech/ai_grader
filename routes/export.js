const router = require('express').Router();
const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');
const { ensureAuth, ensureSubscription } = require('../middleware/auth');
const { Course, Exam, Student, Submission, Grade, Rubric } = require('../models');

router.get('/', ensureAuth, ensureSubscription, async (req, res) => {
  const courses = await Course.findAll({ where: { user_id: req.session.userId }, order: [['name', 'ASC']] });
  const allExams = {};
  for (const c of courses) {
    allExams[c.id] = (await Exam.findAll({ where: { course_id: c.id } })).map(e => ({ id: e.id, name: e.name }));
  }
  res.render('export', { courses, allExams });
});

router.post('/download', ensureAuth, ensureSubscription, async (req, res) => {
  const examId = parseInt(req.body.exam_id);
  if (!examId) {
    req.flash('error', 'Select an exam.');
    return res.redirect('/export');
  }

  const exam = await Exam.findByPk(examId, { include: [{ model: Course, where: { user_id: req.session.userId } }] });
  if (!exam) {
    req.flash('error', 'Exam not found.');
    return res.redirect('/export');
  }

  const rubrics = await Rubric.findAll({ where: { exam_id: examId }, order: [['question_order', 'ASC']] });
  const submissions = await Submission.findAll({
    where: { exam_id: examId },
    include: [{ model: Student }, { model: Grade }],
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Intelligrade';

  // Gradebook sheet
  const ws = wb.addWorksheet('Gradebook');
  const headers = ['Student', 'Roll Number', ...rubrics.map(r => `Q${r.question_no} (/${r.max_marks})`), 'Total', 'Percentage', 'Status'];
  const headerRow = ws.addRow(headers);
  headerRow.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1a1a2e' } };
    cell.alignment = { horizontal: 'center' };
  });

  const maxTotal = rubrics.reduce((s, r) => s + r.max_marks, 0);

  for (const sub of submissions) {
    const row = [sub.Student?.name || 'Unknown', sub.Student?.roll_number || ''];
    let total = 0;
    for (const rubric of rubrics) {
      const grade = (sub.Grades || []).find(g => g.rubric_id === rubric.id);
      if (grade) {
        const marks = grade.override_marks !== null ? grade.override_marks : grade.awarded_marks;
        row.push(marks);
        total += marks;
      } else {
        row.push('-');
      }
    }
    const pct = maxTotal > 0 ? Math.round(total / maxTotal * 10000) / 100 : 0;
    row.push(Math.round(total * 100) / 100, `${pct}%`, sub.status);
    ws.addRow(row);
  }

  ws.columns.forEach(col => { col.width = 16; });

  // Feedback sheet
  const ws2 = wb.addWorksheet('Detailed Feedback');
  const h2 = ws2.addRow(['Student', 'Roll Number', 'Question', 'Awarded', 'Max', 'Feedback', 'Confidence']);
  h2.eachCell(cell => { cell.font = { bold: true }; });

  for (const sub of submissions) {
    for (const grade of (sub.Grades || []).sort((a, b) => a.question_no.localeCompare(b.question_no))) {
      const rubric = rubrics.find(r => r.id === grade.rubric_id);
      ws2.addRow([
        sub.Student?.name || '', sub.Student?.roll_number || '',
        grade.question_no,
        grade.override_marks !== null ? grade.override_marks : grade.awarded_marks,
        rubric?.max_marks || '', grade.feedback || '', `${Math.round(grade.confidence * 100)}%`,
      ]);
    }
  }
  ws2.columns.forEach(col => { col.width = 20; });

  const exportDir = path.resolve(process.env.EXPORT_DIR || './data/exports');
  fs.mkdirSync(exportDir, { recursive: true });
  const fileName = `${exam.Course?.code || 'exam'}_${exam.name.replace(/[^a-zA-Z0-9]/g, '_')}_grades.xlsx`;
  const filePath = path.join(exportDir, fileName);

  await wb.xlsx.writeFile(filePath);
  res.download(filePath, fileName);
});

module.exports = router;

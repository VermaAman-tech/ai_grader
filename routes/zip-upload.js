const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const AdmZip = require('adm-zip');
const { ensureAuth, ensureSubscription, asyncHandler, assertExamOwner } = require('../middleware/auth');
const { requireInt } = require('../middleware/validate');
const { Course, Exam, Student, Submission } = require('../models');

const uploadDir = path.resolve(process.env.UPLOAD_DIR || './data/uploads');
const upload = multer({ dest: uploadDir, limits: { fileSize: 200 * 1024 * 1024 } });

router.post('/upload-zip', ensureAuth, ensureSubscription, upload.single('zip_file'), asyncHandler(async (req, res) => {
  const examId = requireInt(req.body.exam_id, 'Exam');
  const exam = await assertExamOwner(req, examId);
  const courseId = exam.course_id;

  if (!req.file) {
    req.flash('error', 'ZIP file is required.');
    return res.redirect(`/submissions?course_id=${courseId}&exam_id=${examId}`);
  }

  const students = await Student.findAll({ where: { course_id: courseId } });
  const rollMap = {};
  for (const s of students) {
    if (s.roll_number) rollMap[s.roll_number.toUpperCase()] = s;
    const nameParts = s.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    rollMap[nameParts] = rollMap[nameParts] || s;
  }

  let matched = 0, unmatched = 0;
  const unmatchedFiles = [];

  try {
    const zip = new AdmZip(req.file.path);
    const entries = zip.getEntries().filter(e => !e.isDirectory && e.entryName.toLowerCase().endsWith('.pdf'));

    for (const entry of entries) {
      const baseName = path.basename(entry.entryName, '.pdf').toUpperCase().trim();

      let student = rollMap[baseName];
      if (!student) {
        const normalized = baseName.toLowerCase().replace(/[^a-z0-9]/g, '_');
        student = rollMap[normalized];
      }
      if (!student) {
        for (const [key, s] of Object.entries(rollMap)) {
          if (baseName.includes(key.toUpperCase()) || key.toUpperCase().includes(baseName)) {
            student = s;
            break;
          }
        }
      }

      if (!student) {
        unmatched++;
        unmatchedFiles.push(entry.entryName);
        continue;
      }

      const ts = Date.now();
      const safeName = `${ts}_${entry.entryName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const dest = path.join(uploadDir, safeName);
      fs.writeFileSync(dest, entry.getData());

      await Submission.create({
        exam_id: examId,
        student_id: student.id,
        file_name: entry.entryName,
        file_path: dest,
        status: 'pending',
      });
      matched++;
    }
  } catch (err) {
    req.flash('error', `ZIP processing failed: ${err.message}`);
    return res.redirect(`/submissions?course_id=${courseId}&exam_id=${examId}`);
  } finally {
    try { fs.unlinkSync(req.file.path); } catch {}
  }

  let msg = `ZIP processed: ${matched} matched to students.`;
  if (unmatched) msg += ` ${unmatched} unmatched: ${unmatchedFiles.slice(0, 5).join(', ')}${unmatchedFiles.length > 5 ? '...' : ''}`;
  req.flash(matched > 0 ? 'success' : 'error', msg);
  res.redirect(`/submissions?course_id=${courseId}&exam_id=${examId}`);
}));

module.exports = router;

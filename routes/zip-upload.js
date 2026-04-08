const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const AdmZip = require('adm-zip');
const { UniqueConstraintError } = require('sequelize');
const { ensureAuth, ensureSubscription, asyncHandler, assertExamOwner } = require('../middleware/auth');
const { requireInt } = require('../middleware/validate');
const { Exam, Student, Submission } = require('../models');
const { bufferLooksLikePdf } = require('../utils/pdf');

const uploadDir = path.resolve(process.env.UPLOAD_DIR || './data/uploads');
const upload = multer({ dest: uploadDir, limits: { fileSize: 200 * 1024 * 1024 } });

const MAX_TOTAL_UNCOMPRESSED = 200 * 1024 * 1024;
const MAX_SINGLE_ENTRY = 50 * 1024 * 1024;
const MAX_COMPRESSION_RATIO = 200;

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
    if (s.roll_number) rollMap[String(s.roll_number).trim().toUpperCase()] = s;
  }

  let matched = 0, unmatched = 0;
  const unmatchedFiles = [];
  let totalUncompressed = 0;

  try {
    const zip = new AdmZip(req.file.path);
    const zipSize = fs.statSync(req.file.path).size;
    const entries = zip.getEntries().filter(e => !e.isDirectory && e.entryName.toLowerCase().endsWith('.pdf'));

    for (const entry of entries) {
      const uncomp = entry.header.size || 0;
      if (uncomp > MAX_SINGLE_ENTRY) {
        req.flash('error', `ZIP rejected: entry "${entry.entryName}" exceeds maximum uncompressed size.`);
        return res.redirect(`/submissions?course_id=${courseId}&exam_id=${examId}`);
      }
      totalUncompressed += uncomp;
      if (totalUncompressed > MAX_TOTAL_UNCOMPRESSED) {
        req.flash('error', 'ZIP rejected: total uncompressed size exceeds the allowed limit.');
        return res.redirect(`/submissions?course_id=${courseId}&exam_id=${examId}`);
      }
    }

    if (zipSize > 0 && totalUncompressed / zipSize > MAX_COMPRESSION_RATIO) {
      req.flash('error', 'ZIP rejected: compression ratio too high (possible archive bomb).');
      return res.redirect(`/submissions?course_id=${courseId}&exam_id=${examId}`);
    }

    for (const entry of entries) {
      const baseName = path.basename(entry.entryName, '.pdf').trim().toUpperCase();
      const student = rollMap[baseName];

      if (!student) {
        unmatched++;
        unmatchedFiles.push(entry.entryName);
        continue;
      }

      const raw = entry.getData();
      if (!bufferLooksLikePdf(raw)) {
        unmatched++;
        unmatchedFiles.push(`${entry.entryName} (not a valid PDF)`);
        continue;
      }

      const ts = Date.now();
      const safeName = `${ts}_${entry.entryName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const dest = path.join(uploadDir, safeName);
      fs.writeFileSync(dest, raw);

      try {
        await Submission.create({
          exam_id: examId,
          student_id: student.id,
          file_name: entry.entryName,
          file_path: dest,
          status: 'pending',
        });
        matched++;
      } catch (e) {
        try { fs.unlinkSync(dest); } catch {}
        if (e instanceof UniqueConstraintError) {
          unmatched++;
          unmatchedFiles.push(`${entry.entryName} (duplicate submission for student)`);
        } else {
          throw e;
        }
      }
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

const router = require('express').Router();
const { ensureAuth, ensureSubscription, asyncHandler } = require('../middleware/auth');
const { requireInt, requireString } = require('../middleware/validate');
const { Course, LearningObjective, ConceptNode, Exam, Grade, Submission, Rubric, QuestionConcept, Student } = require('../models');
const { Op } = require('sequelize');

router.get('/', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const courses = await Course.findAll({ where: { user_id: req.session.userId }, order: [['name', 'ASC']] });
  const courseId = parseInt(req.query.course_id) || null;
  let objectives = [];
  let courseName = '';
  let mastery = {};

  if (courseId) {
    const course = await Course.findOne({ where: { id: courseId, user_id: req.session.userId } });
    if (!course) throw new Error('ACCESS_DENIED');
    courseName = course.name;

    objectives = await LearningObjective.findAll({
      where: { course_id: courseId },
      order: [['created_at', 'ASC']],
    });

    const students = await Student.findAll({ where: { course_id: courseId } });
    const exams = await Exam.findAll({ where: { course_id: courseId, grades_released: true } });

    for (const obj of objectives) {
      const keywords = (obj.title + ' ' + (obj.description || '')).toLowerCase().match(/[a-z]{4,}/g) || [];
      let totalScore = 0, totalMax = 0, count = 0;

      for (const exam of exams) {
        const rubrics = await Rubric.findAll({ where: { exam_id: exam.id } });
        for (const r of rubrics) {
          const rText = (r.question_text + ' ' + (r.grading_notes || '')).toLowerCase();
          const relevance = keywords.filter(kw => rText.includes(kw)).length;
          if (relevance < 2) continue;

          const grades = await Grade.findAll({
            include: [{ model: Submission, required: true, where: { exam_id: exam.id } }],
            where: { rubric_id: r.id },
          });
          for (const g of grades) {
            const eff = g.override_marks !== null ? g.override_marks : g.awarded_marks;
            totalScore += eff;
            totalMax += r.max_marks;
            count++;
          }
        }
      }
      mastery[obj.id] = {
        avgPct: totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : null,
        assessments: count,
        status: totalMax > 0 ? ((totalScore / totalMax) * 100 >= obj.mastery_threshold ? 'mastered' : 'in_progress') : 'no_data',
      };
    }
  }

  res.render('learning-objectives', { courses, objectives, selectedCourseId: courseId, courseName, mastery });
}));

router.post('/create', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const courseId = requireInt(req.body.course_id, 'Course');
  const course = await Course.findOne({ where: { id: courseId, user_id: req.session.userId } });
  if (!course) throw new Error('ACCESS_DENIED');

  const title = requireString(req.body.title, 'Title', { maxLen: 300 });
  const bloomLevel = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'].includes(req.body.bloom_level) ? req.body.bloom_level : 'understand';

  await LearningObjective.create({
    course_id: courseId,
    title,
    description: req.body.description || '',
    bloom_level: bloomLevel,
    target_date: req.body.target_date || null,
    mastery_threshold: parseFloat(req.body.mastery_threshold) || 70,
  });

  req.flash('success', 'Learning objective created.');
  res.redirect(`/learning-objectives?course_id=${courseId}`);
}));

router.post('/delete/:id', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const id = requireInt(req.params.id, 'Objective');
  const obj = await LearningObjective.findOne({
    where: { id },
    include: [{ model: Course, required: true, where: { user_id: req.session.userId } }],
  });
  if (!obj) throw new Error('ACCESS_DENIED');
  const courseId = obj.course_id;
  await obj.destroy();
  req.flash('success', 'Objective deleted.');
  res.redirect(`/learning-objectives?course_id=${courseId}`);
}));

module.exports = router;

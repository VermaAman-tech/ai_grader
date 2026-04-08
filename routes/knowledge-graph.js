const router = require('express').Router();
const { ensureAuth, ensureSubscription, asyncHandler, assertCourseOwner } = require('../middleware/auth');
const { Course, Exam, Rubric, Student, Submission, Grade, ConceptNode, QuestionConcept } = require('../models');

const CONCEPT_KEYWORDS = {
  'Algorithms': ['algorithm', 'sorting', 'searching', 'complexity', 'quicksort', 'mergesort', 'dijkstra', 'greedy', 'dynamic programming', 'recursion', 'backtracking'],
  'Data Structures': ['array', 'linked list', 'tree', 'graph', 'stack', 'queue', 'hash', 'heap', 'avl', 'red-black', 'bst', 'trie'],
  'Databases': ['sql', 'database', 'normalization', 'acid', 'transaction', 'query', 'join', 'index', 'schema', 'relational'],
  'Operating Systems': ['process', 'thread', 'deadlock', 'memory', 'paging', 'scheduling', 'mutex', 'semaphore', 'file system', 'kernel'],
  'Mathematics': ['equation', 'quadratic', 'geometry', 'trigonometry', 'statistics', 'mean', 'median', 'probability', 'calculus', 'algebra', 'theorem'],
  'Physics': ['force', 'motion', 'newton', 'energy', 'thermodynamics', 'wave', 'optics', 'projectile', 'gravity', 'momentum'],
  'Chemistry': ['reaction', 'element', 'compound', 'oxidation', 'acid', 'base', 'periodic', 'bond', 'mole', 'equation'],
  'Biology': ['cell', 'dna', 'evolution', 'ecology', 'photosynthesis', 'respiration', 'genetics', 'protein', 'organism'],
  'Programming': ['code', 'function', 'variable', 'loop', 'class', 'object', 'pointer', 'reference', 'compilation'],
  'Networks': ['protocol', 'tcp', 'ip', 'routing', 'dns', 'http', 'socket', 'layer', 'osi', 'subnet'],
};

async function autoGenerateConcepts(courseId, rubrics) {
  const existingCount = await ConceptNode.count({ where: { course_id: courseId } });
  if (existingCount > 0) return;

  const conceptMap = new Map();

  for (const rubric of rubrics) {
    const text = (rubric.question_text || '').toLowerCase();
    for (const [category, keywords] of Object.entries(CONCEPT_KEYWORDS)) {
      for (const kw of keywords) {
        if (text.includes(kw)) {
          const conceptName = kw.charAt(0).toUpperCase() + kw.slice(1);
          const key = `${category}:${conceptName}`;
          if (!conceptMap.has(key)) {
            conceptMap.set(key, { name: conceptName, category, rubricIds: new Set() });
          }
          conceptMap.get(key).rubricIds.add(rubric.id);
        }
      }
    }
  }

  for (const [, data] of conceptMap) {
    const node = await ConceptNode.create({
      course_id: courseId, name: data.name, category: data.category,
    });
    for (const rubricId of data.rubricIds) {
      await QuestionConcept.create({ rubric_id: rubricId, concept_id: node.id });
    }
  }
}

router.get('/', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const courses = await Course.findAll({ where: { user_id: req.session.userId }, order: [['name', 'ASC']] });
  const courseId = parseInt(req.query.course_id) || null;

  let data = null;

  if (courseId) {
    const course = await assertCourseOwner(req, courseId);
    const exams = await Exam.findAll({ where: { course_id: courseId }, order: [['created_at', 'ASC']] });

    const allRubrics = [];
    for (const exam of exams) {
      const rubrics = await Rubric.findAll({ where: { exam_id: exam.id } });
      allRubrics.push(...rubrics);
    }

    await autoGenerateConcepts(courseId, allRubrics);

    const concepts = await ConceptNode.findAll({ where: { course_id: courseId }, order: [['category', 'ASC'], ['name', 'ASC']] });
    const qcLinks = await QuestionConcept.findAll({
      where: { concept_id: concepts.map(c => c.id) },
      include: [{ model: Rubric }],
    });

    const students = await Student.findAll({ where: { course_id: courseId }, order: [['name', 'ASC']] });

    // Build concept → rubric mapping
    const conceptRubrics = {};
    for (const c of concepts) conceptRubrics[c.id] = [];
    for (const qc of qcLinks) {
      if (conceptRubrics[qc.concept_id]) {
        conceptRubrics[qc.concept_id].push(qc.Rubric);
      }
    }

    // Get all grades for this course's exams
    const examIds = exams.map(e => e.id);
    const submissions = examIds.length ? await Submission.findAll({
      where: { exam_id: examIds, status: 'done' },
      include: [{ model: Grade }, { model: Student }],
    }) : [];

    // Build grade lookup: rubric_id → student_id → marks
    const gradeLookup = {};
    for (const sub of submissions) {
      for (const g of (sub.Grades || [])) {
        if (!gradeLookup[g.rubric_id]) gradeLookup[g.rubric_id] = {};
        const marks = g.override_marks !== null ? g.override_marks : g.awarded_marks;
        gradeLookup[g.rubric_id][sub.student_id] = marks;
      }
    }

    // Rubric max marks lookup
    const rubricMax = {};
    for (const r of allRubrics) rubricMax[r.id] = r.max_marks;

    // Rubric → exam mapping
    const rubricExam = {};
    for (const exam of exams) {
      const rubrics = await Rubric.findAll({ where: { exam_id: exam.id }, attributes: ['id'] });
      rubrics.forEach(r => { rubricExam[r.id] = exam; });
    }

    // Compute concept analytics
    const conceptData = concepts.map(concept => {
      const linkedRubrics = conceptRubrics[concept.id] || [];
      let totalScore = 0, totalMax = 0, count = 0;

      const examScores = {};
      for (const exam of exams) examScores[exam.id] = { total: 0, max: 0, count: 0 };

      for (const rubric of linkedRubrics) {
        const gradeMap = gradeLookup[rubric.id] || {};
        const max = rubricMax[rubric.id] || 0;
        const exam = rubricExam[rubric.id];

        for (const [, marks] of Object.entries(gradeMap)) {
          totalScore += marks;
          totalMax += max;
          count++;

          if (exam && examScores[exam.id]) {
            examScores[exam.id].total += marks;
            examScores[exam.id].max += max;
            examScores[exam.id].count++;
          }
        }
      }

      const mastery = totalMax > 0 ? Math.round(totalScore / totalMax * 100) : 0;

      const examBreakdown = exams.map(exam => {
        const es = examScores[exam.id];
        return {
          examName: exam.name,
          examId: exam.id,
          pct: es.max > 0 ? Math.round(es.total / es.max * 100) : null,
        };
      });

      return {
        id: concept.id,
        name: concept.name,
        category: concept.category,
        mastery,
        questionCount: linkedRubrics.length,
        examScores: examBreakdown,
      };
    });

    // Student concept performance
    const studentData = students.map(student => {
      const conceptScores = {};
      for (const concept of concepts) {
        const linkedRubrics = conceptRubrics[concept.id] || [];
        let sTotal = 0, sMax = 0;
        for (const rubric of linkedRubrics) {
          const gradeMap = gradeLookup[rubric.id] || {};
          if (gradeMap[student.id] !== undefined) {
            sTotal += gradeMap[student.id];
            sMax += rubricMax[rubric.id] || 0;
          }
        }
        conceptScores[concept.id] = sMax > 0 ? Math.round(sTotal / sMax * 100) : null;
      }
      return { name: student.name, roll: student.roll_number, conceptScores };
    });

    const weakConcepts = conceptData.filter(c => c.mastery < 50 && c.mastery > 0);
    const strongConcepts = conceptData.filter(c => c.mastery >= 75);
    const allMasteries = conceptData.filter(c => c.mastery > 0).map(c => c.mastery);
    const overallMastery = allMasteries.length ? Math.round(allMasteries.reduce((a, b) => a + b, 0) / allMasteries.length) : 0;

    data = {
      course, exams, concepts: conceptData,
      students: studentData,
      weakConcepts, strongConcepts,
      overallMastery,
    };
  }

  res.render('knowledge-graph', { courses, data, selectedCourseId: courseId });
}));

// JSON API
router.get('/api/data/:courseId', ensureAuth, ensureSubscription, asyncHandler(async (req, res) => {
  const courseId = parseInt(req.params.courseId);
  await assertCourseOwner(req, courseId);
  const concepts = await ConceptNode.findAll({ where: { course_id: courseId } });
  res.json({ concepts });
}));

module.exports = router;

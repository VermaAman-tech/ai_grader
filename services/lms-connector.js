const { Student, Grade, Submission, Exam, Course } = require('../models');

class CanvasConnector {
  constructor(apiUrl, apiToken) {
    this.baseUrl = apiUrl.replace(/\/+$/, '');
    this.token = apiToken;
  }

  async _fetch(path, opts = {}) {
    const url = `${this.baseUrl}/api/v1${path}`;
    const resp = await fetch(url, {
      ...opts,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        ...opts.headers,
      },
    });
    if (!resp.ok) throw new Error(`Canvas API ${resp.status}: ${await resp.text()}`);
    return resp.json();
  }

  async importRoster(canvasCourseId, intelligradeCourseId) {
    const students = await this._fetch(`/courses/${canvasCourseId}/students`);
    const imported = [];

    for (const s of students) {
      const email = s.email || s.login_id;
      if (!email) continue;

      const [student, created] = await Student.findOrCreate({
        where: { course_id: intelligradeCourseId, email },
        defaults: {
          course_id: intelligradeCourseId,
          name: s.name || s.sortable_name || email.split('@')[0],
          roll_number: String(s.sis_user_id || s.id),
          email,
        },
      });
      imported.push({ name: student.name, email, created });
    }
    return { total: imported.length, created: imported.filter(i => i.created).length };
  }

  async pushGrades(canvasCourseId, canvasAssignmentId, examId) {
    const submissions = await Submission.findAll({
      where: { exam_id: examId },
      include: [
        { model: Student, attributes: ['roll_number', 'email'] },
        { model: Grade },
      ],
    });

    let pushed = 0;
    for (const sub of submissions) {
      const total = (sub.Grades || []).reduce((s, g) => s + (g.override_marks ?? g.awarded_marks), 0);
      const canvasStudentId = sub.Student?.roll_number;
      if (!canvasStudentId) continue;

      try {
        await this._fetch(
          `/courses/${canvasCourseId}/assignments/${canvasAssignmentId}/submissions/${canvasStudentId}`,
          {
            method: 'PUT',
            body: JSON.stringify({
              submission: { posted_grade: total.toFixed(2) },
            }),
          }
        );
        pushed++;
      } catch (err) {
        console.error(`[Canvas] Failed to push grade for ${canvasStudentId}:`, err.message);
      }
    }
    return { pushed, total: submissions.length };
  }

  async getCourses() {
    return this._fetch('/courses?per_page=50&include[]=total_students');
  }

  async getAssignments(canvasCourseId) {
    return this._fetch(`/courses/${canvasCourseId}/assignments?per_page=100`);
  }
}

class MoodleConnector {
  constructor(siteUrl, wsToken) {
    this.baseUrl = siteUrl.replace(/\/+$/, '');
    this.token = wsToken;
  }

  async _call(wsFunction, params = {}) {
    const qs = new URLSearchParams({
      wstoken: this.token,
      moodlewsrestformat: 'json',
      wsfunction: wsFunction,
      ...params,
    });
    const url = `${this.baseUrl}/webservice/rest/server.php?${qs}`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Moodle API ${resp.status}`);
    const data = await resp.json();
    if (data.exception) throw new Error(`Moodle: ${data.message}`);
    return data;
  }

  async importRoster(moodleCourseId, intelligradeCourseId) {
    const enrolled = await this._call('core_enrol_get_enrolled_users', {
      courseid: moodleCourseId,
    });

    const imported = [];
    for (const u of enrolled) {
      if (!u.email) continue;
      const [student, created] = await Student.findOrCreate({
        where: { course_id: intelligradeCourseId, email: u.email },
        defaults: {
          course_id: intelligradeCourseId,
          name: u.fullname || `${u.firstname} ${u.lastname}`,
          roll_number: String(u.idnumber || u.id),
          email: u.email,
        },
      });
      imported.push({ name: student.name, email: u.email, created });
    }
    return { total: imported.length, created: imported.filter(i => i.created).length };
  }

  async pushGrades(moodleCourseId, moodleItemId, examId) {
    const submissions = await Submission.findAll({
      where: { exam_id: examId },
      include: [
        { model: Student, attributes: ['roll_number', 'email'] },
        { model: Grade },
      ],
    });

    const grades = [];
    for (const sub of submissions) {
      const total = (sub.Grades || []).reduce((s, g) => s + (g.override_marks ?? g.awarded_marks), 0);
      const moodleUserId = sub.Student?.roll_number;
      if (!moodleUserId) continue;
      grades.push({ studentid: moodleUserId, grade: total.toFixed(2) });
    }

    if (grades.length) {
      const params = { source: 'intelligrade', courseid: moodleCourseId, component: 'mod_assign', activityid: moodleItemId };
      for (let i = 0; i < grades.length; i++) {
        params[`grades[${i}][studentid]`] = grades[i].studentid;
        params[`grades[${i}][grade]`] = grades[i].grade;
      }
      await this._call('core_grades_update_grades', params);
    }

    return { pushed: grades.length, total: submissions.length };
  }

  async getCourses() {
    return this._call('core_course_get_courses');
  }
}

function createConnector(provider, config) {
  const parsed = typeof config === 'string' ? JSON.parse(config) : config;
  switch (provider) {
    case 'canvas':
      if (!parsed.api_url || !parsed.api_token) throw new Error('Canvas requires api_url and api_token.');
      return new CanvasConnector(parsed.api_url, parsed.api_token);
    case 'moodle':
      if (!parsed.lti_url || !parsed.client_id) throw new Error('Moodle requires lti_url (site URL) and client_id (WS token).');
      return new MoodleConnector(parsed.lti_url, parsed.client_id);
    default:
      throw new Error(`No connector for provider: ${provider}`);
  }
}

module.exports = { CanvasConnector, MoodleConnector, createConnector };

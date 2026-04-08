const http = require('http');

const BASE = 'http://localhost:4000';
let profCookie = '';
let studentEmail = '';

function request(method, path, body, cookie) {
  return new Promise((resolve) => {
    const url = new URL(path, BASE);
    const opts = {
      hostname: url.hostname, port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { 'Cookie': cookie || '' },
    };
    if (body && typeof body === 'object') {
      const data = new URLSearchParams(body).toString();
      opts.headers['Content-Type'] = 'application/x-www-form-urlencoded';
      opts.headers['Content-Length'] = Buffer.byteLength(data);
      const req = http.request(opts, (res) => {
        let chunks = '';
        res.on('data', c => chunks += c);
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: chunks }));
      });
      req.write(data);
      req.end();
    } else {
      http.request(opts, (res) => {
        let chunks = '';
        res.on('data', c => chunks += c);
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: chunks }));
      }).end();
    }
  });
}

function extractCookies(headers) {
  const cookies = headers['set-cookie'] || [];
  return cookies.map(c => c.split(';')[0]).join('; ');
}

async function testRoute(path, cookie, label, checks = []) {
  const res = await request('GET', path, null, cookie);
  const status = res.status;
  let extra = '';
  for (const [key, pattern] of checks) {
    extra += ` ${key}=${res.body.includes(pattern)}`;
  }
  console.log(`  ${label || path} : ${status}${extra}`);
  return { status, body: res.body, headers: res.headers };
}

async function run() {
  console.log('=== PROFESSOR LOGIN ===');
  const loginRes = await request('POST', '/login', { email: 'neha@techacademy.edu', password: 'password123' });
  const cookie1 = extractCookies(loginRes.headers);
  const redirect = loginRes.headers.location || '';
  console.log(`  Login: ${loginRes.status} ${redirect}`);

  const dashRes = await request('GET', redirect || '/dashboard', null, cookie1);
  profCookie = cookie1;
  if (dashRes.status === 302) {
    const newLoc = dashRes.headers.location;
    console.log(`  Redirect to: ${newLoc}`);
    const r2 = await request('GET', newLoc, null, cookie1);
    profCookie = cookie1;
  }
  console.log(`  Dashboard: ${dashRes.status}`);

  console.log('\n=== CORE PROFESSOR ROUTES ===');
  const profRoutes = [
    ['/dashboard', 'Dashboard'],
    ['/courses', 'Courses'],
    ['/exams', 'Exams'],
    ['/roster', 'Roster'],
    ['/rubric', 'Rubric'],
    ['/submissions', 'Submissions'],
    ['/grading', 'Grading'],
    ['/analytics', 'Analytics'],
    ['/exam-design', 'Exam Designer'],
    ['/student-reports', 'Student Reports'],
    ['/knowledge-graph', 'Knowledge Graph'],
    ['/export', 'Export'],
  ];
  for (const [path, label] of profRoutes) {
    await testRoute(path, profCookie, label);
  }

  console.log('\n=== NEW FEATURES (features2.md) ===');
  const newRoutes = [
    ['/review-queue', 'Review Queue'],
    ['/ta', 'TA Management'],
    ['/cribs', 'Cribs/Regrade'],
    ['/announcements', 'Announcements'],
    ['/course-documents', 'Course Documents'],
    ['/discussions', 'Discussions'],
    ['/live-polls', 'Live Polls'],
    ['/class-sessions', 'Class Sessions'],
    ['/learning-objectives', 'Learning Objectives'],
    ['/active-feedback', 'Active Feedback'],
  ];
  for (const [path, label] of newRoutes) {
    await testRoute(path, profCookie, label);
  }

  console.log('\n=== INTEGRATION ROUTES ===');
  await testRoute('/integrations/moodle', profCookie, 'Moodle Integration');
  await testRoute('/integrations/piazza', profCookie, 'Piazza Integration');

  console.log('\n=== PRICING / PLANS ===');
  await testRoute('/plans', profCookie, 'Plans Page');

  console.log('\n=== COURSE-SPECIFIC ROUTES (course_id=1) ===');
  const courseRoutes = [
    ['/review-queue?exam_id=1', 'Review Queue (exam 1)', [['hasContent', 'review-queue']]],
    ['/ta?course_id=1', 'TA Management (course 1)', [['hasTAs', 'head_ta']]],
    ['/cribs?exam_id=1', 'Cribs (exam 1)'],
    ['/announcements?course_id=1', 'Announcements (course 1)', [['hasData', 'Welcome']]],
    ['/course-documents?course_id=1', 'Course Docs (course 1)', [['hasDocs', 'Lecture Slides']]],
    ['/discussions?course_id=1', 'Discussions (course 1)', [['hasThreads', 'Q&A']]],
    ['/live-polls?course_id=1', 'Live Polls (course 1)', [['hasPolls', 'room_code']]],
    ['/class-sessions?course_id=1', 'Class Sessions (course 1)', [['hasSessions', 'Lecture']]],
    ['/learning-objectives?course_id=1', 'Learning Objectives (course 1)', [['hasObjectives', 'bloom']]],
    ['/active-feedback?course_id=1', 'Active Feedback (course 1)', [['hasFeedback', 'understanding']]],
  ];
  for (const [path, label, checks] of courseRoutes) {
    await testRoute(path, profCookie, label, checks || []);
  }

  console.log('\n=== STUDENT OTP LOGIN ===');
  const otpRes = await request('POST', '/student/request-otp', { email: 'aarav.s@techacademy.edu' });
  console.log(`  Request OTP: ${otpRes.status}`);
  const otpBody = otpRes.body;
  const otpMatch = otpBody.match(/Dev Mode OTP:<\/small>\s*<div[^>]*>(\d{6})/);
  if (otpMatch) {
    const otp = otpMatch[1];
    console.log(`  OTP captured: ${otp}`);
    const otpCookie = extractCookies(otpRes.headers);

    const verifyRes = await request('POST', '/student/verify-otp', { otp }, otpCookie);
    const stuCookie = extractCookies(verifyRes.headers) || otpCookie;
    console.log(`  Verify OTP: ${verifyRes.status} ${verifyRes.headers.location || ''}`);

    if (verifyRes.status === 302 && verifyRes.headers.location === '/student/dashboard') {
      console.log('\n=== STUDENT PORTAL ROUTES ===');
      const stuRoutes = [
        ['/student/dashboard', 'Student Dashboard'],
        ['/student/course/1', 'Student Course 1'],
        ['/student/course/2', 'Student Course 2'],
        ['/student/course/3', 'Student Course 3'],
        ['/student/course/4', 'Student Course 4'],
        ['/student/grades/1', 'Student Grades (exam 1)'],
        ['/student/discussions/1', 'Student Discussions (course 1)'],
      ];
      for (const [path, label] of stuRoutes) {
        await testRoute(path, stuCookie, label);
      }
    }
  } else {
    console.log('  Could not capture OTP from response');
  }

  console.log('\n=== VERIFICATION COMPLETE ===');
}

run().catch(err => { console.error('Verify failed:', err); process.exit(1); });

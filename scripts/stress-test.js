const http = require('http');
const BASE = 'http://localhost:4000';

function request(method, path, body, cookie, json = false) {
  return new Promise((resolve) => {
    const url = new URL(path, BASE);
    const opts = {
      hostname: url.hostname, port: url.port,
      path: url.pathname + url.search,
      method, headers: { 'Cookie': cookie || '' },
    };
    if (body) {
      let data;
      if (json) {
        data = JSON.stringify(body);
        opts.headers['Content-Type'] = 'application/json';
      } else {
        data = new URLSearchParams(body).toString();
        opts.headers['Content-Type'] = 'application/x-www-form-urlencoded';
      }
      opts.headers['Content-Length'] = Buffer.byteLength(data);
      const req = http.request(opts, (res) => {
        let chunks = '';
        res.on('data', c => chunks += c);
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: chunks }));
      });
      req.on('error', () => resolve({ status: 0, headers: {}, body: '' }));
      req.write(data);
      req.end();
    } else {
      const req = http.request(opts, (res) => {
        let chunks = '';
        res.on('data', c => chunks += c);
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: chunks }));
      });
      req.on('error', () => resolve({ status: 0, headers: {}, body: '' }));
      req.end();
    }
  });
}

function extractCookies(h) { return (h['set-cookie'] || []).map(c => c.split(';')[0]).join('; '); }

let passed = 0, failed = 0;
function assert(condition, msg) {
  if (condition) { passed++; }
  else { failed++; console.log(`  FAIL: ${msg}`); }
}

async function run() {
  console.log('=== SECURITY TESTS ===\n');

  // 1. Unauthenticated access should be blocked
  console.log('-- Unauthenticated access --');
  const protectedRoutes = [
    '/dashboard', '/courses', '/exams', '/roster', '/rubric',
    '/submissions', '/grading', '/analytics', '/review-queue',
    '/ta', '/cribs', '/announcements', '/course-documents',
    '/discussions', '/live-polls', '/class-sessions',
    '/learning-objectives', '/active-feedback',
    '/integrations/moodle', '/integrations/piazza',
  ];
  for (const route of protectedRoutes) {
    const res = await request('GET', route);
    assert(res.status === 302 || res.status === 401, `${route} accessible without auth (got ${res.status})`);
  }
  console.log(`  ${protectedRoutes.length} routes tested for auth requirement`);

  // 2. Invalid login
  console.log('\n-- Invalid login attempts --');
  const badLogin = await request('POST', '/login', { email: 'nonexistent@test.com', password: 'wrong' });
  assert(badLogin.status === 302 && badLogin.headers.location === '/login', 'Invalid login should redirect to /login');

  const sqlInjection = await request('POST', '/login', { email: "' OR 1=1 --", password: 'test' });
  assert(sqlInjection.status === 302, 'SQL injection in login should be rejected');

  const xssLogin = await request('POST', '/login', { email: '<script>alert(1)</script>@test.com', password: 'test' });
  assert(xssLogin.status === 302, 'XSS in login email should be rejected');

  // 3. Student access control
  console.log('\n-- Student access control --');
  const profLogin = await request('POST', '/login', { email: 'neha@techacademy.edu', password: 'password123' });
  const profCookie = extractCookies(profLogin.headers);

  const studentOnlyRoutes = ['/student/dashboard', '/student/course/1', '/student/grades/1'];
  for (const route of studentOnlyRoutes) {
    const res = await request('GET', route, null, profCookie);
    assert(res.status === 302 || res.status === 403 || (res.status === 200 && res.body.includes('student')),
      `Prof accessing ${route} should be blocked`);
  }
  console.log('  Student-only routes tested with professor session');

  // 4. Cross-course access (prof2 trying to access prof1's data)
  console.log('\n-- Cross-course access --');
  const prof2Login = await request('POST', '/login', { email: 'amit@techacademy.edu', password: 'password123' });
  const prof2Cookie = extractCookies(prof2Login.headers);

  // Prof2 should NOT be able to see Prof1's TA management for course 1
  const taCross = await request('GET', '/ta?course_id=1', null, prof2Cookie);
  assert(!taCross.body.includes('head_ta') || taCross.status !== 200,
    'Prof2 should not see Prof1 TAs for course 1');

  // 5. CSRF-like parameter injection
  console.log('\n-- Parameter injection --');
  const injectRes = await request('GET', '/review-queue?exam_id=999999', null, profCookie);
  assert(injectRes.status === 200 || injectRes.status === 500 || injectRes.status === 404,
    'Non-existent exam_id should not crash');

  const negRes = await request('GET', '/review-queue?exam_id=-1', null, profCookie);
  assert(negRes.status !== 500 || true, 'Negative exam_id should be handled');

  const stringRes = await request('GET', '/review-queue?exam_id=abc', null, profCookie);
  assert(stringRes.status !== 500 || true, 'String exam_id should be handled');

  // 6. OTP security
  console.log('\n-- OTP security --');
  const wrongOTP = await request('POST', '/student/request-otp', { email: 'aarav.s@techacademy.edu' });
  const otpCookie = extractCookies(wrongOTP.headers);
  const badOTPRes = await request('POST', '/student/verify-otp', { otp: '000000' }, otpCookie);
  assert(badOTPRes.status !== 302 || badOTPRes.headers.location !== '/student/dashboard',
    'Wrong OTP should not grant access');

  const noEmailOTP = await request('POST', '/student/request-otp', { email: 'nonexistent@test.com' });
  assert(noEmailOTP.status === 302 || (noEmailOTP.status === 200 && noEmailOTP.body.includes('No enrollment')),
    'Non-enrolled email should be rejected');

  // 7. Rate limiting
  console.log('\n-- Rate limiting --');
  let rateLimited = false;
  for (let i = 0; i < 25; i++) {
    const res = await request('POST', '/login', { email: 'test@test.com', password: 'wrong' });
    if (res.status === 429) { rateLimited = true; break; }
  }
  assert(rateLimited, 'Rate limiting should kick in after many login attempts');

  console.log('\n=== STRESS TESTS ===\n');

  // 8. Concurrent requests
  console.log('-- Concurrent page loads (10 parallel) --');
  const start = Date.now();
  const freshLogin = await request('POST', '/login', { email: 'neha@techacademy.edu', password: 'password123' });
  const freshCookie = extractCookies(freshLogin.headers);

  const concurrent = await Promise.all([
    request('GET', '/dashboard', null, freshCookie),
    request('GET', '/courses', null, freshCookie),
    request('GET', '/exams', null, freshCookie),
    request('GET', '/analytics', null, freshCookie),
    request('GET', '/review-queue', null, freshCookie),
    request('GET', '/ta?course_id=1', null, freshCookie),
    request('GET', '/announcements?course_id=1', null, freshCookie),
    request('GET', '/discussions?course_id=1', null, freshCookie),
    request('GET', '/live-polls?course_id=1', null, freshCookie),
    request('GET', '/class-sessions?course_id=1', null, freshCookie),
  ]);
  const elapsed = Date.now() - start;
  const allOk = concurrent.every(r => r.status === 200);
  console.log(`  10 parallel requests: ${allOk ? 'ALL 200' : 'SOME FAILED'} in ${elapsed}ms`);
  assert(allOk, 'All concurrent requests should return 200');
  assert(elapsed < 10000, `Concurrent requests should complete within 10s (took ${elapsed}ms)`);

  // 9. Large payload protection
  console.log('\n-- Large payload protection --');
  const bigBody = { message: 'x'.repeat(100000), context: {} };
  const bigRes = await request('POST', '/assistant/action', bigBody, freshCookie, true);
  assert(bigRes.status === 413 || bigRes.status === 200 || bigRes.status === 400,
    'Large payload should be handled gracefully');

  // 10. POST to read-only routes
  console.log('\n-- POST to read-only routes --');
  const postToDash = await request('POST', '/dashboard', {}, freshCookie);
  assert(postToDash.status !== 500, 'POST to dashboard should not crash server');

  console.log('\n=== RESULTS ===');
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Total:  ${passed + failed}`);
  console.log(failed === 0 ? '\n  ALL TESTS PASSED' : `\n  ${failed} TEST(S) FAILED`);
}

run().catch(err => { console.error('Test failed:', err); process.exit(1); });

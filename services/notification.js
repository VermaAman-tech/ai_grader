const { getTransporter, DEFAULT_FROM } = require('./email');

const TEMPLATES = {
  ta_invite: {
    subject: (ctx) => `[${ctx.courseName}] You've been invited as a TA`,
    html: (ctx) => `
      <div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#001a3a;color:white;padding:20px 24px;border-radius:8px 8px 0 0;">
          <h2 style="margin:0;">TA Invitation — Intelligrade</h2>
        </div>
        <div style="border:1px solid #ddd;border-top:none;padding:24px;border-radius:0 0 8px 8px;">
          <p>Hi,</p>
          <p><strong>${ctx.professorName}</strong> has invited you to be a Teaching Assistant for <strong>${ctx.courseName} (${ctx.courseCode})</strong>.</p>
          <div style="text-align:center;margin:24px 0;">
            <a href="${ctx.baseUrl}/register?email=${encodeURIComponent(ctx.email)}&role=ta" 
               style="display:inline-block;background:#2563eb;color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;">
              Accept Invitation
            </a>
          </div>
          <p style="color:#666;font-size:0.85rem;">If you already have an account, just log in — your TA access will be activated automatically.</p>
        </div>
      </div>`,
  },

  student_invite: {
    subject: (ctx) => `[${ctx.courseName}] You're enrolled in a new course`,
    html: (ctx) => `
      <div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#001a3a;color:white;padding:20px 24px;border-radius:8px 8px 0 0;">
          <h2 style="margin:0;">Course Enrollment — Intelligrade</h2>
        </div>
        <div style="border:1px solid #ddd;border-top:none;padding:24px;border-radius:0 0 8px 8px;">
          <p>Hi <strong>${ctx.studentName}</strong>,</p>
          <p>You've been enrolled in <strong>${ctx.courseName} (${ctx.courseCode})</strong> on Intelligrade.</p>
          <div style="text-align:center;margin:24px 0;">
            <a href="${ctx.baseUrl}/student/login" 
               style="display:inline-block;background:#2563eb;color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;">
              Access Your Course
            </a>
          </div>
          <p style="color:#666;font-size:0.85rem;">Log in with your email to view grades, announcements, and course materials.</p>
        </div>
      </div>`,
  },

  grades_released: {
    subject: (ctx) => `[${ctx.courseName}] ${ctx.examName} grades are now available`,
    html: (ctx) => `
      <div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#001a3a;color:white;padding:20px 24px;border-radius:8px 8px 0 0;">
          <h2 style="margin:0;">Grades Released — ${ctx.examName}</h2>
        </div>
        <div style="border:1px solid #ddd;border-top:none;padding:24px;border-radius:0 0 8px 8px;">
          <p>Hi <strong>${ctx.studentName}</strong>,</p>
          <p>Your grades for <strong>${ctx.examName}</strong> in <strong>${ctx.courseName}</strong> have been released.</p>
          ${ctx.score ? `
          <div style="background:#f0f7ff;padding:16px;border-radius:8px;margin:16px 0;text-align:center;">
            <div style="font-size:2rem;font-weight:800;color:#001a3a;">${ctx.score} / ${ctx.maxMarks}</div>
            <div style="color:#666;">${ctx.percentage}%</div>
          </div>` : ''}
          <div style="text-align:center;margin:24px 0;">
            <a href="${ctx.baseUrl}/student/dashboard" 
               style="display:inline-block;background:#2563eb;color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;">
              View Detailed Results
            </a>
          </div>
          ${ctx.cribDeadline ? `<p style="color:#e65100;font-size:0.9rem;">Regrade request deadline: <strong>${ctx.cribDeadline}</strong></p>` : ''}
        </div>
      </div>`,
  },

  announcement: {
    subject: (ctx) => `[${ctx.courseName}] ${ctx.title}`,
    html: (ctx) => `
      <div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#001a3a;color:white;padding:20px 24px;border-radius:8px 8px 0 0;">
          <h2 style="margin:0;">${ctx.title}</h2>
          <p style="margin:4px 0 0;opacity:0.8;">${ctx.courseName}</p>
        </div>
        <div style="border:1px solid #ddd;border-top:none;padding:24px;border-radius:0 0 8px 8px;">
          <div>${ctx.content}</div>
          <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
          <p style="color:#666;font-size:0.85rem;">Posted by ${ctx.authorName} on ${ctx.date}</p>
        </div>
      </div>`,
  },

  password_reset: {
    subject: () => 'Intelligrade — Password Reset',
    html: (ctx) => `
      <div style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:0 auto;">
        <div style="background:#001a3a;color:white;padding:20px 24px;border-radius:8px 8px 0 0;">
          <h2 style="margin:0;">Password Reset</h2>
        </div>
        <div style="border:1px solid #ddd;border-top:none;padding:24px;border-radius:0 0 8px 8px;">
          <p>Click the button below to reset your password. This link expires in 1 hour.</p>
          <div style="text-align:center;margin:24px 0;">
            <a href="${ctx.resetUrl}" 
               style="display:inline-block;background:#2563eb;color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;">
              Reset Password
            </a>
          </div>
          <p style="color:#666;font-size:0.85rem;">If you didn't request this, ignore this email.</p>
        </div>
      </div>`,
  },

  course_join: {
    subject: (ctx) => `[${ctx.courseName}] Join link`,
    html: (ctx) => `
      <div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#001a3a;color:white;padding:20px 24px;border-radius:8px 8px 0 0;">
          <h2 style="margin:0;">Join ${ctx.courseName}</h2>
        </div>
        <div style="border:1px solid #ddd;border-top:none;padding:24px;border-radius:0 0 8px 8px;">
          <p>You've been invited to join <strong>${ctx.courseName} (${ctx.courseCode})</strong>.</p>
          <div style="text-align:center;margin:24px 0;">
            <a href="${ctx.joinUrl}" 
               style="display:inline-block;background:#2563eb;color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;">
              Join Course
            </a>
          </div>
          <p style="color:#666;">Or use join code: <strong>${ctx.joinCode}</strong></p>
        </div>
      </div>`,
  },
};

async function sendNotification(templateName, context) {
  const t = getTransporter();
  if (!t) {
    console.warn(`[Notification] SMTP not configured — skipping ${templateName} to ${context.email}`);
    return false;
  }

  const template = TEMPLATES[templateName];
  if (!template) {
    console.error(`[Notification] Unknown template: ${templateName}`);
    return false;
  }

  try {
    await t.sendMail({
      from: process.env.SMTP_FROM || DEFAULT_FROM,
      to: context.email,
      subject: template.subject(context),
      html: template.html(context),
    });
    return true;
  } catch (err) {
    console.error(`[Notification] Failed to send ${templateName} to ${context.email}:`, err.message);
    return false;
  }
}

async function sendBulkNotification(templateName, recipients) {
  const results = { sent: 0, failed: 0 };
  for (const ctx of recipients) {
    const ok = await sendNotification(templateName, ctx);
    if (ok) results.sent++;
    else results.failed++;
  }
  return results;
}

module.exports = { sendNotification, sendBulkNotification, TEMPLATES };

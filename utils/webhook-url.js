const { URL } = require('url');

function isPrivateOrBlockedHost(hostname) {
  if (!hostname) return true;
  const h = String(hostname).toLowerCase();
  if (h === 'localhost' || h.endsWith('.localhost')) return true;
  if (h === '0.0.0.0') return true;
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 0) return true;
  }
  return false;
}

/** Only Slack / Discord HTTPS webhooks; blocks private hosts and non-HTTPS. */
function assertSafeWebhookUrl(urlStr) {
  let u;
  try {
    u = new URL(String(urlStr).trim());
  } catch {
    throw new Error('Invalid webhook URL');
  }
  if (u.protocol !== 'https:') throw new Error('Webhook must use HTTPS');
  if (isPrivateOrBlockedHost(u.hostname)) throw new Error('Webhook host is not allowed');
  const host = u.hostname.toLowerCase();
  const path = u.pathname || '';
  if (host === 'hooks.slack.com' && path.startsWith('/services/')) return;
  if ((host === 'discord.com' || host === 'discordapp.com') && path.startsWith('/api/webhooks/')) return;
  throw new Error('Webhook must be a Slack (hooks.slack.com/services/...) or Discord (/api/webhooks/...) URL');
}

module.exports = { assertSafeWebhookUrl };

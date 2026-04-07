function requireInt(value, fieldName) {
  const n = parseInt(value, 10);
  if (isNaN(n) || n < 0) throw new Error(`Invalid ${fieldName}`);
  return n;
}

function requireFloat(value, fieldName, { min = 0, max = Infinity } = {}) {
  const n = parseFloat(value);
  if (isNaN(n) || n < min || n > max) throw new Error(`Invalid ${fieldName}`);
  return n;
}

function requireString(value, fieldName, { maxLen = 500 } = {}) {
  const s = (value || '').trim();
  if (!s) throw new Error(`${fieldName} is required`);
  if (s.length > maxLen) throw new Error(`${fieldName} is too long (max ${maxLen} chars)`);
  return s;
}

function optionalString(value, { maxLen = 500 } = {}) {
  const s = (value || '').trim();
  return s.length > maxLen ? s.slice(0, maxLen) : (s || null);
}

function requireEmail(value) {
  const s = (value || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) throw new Error('Invalid email address');
  return s;
}

module.exports = { requireInt, requireFloat, requireString, optionalString, requireEmail };

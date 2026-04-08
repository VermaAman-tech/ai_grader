const store = new Map();

function generateOTP() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function storeOTP(key, otp, ttlMs = 10 * 60 * 1000) {
  store.set(key, { code: otp, expiresAt: Date.now() + ttlMs });
}

/** Wrong attempt: keep entry but return false (caller may throttle). */
function verifyOTP(key, code) {
  const entry = store.get(key);
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return false;
  }
  if (entry.code !== String(code || '').trim()) return false;
  store.delete(key);
  return true;
}

function clearOTP(key) {
  store.delete(key);
}

module.exports = { generateOTP, storeOTP, verifyOTP, clearOTP };

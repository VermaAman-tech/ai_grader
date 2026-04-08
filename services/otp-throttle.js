const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS = 10;
const LOCKOUT_MS = 15 * 60 * 1000;

const state = new Map();

function key(kind, id) {
  return `${kind}:${id}`;
}

function prune(entry) {
  if (Date.now() > entry.resetAt) {
    entry.fails = 0;
    entry.resetAt = Date.now() + WINDOW_MS;
    entry.lockedUntil = 0;
  }
}

function isLocked(kind, id) {
  const k = key(kind, id);
  let e = state.get(k);
  if (!e) return false;
  prune(e);
  return e.lockedUntil > Date.now();
}

function recordFailure(kind, id) {
  const k = key(kind, id);
  let e = state.get(k);
  if (!e) {
    e = { fails: 0, resetAt: Date.now() + WINDOW_MS, lockedUntil: 0 };
    state.set(k, e);
  }
  prune(e);
  e.fails += 1;
  if (e.fails >= MAX_FAILS) {
    e.lockedUntil = Date.now() + LOCKOUT_MS;
    e.fails = 0;
  }
}

function resetFailures(kind, id) {
  state.delete(key(kind, id));
}

module.exports = { isLocked, recordFailure, resetFailures, MAX_FAILS, LOCKOUT_MS };

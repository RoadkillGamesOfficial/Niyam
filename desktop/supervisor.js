// Pure supervision rules for the desktop shell. No Electron import on purpose:
// the behaviour that matters (when to retry, how long to wait, which origin may
// ask for a permission) is provable with plain `node --test`.

const MAX_ATTEMPTS = 4;
const BASE_DELAY_MS = 500;
const MAX_DELAY_MS = 4_000;
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

/** A child that exited with 0 stopped on its own; anything else is a crash. */
function classifyExit(code, signal) {
  if (signal) {
    return "crash";
  }
  return code === 0 ? "clean" : "crash";
}

/**
 * Delay before the next attempt: 500, 1000, 2000, 4000 ms, then capped. Garbage
 * input still yields a usable delay rather than NaN or a negative timer.
 */
function nextDelay(attempt, base = BASE_DELAY_MS, max = MAX_DELAY_MS) {
  const safe = Math.max(0, Math.trunc(Number(attempt)) || 0);
  const delay = base * 2 ** Math.min(safe, 16);
  return Math.min(delay, max);
}

/** True while another attempt is allowed. `attempt` counts attempts already made. */
function shouldRetry(attempt, maxAttempts = MAX_ATTEMPTS) {
  return Number.isFinite(attempt) && attempt < maxAttempts;
}

/**
 * Only the app's own loopback origin may hold a permission. Anything that is not
 * http on a loopback host, or that names a different port, is refused — which
 * also refuses `http://127.0.0.1.evil.com`.
 */
function isAppOrigin(value, port) {
  let url;
  try {
    url = new URL(String(value));
  } catch {
    return false;
  }
  if (url.protocol !== "http:") {
    return false;
  }
  if (!LOOPBACK_HOSTS.has(url.hostname)) {
    return false;
  }
  if (port === null || port === undefined || port === "") {
    return true;
  }
  return url.port === String(port);
}

module.exports = {
  BASE_DELAY_MS,
  MAX_ATTEMPTS,
  MAX_DELAY_MS,
  classifyExit,
  isAppOrigin,
  nextDelay,
  shouldRetry,
};

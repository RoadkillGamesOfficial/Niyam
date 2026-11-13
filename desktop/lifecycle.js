// The grace window between hiding the window and stopping the server. Pure and
// time-injected so the boundaries are provable without timers or Electron.

const DEFAULT_GRACE_MS = 2 * 60 * 1_000;

/**
 * `arm(now)` starts the countdown, `disarm()` cancels it. The caller owns the
 * actual timer; this only answers "how long is left" and "has it expired".
 */
function createGrace(graceMs = DEFAULT_GRACE_MS) {
  let armedAt = null;
  return {
    arm(now) {
      armedAt = now;
      return graceMs;
    },
    disarm() {
      armedAt = null;
    },
    isArmed() {
      return armedAt !== null;
    },
    armedAt() {
      return armedAt;
    },
    remaining(now) {
      return armedAt === null ? 0 : Math.max(0, armedAt + graceMs - now);
    },
    expired(now) {
      return armedAt !== null && now - armedAt >= graceMs;
    },
  };
}

module.exports = { DEFAULT_GRACE_MS, createGrace };

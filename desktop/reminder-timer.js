// The reminder loop. Deliberately small: one tick at a time, errors contained,
// and the clock injected so the tests can say when "now" is.

const DEFAULT_TICK_MS = 60_000;

function createReminderTimer({
  intervalMs = DEFAULT_TICK_MS,
  tick,
  onError = () => {},
  now = () => new Date(),
} = {}) {
  let handle = null;
  let busy = false;

  async function run() {
    if (busy) {
      return "skipped";
    }
    busy = true;
    try {
      await tick(now());
      return "ran";
    } catch (error) {
      onError(error);
      return "failed";
    } finally {
      busy = false;
    }
  }

  return {
    start() {
      if (handle) {
        return;
      }
      // unref: a reminder timer must never be the reason the app stays alive.
      handle = setInterval(run, intervalMs);
      handle.unref?.();
    },
    stop() {
      if (handle) {
        clearInterval(handle);
        handle = null;
      }
    },
    isRunning() {
      return handle !== null;
    },
    runOnce: run,
  };
}

module.exports = { DEFAULT_TICK_MS, createReminderTimer };

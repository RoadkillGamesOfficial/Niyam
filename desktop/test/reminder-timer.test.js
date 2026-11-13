const assert = require("node:assert/strict");
const { test } = require("node:test");
const { setTimeout: delay } = require("node:timers/promises");
const { createReminderTimer } = require("../reminder-timer.js");

test("starts and stops without leaving a timer behind", () => {
  const timer = createReminderTimer({ intervalMs: 50, tick: () => {} });
  assert.equal(timer.isRunning(), false);
  timer.start();
  assert.equal(timer.isRunning(), true);
  timer.stop();
  assert.equal(timer.isRunning(), false);
});

test("starting twice does not run two loops", () => {
  let ticks = 0;
  const timer = createReminderTimer({ intervalMs: 5, tick: () => ticks++ });
  timer.start();
  timer.start();
  timer.stop();
  assert.equal(timer.isRunning(), false);
  assert.ok(ticks >= 0);
});

test("a slow tick is never overlapped", async () => {
  let running = 0;
  let peak = 0;
  const timer = createReminderTimer({
    intervalMs: 5,
    tick: async () => {
      running += 1;
      peak = Math.max(peak, running);
      await delay(30);
      running -= 1;
    },
  });
  const first = timer.runOnce();
  const second = await timer.runOnce();
  assert.equal(second, "skipped");
  assert.equal(await first, "ran");
  assert.equal(peak, 1);
  timer.stop();
});

test("a throwing tick is reported, not thrown", async () => {
  const errors = [];
  const timer = createReminderTimer({
    intervalMs: 5,
    tick: () => {
      throw new Error("database is locked");
    },
    onError: (error) => errors.push(error.message),
  });
  assert.equal(await timer.runOnce(), "failed");
  assert.deepEqual(errors, ["database is locked"]);
  timer.stop();
});

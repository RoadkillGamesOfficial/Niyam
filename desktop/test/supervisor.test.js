const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
  MAX_ATTEMPTS,
  MAX_DELAY_MS,
  classifyExit,
  isAppOrigin,
  nextDelay,
  shouldRetry,
} = require("../supervisor.js");

test("a clean exit is distinct from a crash", () => {
  assert.equal(classifyExit(0, null), "clean");
  assert.equal(classifyExit(1, null), "crash");
  assert.equal(classifyExit(null, "SIGTERM"), "crash");
  assert.equal(classifyExit(0, "SIGTERM"), "crash");
});

test("backoff doubles from the base and then stays capped", () => {
  assert.equal(nextDelay(0), 500);
  assert.equal(nextDelay(1), 1_000);
  assert.equal(nextDelay(2), 2_000);
  assert.equal(nextDelay(3), 4_000);
  assert.equal(nextDelay(4), MAX_DELAY_MS);
  assert.equal(nextDelay(40), MAX_DELAY_MS);
});

test("backoff stays usable with junk input", () => {
  assert.equal(nextDelay(-3), 500);
  assert.equal(nextDelay(Number.NaN), 500);
  for (let attempt = 0; attempt < 40; attempt += 1) {
    assert.ok(nextDelay(attempt) > 0 && nextDelay(attempt) <= MAX_DELAY_MS);
  }
});

test("retries stop at the attempt limit", () => {
  assert.equal(shouldRetry(0), true);
  assert.equal(shouldRetry(MAX_ATTEMPTS - 1), true);
  assert.equal(shouldRetry(MAX_ATTEMPTS), false);
  assert.equal(shouldRetry(MAX_ATTEMPTS + 10), false);
  assert.equal(shouldRetry(Number.NaN), false);
});

test("only the app's own loopback origin is trusted", () => {
  assert.equal(isAppOrigin("http://127.0.0.1:49687/", 49687), true);
  assert.equal(isAppOrigin("http://127.0.0.1:49687/settings", 49687), true);
  assert.equal(isAppOrigin("http://localhost:49687/", 49687), true);

  assert.equal(isAppOrigin("http://127.0.0.1:50000/", 49687), false);
  assert.equal(isAppOrigin("https://127.0.0.1:49687/", 49687), false);
  assert.equal(isAppOrigin("http://127.0.0.1.evil.com:49687/", 49687), false);
  assert.equal(isAppOrigin("https://example.com/", 49687), false);
  assert.equal(isAppOrigin("file:///C:/Niyam/error.html", 49687), false);
  assert.equal(isAppOrigin("", 49687), false);
  assert.equal(isAppOrigin("not a url", 49687), false);
});

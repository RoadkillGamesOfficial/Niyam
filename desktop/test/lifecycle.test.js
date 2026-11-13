const assert = require("node:assert/strict");
const { test } = require("node:test");
const { DEFAULT_GRACE_MS, createGrace } = require("../lifecycle.js");

test("the grace window defaults to two minutes", () => {
  assert.equal(DEFAULT_GRACE_MS, 120_000);
});

test("an unarmed grace window never expires", () => {
  const grace = createGrace();
  assert.equal(grace.isArmed(), false);
  assert.equal(grace.expired(Date.now() + 10_000_000), false);
  assert.equal(grace.remaining(Date.now()), 0);
});

test("it expires exactly at the boundary, not before", () => {
  const grace = createGrace(1_000);
  grace.arm(5_000);
  assert.equal(grace.isArmed(), true);
  assert.equal(grace.expired(5_999), false);
  assert.equal(grace.expired(6_000), true);
  assert.equal(grace.expired(9_000), true);
});

test("remaining time counts down and floors at zero", () => {
  const grace = createGrace(1_000);
  grace.arm(0);
  assert.equal(grace.remaining(0), 1_000);
  assert.equal(grace.remaining(400), 600);
  assert.equal(grace.remaining(1_000), 0);
  assert.equal(grace.remaining(5_000), 0);
});

test("disarming cancels the countdown", () => {
  const grace = createGrace(1_000);
  grace.arm(0);
  grace.disarm();
  assert.equal(grace.isArmed(), false);
  assert.equal(grace.expired(10_000), false);
});

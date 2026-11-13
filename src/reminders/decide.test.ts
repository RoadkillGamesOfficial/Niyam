import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { COPY } from "../copy.ts";
import { decideReminder, reminderBody } from "./decide.ts";

const NOW = Date.parse("2026-11-13T10:05:00Z");
const RULES = { maxRepeats: 3, repeatMinutes: 5, nowMs: NOW };

function pending(overrides: Partial<{ dueAt: string; quiet: boolean; taskTitle: string | null }> = {}) {
  return { dueAt: "2026-11-13 10:00:00", quiet: false, taskTitle: null, ...overrides };
}

describe("reminder decisions", () => {
  it("announces a fresh pending check-in once", () => {
    const decision = decideReminder({
      ...RULES,
      level: "standard",
      pending: pending(),
      notified: null,
    });
    assert.equal(decision.action, "notify");
    assert.equal(decision.action === "notify" && decision.repeat, false);
    assert.equal(decision.action === "notify" && decision.body, COPY.reminders.noTask);
  });

  it("keeps quiet hours, gentle and an empty slot silent", () => {
    const quiet = decideReminder({
      ...RULES,
      level: "firm",
      pending: pending({ quiet: true }),
      notified: null,
    });
    const gentle = decideReminder({
      ...RULES,
      level: "gentle",
      pending: pending(),
      notified: null,
    });
    const none = decideReminder({
      ...RULES,
      level: "standard",
      pending: null,
      notified: null,
    });
    assert.deepEqual([quiet.action, gentle.action, none.action], ["none", "none", "none"]);
  });

  it("never repeats a standard reminder for the same slot", () => {
    const decision = decideReminder({
      ...RULES,
      level: "standard",
      pending: pending(),
      notified: { dueAt: "2026-11-13 10:00:00", count: 1, lastAt: NOW - 60_000 },
    });
    assert.equal(decision.action, "none");
  });

  it("repeats a firm reminder only after the interval, and stops at the cap", () => {
    const fresh = { dueAt: "2026-11-13 10:00:00", count: 1, lastAt: NOW - 60_000 };
    const tooSoon = decideReminder({
      ...RULES,
      level: "firm",
      pending: pending(),
      notified: fresh,
    });
    const due = decideReminder({
      ...RULES,
      level: "firm",
      pending: pending(),
      notified: { ...fresh, lastAt: NOW - 6 * 60_000 },
    });
    const capped = decideReminder({
      ...RULES,
      level: "firm",
      pending: pending(),
      notified: { dueAt: fresh.dueAt, count: 3, lastAt: NOW - 6 * 60_000 },
    });
    assert.equal(tooSoon.action, "none");
    assert.equal(due.action, "notify");
    assert.equal(due.action === "notify" && due.repeat, true);
    assert.equal(capped.action, "none");
  });

  it("treats a newer slot as a new reminder", () => {
    const decision = decideReminder({
      ...RULES,
      level: "standard",
      pending: pending({ dueAt: "2026-11-13 10:30:00" }),
      notified: { dueAt: "2026-11-13 10:00:00", count: 1, lastAt: NOW - 60_000 },
    });
    assert.equal(decision.action, "notify");
  });

  it("names the open task, shortened to fit a notification", () => {
    assert.equal(
      reminderBody("Write the weekly report"),
      COPY.reminders.withTask.replace("{task}", "Write the weekly report"),
    );
    // Only the task title is shortened; the wording around it is fixed.
    const long = reminderBody("x".repeat(200));
    assert.equal(long, `Still on ${"x".repeat(79)}…?`);
    assert.equal(
      reminderBody("   "),
      COPY.reminders.noTask,
    );
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CONFIG } from "../config.ts";
import { dueSlots, isQuiet, reconcile, slotKey } from "./pulses.ts";

const at = (minutes: number, base = new Date(2026, 10, 8, 9, 0, 0)): Date =>
  new Date(base.getTime() + minutes * 60_000);

describe("dueSlots", () => {
  it("emits one slot per interval of active time", () => {
    const slots = dueSlots(at(0), at(90), 30, []);
    assert.deepEqual(
      slots.map((slot) => slot.getTime()),
      [at(30).getTime(), at(60).getTime(), at(90).getTime()],
    );
  });

  it("stops the clock during a pause instead of counting it", () => {
    const slots = dueSlots(at(0), at(90), 30, [
      { start: at(30), end: at(60) },
    ]);
    // Only 60 minutes of active time passed, so two slots, the second at 09:90.
    assert.equal(slots.length, 2);
    assert.equal(slots[0].getTime(), at(30).getTime());
    assert.equal(slots[1].getTime(), at(90).getTime());
  });

  it("treats an open pause as running until now", () => {
    const slots = dueSlots(at(0), at(120), 30, [{ start: at(45), end: null }]);
    assert.equal(slots.length, 1);
    assert.equal(slots[0].getTime(), at(30).getTime());
  });

  it("returns nothing before the first interval", () => {
    assert.deepEqual(dueSlots(at(0), at(20), 30, []), []);
  });

  it("caps backfill after a long sleep", () => {
    const slots = dueSlots(at(0), at(60 * 24 * 5), 30, []);
    assert.equal(slots.length, CONFIG.pulses.maxCatchUp);
  });
});

describe("quiet hours", () => {
  it("understands an overnight range", () => {
    assert.equal(isQuiet(new Date(2026, 10, 8, 23, 30), "22:00", "07:00"), true);
    assert.equal(isQuiet(new Date(2026, 10, 8, 6, 59), "22:00", "07:00"), true);
    assert.equal(isQuiet(new Date(2026, 10, 8, 12, 0), "22:00", "07:00"), false);
  });

  it("understands a daytime range", () => {
    assert.equal(isQuiet(new Date(2026, 10, 8, 10, 0), "09:00", "17:00"), true);
    assert.equal(isQuiet(new Date(2026, 10, 8, 18, 0), "09:00", "17:00"), false);
  });

  it("is off when either bound is missing or equal", () => {
    assert.equal(isQuiet(new Date(), null, "07:00"), false);
    assert.equal(isQuiet(new Date(), "22:00", "22:00"), false);
  });
});

describe("reconciliation", () => {
  const now = at(120);
  const graceMinutes = 10;
  const never = { graceMinutes, quiet: () => false };

  it("logs old slots as missed and keeps only the newest answerable one", () => {
    const result = reconcile([at(30), at(60), at(90), at(118)], [], now, never);
    assert.equal(result.missed.length, 3); // 30, 60, 90 are past the grace window
    assert.equal(result.pending.length, 1);
    assert.equal(result.pending[0].getTime(), at(118).getTime());
  });

  it("does not re-create slots that already have a pulse row", () => {
    const result = reconcile([at(60), at(120)], [at(60)], now, never);
    assert.equal(result.missed.length, 0);
    assert.equal(result.pending.length, 1);
  });

  it("skips quiet-hour slots entirely so they never count as missed", () => {
    const result = reconcile([at(30), at(60), at(90)], [], now, {
      graceMinutes,
      quiet: (slot) => slot.getTime() === at(60).getTime(),
    });
    assert.equal(result.missed.length, 2);
    assert.equal(result.pending.length, 0);
  });

  it("treats a slot inside the grace window as still answerable", () => {
    const result = reconcile([at(120)], [], at(125), never);
    assert.equal(result.pending.length, 1);
    assert.equal(result.missed.length, 0);
  });
});

describe("slot keys", () => {
  it("writes local time in SQLite's timestamp shape", () => {
    assert.equal(slotKey(new Date(2026, 0, 5, 9, 7, 3)), "2026-01-05 09:07:03");
  });
});

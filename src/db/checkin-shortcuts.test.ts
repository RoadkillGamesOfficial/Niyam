import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkinShortcutFromEvent } from "../game/shortcuts.ts";
import { getOrCreateDayForDate } from "./days.ts";
import { answerPulse, createPulse, pendingPulse } from "./pulses.ts";
import { withTempDatabase } from "./test-helpers.ts";

describe("check-in shortcut response paths", () => {
  it("stores on_track, pivot and drifted from O, P and D", () => {
    withTempDatabase((db) => {
      const day = getOrCreateDayForDate(db, "2026-11-11");
      const cases = [
        ["o", "on_track", "09:00:00"],
        ["p", "pivot", "09:30:00"],
        ["d", "drifted", "10:00:00"],
      ] as const;

      for (const [key, expected, clock] of cases) {
        const due = `2026-11-11 ${clock}`;
        createPulse(db, { dayId: day.id, dueAt: due, status: "pending" });
        const pending = pendingPulse(db, day.id);
        assert.ok(pending);

        const response = checkinShortcutFromEvent({
          key,
          target: null,
          modalOpen: false,
        });
        assert.equal(response, expected);
        const answered = answerPulse(db, pending.id, response, null, due);
        assert.equal(answered?.status, "answered");
        assert.equal(answered?.response, expected);
      }
    });
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getDayByDate, getOrCreateDayForDate } from "./days.ts";
import { withTempDatabase } from "./test-helpers.ts";

describe("days", () => {
  it("creates one day per date and hands back the same row", () => {
    withTempDatabase((db) => {
      const first = getOrCreateDayForDate(db, "2026-11-07");
      const second = getOrCreateDayForDate(db, "2026-11-07");

      assert.equal(second.id, first.id);
      assert.equal(first.date, "2026-11-07");
      assert.equal(first.profile, null);
      assert.equal(first.closed_at, null);
      assert.equal(getDayByDate(db, "2026-11-07")?.id, first.id);
    });
  });

  it("keeps different dates apart", () => {
    withTempDatabase((db) => {
      const today = getOrCreateDayForDate(db, "2026-11-07");
      const tomorrow = getOrCreateDayForDate(db, "2026-11-08");

      assert.notEqual(tomorrow.id, today.id);
      assert.equal(tomorrow.date, "2026-11-08");
      assert.equal(getDayByDate(db, "2026-11-09"), undefined);
    });
  });

  it("rejects a date that is not YYYY-MM-DD", () => {
    withTempDatabase((db) => {
      assert.throws(() => getOrCreateDayForDate(db, "07/11/2026"), /YYYY-MM-DD/);
      assert.throws(() => getDayByDate(db, "today"), /YYYY-MM-DD/);
    });
  });
});

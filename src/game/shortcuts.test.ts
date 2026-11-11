import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CHECKIN_SHORTCUTS, checkinShortcut } from "./shortcuts.ts";

describe("check-in quick keys", () => {
  it("routes O, P and D to the three response paths", () => {
    assert.equal(checkinShortcut("o", null, false), "on_track");
    assert.equal(checkinShortcut("p", null, false), "pivot");
    assert.equal(checkinShortcut("d", null, false), "drifted");
    assert.deepEqual(CHECKIN_SHORTCUTS, {
      o: "on_track",
      p: "pivot",
      d: "drifted",
    });
  });

  it("accepts uppercase keys", () => {
    assert.equal(checkinShortcut("O", null, false), "on_track");
    assert.equal(checkinShortcut("P", null, false), "pivot");
    assert.equal(checkinShortcut("D", null, false), "drifted");
  });

  it("does not fire while typing in a text field", () => {
    for (const tagName of ["INPUT", "TEXTAREA", "SELECT"]) {
      assert.equal(checkinShortcut("o", { tagName }, false), null);
    }
    assert.equal(checkinShortcut("p", { tagName: "DIV", isContentEditable: true }, false), null);
  });

  it("does not fire when a modal owns focus", () => {
    assert.equal(checkinShortcut("o", null, true), null);
    assert.equal(checkinShortcut("p", null, true), null);
    assert.equal(checkinShortcut("d", null, true), null);
  });

  it("ignores unrelated keys", () => {
    assert.equal(checkinShortcut("r", null, false), null);
    assert.equal(checkinShortcut("Enter", null, false), null);
    assert.equal(checkinShortcut("1", null, false), null);
  });
});

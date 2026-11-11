import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkinShortcutFromEvent } from "./shortcuts.ts";

const plain = { target: null, modalOpen: false } as const;

describe("check-in quick keys", () => {
  it("routes O to on_track", () => {
    assert.equal(
      checkinShortcutFromEvent({ ...plain, key: "o" }),
      "on_track",
    );
  });

  it("routes P to pivot", () => {
    assert.equal(
      checkinShortcutFromEvent({ ...plain, key: "p" }),
      "pivot",
    );
  });

  it("routes D to drifted", () => {
    assert.equal(
      checkinShortcutFromEvent({ ...plain, key: "d" }),
      "drifted",
    );
  });

  it("accepts uppercase keys", () => {
    assert.equal(checkinShortcutFromEvent({ ...plain, key: "O" }), "on_track");
    assert.equal(checkinShortcutFromEvent({ ...plain, key: "P" }), "pivot");
    assert.equal(checkinShortcutFromEvent({ ...plain, key: "D" }), "drifted");
  });

  it("does not fire while typing in a text field", () => {
    for (const tagName of ["INPUT", "TEXTAREA", "SELECT"]) {
      assert.equal(
        checkinShortcutFromEvent({ ...plain, key: "o", target: { tagName } }),
        null,
      );
    }
  });

  it("does not fire in a content-editable area", () => {
    assert.equal(
      checkinShortcutFromEvent({
        ...plain,
        key: "p",
        target: { tagName: "DIV", isContentEditable: true },
      }),
      null,
    );
  });

  it("does not fire when a modal owns focus", () => {
    assert.equal(
      checkinShortcutFromEvent({ ...plain, key: "o", modalOpen: true }),
      null,
    );
    assert.equal(
      checkinShortcutFromEvent({ ...plain, key: "p", modalOpen: true }),
      null,
    );
    assert.equal(
      checkinShortcutFromEvent({ ...plain, key: "d", modalOpen: true }),
      null,
    );
  });

  it("ignores modifier chords, repeats and already-handled keys", () => {
    assert.equal(checkinShortcutFromEvent({ ...plain, key: "o", altKey: true }), null);
    assert.equal(checkinShortcutFromEvent({ ...plain, key: "o", ctrlKey: true }), null);
    assert.equal(checkinShortcutFromEvent({ ...plain, key: "o", metaKey: true }), null);
    assert.equal(checkinShortcutFromEvent({ ...plain, key: "o", repeat: true }), null);
    assert.equal(
      checkinShortcutFromEvent({ ...plain, key: "o", defaultPrevented: true }),
      null,
    );
  });

  it("ignores unrelated keys", () => {
    assert.equal(checkinShortcutFromEvent({ ...plain, key: "r" }), null);
    assert.equal(checkinShortcutFromEvent({ ...plain, key: "Enter" }), null);
    assert.equal(checkinShortcutFromEvent({ ...plain, key: "1" }), null);
  });
});

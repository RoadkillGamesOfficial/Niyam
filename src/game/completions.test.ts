import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { completionNotice } from "./completions.ts";

describe("completion notices", () => {
  it("fires once per task, including after a reopen and re-complete", () => {
    const notified = new Set<number>();

    assert.ok(completionNotice(7, "granted", notified));
    // Reopening and completing task 7 again reaches the same guard.
    assert.equal(completionNotice(7, "granted", notified), null);
    assert.equal(completionNotice(7, "granted", notified), null);

    // A different completion still gets its own notice.
    assert.ok(completionNotice(8, "granted", notified));
  });

  it("stays silent when permission is denied or has not been asked", () => {
    for (const permission of ["denied", "default"] as const) {
      const notified = new Set<number>();
      assert.equal(completionNotice(7, permission, notified), null);
      assert.equal(notified.size, 0);
    }
  });
});

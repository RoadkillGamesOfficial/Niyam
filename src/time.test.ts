import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { localDateString } from "./time.ts";

describe("localDateString", () => {
  it("formats the local date with zero padding", () => {
    // Built from local parts, so the expectation holds in every timezone.
    assert.equal(localDateString(new Date(2026, 0, 5, 23, 59)), "2026-01-05");
    assert.equal(localDateString(new Date(2026, 11, 31, 0, 0)), "2026-12-31");
    assert.equal(localDateString(new Date(2026, 10, 8, 12, 0)), "2026-11-08");
  });

  it("uses the local day, not the UTC one", () => {
    const lateEvening = new Date(2026, 10, 8, 23, 30);
    assert.equal(localDateString(lateEvening), "2026-11-08");
  });
});

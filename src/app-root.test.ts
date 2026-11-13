import assert from "node:assert/strict";
import { join } from "node:path";
import { describe, it } from "node:test";
import { CONFIG } from "./config.ts";
import { appRoot, dataRoot } from "./app-root.ts";

// The variables are process-wide, so every case restores what it found. A
// leaked NIYAM_DATA_DIR would send later tests at a real data folder.
const KEYS = ["NIYAM_APP_ROOT", "NIYAM_DATA_DIR"] as const;

function withEnv(values: Partial<Record<(typeof KEYS)[number], string>>, body: () => void): void {
  const saved = new Map(KEYS.map((key) => [key, process.env[key] as string | undefined]));
  for (const key of KEYS) {
    delete process.env[key];
  }
  for (const [key, value] of Object.entries(values)) {
    process.env[key] = value;
  }
  try {
    body();
  } finally {
    for (const key of KEYS) {
      const value = saved.get(key);
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

describe("appRoot", () => {
  it("defaults to the working directory", () => {
    withEnv({}, () => assert.equal(appRoot(), process.cwd()));
  });

  it("resolves a relative override against the working directory", () => {
    withEnv({ NIYAM_APP_ROOT: join("build", "app") }, () =>
      assert.equal(appRoot(), join(process.cwd(), "build", "app")),
    );
  });

  it("keeps an absolute override as written", () => {
    const absolute = join(process.cwd(), "installed-app");
    withEnv({ NIYAM_APP_ROOT: absolute }, () => assert.equal(appRoot(), absolute));
  });

  it("ignores an empty or blank override", () => {
    withEnv({ NIYAM_APP_ROOT: "   " }, () => assert.equal(appRoot(), process.cwd()));
  });
});

describe("dataRoot", () => {
  it("defaults to the data folder under the app root", () => {
    withEnv({}, () => assert.equal(dataRoot(), join(process.cwd(), CONFIG.database.directory)));
  });

  it("moves with the app root", () => {
    const absolute = join(process.cwd(), "installed-app");
    withEnv({ NIYAM_APP_ROOT: absolute }, () =>
      assert.equal(dataRoot(), join(absolute, CONFIG.database.directory)),
    );
  });

  it("prefers an absolute NIYAM_DATA_DIR", () => {
    const absolute = join(process.cwd(), "user-data");
    withEnv({ NIYAM_DATA_DIR: absolute }, () => assert.equal(dataRoot(), absolute));
  });

  it("resolves a relative NIYAM_DATA_DIR against the app root, not the cwd", () => {
    const absolute = join(process.cwd(), "installed-app");
    withEnv({ NIYAM_APP_ROOT: absolute, NIYAM_DATA_DIR: "profile" }, () =>
      assert.equal(dataRoot(), join(absolute, "profile")),
    );
  });

  it("does not leave a trailing separator", () => {
    const absolute = join(process.cwd(), "user-data");
    withEnv({ NIYAM_DATA_DIR: absolute }, () => assert.ok(!dataRoot().endsWith("/")));
  });
});

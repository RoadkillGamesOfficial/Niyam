// Phase 0b: can Electron's bundled Node open node:sqlite?
//
// The shell could reuse Electron's own binary to run the server (saving an
// 80 MB node.exe sidecar) only if node:sqlite exists and is stable there.
// Prints one JSON line and exits non-zero when the probe fails.

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const desktop = fileURLToPath(new URL("..", import.meta.url));
const electron = join(desktop, "node_modules", "electron", "dist", "electron.exe");

const probe = `
let sqlite;
try {
  const { DatabaseSync } = require("node:sqlite");
  const db = new DatabaseSync(":memory:");
  db.exec("create table t(x integer)");
  db.prepare("insert into t values (?)").run(7);
  const row = db.prepare("select count(*) as c from t").get();
  db.close();
  sqlite = { ok: true, row };
} catch (error) {
  sqlite = { ok: false, message: error.message };
}
console.log(JSON.stringify({
  node: process.versions.node,
  electron: process.versions.electron,
  modules: process.versions.modules,
  sqlite,
}));
`;

const run = spawnSync(electron, ["-e", probe], {
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
  encoding: "utf8",
});

const payload = run.stdout.trim();
console.log(payload || "(no output)");
if (run.stderr.trim()) console.error(run.stderr.trim());
process.exit(run.status === 0 && payload.includes('"ok":true') ? 0 : 1);

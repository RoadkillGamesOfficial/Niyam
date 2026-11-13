// Phase 0c/0d: spawn the standalone server the way the shell will, serve one
// request, measure its RSS, then stop it and prove the process is gone.
//
// Run from the repo root after `npm run build`:
//   node desktop/spike/check-server.mjs

import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const desktop = join(root, "desktop");
const electron = join(desktop, "node_modules", "electron", "dist", "electron.exe");
const standalone = join(root, ".next", "standalone");
const serverEntry = join(standalone, "server.js");
const useElectronAsNode = process.env.SPIKE_NODE === "electron";

const database = join(tmpdir(), `niyam-spike-${process.pid}.db`);

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.unref();
    probe.on("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

async function rssMb(pid) {
  const out = await new Promise((resolve) => {
    const tasklist = spawn("tasklist", ["/FI", `PID eq ${pid}`, "/FO", "CSV", "/NH"]);
    let text = "";
    tasklist.stdout.on("data", (chunk) => (text += chunk));
    tasklist.on("close", () => resolve(text));
  });
  const match = out.match(/"([\d,]+) K"/);
  return match ? Math.round(Number(match[1].replace(/,/g, "")) / 1024) : null;
}

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

if (!existsSync(serverEntry)) {
  console.error(`missing ${serverEntry} — run npm run build first`);
  process.exit(1);
}

const port = await freePort();
const startedAt = Date.now();

const child = spawn(useElectronAsNode ? electron : process.execPath, [serverEntry], {
  cwd: standalone,
  env: {
    ...process.env,
    ...(useElectronAsNode ? { ELECTRON_RUN_AS_NODE: "1" } : {}),
    PORT: String(port),
    HOSTNAME: "127.0.0.1",
    NIYAM_DB: database,
    NEXT_TELEMETRY_DISABLED: "1",
  },
  stdio: ["ignore", "pipe", "pipe"],
});

let log = "";
child.stdout.on("data", (chunk) => (log += chunk));
child.stderr.on("data", (chunk) => (log += chunk));

let status = null;
let body = "";
const deadline = Date.now() + 20_000;
while (Date.now() < deadline) {
  if (child.exitCode !== null) break;
  try {
    const response = await fetch(`http://127.0.0.1:${port}/`);
    status = response.status;
    body = await response.text();
    if (status === 200) break;
  } catch {
    // not listening yet
  }
  await new Promise((resolve) => setTimeout(resolve, 200));
}

const readyMs = Date.now() - startedAt;
await new Promise((resolve) => setTimeout(resolve, 1500));
const serverRss = await rssMb(child.pid);

console.log(
  JSON.stringify(
    {
      runtime: useElectronAsNode ? "electron-as-node" : "node",
      http: status,
      readyMs,
      serverRssMb: serverRss,
      renderedApp: body.includes("Niyam"),
      htmlBytes: body.length,
    },
    null,
    2,
  ),
);

if (log.trim()) console.log("--- server log ---\n" + log.trim().slice(0, 800));

const stopped = new Promise((resolve) => child.on("close", resolve));
child.kill();
await Promise.race([stopped, new Promise((resolve) => setTimeout(resolve, 5000))]);
const stillAlive = alive(child.pid);
console.log(`stopped: ${!stillAlive}, port freed: ${await new Promise((resolve) => {
  const probe = createServer();
  probe.once("error", () => resolve(false));
  probe.once("listening", () => probe.close(() => resolve(true)));
  probe.listen(port, "127.0.0.1");
})}`);

for (const suffix of ["", "-wal", "-shm"]) {
  rmSync(database + suffix, { force: true });
}
process.exit(status === 200 && !stillAlive ? 0 : 1);

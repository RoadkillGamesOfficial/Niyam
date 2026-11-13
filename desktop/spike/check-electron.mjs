// Phase 0d: idle footprint of the Electron shell with no window open.
//
// Spawns idle-app (no BrowserWindow), samples every electron.exe process, and
// reports the totals the "under 60 MB closed" budget is measured against.

import { spawn } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const desktop = fileURLToPath(new URL("..", import.meta.url));
const electron = join(desktop, "node_modules", "electron", "dist", "electron.exe");
const appDir = join(desktop, "spike", "idle-app");

function electronProcesses() {
  return new Promise((resolve) => {
    const tasklist = spawn("tasklist", ["/FI", "IMAGENAME eq electron.exe", "/FO", "CSV", "/NH"]);
    let text = "";
    tasklist.stdout.on("data", (chunk) => (text += chunk));
    tasklist.on("close", () => {
      const rows = text
        .split(/\r?\n/)
        .map((line) => line.match(/^"([^"]+)","(\d+)","[^"]*","[^"]*","([\d,]+) K"/))
        .filter(Boolean)
        .map((m) => ({ name: m[1], pid: Number(m[2]), mb: Math.round(Number(m[3].replace(/,/g, "")) / 1024) }));
      resolve(rows);
    });
  });
}

const child = spawn(electron, [appDir], { stdio: ["ignore", "pipe", "pipe"] });
let out = "";
child.stdout.on("data", (chunk) => (out += chunk));

await new Promise((resolve) => setTimeout(resolve, 5000));
const sampled = await electronProcesses();
const total = sampled.reduce((sum, row) => sum + row.mb, 0);

console.log(JSON.stringify({ processes: sampled, totalMb: total, inApp: out.trim() }, null, 2));

await new Promise((resolve) => child.on("close", resolve));

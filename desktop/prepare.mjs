// The standalone build does not copy its own static assets, so the shell puts
// them back before the server starts. Idempotent and cheap.
//
// `--check` additionally refuses to package an incomplete bundle: the installer
// must contain a runnable server and the files the server reads at startup.

import { cpSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const standalone = join(root, ".next", "standalone");

const pairs = [
  [join(root, ".next", "static"), join(standalone, ".next", "static")],
  [join(root, "public"), join(standalone, "public")],
];

let copied = 0;
for (const [from, to] of pairs) {
  if (!existsSync(from)) continue;
  cpSync(from, to, { recursive: true });
  copied += 1;
}

console.log(`prepared the standalone bundle (${copied} asset folders)`);

if (process.argv.includes("--check")) {
  const required = [
    "server.js",
    join(".next", "static"),
    join("migrations", "001_init.sql"),
    join("prompts", "planner.md"),
    join("src", "reminders", "decide.ts"),
    join("src", "db", "database.ts"),
  ];
  const missing = required.filter((entry) => !existsSync(join(standalone, entry)));
  if (missing.length > 0) {
    console.error(`the bundle is incomplete; missing ${missing.join(", ")}`);
    process.exit(1);
  }
  console.log(`bundle check passed (${required.length} entries)`);
}

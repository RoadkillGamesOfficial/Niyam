// The standalone build does not copy its own static assets, so the shell puts
// them back before the server starts. Idempotent and cheap.

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

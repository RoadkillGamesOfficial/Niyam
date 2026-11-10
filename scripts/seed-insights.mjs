import { existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { openDatabase } from "../src/db/database.ts";
import { seedHistory } from "../src/db/seed.ts";

// Generates a separate database so the owner's real data is never touched.
// Run the app against it with NIYAM_DB=data/seed.db (Git Bash / bash).
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  return index === -1 ? fallback : args[index + 1] ?? fallback;
};

const target = resolve(option("--db", "data/seed.db"));
const days = Number(option("--days", "84"));
const fresh = args.includes("--fresh");
const liveDatabase = resolve("data/discipline.db");

if (target === liveDatabase) {
  console.error(
    "Refusing to seed the live database. Use the default data/seed.db and NIYAM_DB instead.",
  );
  process.exit(1);
}

if (existsSync(target)) {
  if (!fresh) {
    console.error(`Refusing to overwrite ${target}. Add --fresh to replace it.`);
    process.exit(1);
  }
  rmSync(target, { force: true });
  rmSync(`${target}-wal`, { force: true });
  rmSync(`${target}-shm`, { force: true });
}

const db = openDatabase(target);
try {
  const result = seedHistory(db, { days });
  console.log(
    `Seeded ${result.days} days (${result.startDate} to ${result.endDate}) into ${target}.`,
  );
  console.log(
    `${result.tasks} tasks, ${result.pulses} check-ins, ${result.habits} habits.`,
  );
  console.log(`Run the app against it with: NIYAM_DB=${target} npm run dev`);
} finally {
  db.close();
}

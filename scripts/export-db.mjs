import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { exportDatabase, exportFilePath } from "../src/db/backup.ts";
import { databasePath, openDatabase } from "../src/db/database.ts";

// One-step export. This opens the same database the app uses and asks SQLite for
// a consistent snapshot, so it is safe while the app is running.
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  return index === -1 ? fallback : args[index + 1] ?? fallback;
};

const source = resolve(option("--db", databasePath()));
const destination = resolve(option("--out", exportFilePath()));

if (!existsSync(source)) {
  console.error(`No database found at ${source}. Open the app once, then try again.`);
  process.exit(1);
}

const db = openDatabase(source);
try {
  const result = exportDatabase(db, destination);
  console.log(`Exported a snapshot to ${result.path} (${result.bytes} bytes).`);
  console.log("Open it with any SQLite tool, or place it back as data/discipline.db.");
} finally {
  db.close();
}

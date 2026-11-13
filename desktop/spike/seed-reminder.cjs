// A throwaway data root with one due check-in, so the reminder spikes do not
// touch real history.
//
//   NIYAM_DATA_DIR=C:/temp/niyam-remind npm run ... :
//   ELECTRON_RUN_AS_NODE=1 ./node_modules/electron/dist/electron.exe \
//     spike/seed-reminder.cjs [--task "..."] [--due-minutes-ago 2] \
//     [--level standard] [--quiet-start 22:00 --quiet-end 07:00] \
//     [--interval 240] [--no-pulse]
//
// It has to run under Electron's Node: plain Node cannot require the app's .ts.
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..", "..");
const dataRoot = process.env.NIYAM_DATA_DIR;
if (!dataRoot) {
  console.error("set NIYAM_DATA_DIR to a throwaway folder first");
  process.exit(1);
}
process.env.NIYAM_APP_ROOT = repoRoot;

const { openDatabase, databasePath } = require(path.join(repoRoot, "src", "db", "database.ts"));
const { getOrCreateDayForDate } = require(path.join(repoRoot, "src", "db", "days.ts"));
const { localDateString } = require(path.join(repoRoot, "src", "time.ts"));

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
}

function stamp(at) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())} ${pad(
    at.getHours(),
  )}:${pad(at.getMinutes())}:${pad(at.getSeconds())}`;
}

const db = openDatabase();
const now = new Date();
const day = getOrCreateDayForDate(db, localDateString(now));
const confirmed = new Date(now.getTime() - 45 * 60_000);
const due = new Date(now.getTime() - Number(arg("due-minutes-ago", 2)) * 60_000);

// Long interval so reconciliation does not invent extra slots around our one.
db.prepare(
  "UPDATE settings SET checkin_interval_minutes = ?, interruption_level = ?, quiet_start = ?, quiet_end = ? WHERE id = 1",
).run(
  Number(arg("interval", 240)),
  arg("level", "standard"),
  arg("quiet-start", null),
  arg("quiet-end", null),
);
db.prepare("UPDATE day SET plan_status = 'active', confirmed_at = ? WHERE id = ?").run(
  stamp(confirmed),
  day.id,
);

const task = db
  .prepare("INSERT INTO task (day_id, title, cognitive_load) VALUES (?, ?, 'medium')")
  .run(day.id, arg("task", "Write the weekly report"));
if (!process.argv.includes("--no-pulse")) {
  db.prepare(
    "INSERT INTO pulse (day_id, task_id, due_at, status, quiet) VALUES (?, ?, ?, 'pending', 0) ON CONFLICT(day_id, due_at) DO NOTHING",
  ).run(day.id, task.lastInsertRowid, stamp(due));
}

db.close();
console.log(JSON.stringify({ database: databasePath(), day: day.id, due: stamp(due) }));

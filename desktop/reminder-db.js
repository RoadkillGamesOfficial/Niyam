// One reminder tick, run in the shell. It reuses the app's own reconciliation so
// a hidden app and an open one cannot disagree about what is due; Electron's Node
// strips types, so the .ts modules load directly (proven with Electron 45).
//
// The connection is opened for one tick and closed again: the server owns the
// long-lived one, and (day_id, due_at) is unique, so a race is harmless anyway.

const path = require("node:path");

const srcDir = path.join(__dirname, "..", "src");

let modules = null;

function appModules() {
  if (!modules) {
    modules = {
      openDatabase: require(path.join(srcDir, "db", "database.ts")).openDatabase,
      getDayByDate: require(path.join(srcDir, "db", "days.ts")).getDayByDate,
      getSettings: require(path.join(srcDir, "db", "settings.ts")).getSettings,
      reconcileCheckins: require(path.join(srcDir, "db", "checkins.ts")).reconcileCheckins,
      pendingPulse: require(path.join(srcDir, "db", "pulses.ts")).pendingPulse,
      getTask: require(path.join(srcDir, "db", "tasks.ts")).getTask,
      localDateString: require(path.join(srcDir, "time.ts")).localDateString,
    };
  }
  return modules;
}

/**
 * Brings today's check-ins up to date and reports the prompt worth showing.
 * Returns `{ level, pending }`, where pending is null unless something is due.
 */
function readCheckinTick(now = new Date()) {
  const app = appModules();
  const db = app.openDatabase();
  try {
    const settings = app.getSettings(db);
    const level = settings.interruption_level;
    const day = app.getDayByDate(db, app.localDateString(now));
    if (!day || day.plan_status !== "active" || !day.confirmed_at) {
      return { level, pending: null };
    }

    app.reconcileCheckins(db, day, settings, now);

    const pulse = app.pendingPulse(db, day.id);
    if (!pulse) {
      return { level, pending: null };
    }
    const task = pulse.task_id ? app.getTask(db, pulse.task_id) : undefined;
    return {
      level,
      pending: {
        dueAt: pulse.due_at,
        quiet: pulse.quiet === 1,
        taskTitle: task?.title ?? null,
      },
    };
  } finally {
    db.close();
  }
}

module.exports = { readCheckinTick };

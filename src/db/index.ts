import type { DatabaseSync } from "node:sqlite";
import { ensureAutomaticBackup } from "./backup.ts";
import { databasePath, openDatabase } from "./database.ts";

// One connection per process. Next reloads modules on edit in dev, so the
// connection is parked on globalThis; otherwise every reload would open another
// handle and leak the old ones.
const globalForDb = globalThis as unknown as { disciplineDb?: DatabaseSync };

export function getDatabase(): DatabaseSync {
  globalForDb.disciplineDb ??= openDatabase();
  try {
    // The interval inside the helper makes this startup/periodic, not one per
    // request. A failed backup must never stop the app from opening.
    ensureAutomaticBackup(globalForDb.disciplineDb, databasePath());
  } catch (error) {
    console.warn("Automatic backup skipped:", error);
  }
  return globalForDb.disciplineDb;
}

import type { DatabaseSync } from "node:sqlite";
import { openDatabase } from "./database.ts";

// One connection per process. Next reloads modules on edit in dev, so the
// connection is parked on globalThis; otherwise every reload would open another
// handle and leak the old ones.
const globalForDb = globalThis as unknown as { disciplineDb?: DatabaseSync };

export function getDatabase(): DatabaseSync {
  globalForDb.disciplineDb ??= openDatabase();
  return globalForDb.disciplineDb;
}

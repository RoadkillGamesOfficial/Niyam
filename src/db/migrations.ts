import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";

// Migrations are plain .sql files, applied in filename order (001_, 002_, ...).
// Each one is recorded by filename in schema_migrations, so it runs exactly once.
// Nothing here ever edits or deletes existing data: new work goes in a new file.
const MIGRATIONS_DIR = join(process.cwd(), "migrations");

const CREATE_MIGRATIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    filename TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`;

export function appliedMigrations(db: DatabaseSync): string[] {
  db.exec(CREATE_MIGRATIONS_TABLE);
  const rows = db
    .prepare("SELECT filename FROM schema_migrations ORDER BY filename")
    .all() as Array<{ filename: string }>;
  return rows.map((row) => row.filename);
}

/**
 * Applies every pending migration and returns the filenames it ran.
 * Each migration runs inside its own transaction: if one fails, that file is
 * rolled back and left unapplied, and the error is rethrown.
 */
export function runMigrations(db: DatabaseSync): string[] {
  const applied = new Set(appliedMigrations(db));
  const pending = readdirSync(MIGRATIONS_DIR)
    .filter((filename) => filename.endsWith(".sql"))
    .sort()
    .filter((filename) => !applied.has(filename));

  for (const filename of pending) {
    const sql = readFileSync(join(MIGRATIONS_DIR, filename), "utf8");
    db.exec("BEGIN");
    try {
      db.exec(sql);
      db.prepare("INSERT INTO schema_migrations (filename) VALUES (?)").run(filename);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`Migration ${filename} failed and was rolled back: ${reason}`);
    }
  }

  return pending;
}

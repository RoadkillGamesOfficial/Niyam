import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { openDatabase } from "./database.ts";

/**
 * Runs `body` against a freshly migrated database in a temp directory, then
 * closes it and deletes the files. Closing before deleting matters on Windows,
 * where an open handle blocks removal.
 *
 * Tests never touch data/discipline.db: that is the user's real data.
 */
export function withTempDatabase<T>(body: (db: DatabaseSync, path: string) => T): T {
  const dir = mkdtempSync(join(tmpdir(), "discipline-test-"));
  const path = join(dir, "test.db");
  const db = openDatabase(path);
  try {
    return body(db, path);
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

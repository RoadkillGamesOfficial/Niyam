import type { DatabaseSync } from "node:sqlite";

// Data access for the `day` table. Plain functions that take a connection, so a
// test can point them at a throwaway database. See docs/decisions.md.

export type Day = {
  id: number;
  date: string;
  profile: string | null;
  started_at: string;
  closed_at: string | null;
  summary: string | null;
};

const COLUMNS = "id, date, profile, started_at, closed_at, summary";
const DATE_SHAPE = /^\d{4}-\d{2}-\d{2}$/;

// A bare "2026-11-07" keeps the file readable in any SQLite viewer, and matches
// what the day table stores. Anything else is a bug, not user input.
function assertDateShape(date: string): void {
  if (!DATE_SHAPE.test(date)) {
    throw new Error(`A day is keyed by a local date (YYYY-MM-DD); got "${date}".`);
  }
}

export function getDayByDate(db: DatabaseSync, date: string): Day | undefined {
  assertDateShape(date);
  const row = db
    .prepare(`SELECT ${COLUMNS} FROM day WHERE date = ?`)
    .get(date) as unknown as Day | undefined;
  return row;
}

/**
 * Returns the day row for a local date, creating it on first use. Days are
 * created lazily so the app has no startup step and no background job.
 */
export function getOrCreateDayForDate(db: DatabaseSync, date: string): Day {
  const existing = getDayByDate(db, date);
  if (existing) {
    return existing;
  }

  // ON CONFLICT keeps the insert harmless if two requests arrive together.
  db.prepare("INSERT INTO day (date) VALUES (?) ON CONFLICT(date) DO NOTHING").run(date);

  // Read back rather than trusting the insert: on a conflict the row that exists
  // is the one we want, and its id is not the one this insert would have used.
  const created = getDayByDate(db, date);
  if (!created) {
    throw new Error(`Could not open a day row for "${date}".`);
  }
  return created;
}

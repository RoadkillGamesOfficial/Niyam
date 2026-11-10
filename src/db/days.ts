import type { DatabaseSync } from "node:sqlite";
import type { PauseWindow } from "../game/pulses.ts";

// Data access for the `day` table. Plain functions that take a connection, so a
// test can point them at a throwaway database. See docs/decisions.md.

export type DayStatus = "draft" | "active" | "closed";
export type DayProfile = "sprinting" | "maintenance" | "low_energy";

export type Day = {
  id: number;
  date: string;
  profile: DayProfile | null;
  plan_status: DayStatus;
  confirmed_at: string | null;
  started_at: string;
  closed_at: string | null;
  summary: string | null;
};

const COLUMNS =
  "id, date, profile, plan_status, confirmed_at, started_at, closed_at, summary";
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
  return db
    .prepare(`SELECT ${COLUMNS} FROM day WHERE date = ?`)
    .get(date) as unknown as Day | undefined;
}

export function getDayById(db: DatabaseSync, id: number): Day | undefined {
  return db
    .prepare(`SELECT ${COLUMNS} FROM day WHERE id = ?`)
    .get(id) as unknown as Day | undefined;
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

export function setDayProfile(db: DatabaseSync, dayId: number, profile: DayProfile): void {
  db.prepare("UPDATE day SET profile = ? WHERE id = ?").run(profile, dayId);
}

/** SQLite timestamps are UTC with `datetime('now')`; slots use local time. */
export function parseLocalTimestamp(value: string): Date {
  const [datePart, timePart = "00:00:00"] = value.split(" ");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hours, minutes, seconds] = timePart.split(":").map(Number);
  return new Date(year, month - 1, day, hours, minutes, seconds);
}

export function pauseDay(db: DatabaseSync, dayId: number, at: string): void {
  const open = db
    .prepare("SELECT id FROM pause WHERE day_id = ? AND ended_at IS NULL LIMIT 1")
    .get(dayId);
  if (open) {
    return; // already paused; pausing twice must not create two windows
  }
  db.prepare("INSERT INTO pause (day_id, started_at) VALUES (?, ?)").run(dayId, at);
}

export function resumeDay(db: DatabaseSync, dayId: number, at: string): void {
  db.prepare(
    "UPDATE pause SET ended_at = ? WHERE day_id = ? AND ended_at IS NULL",
  ).run(at, dayId);
}

export function pauseWindows(db: DatabaseSync, dayId: number): PauseWindow[] {
  const rows = db
    .prepare("SELECT started_at, ended_at FROM pause WHERE day_id = ? ORDER BY started_at")
    .all(dayId) as unknown as Array<{ started_at: string; ended_at: string | null }>;
  return rows.map((row) => ({
    start: parseLocalTimestamp(row.started_at),
    end: row.ended_at ? parseLocalTimestamp(row.ended_at) : null,
  }));
}

export function isPaused(db: DatabaseSync, dayId: number): boolean {
  const row = db
    .prepare("SELECT 1 AS present FROM pause WHERE day_id = ? AND ended_at IS NULL LIMIT 1")
    .get(dayId);
  return row !== undefined;
}

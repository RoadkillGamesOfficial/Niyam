import type { DatabaseSync } from "node:sqlite";

// Data access for check-ins. A row exists for every scheduled slot, including
// missed ones, because later phases read this history and it must not be lost
// (PULSE-3, PULSE-4).

export type PulseStatus = "pending" | "answered" | "missed";
export type PulseResponse = "on_track" | "pivot" | "drifted";

export type Pulse = {
  id: number;
  day_id: number;
  task_id: number | null;
  due_at: string;
  status: PulseStatus;
  response: PulseResponse | null;
  note: string | null;
  answered_at: string | null;
  created_at: string;
};

const COLUMNS =
  "id, day_id, task_id, due_at, status, response, note, answered_at, created_at";

export function listPulsesForDay(db: DatabaseSync, dayId: number): Pulse[] {
  return db
    .prepare(`SELECT ${COLUMNS} FROM pulse WHERE day_id = ? ORDER BY due_at, id`)
    .all(dayId) as unknown as Pulse[];
}

export function getPulse(db: DatabaseSync, id: number): Pulse | undefined {
  return db.prepare(`SELECT ${COLUMNS} FROM pulse WHERE id = ?`).get(id) as
    | unknown as Pulse
    | undefined;
}

/**
 * Creates the row for a scheduled slot. The unique index on (day_id, due_at)
 * makes reconciliation idempotent: running it twice never duplicates a pulse.
 */
export function createPulse(
  db: DatabaseSync,
  input: {
    dayId: number;
    dueAt: string;
    status: PulseStatus;
    taskId?: number | null;
  },
): void {
  db.prepare(
    `INSERT INTO pulse (day_id, task_id, due_at, status)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(day_id, due_at) DO NOTHING`,
  ).run(input.dayId, input.taskId ?? null, input.dueAt, input.status);
}

/** The one prompt worth showing: newest pending, oldest first if several exist. */
export function pendingPulse(db: DatabaseSync, dayId: number): Pulse | undefined {
  return db
    .prepare(
      `SELECT ${COLUMNS} FROM pulse
       WHERE day_id = ? AND status = 'pending'
       ORDER BY due_at DESC, id DESC LIMIT 1`,
    )
    .get(dayId) as unknown as Pulse | undefined;
}

/**
 * Records an answer. Only a pending pulse can be answered, so a double submit or
 * a stale tab cannot award XP twice.
 */
export function answerPulse(
  db: DatabaseSync,
  id: number,
  response: PulseResponse,
  note: string | null,
  at: string,
): Pulse | undefined {
  const result = db
    .prepare(
      `UPDATE pulse SET status = 'answered', response = ?, note = ?, answered_at = ?
       WHERE id = ? AND status = 'pending'`,
    )
    .run(response, note, at, id);
  if (result.changes === 0) {
    return undefined;
  }
  return getPulse(db, id);
}

export function markPulseMissed(db: DatabaseSync, id: number): void {
  db.prepare(
    "UPDATE pulse SET status = 'missed' WHERE id = ? AND status = 'pending'",
  ).run(id);
}

export function pulseCounts(
  db: DatabaseSync,
  dayId: number,
): { answered: number; missed: number } {
  const row = db
    .prepare(
      `SELECT
         SUM(CASE WHEN status = 'answered' THEN 1 ELSE 0 END) AS answered,
         SUM(CASE WHEN status = 'missed' THEN 1 ELSE 0 END) AS missed
       FROM pulse WHERE day_id = ?`,
    )
    .get(dayId) as unknown as { answered: number | null; missed: number | null };
  return { answered: row.answered ?? 0, missed: row.missed ?? 0 };
}

/**
 * The answers, in order, as the combo sees them. A missed check-in counts as a
 * drift for the multiplier (PDD §8.2) without taking any XP away.
 */
export function comboResponses(db: DatabaseSync): PulseResponse[] {
  const rows = db
    .prepare(
      `SELECT CASE WHEN status = 'missed' THEN 'drifted' ELSE response END AS response
       FROM pulse
       WHERE status = 'missed' OR (status = 'answered' AND response IS NOT NULL)
       ORDER BY COALESCE(answered_at, due_at), id`,
    )
    .all() as unknown as Array<{ response: PulseResponse }>;
  return rows.map((row) => row.response);
}

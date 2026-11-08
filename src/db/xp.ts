import type { DatabaseSync } from "node:sqlite";

// The XP ledger. Events are only ever appended (GAME-1): totals, levels and the
// combo are derived from it, so rules can be retuned without rewriting history.

export type XpReason =
  | "pulse_on_track"
  | "pulse_pivot"
  | "pulse_drifted"
  | "micro_action"
  | "task_done"
  | "task_undone"
  | "day_closed";

export type NewXpEvent = {
  dayId?: number | null;
  amount: number;
  reason: XpReason;
  multiplier?: number;
  taskId?: number | null;
  pulseId?: number | null;
};

export function addXpEvent(db: DatabaseSync, event: NewXpEvent): void {
  db.prepare(
    `INSERT INTO xp_event (day_id, amount, reason, multiplier, task_id, pulse_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    event.dayId ?? null,
    event.amount,
    event.reason,
    event.multiplier ?? 1,
    event.taskId ?? null,
    event.pulseId ?? null,
  );
}

export function totalXp(db: DatabaseSync): number {
  const row = db.prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM xp_event").get() as
    | unknown as { total: number };
  return row.total;
}

export function xpForDay(db: DatabaseSync, dayId: number): number {
  const row = db
    .prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM xp_event WHERE day_id = ?")
    .get(dayId) as unknown as { total: number };
  return row.total;
}

export function xpEventsForDay(db: DatabaseSync, dayId: number) {
  return db
    .prepare(
      `SELECT id, amount, reason, multiplier, created_at FROM xp_event
       WHERE day_id = ? ORDER BY created_at DESC, id DESC`,
    )
    .all(dayId) as unknown as Array<{
    id: number;
    amount: number;
    reason: XpReason;
    multiplier: number;
    created_at: string;
  }>;
}

/** True when this pulse already produced an event, so retries cannot pay twice. */
export function hasEventForPulse(db: DatabaseSync, pulseId: number): boolean {
  const row = db
    .prepare("SELECT 1 AS present FROM xp_event WHERE pulse_id = ? LIMIT 1")
    .get(pulseId);
  return row !== undefined;
}

/** True when this task already earned completion XP. */
export function hasTaskCompletionEvent(db: DatabaseSync, taskId: number): boolean {
  const row = db
    .prepare("SELECT 1 AS present FROM xp_event WHERE task_id = ? AND reason = 'task_done' LIMIT 1")
    .get(taskId);
  return row !== undefined;
}

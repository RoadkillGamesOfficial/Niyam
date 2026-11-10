import type { DatabaseSync } from "node:sqlite";
import { CONFIG } from "../config.ts";

// Data access for the `task` table. Same shape as src/db/days.ts: plain
// functions that take a connection and return plain rows.

export type TaskStatus = "open" | "done";
export type CognitiveLoad = "light" | "medium" | "heavy";

export type Task = {
  id: number;
  day_id: number;
  title: string;
  notes: string | null;
  estimated_minutes: number | null;
  cognitive_load: CognitiveLoad;
  status: TaskStatus;
  parent_task_id: number | null;
  habit_id: number | null;
  carried_from_day_id: number | null;
  brain_dump_id: number | null;
  created_at: string;
  updated_at: string;
};

export type NewTask = {
  dayId: number;
  title: string;
  notes?: string | null;
  estimatedMinutes?: number | null;
  cognitiveLoad?: CognitiveLoad;
  habitId?: number | null;
  // Set for a shrunken task, so micro-action XP can be paid on completion.
  parentTaskId?: number | null;
};

const COLUMNS =
  "id, day_id, title, notes, estimated_minutes, cognitive_load, status, parent_task_id, habit_id, carried_from_day_id, brain_dump_id, created_at, updated_at";

export function getTask(db: DatabaseSync, id: number): Task | undefined {
  const row = db
    .prepare(`SELECT ${COLUMNS} FROM task WHERE id = ?`)
    .get(id) as unknown as Task | undefined;
  return row;
}

export function createTask(db: DatabaseSync, input: NewTask): Task {
  const title = input.title.trim();
  if (!title) {
    throw new Error("A task needs a title.");
  }
  if (title.length > CONFIG.tasks.maxTitleLength) {
    throw new Error(
      `A task title can be at most ${CONFIG.tasks.maxTitleLength} characters.`,
    );
  }

  const result = db
    .prepare(
      `INSERT INTO task (day_id, title, notes, estimated_minutes, cognitive_load, habit_id, parent_task_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.dayId,
      title,
      input.notes ?? null,
      input.estimatedMinutes ?? null,
      input.cognitiveLoad ?? "medium",
      input.habitId ?? null,
      input.parentTaskId ?? null,
    );

  // lastInsertRowid is a number or a bigint depending on the driver's mood.
  const created = getTask(db, Number(result.lastInsertRowid));
  if (!created) {
    throw new Error("The task was inserted but could not be read back.");
  }
  return created;
}

/**
 * One day's tasks, oldest first. Ordering by id as well as created_at keeps the
 * list stable when several tasks land in the same second.
 */
export function listTasksForDay(db: DatabaseSync, dayId: number): Task[] {
  return db
    .prepare(`SELECT ${COLUMNS} FROM task WHERE day_id = ? ORDER BY created_at, id`)
    .all(dayId) as unknown as Task[];
}

/**
 * Unfinished tasks from earlier days that are not already carried into today.
 * They are suggestions only: nothing moves until the user asks (PLAN-6).
 */
export function listOpenTasksBefore(
  db: DatabaseSync,
  date: string,
  todayId: number,
  limit = 5,
): Task[] {
  return db
    .prepare(
      `SELECT ${COLUMNS.split(", ").map((column) => `task.${column}`).join(", ")}
       FROM task JOIN day ON day.id = task.day_id
       WHERE day.date < ? AND task.status = 'open' AND task.habit_id IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM task carried
           WHERE carried.day_id = ? AND carried.carried_from_day_id = task.day_id
             AND carried.title = task.title
         )
       ORDER BY day.date DESC, task.id
       LIMIT ?`,
    )
    .all(date, todayId, limit) as unknown as Task[];
}

/**
 * Marks a task open or done. History is not deleted, only flagged, so a task can
 * be reopened without losing when it was made.
 */
export function setTaskStatus(
  db: DatabaseSync,
  taskId: number,
  status: TaskStatus,
): Task | undefined {
  db.prepare("UPDATE task SET status = ?, updated_at = datetime('now') WHERE id = ?").run(
    status,
    taskId,
  );
  return getTask(db, taskId);
}

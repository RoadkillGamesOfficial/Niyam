import type { DatabaseSync } from "node:sqlite";
import {
  dateKey,
  habitStreak,
  isHabitDue,
  isHabitIncluded,
  parseDateKey,
  type HabitFrequency,
  type HabitOutcome,
  type Habit,
} from "../game/habits.ts";
import { addPlanItem } from "./plan.ts";
import { createTask } from "./tasks.ts";

// Habits create tasks on the days they are due (HAB-3). Occurrences record what
// happened, so archiving or editing a habit never rewrites the past (HAB-7).

export type HabitRecord = Habit & { created_at: string; archived_at: string | null };

export type NewHabit = {
  name: string;
  frequency: HabitFrequency;
  weekdays?: number[] | null;
  intervalDays?: number | null;
  timesPerWeek?: number | null;
  monthDay?: number | null;
  preferredTime?: "morning" | "afternoon" | "evening" | null;
  estimatedMinutes?: number | null;
  cognitiveLoad?: "light" | "medium" | "heavy";
  essential?: boolean;
};

const COLUMNS = `id, name, frequency, weekdays, interval_days, times_per_week, month_day,
  preferred_time, estimated_minutes, cognitive_load, essential, status, archived_at, created_at`;

type RawHabit = Omit<HabitRecord, "weekdays" | "essential"> & {
  weekdays: string | null;
  essential: number;
};

function toHabit(row: RawHabit): HabitRecord {
  return {
    ...row,
    essential: row.essential === 1,
    weekdays: row.weekdays ? row.weekdays.split(",").map(Number) : null,
  };
}

export function createHabit(db: DatabaseSync, input: NewHabit): HabitRecord {
  const name = input.name.trim();
  if (!name) {
    throw new Error("A habit needs a name.");
  }
  if (name.length > 80) {
    throw new Error("A habit name can be at most 80 characters.");
  }
  if (input.frequency === "weekdays" && (input.weekdays ?? []).length === 0) {
    throw new Error("Pick at least one weekday.");
  }
  if (input.frequency === "every_n" && (input.intervalDays ?? 0) < 1) {
    throw new Error("Every-N-days habits need a positive interval.");
  }
  if (input.frequency === "monthly" && ((input.monthDay ?? 0) < 1 || (input.monthDay ?? 0) > 31)) {
    throw new Error("Monthly habits need a day between 1 and 31.");
  }

  const result = db
    .prepare(
      `INSERT INTO habit (name, frequency, weekdays, interval_days, times_per_week, month_day,
         preferred_time, estimated_minutes, cognitive_load, essential)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      name,
      input.frequency,
      input.weekdays && input.weekdays.length > 0 ? input.weekdays.join(",") : null,
      input.intervalDays ?? null,
      input.timesPerWeek ?? null,
      input.monthDay ?? null,
      input.preferredTime ?? null,
      input.estimatedMinutes ?? null,
      input.cognitiveLoad ?? "light",
      input.essential ? 1 : 0,
    );

  const created = getHabit(db, Number(result.lastInsertRowid));
  if (!created) {
    throw new Error("The habit was inserted but could not be read back.");
  }
  return created;
}

export function getHabit(db: DatabaseSync, id: number): HabitRecord | undefined {
  const row = db.prepare(`SELECT ${COLUMNS} FROM habit WHERE id = ?`).get(id) as
    | unknown as RawHabit
    | undefined;
  return row ? toHabit(row) : undefined;
}

/** Active and paused habits, newest last. Archived habits are history only. */
export function listHabits(db: DatabaseSync): HabitRecord[] {
  const rows = db
    .prepare(`SELECT ${COLUMNS} FROM habit WHERE archived_at IS NULL ORDER BY created_at, id`)
    .all() as unknown as RawHabit[];
  return rows.map(toHabit);
}

export function setHabitStatus(
  db: DatabaseSync,
  id: number,
  status: "active" | "paused",
): void {
  db.prepare("UPDATE habit SET status = ?, updated_at = datetime('now') WHERE id = ?").run(
    status,
    id,
  );
}

export function archiveHabit(db: DatabaseSync, id: number): void {
  db.prepare(
    "UPDATE habit SET archived_at = datetime('now'), status = 'paused', updated_at = datetime('now') WHERE id = ?",
  ).run(id);
}

export type Occurrence = {
  id: number;
  habit_id: number;
  day_id: number | null;
  due_date: string;
  task_id: number | null;
  outcome: HabitOutcome;
};

export function occurrencesFor(db: DatabaseSync, habitId: number): Occurrence[] {
  return db
    .prepare(
      `SELECT id, habit_id, day_id, due_date, task_id, outcome
       FROM habit_occurrence WHERE habit_id = ? ORDER BY due_date`,
    )
    .all(habitId) as unknown as Occurrence[];
}

/** Which habits are due on `date`, using their own history for weekly windows. */
export function dueHabits(db: DatabaseSync, date: Date): HabitRecord[] {
  return listHabits(db).filter((habit) => {
    if (habit.status !== "active") {
      return false;
    }
    return isHabitDue(habit, date, {
      createdOn: parseDateKey(habit.created_at.slice(0, 10)),
      occurrences: occurrencesFor(db, habit.id),
    });
  });
}

/**
 * Adds today's due habits to the plan as tasks, tagging them so completion and
 * streaks work. Low-energy days create deferred occurrences instead, which are
 * "not today", never failures (HAB-5).
 */
export function syncHabitsForDay(
  db: DatabaseSync,
  input: {
    dayId: number;
    date: Date;
    profile: "sprinting" | "maintenance" | "low_energy";
  },
): number {
  let created = 0;
  const dueDate = dateKey(input.date);

  for (const habit of dueHabits(db, input.date)) {
    const existing = db
      .prepare("SELECT id FROM habit_occurrence WHERE habit_id = ? AND due_date = ?")
      .get(habit.id, dueDate);
    if (existing) {
      continue;
    }

    if (!isHabitIncluded(habit, input.profile)) {
      db.prepare(
        `INSERT INTO habit_occurrence (habit_id, day_id, due_date, outcome)
         VALUES (?, ?, ?, 'deferred')
         ON CONFLICT(habit_id, due_date) DO NOTHING`,
      ).run(habit.id, input.dayId, dueDate);
      continue;
    }

    const task = createTask(db, {
      dayId: input.dayId,
      title: habit.name,
      estimatedMinutes: habit.estimated_minutes,
      cognitiveLoad: habit.cognitive_load,
      habitId: habit.id,
    });
    addPlanItem(db, input.dayId, task.id);
    db.prepare(
      `INSERT INTO habit_occurrence (habit_id, day_id, due_date, task_id)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(habit_id, due_date) DO NOTHING`,
    ).run(habit.id, input.dayId, dueDate, task.id);
    created += 1;
  }

  return created;
}

/** Keeps the occurrence in step with the task: done means completed. */
export function recordHabitOutcomeForTask(
  db: DatabaseSync,
  taskId: number,
  done: boolean,
): void {
  db.prepare(
    "UPDATE habit_occurrence SET outcome = ? WHERE task_id = ? AND outcome IN ('pending', 'completed')",
  ).run(done ? "completed" : "pending", taskId);
}

/** Skipping is logged and costs nothing; the streak grace may forgive one miss. */
export function skipOccurrence(db: DatabaseSync, occurrenceId: number): void {
  db.prepare(
    "UPDATE habit_occurrence SET outcome = 'skipped' WHERE id = ? AND outcome = 'pending'",
  ).run(occurrenceId);
}

export function streakFor(db: DatabaseSync, habitId: number): number {
  return habitStreak(occurrencesFor(db, habitId));
}

export function occurrenceForTask(db: DatabaseSync, taskId: number): Occurrence | undefined {
  return db
    .prepare(
      `SELECT id, habit_id, day_id, due_date, task_id, outcome
       FROM habit_occurrence WHERE task_id = ? LIMIT 1`,
    )
    .get(taskId) as unknown as Occurrence | undefined;
}

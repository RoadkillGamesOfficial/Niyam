import { CONFIG } from "../config.ts";

// Pure habit scheduling: when a habit is due, whether it survives a low-energy
// day, and how long its streak is. Habits generate tasks; nothing here touches
// the database, so every rule is testable without a clock.

export type HabitFrequency =
  | "daily"
  | "weekdays"
  | "every_n"
  | "times_per_week"
  | "monthly";

export type Habit = {
  id: number;
  name: string;
  frequency: HabitFrequency;
  weekdays: number[] | null; // 0 = Sunday
  interval_days: number | null;
  times_per_week: number | null;
  month_day: number | null;
  preferred_time: "morning" | "afternoon" | "evening" | null;
  estimated_minutes: number | null;
  cognitive_load: "light" | "medium" | "heavy";
  essential: boolean;
  status: "active" | "paused";
};

export type HabitOutcome = "pending" | "completed" | "skipped" | "deferred";
export type HabitOccurrence = { due_date: string; outcome: HabitOutcome };

const DAY = 86_400_000;

export function dateKey(date: Date): string {
  const pad = (value: number): string => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseDateKey(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function daysBetween(from: Date, to: Date): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime();
  return Math.round((b - a) / DAY);
}

/** Monday-based week start, used by weekly habits and streak grace. */
export function startOfWeek(date: Date): Date {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const offset = (copy.getDay() + 6) % 7; // Sunday 0 -> 6, Monday 1 -> 0
  copy.setDate(copy.getDate() - offset);
  return copy;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Is this habit due on `date`?
 *
 * Weekly and flexible habits ("groceries", "3 times this week") are due every day
 * inside their window until completed, so they stay visible instead of silently
 * disappearing (HAB-4).
 */
export function isHabitDue(
  habit: Habit,
  date: Date,
  context: { createdOn: Date; occurrences: HabitOccurrence[] },
): boolean {
  if (habit.status !== "active") {
    return false;
  }
  if (daysBetween(context.createdOn, date) < 0) {
    return false;
  }
  const key = dateKey(date);
  switch (habit.frequency) {
    case "daily":
      return true;
    case "weekdays":
      return (habit.weekdays ?? []).includes(date.getDay());
    case "every_n": {
      const every = habit.interval_days ?? 1;
      return daysBetween(context.createdOn, date) % every === 0;
    }
    case "monthly": {
      const wanted = habit.month_day ?? 1;
      const last = daysInMonth(date.getFullYear(), date.getMonth());
      return date.getDate() === Math.min(wanted, last);
    }
    case "times_per_week": {
      const weekStart = startOfWeek(date).getTime();
      const doneThisWeek = context.occurrences.some(
        (occurrence) =>
          occurrence.outcome === "completed" &&
          startOfWeek(parseDateKey(occurrence.due_date)).getTime() === weekStart,
      );
      return !doneThisWeek;
    }
    default:
      return false;
  }
}

/** Low-Energy Rescue keeps only Essential habits; the rest are deferred (HAB-5). */
export function isHabitIncluded(
  habit: Habit,
  profile: "sprinting" | "maintenance" | "low_energy",
): boolean {
  return profile !== "low_energy" || habit.essential;
}

/**
 * Consecutive completed due-days, newest first, allowing one miss per week
 * without breaking the run (PDD §8.7 assumption, HAB-6).
 */
export function habitStreak(
  occurrences: HabitOccurrence[],
  options: { gracePerWeek?: number } = {},
): number {
  const grace = options.gracePerWeek ?? CONFIG.habits.gracePerWeek;
  const ordered = [...occurrences]
    .filter((occurrence) => occurrence.outcome !== "deferred")
    .sort((a, b) => (a.due_date < b.due_date ? 1 : -1));

  let streak = 0;
  const missesPerWeek = new Map<number, number>();
  for (const occurrence of ordered) {
    if (occurrence.outcome === "completed") {
      streak += 1;
      continue;
    }
    if (occurrence.outcome === "deferred") {
      continue;
    }
    const week = startOfWeek(parseDateKey(occurrence.due_date)).getTime();
    const used = missesPerWeek.get(week) ?? 0;
    if (used < grace) {
      missesPerWeek.set(week, used + 1);
      continue; // forgiven: the streak neither grows nor breaks
    }
    break;
  }
  return streak;
}

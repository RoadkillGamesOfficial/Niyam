import type { DatabaseSync } from "node:sqlite";
import { CONFIG } from "../config.ts";
import {
  consistencyRate,
  driftLevel,
  findPeakWindows,
  longestOnTrackRun,
  type PeakWindow,
} from "../game/insights.ts";
import { dateKey, parseDateKey, startOfWeek } from "../game/habits.ts";
import { integrityFromDays, type DayScore } from "../game/rules.ts";
import type { DayProfile } from "./days.ts";
import { listHabits, streakFor } from "./habits.ts";

// Phase 4 reads only the local history: pulses, tasks, days and habits. Nothing
// leaves the machine, and every view is derived on request so no new table can
// drift out of sync with what actually happened.

function shiftKey(key: string, days: number): string {
  const date = parseDateKey(key);
  date.setDate(date.getDate() + days);
  return dateKey(date);
}

function startKeyFor(days: number, now: Date): string {
  return shiftKey(dateKey(now), -(days - 1));
}

function weekKey(key: string): string {
  return dateKey(startOfWeek(parseDateKey(key)));
}

function weekdayOf(key: string): number {
  return parseDateKey(key).getDay();
}

export type DriftCell = {
  weekday: number;
  hour: number;
  answered: number;
  missed: number;
  drifts: number;
  total: number;
  level: 0 | 1 | 2 | 3 | 4;
};

export type DriftHeatmap = {
  cells: DriftCell[];
  answered: number;
  missed: number;
  drifts: number;
  hasData: boolean;
};

/**
 * One cell per weekday and hour. Drift is a drifted answer or a missed slot;
 * pivot is a course correction, so it is not counted as drift.
 */
export function getDriftHeatmap(
  db: DatabaseSync,
  options: { days?: number; now?: Date } = {},
): DriftHeatmap {
  const days = options.days ?? CONFIG.insights.heatmapDays;
  const now = options.now ?? new Date();
  const start = startKeyFor(days, now);

  const rows = db
    .prepare(
      `SELECT d.date AS date,
         CAST(substr(p.due_at, 12, 2) AS INTEGER) AS hour,
         COUNT(*) AS total,
         SUM(CASE WHEN p.status = 'answered' THEN 1 ELSE 0 END) AS answered,
         SUM(CASE WHEN p.status = 'missed' THEN 1 ELSE 0 END) AS missed,
         SUM(CASE WHEN p.status = 'missed' OR p.response = 'drifted' THEN 1 ELSE 0 END) AS drifts
       FROM pulse p JOIN day d ON d.id = p.day_id
       WHERE d.date >= ?
       GROUP BY d.date, hour`,
    )
    .all(start) as unknown as Array<{
    date: string;
    hour: number;
    total: number;
    answered: number;
    missed: number;
    drifts: number;
  }>;

  const cells: DriftCell[] = [];
  for (let index = 0; index < 7; index += 1) {
    const weekday = (index + 1) % 7; // Monday-first display
    for (let hour = 0; hour < 24; hour += 1) {
      cells.push({
        weekday,
        hour,
        answered: 0,
        missed: 0,
        drifts: 0,
        total: 0,
        level: 0,
      });
    }
  }
  const byKey = new Map(cells.map((cell) => [`${cell.weekday}-${cell.hour}`, cell]));

  let answered = 0;
  let missed = 0;
  let drifts = 0;
  for (const row of rows) {
    if (row.hour < 0 || row.hour > 23) {
      continue;
    }
    const cell = byKey.get(`${weekdayOf(row.date)}-${row.hour}`);
    if (!cell) {
      continue;
    }
    cell.answered += row.answered;
    cell.missed += row.missed;
    cell.drifts += row.drifts;
    cell.total += row.total;
    answered += row.answered;
    missed += row.missed;
    drifts += row.drifts;
  }
  for (const cell of cells) {
    cell.level = driftLevel(cell.drifts);
  }

  return { cells, answered, missed, drifts, hasData: answered + missed > 0 };
}

export type ProfileCompletion = {
  profile: DayProfile;
  days: number;
  tasksDone: number;
  tasksTotal: number;
  rate: number | null;
};

const PROFILE_ORDER: DayProfile[] = ["sprinting", "maintenance", "low_energy"];

/** Completion under each energy setting, across the recent history window. */
export function getProfileCompletion(
  db: DatabaseSync,
  options: { days?: number; now?: Date } = {},
): ProfileCompletion[] {
  const days = options.days ?? CONFIG.insights.historyDays;
  const start = startKeyFor(days, options.now ?? new Date());

  const rows = db
    .prepare(
      `SELECT d.profile AS profile,
         COUNT(DISTINCT d.id) AS days,
         COALESCE(SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END), 0) AS done,
         COUNT(t.id) AS total
       FROM day d
       LEFT JOIN task t ON t.day_id = d.id
       WHERE d.profile IS NOT NULL AND d.date >= ?
       GROUP BY d.profile`,
    )
    .all(start) as unknown as Array<{
    profile: DayProfile;
    days: number;
    done: number;
    total: number;
  }>;

  const byProfile = new Map(rows.map((row) => [row.profile, row]));
  return PROFILE_ORDER.map((profile) => {
    const row = byProfile.get(profile);
    const total = row?.total ?? 0;
    const done = row?.done ?? 0;
    return {
      profile,
      days: row?.days ?? 0,
      tasksDone: done,
      tasksTotal: total,
      rate: total > 0 ? done / total : null,
    };
  });
}

export type WeeklyTrend = {
  weekStart: string;
  weekEnd: string;
  activeDays: number;
  answered: number;
  missed: number;
  onTrack: number;
  pivot: number;
  drifted: number;
  tasksDone: number;
  tasksTotal: number;
  consistency: number | null;
  longestCombo: number;
  integrity: number | null;
};

type PulseRow = {
  date: string;
  status: string;
  response: string | null;
};

type DayStatRow = { date: string; total: number; done: number };

function pulseBuckets(rows: PulseRow[]): Map<
  string,
  { answered: number; missed: number; onTrack: number; pivot: number; drifted: number }
> {
  const buckets = new Map<
    string,
    { answered: number; missed: number; onTrack: number; pivot: number; drifted: number }
  >();
  for (const row of rows) {
    const bucket = buckets.get(row.date) ?? {
      answered: 0,
      missed: 0,
      onTrack: 0,
      pivot: 0,
      drifted: 0,
    };
    if (row.status === "answered") {
      bucket.answered += 1;
      if (row.response === "on_track") bucket.onTrack += 1;
      else if (row.response === "pivot") bucket.pivot += 1;
      else if (row.response === "drifted") bucket.drifted += 1;
    } else if (row.status === "missed") {
      bucket.missed += 1;
    }
    buckets.set(row.date, bucket);
  }
  return buckets;
}

/** Monday-to-Sunday trends, oldest first, including the current partial week. */
export function getWeeklyTrends(
  db: DatabaseSync,
  options: { weeks?: number; now?: Date } = {},
): WeeklyTrend[] {
  const weeks = options.weeks ?? CONFIG.insights.trendWeeks;
  const now = options.now ?? new Date();
  const currentStart = startOfWeek(now);
  const firstStart = new Date(currentStart);
  firstStart.setDate(firstStart.getDate() - (weeks - 1) * 7);
  const start = dateKey(firstStart);
  const today = dateKey(now);

  const pulses = db
    .prepare(
      `SELECT d.date AS date, p.status, p.response
       FROM pulse p JOIN day d ON d.id = p.day_id
       WHERE d.date >= ?
       ORDER BY d.date, p.due_at, p.id`,
    )
    .all(start) as unknown as PulseRow[];
  const dayRows = db
    .prepare(
      `SELECT d.date AS date,
         COUNT(t.id) AS total,
         COALESCE(SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END), 0) AS done
       FROM day d LEFT JOIN task t ON t.day_id = d.id
       WHERE d.date >= ?
       GROUP BY d.date`,
    )
    .all(start) as unknown as DayStatRow[];

  const pulsesByDate = pulseBuckets(pulses);
  const tasksByDate = new Map(dayRows.map((row) => [row.date, row]));

  const trends: WeeklyTrend[] = [];
  for (let index = 0; index < weeks; index += 1) {
    const weekStartDate = new Date(firstStart);
    weekStartDate.setDate(weekStartDate.getDate() + index * 7);
    const weekStart = dateKey(weekStartDate);
    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setDate(weekEndDate.getDate() + 6);
    const weekEnd = index === weeks - 1 ? today : dateKey(weekEndDate);

    const dayScores: DayScore[] = [];
    const responses: Array<string | null> = [];
    let answered = 0;
    let missed = 0;
    let onTrack = 0;
    let pivot = 0;
    let drifted = 0;
    let tasksDone = 0;
    let tasksTotal = 0;
    let activeDays = 0;

    let cursor = new Date(weekStartDate);
    while (dateKey(cursor) <= weekEnd) {
      const key = dateKey(cursor);
      const pulse = pulsesByDate.get(key);
      const task = tasksByDate.get(key);
      const dayAnswered = pulse?.answered ?? 0;
      const dayMissed = pulse?.missed ?? 0;
      const dayDone = task?.done ?? 0;
      const dayTotal = task?.total ?? 0;

      answered += dayAnswered;
      missed += dayMissed;
      onTrack += pulse?.onTrack ?? 0;
      pivot += pulse?.pivot ?? 0;
      drifted += pulse?.drifted ?? 0;
      tasksDone += dayDone;
      tasksTotal += dayTotal;
      if (dayAnswered + dayMissed + dayTotal > 0) {
        activeDays += 1;
      }
      dayScores.push({
        answered: dayAnswered,
        missed: dayMissed,
        tasksDone: dayDone,
        tasksPlanned: dayTotal,
      });

      // The rows arrive in due order, so this is the week's real answer order.
      for (const row of pulses) {
        if (row.date !== key) {
          continue;
        }
        if (row.status === "missed") {
          responses.push("missed");
        } else if (row.status === "answered") {
          responses.push(row.response);
        }
      }

      cursor.setDate(cursor.getDate() + 1);
    }

    trends.push({
      weekStart,
      weekEnd,
      activeDays,
      answered,
      missed,
      onTrack,
      pivot,
      drifted,
      tasksDone,
      tasksTotal,
      consistency: consistencyRate(answered, missed),
      longestCombo: longestOnTrackRun(responses),
      // A silent week has no integrity reading. The dashboard meter keeps its
      // 50% baseline, but a historical row should say "no data", not invent one.
      integrity: activeDays > 0 ? integrityFromDays(dayScores) : null,
    });
  }

  return trends;
}

export type HabitSuggestion = "shrink" | "reschedule";

export type HabitInsight = {
  habitId: number;
  name: string;
  frequency: string;
  status: "active" | "paused";
  preferredTime: "morning" | "afternoon" | "evening" | null;
  estimatedMinutes: number | null;
  cognitiveLoad: "light" | "medium" | "heavy";
  streak: number;
  completed: number;
  decided: number;
  rate: number | null;
  suggestions: HabitSuggestion[];
};

/**
 * Recent completion for each habit. Pending days are not failures and deferred
 * days are not counted; only completed versus skipped decisions are judged.
 */
export function getHabitInsights(
  db: DatabaseSync,
  options: { days?: number; now?: Date } = {},
): HabitInsight[] {
  const days = options.days ?? CONFIG.insights.habitWindowDays;
  const now = options.now ?? new Date();
  const start = startKeyFor(days, now);
  const end = dateKey(now);

  return listHabits(db).map((habit) => {
    const rows = db
      .prepare(
        `SELECT outcome FROM habit_occurrence
         WHERE habit_id = ? AND due_date >= ? AND due_date <= ?`,
      )
      .all(habit.id, start, end) as unknown as Array<{ outcome: string }>;
    const completed = rows.filter((row) => row.outcome === "completed").length;
    const skipped = rows.filter((row) => row.outcome === "skipped").length;
    const decided = completed + skipped;
    const rate = decided > 0 ? completed / decided : null;
    const suggestions: HabitSuggestion[] = [];
    if (
      decided >= CONFIG.insights.habitMinDecided &&
      rate !== null &&
      rate < CONFIG.insights.habitStruggleRate
    ) {
      suggestions.push("shrink", "reschedule");
    }

    return {
      habitId: habit.id,
      name: habit.name,
      frequency: habit.frequency,
      status: habit.status,
      preferredTime: habit.preferred_time,
      estimatedMinutes: habit.estimated_minutes,
      cognitiveLoad: habit.cognitive_load,
      streak: streakFor(db, habit.id),
      completed,
      decided,
      rate,
      suggestions,
    };
  });
}

/**
 * The hours that tend to go well, from answered and missed pulses. A missed
 * slot counts against the hour; a pivot counts as half, because it is a
 * correction rather than a drift.
 */
export function getPeakWindows(
  db: DatabaseSync,
  options: { days?: number; now?: Date } = {},
): PeakWindow[] {
  const days = options.days ?? CONFIG.insights.peakWindowDays;
  const start = startKeyFor(days, options.now ?? new Date());
  const rows = db
    .prepare(
      `SELECT CAST(substr(p.due_at, 12, 2) AS INTEGER) AS hour,
         COUNT(*) AS samples,
         SUM(CASE
           WHEN p.status = 'answered' AND p.response = 'on_track' THEN 1.0
           WHEN p.status = 'answered' AND p.response = 'pivot' THEN 0.5
           ELSE 0.0
         END) AS points
       FROM pulse p JOIN day d ON d.id = p.day_id
       WHERE d.date >= ?
       GROUP BY hour`,
    )
    .all(start) as unknown as Array<{
    hour: number;
    samples: number;
    points: number;
  }>;
  return findPeakWindows(
    rows.map((row) => ({
      hour: row.hour,
      samples: row.samples,
      points: row.points ?? 0,
    })),
  );
}

export type DailySummary = {
  date: string;
  planStatus: string;
  answered: number;
  onTrack: number;
  pivot: number;
  drifted: number;
  missed: number;
  tasksDone: number;
  tasksTotal: number;
  xp: number;
  hasActivity: boolean;
};

export function getDailySummary(db: DatabaseSync, dayId: number): DailySummary {
  const day = db
    .prepare("SELECT date, plan_status FROM day WHERE id = ?")
    .get(dayId) as unknown as { date: string; plan_status: string } | undefined;
  if (!day) {
    throw new Error("Cannot summarise a day that does not exist.");
  }

  const tasks = db
    .prepare(
      `SELECT COUNT(*) AS total,
         COALESCE(SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END), 0) AS done
       FROM task WHERE day_id = ?`,
    )
    .get(dayId) as unknown as { total: number; done: number };
  const pulses = pulseBuckets(
    db
      .prepare(
        "SELECT date, status, response FROM pulse p JOIN day d ON d.id = p.day_id WHERE p.day_id = ?",
      )
      .all(dayId) as unknown as PulseRow[],
  );
  const bucket = pulses.get(day.date) ?? {
    answered: 0,
    missed: 0,
    onTrack: 0,
    pivot: 0,
    drifted: 0,
  };
  const xp = db
    .prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM xp_event WHERE day_id = ?")
    .get(dayId) as unknown as { total: number };

  return {
    date: day.date,
    planStatus: day.plan_status,
    answered: bucket.answered,
    onTrack: bucket.onTrack,
    pivot: bucket.pivot,
    drifted: bucket.drifted,
    missed: bucket.missed,
    tasksDone: tasks.done,
    tasksTotal: tasks.total,
    xp: xp.total,
    hasActivity: bucket.answered + bucket.missed + tasks.total > 0,
  };
}

export type WeeklySummary = WeeklyTrend & {
  bestDay: { date: string; tasksDone: number } | null;
};

function bestDayBetween(
  db: DatabaseSync,
  start: string,
  end: string,
): { date: string; tasksDone: number } | null {
  const best = db
    .prepare(
      `SELECT d.date AS date,
         COALESCE(SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END), 0) AS done
       FROM day d LEFT JOIN task t ON t.day_id = d.id
       WHERE d.date >= ? AND d.date <= ?
       GROUP BY d.date
       HAVING done > 0
       ORDER BY done DESC, d.date DESC LIMIT 1`,
    )
    .get(start, end) as unknown as
    | { date: string; done: number }
    | undefined;
  return best ? { date: best.date, tasksDone: best.done } : null;
}

/** Current Monday-to-today summary, used by the plain-language weekly note. */
export function getWeeklySummary(
  db: DatabaseSync,
  options: { now?: Date } = {},
): WeeklySummary {
  const now = options.now ?? new Date();
  const [trend] = getWeeklyTrends(db, { weeks: 1, now });
  return {
    ...trend,
    bestDay: bestDayBetween(db, trend.weekStart, trend.weekEnd),
  };
}

/**
 * The last complete Monday-to-Sunday week. Kept separate from the current
 * week-to-date so an end-of-week note survives into Monday morning.
 */
export function getCompletedWeekSummary(
  db: DatabaseSync,
  options: { now?: Date } = {},
): WeeklySummary {
  const now = options.now ?? new Date();
  const [trend] = getWeeklyTrends(db, { weeks: 2, now });
  return {
    ...trend,
    bestDay: bestDayBetween(db, trend.weekStart, trend.weekEnd),
  };
}

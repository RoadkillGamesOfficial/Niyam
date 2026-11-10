import type { DatabaseSync } from "node:sqlite";
import { CONFIG } from "../config.ts";
import { dateKey, parseDateKey } from "../game/habits.ts";
import type { DayProfile } from "./days.ts";
import type { CognitiveLoad } from "./tasks.ts";

// Deterministic demo history for Phase 4. It writes into a database the caller
// chooses, refuses to touch a window that already has days, and never runs as
// part of the app. The records follow the real tables rather than a parallel
// fixture format, so the insight queries are exercised exactly as they ship.

export type SeedOptions = {
  days?: number;
  seed?: number;
  /** The window ends the day before this date, leaving today free. */
  endDate?: Date;
};

export type SeedResult = {
  startDate: string;
  endDate: string;
  days: number;
  tasks: number;
  pulses: number;
  habits: number;
};

const TASK_TITLES = [
  "Email the invoice",
  "Draft the report",
  "Fix the leaking tap",
  "Read one chapter",
  "Plan tomorrow",
  "Walk around the block",
  "Tidy the desk",
  "Call the dentist",
  "Review the pull request",
  "Prepare the slides",
  "Buy groceries",
  "Write the meeting notes",
];

const LOADS: CognitiveLoad[] = ["light", "medium", "heavy"];

function mulberry32(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function profileFor(index: number): DayProfile {
  if (index % 7 === 0 || index % 7 === 4) return "sprinting";
  if (index % 7 === 1 || index % 7 === 5) return "low_energy";
  return "maintenance";
}

function taskCount(profile: DayProfile): number {
  return profile === "sprinting" ? 5 : profile === "low_energy" ? 2 : 4;
}

function doneChance(profile: DayProfile): number {
  return profile === "sprinting" ? 0.76 : profile === "low_energy" ? 0.42 : 0.58;
}

function successChance(hour: number, weekday: number, profile: DayProfile): number {
  let chance = hour < 12 ? 0.82 : hour < 15 ? 0.56 : 0.32;
  if (weekday === 1) chance -= 0.12; // Mondays tend to drift a little more.
  if (profile === "low_energy") chance -= 0.05;
  return Math.max(0.08, chance);
}

function at(date: string, hour: number, minute: number): string {
  return `${date} ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
}

function plusMinutes(timestamp: string, minutes: number): string {
  const day = timestamp.slice(0, 10);
  const [hours, mins] = timestamp.slice(11, 16).split(":").map(Number);
  return `${day} ${String(Math.floor((hours * 60 + mins + minutes) / 60)).padStart(2, "0")}:${String(
    (hours * 60 + mins + minutes) % 60,
  ).padStart(2, "0")}:00`;
}

/**
 * Seeds a closed, realistic history ending yesterday. Pulses cluster into
 * morning peaks and afternoon drift, profiles trade completion rates, and two
 * habits are deliberately strong or struggling so the insight surfaces have
 * something honest to show.
 */
export function seedHistory(db: DatabaseSync, options: SeedOptions = {}): SeedResult {
  const days = options.days ?? 84;
  if (!Number.isInteger(days) || days < 7 || days > 730) {
    throw new Error("Seed history must be between 7 and 730 days.");
  }
  const random = mulberry32(options.seed ?? 20261110);
  const endDate = new Date(
    (options.endDate ?? new Date()).getFullYear(),
    (options.endDate ?? new Date()).getMonth(),
    (options.endDate ?? new Date()).getDate() - 1,
  );
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - (days - 1));
  const startKey = dateKey(startDate);
  const endKey = dateKey(endDate);

  const existing = db
    .prepare("SELECT COUNT(*) AS count FROM day WHERE date >= ? AND date <= ?")
    .get(startKey, endKey) as unknown as { count: number };
  if (existing.count > 0) {
    throw new Error(
      `Seed history already exists between ${startKey} and ${endKey}; use a fresh database.`,
    );
  }

  const firstStamp = `${startKey} 08:00:00`;
  const habitRows = [
    {
      name: "Make the bed",
      frequency: "daily",
      weekdays: null as string | null,
      rate: 0.9,
      minutes: 5,
      load: "light" as CognitiveLoad,
    },
    {
      name: "Walk for ten minutes",
      frequency: "daily",
      weekdays: null as string | null,
      rate: 0.34,
      minutes: 10,
      load: "light" as CognitiveLoad,
    },
    {
      name: "Plan tomorrow",
      frequency: "weekdays",
      weekdays: "1,2,3,4,5",
      rate: 0.7,
      minutes: 10,
      load: "light" as CognitiveLoad,
    },
  ];
  const habitIds = habitRows.map((habit) => {
    const result = db
      .prepare(
        `INSERT INTO habit (name, frequency, weekdays, estimated_minutes, cognitive_load,
           essential, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 0, 'active', ?, ?)`,
      )
      .run(
        habit.name,
        habit.frequency,
        habit.weekdays,
        habit.minutes,
        habit.load,
        firstStamp,
        firstStamp,
      );
    return Number(result.lastInsertRowid);
  });

  let taskTotal = 0;
  let pulseTotal = 0;

  for (let offset = 0; offset < days; offset += 1) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + offset);
    const key = dateKey(date);
    const profile = profileFor(offset);
    const weekday = date.getDay();
    const count = taskCount(profile);
    const confirmed = at(key, 8, 30);

    const dayResult = db
      .prepare(
        `INSERT INTO day (date, profile, plan_status, started_at, confirmed_at, closed_at)
         VALUES (?, ?, 'closed', ?, ?, ?)`,
      )
      .run(key, profile, at(key, 8, 0), confirmed, at(key, 18, 0));
    const dayId = Number(dayResult.lastInsertRowid);

    let tasksDone = 0;
    let xp = 0;
    for (let index = 0; index < count; index += 1) {
      const load = LOADS[(offset + index) % LOADS.length];
      const done = random() < doneChance(profile);
      const created = at(key, 8, 45 + index * 2);
      const taskResult = db
        .prepare(
          `INSERT INTO task (day_id, title, estimated_minutes, cognitive_load, status,
             created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          dayId,
          TASK_TITLES[(offset * 3 + index) % TASK_TITLES.length],
          load === "light" ? 15 : load === "medium" ? 30 : 45,
          load,
          done ? "done" : "open",
          created,
          created,
        );
      const taskId = Number(taskResult.lastInsertRowid);
      taskTotal += 1;
      db.prepare(
        "INSERT INTO plan_item (day_id, task_id, position, planned_start) VALUES (?, ?, ?, ?)",
      ).run(
        dayId,
        taskId,
        index + 1,
        load === "heavy" && index < 3 ? at(key, 9 + index, 0).slice(11, 16) : null,
      );
      if (done) {
        tasksDone += 1;
        const amount =
          load === "light"
            ? CONFIG.game.xp.taskByLoad.light
            : load === "medium"
              ? CONFIG.game.xp.taskByLoad.medium
              : CONFIG.game.xp.taskByLoad.heavy;
        xp += amount;
        db.prepare(
          `INSERT INTO xp_event (day_id, amount, reason, multiplier, task_id)
           VALUES (?, ?, 'task_done', 1, ?)`,
        ).run(dayId, amount, taskId);
      }
    }

    let answered = 0;
    let missed = 0;
    let run = 0;
    let longest = 0;
    for (let slot = 0; slot < 11; slot += 1) {
      const minutes = 9 * 60 + slot * 45;
      const hour = Math.floor(minutes / 60);
      const minute = minutes % 60;
      const due = at(key, hour, minute);
      const chance = successChance(hour, weekday, profile);
      pulseTotal += 1;

      if (random() < 0.07) {
        db.prepare(
          `INSERT INTO pulse (day_id, due_at, status)
           VALUES (?, ?, 'missed')`,
        ).run(dayId, due);
        missed += 1;
        run = 0;
        continue;
      }

      const roll = random();
      const response =
        roll < chance ? "on_track" : roll < chance + 0.18 ? "pivot" : "drifted";
      db.prepare(
        `INSERT INTO pulse (day_id, due_at, status, response, answered_at)
         VALUES (?, ?, 'answered', ?, ?)`,
      ).run(dayId, due, response, plusMinutes(due, 2));
      answered += 1;
      if (response === "on_track") {
        run += 1;
        longest = Math.max(longest, run);
      } else {
        run = 0;
      }
      const amount =
        response === "on_track"
          ? CONFIG.game.xp.onTrack
          : response === "pivot"
            ? CONFIG.game.xp.pivot
            : CONFIG.game.xp.drifted;
      xp += amount;
      db.prepare(
        `INSERT INTO xp_event (day_id, amount, reason, multiplier)
         VALUES (?, ?, ?, 1)`,
      ).run(
        dayId,
        amount,
        response === "on_track"
          ? "pulse_on_track"
          : response === "pivot"
            ? "pulse_pivot"
            : "pulse_drifted",
      );
    }

    habitRows.forEach((habit, habitIndex) => {
      if (habit.frequency === "weekdays" && (weekday === 0 || weekday === 6)) {
        return;
      }
      const outcome = random() < habit.rate ? "completed" : "skipped";
      db.prepare(
        `INSERT INTO habit_occurrence (habit_id, day_id, due_date, outcome)
         VALUES (?, ?, ?, ?)`,
      ).run(habitIds[habitIndex], dayId, key, outcome);
    });

    xp += CONFIG.game.xp.dayClosed;
    db.prepare(
      "INSERT INTO xp_event (day_id, amount, reason, multiplier) VALUES (?, ?, 'day_closed', 1)",
    ).run(dayId, CONFIG.game.xp.dayClosed);
    db.prepare("UPDATE day SET summary = ? WHERE id = ?").run(
      JSON.stringify({
        xp,
        answered,
        missed,
        longestCombo: longest,
        tasksDone,
        tasksTotal: count,
        carryOver: count - tasksDone,
      }),
      dayId,
    );
  }

  return {
    startDate: startKey,
    endDate: endKey,
    days,
    tasks: taskTotal,
    pulses: pulseTotal,
    habits: habitIds.length,
  };
}

import { CONFIG } from "../config.ts";

// Pure game rules: no database, no clock, no React. Everything here is derived
// from the XP ledger by the caller, which keeps the rules testable and lets them
// be retuned without touching stored data (GAME-1, GAME-2, GAME-4).

export type PulseResponse = "on_track" | "pivot" | "drifted";

/** The multiplier after one check-in response. It never drops below the start. */
export function nextMultiplier(current: number, response: PulseResponse): number {
  const { start, step, cap } = CONFIG.game.combo;
  if (response === "drifted") {
    return start;
  }
  if (response === "pivot") {
    return current;
  }
  // Round to the step so floating point does not accumulate 1.5000000000002.
  return Math.min(cap, Math.round((current + step) * 100) / 100);
}

/** XP for answering a pulse. On Track scales with the multiplier. */
export function pulseXp(response: PulseResponse, multiplier: number): number {
  const xp = CONFIG.game.xp;
  if (response === "on_track") {
    return Math.round(xp.onTrack * multiplier);
  }
  return response === "pivot" ? xp.pivot : xp.drifted;
}

export function taskXp(load: "light" | "medium" | "heavy"): number {
  return CONFIG.game.xp.taskByLoad[load];
}

export type Level = { level: number; name: string; minXp: number };

/** Highest level whose threshold the total has reached. XP never decreases. */
export function levelForXp(totalXp: number): Level {
  const levels = CONFIG.game.levels;
  let found: Level = { level: 1, name: levels[0].name, minXp: levels[0].minXp };
  for (let i = 0; i < levels.length; i += 1) {
    if (totalXp >= levels[i].minXp) {
      found = { level: i + 1, name: levels[i].name, minXp: levels[i].minXp };
    }
  }
  return found;
}

/** Progress toward the next level, as 0..1. The top level stays full. */
export function levelProgress(totalXp: number): number {
  const levels = CONFIG.game.levels;
  const current = levelForXp(totalXp);
  const next = levels[current.level]; // level is 1-based, array is 0-based
  if (!next) {
    return 1;
  }
  const span = next.minXp - current.minXp;
  return span <= 0 ? 1 : (totalXp - current.minXp) / span;
}

export type DayScore = {
  answered: number;
  missed: number;
  tasksDone: number;
  tasksPlanned: number;
};

/**
 * System Integrity: recent consistency, decaying slowly through idle days and
 * recovering with engagement, floored so it can never read as "dead" (PDD §8.4).
 * Days with nothing planned and no pulses count as idle, not as failures.
 */
export function integrityFromDays(days: DayScore[]): number {
  const { floor, idleDecayPerDay } = CONFIG.integrity;
  const scores: number[] = [];

  for (const day of days) {
    const answeredOrMissed = day.answered + day.missed;
    const isIdle = answeredOrMissed === 0 && day.tasksPlanned === 0;
    if (isIdle) {
      continue; // idle days are neither credit nor failure
    }
    const pulsePart = answeredOrMissed > 0 ? day.answered / answeredOrMissed : null;
    const taskPart =
      day.tasksPlanned > 0 ? Math.min(1, day.tasksDone / day.tasksPlanned) : null;
    const parts = [pulsePart, taskPart].filter((part): part is number => part !== null);
    if (parts.length > 0) {
      scores.push(parts.reduce((sum, part) => sum + part, 0) / parts.length);
    }
  }

  // Only a stretch of idle days at the *end* decays the meter: coming back and
  // engaging must recover it immediately, which is the point of the mechanic.
  let idleRun = 0;
  for (let i = days.length - 1; i >= 0; i -= 1) {
    const day = days[i];
    if (day.answered + day.missed === 0 && day.tasksPlanned === 0) {
      idleRun += 1;
    } else {
      break;
    }
  }

  const base =
    scores.length > 0 ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0.5;
  const decayed = base * (1 - idleDecayPerDay * idleRun);
  return Math.min(1, Math.max(floor, decayed));
}

/** Bucket for the contribution-style heat map. 0 is a blank day. */
export function heatLevel(activity: number): 0 | 1 | 2 | 3 | 4 {
  if (activity <= 0) return 0;
  if (activity < 3) return 1;
  if (activity < 6) return 2;
  if (activity < 10) return 3;
  return 4;
}

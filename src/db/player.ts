import type { DatabaseSync } from "node:sqlite";
import { CONFIG } from "../config.ts";
import { dateKey } from "../game/habits.ts";
import {
  heatLevel,
  integrityFromDays,
  levelForXp,
  levelProgress,
  nextMultiplier,
  type DayScore,
  type Level,
} from "../game/rules.ts";
import { comboResponses } from "./pulses.ts";

// Player state is derived from the XP ledger and the pulse history, never stored
// (PDD §10). That is what makes retuning the rules safe (GAME-1, GAME-2).

export type PlayerState = {
  totalXp: number;
  level: Level;
  progress: number;
  multiplier: number;
  integrity: number;
};

export function getPlayerState(db: DatabaseSync): PlayerState {
  const total = db
    .prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM xp_event")
    .get() as unknown as { total: number };

  // Replay the answers: the combo is a fold over history, not a stored number.
  const multiplier = comboResponses(db).reduce<number>(
    (current, response) => nextMultiplier(current, response),
    CONFIG.game.combo.start,
  );

  return {
    totalXp: total.total,
    level: levelForXp(total.total),
    progress: levelProgress(total.total),
    multiplier: Math.round(multiplier * 100) / 100,
    integrity: getIntegrity(db),
  };
}

type DayStats = DayScore & { date: string };

function recentDayStats(db: DatabaseSync, days: number): DayStats[] {
  const start = new Date();
  start.setDate(start.getDate() - (days - 1));
  const rows = db
    .prepare(
      `SELECT d.date,
         (SELECT COUNT(*) FROM pulse p WHERE p.day_id = d.id AND p.status = 'answered') AS answered,
         (SELECT COUNT(*) FROM pulse p WHERE p.day_id = d.id AND p.status = 'missed') AS missed,
         (SELECT COUNT(*) FROM task t WHERE t.day_id = d.id AND t.status = 'done') AS tasksDone,
         (SELECT COUNT(*) FROM task t WHERE t.day_id = d.id) AS tasksPlanned
       FROM day d WHERE d.date >= ?`,
    )
    .all(dateKey(start)) as unknown as Array<{
    date: string;
    answered: number;
    missed: number;
    tasksDone: number;
    tasksPlanned: number;
  }>;

  const byDate = new Map(rows.map((row) => [row.date, row]));
  const stats: DayStats[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - offset);
    const key = dateKey(date);
    const row = byDate.get(key);
    stats.push(
      row ?? { date: key, answered: 0, missed: 0, tasksDone: 0, tasksPlanned: 0 },
    );
  }
  return stats;
}

export function getIntegrity(db: DatabaseSync): number {
  const days = recentDayStats(db, CONFIG.integrity.windowDays);
  return integrityFromDays(days);
}

export type HeatDay = { date: string; level: 0 | 1 | 2 | 3 | 4; activity: number };

/** Contribution-style grid for the last `days` calendar days, oldest first. */
export function getHeatMap(db: DatabaseSync, days = 84): HeatDay[] {
  return recentDayStats(db, days).map((day) => {
    const activity = day.answered + day.tasksDone;
    return { date: day.date, level: heatLevel(activity), activity };
  });
}

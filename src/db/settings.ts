import type { DatabaseSync } from "node:sqlite";
import { CONFIG } from "../config.ts";

// One settings row. The daily controls live here; gamification numbers stay in
// src/config.ts so they are reviewed like code (GAME-4).

export type InterruptionLevel = "gentle" | "standard" | "firm";

export type Settings = {
  checkin_interval_minutes: number;
  interruption_level: InterruptionLevel;
  quiet_start: string | null;
  quiet_end: string | null;
  ai_enabled: number;
  ai_model: string;
};

const COLUMNS =
  "checkin_interval_minutes, interruption_level, quiet_start, quiet_end, ai_enabled, ai_model";
const TIME_SHAPE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function getSettings(db: DatabaseSync): Settings {
  const row = db.prepare(`SELECT ${COLUMNS} FROM settings WHERE id = 1`).get() as
    | unknown as Settings
    | undefined;
  if (row) {
    return row;
  }
  const fallback: Settings = {
    checkin_interval_minutes: CONFIG.pulses.intervalMinutes,
    interruption_level: "standard",
    quiet_start: null,
    quiet_end: null,
    ai_enabled: 1,
    ai_model: CONFIG.ai.defaultModel,
  };
  return fallback;
}

export type SettingsInput = {
  intervalMinutes: number;
  interruptionLevel: InterruptionLevel;
  quietStart: string | null;
  quietEnd: string | null;
};

/** Validates before writing: settings arrive from a form, so nothing is trusted. */
export function updateSettings(db: DatabaseSync, input: SettingsInput): Settings {
  const interval = Math.round(input.intervalMinutes);
  if (!Number.isFinite(interval) || interval < 5 || interval > 240) {
    throw new Error("Check-in interval must be between 5 and 240 minutes.");
  }
  if (!["gentle", "standard", "firm"].includes(input.interruptionLevel)) {
    throw new Error("Unknown interruption level.");
  }
  for (const value of [input.quietStart, input.quietEnd]) {
    if (value && !TIME_SHAPE.test(value)) {
      throw new Error("Quiet hours must look like 22:00.");
    }
  }

  db.prepare(
    `UPDATE settings SET checkin_interval_minutes = ?, interruption_level = ?,
       quiet_start = ?, quiet_end = ? WHERE id = 1`,
  ).run(interval, input.interruptionLevel, input.quietStart, input.quietEnd);
  return getSettings(db);
}

/**
 * The AI switch and model name (PDD §8.6). The address stays in src/config.ts,
 * so this can never point the app at another machine.
 */
export function updateAiSettings(
  db: DatabaseSync,
  input: { enabled: boolean; model: string },
): Settings {
  const model = input.model.trim();
  if (!model || model.length > 80 || !/^[A-Za-z0-9._:\/-]+$/.test(model)) {
    throw new Error("A model name looks like qwen2.5:1.5b-instruct.");
  }
  db.prepare("UPDATE settings SET ai_enabled = ?, ai_model = ? WHERE id = 1").run(
    input.enabled ? 1 : 0,
    model,
  );
  return getSettings(db);
}

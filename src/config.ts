// Tunable values live here rather than being scattered through the logic.
// See docs/knowledge.md ("Game rules and tunable values live in configuration").
// Keep this module dependency-free: the data layer imports it with plain Node,
// which does not understand the "@/..." alias.

export const CONFIG = {
  database: {
    // Relative to the project root, which is where dev, start and tests run from.
    directory: "data",
    filename: "discipline.db", // never contains the product name; see docs/decisions.md
  },
  tasks: {
    // Long titles are hard to scan, so the input and the data layer share a cap.
    maxTitleLength: 200,
  },
  game: {
    // Starting values from PDD §8.4. Retuning these is intended: totals are
    // derived from the XP ledger, never stored.
    xp: {
      onTrack: 10,
      pivot: 5,
      drifted: 3,
      microAction: 5,
      dayClosed: 20,
      taskByLoad: { light: 15, medium: 30, heavy: 50 },
    },
    combo: {
      start: 1,
      step: 0.25,
      cap: 3,
    },
    // Greek/Roman progression from PDD §8.4. A level is the highest threshold
    // the total XP has reached.
    levels: [
      { name: "Mortal", minXp: 0 },
      { name: "Initiate", minXp: 120 },
      { name: "Hoplite", minXp: 320 },
      { name: "Legionary", minXp: 700 },
      { name: "Centurion", minXp: 1400 },
      { name: "Champion", minXp: 2500 },
      { name: "Hero", minXp: 4200 },
      { name: "Demigod", minXp: 6500 },
      { name: "Titan", minXp: 9500 },
      { name: "Olympian", minXp: 13000 },
    ],
  },
  pulses: {
    intervalMinutes: 30, // PDD §8.2 default
    // A slot older than this counts as missed rather than waiting for an answer.
    graceMinutes: 10,
    // Safety valve for reconciliation after a long sleep: never backfill more
    // than a day of slots in one pass.
    maxCatchUp: 48,
  },
  integrity: {
    windowDays: 14,
    floor: 0.2, // never reaches an unrecoverable "dead" state
    idleDecayPerDay: 0.04,
  },
  habits: {
    // One missed day per week does not break a streak (PDD §8.7 assumption).
    gracePerWeek: 1,
  },
} as const;

export type GameConfig = typeof CONFIG.game;

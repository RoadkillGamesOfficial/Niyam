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
  insights: {
    // Phase 4. All windows are local calendar days and all rates are 0..1.
    heatmapDays: 84, // twelve weeks of drift cells
    historyDays: 112, // completion by profile
    trendWeeks: 8,
    habitWindowDays: 56,
    peakWindowDays: 56,
    peakMinSamples: 3, // one lucky hour is not a peak
    peakMinRate: 0.6,
    peakMaxWindows: 3,
    habitMinDecided: 4, // do not advise from one or two decisions
    habitStruggleRate: 0.5,
    scheduleBreakMinutes: 5,
  },
  ai: {
    // Phase 3. Ollama is reached on loopback only: the URL is checked before any
    // request, and a non-local host throws (ARCH-1). The default model is small
    // enough for a modest laptop; the benchmark script compares the candidates.
    baseUrl: "http://127.0.0.1:11434",
    defaultModel: "qwen2.5:1.5b-instruct",
    candidates: ["qwen2.5:1.5b-instruct", "llama3.2:1b", "gemma2:2b"],
    // A slow laptop is allowed to think; the UI waits rather than losing the
    // answer. Anything longer is treated as unavailable and falls back.
    timeoutMs: 60_000,
    healthTimeoutMs: 2_500,
    maxPlanItems: 12,
    maxInputChars: 4_000,
    maxDumpChars: 4_000,
    temperature: 0.2,
    maxTokens: 600,
  },
} as const;

export type GameConfig = typeof CONFIG.game;

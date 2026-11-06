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
} as const;

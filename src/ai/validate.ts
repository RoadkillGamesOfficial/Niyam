import { CONFIG } from "../config.ts";

// Validation for everything a local model sends back (ARCH-3). Model output is
// untrusted: it never reaches the UI or the database until it matches one of
// these shapes, and a rejection makes the caller use its fallback.

export class AiFormatError extends Error {}

export type CognitiveLoad = "light" | "medium" | "heavy";

export type PlannerItem = {
  title: string;
  minutes: number;
  load: CognitiveLoad;
};

export const REFRAME_CATEGORIES = [
  "clarity",
  "overwhelm",
  "fatigue",
  "avoidance",
  "distraction",
  "low_mood",
  "distress",
] as const;

export type ReframeCategory = (typeof REFRAME_CATEGORIES)[number];

export type ReframeReading = {
  category: ReframeCategory;
  diagnosis: string;
  microAction: string;
};

// The model is asked for slugs, but the PDD names categories in prose and a
// small model will sometimes copy those. Both are accepted.
const CATEGORY_ALIASES: Record<string, ReframeCategory> = {
  clarity_deficit: "clarity",
  overwhelm_or_scope_creep: "overwhelm",
  scope_creep: "overwhelm",
  too_much: "overwhelm",
  tired: "fatigue",
  low_energy: "fatigue",
  distraction_pull: "distraction",
  low_mood: "low_mood",
  low_energy_mood: "low_mood",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Trimmed and collapsed to one line, or null when it is empty or too long. */
function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const cleaned = value.trim().replace(/\s+/g, " ");
  if (!cleaned || cleaned.length > max) {
    return null;
  }
  return cleaned;
}

function parseLoad(value: unknown): CognitiveLoad {
  const candidate = typeof value === "string" ? value.trim().toLowerCase() : "";
  return candidate === "light" || candidate === "heavy" ? candidate : "medium";
}

function parseMinutes(value: unknown): number {
  const number = typeof value === "number" ? value : Number(value);
  const rounded = Number.isFinite(number) ? Math.round(number) : 15;
  return Math.min(180, Math.max(5, rounded));
}

/** Accepts {"tasks": [...]} or a bare array; skips unusable rows. */
export function parsePlannerOutput(raw: unknown): PlannerItem[] {
  const list = Array.isArray(raw)
    ? raw
    : isRecord(raw) && Array.isArray(raw.tasks)
      ? raw.tasks
      : null;
  if (!list) {
    throw new AiFormatError("The planner reply was not a task list.");
  }

  const items: PlannerItem[] = [];
  for (const entry of list) {
    if (!isRecord(entry)) {
      continue;
    }
    const title = text(entry.title, CONFIG.tasks.maxTitleLength);
    if (!title) {
      continue;
    }
    items.push({ title, minutes: parseMinutes(entry.minutes), load: parseLoad(entry.load) });
    if (items.length >= CONFIG.ai.maxPlanItems) {
      break;
    }
  }

  if (items.length === 0) {
    throw new AiFormatError("The planner reply had no usable tasks.");
  }
  return items;
}

export function normalizeCategory(value: unknown): ReframeCategory | null {
  if (typeof value !== "string") {
    return null;
  }
  const key = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  const direct = REFRAME_CATEGORIES.find((category) => category === key);
  if (direct) {
    return direct;
  }
  return CATEGORY_ALIASES[key] ?? null;
}

export function parseReframeOutput(raw: unknown): ReframeReading {
  if (!isRecord(raw)) {
    throw new AiFormatError("The reframe reply was not an object.");
  }
  const category = normalizeCategory(raw.category);
  if (!category) {
    throw new AiFormatError("The reframe reply used an unknown category.");
  }
  const diagnosis = text(raw.diagnosis, 400);
  const microAction = text(raw.micro_action ?? raw.microAction ?? raw.action, 300);
  if (!diagnosis || !microAction) {
    throw new AiFormatError("The reframe reply was missing its reading or its step.");
  }
  return { category, diagnosis, microAction };
}

export type ShrinkReading = { title: string; minutes: number };

/**
 * A re-plan reply is a permutation of the remaining items. Anything else is
 * rejected: a partial order would silently drop work from the plan.
 */
export function parseReplanOutput(raw: unknown, count: number): number[] {
  const list = isRecord(raw) && Array.isArray(raw.order) ? raw.order : null;
  if (!list || count === 0) {
    throw new AiFormatError("The replan reply was not an order.");
  }
  const order: number[] = [];
  for (const entry of list) {
    const index = typeof entry === "number" ? entry : Number(entry);
    if (!Number.isInteger(index) || index < 0 || index >= count || order.includes(index)) {
      throw new AiFormatError("The replan reply was not a clean order.");
    }
    order.push(index);
  }
  if (order.length !== count) {
    throw new AiFormatError("The replan reply left tasks out.");
  }
  return order;
}

export function parseShrinkOutput(raw: unknown): ShrinkReading {
  if (!isRecord(raw)) {
    throw new AiFormatError("The shrink reply was not an object.");
  }
  const title = text(raw.title, CONFIG.tasks.maxTitleLength);
  if (!title) {
    throw new AiFormatError("The shrink reply had no usable title.");
  }
  const number = typeof raw.minutes === "number" ? raw.minutes : Number(raw.minutes);
  const minutes = Number.isFinite(number) ? Math.min(15, Math.max(1, Math.round(number))) : 5;
  return { title, minutes };
}

/**
 * Pulls the first JSON object out of a reply. Small models wrap JSON in prose or
 * fences even when asked not to; that is recoverable, malformed JSON is not.
 */
export function extractJson(reply: string): unknown {
  if (typeof reply !== "string" || !reply.trim()) {
    throw new AiFormatError("The model returned nothing.");
  }
  const cleaned = reply.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) {
    throw new AiFormatError("The model did not return JSON.");
  }
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as unknown;
  } catch {
    throw new AiFormatError("The model returned malformed JSON.");
  }
}

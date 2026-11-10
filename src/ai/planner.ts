import { CONFIG } from "../config.ts";
import { ollamaChat, type ChatFn } from "./ollama.ts";
import { fillPrompt, loadPrompt } from "./prompts.ts";
import { parsePlannerOutput, type PlannerItem } from "./validate.ts";

// The planner asks the model to structure a messy list, then validates the reply.
// When the model is missing, slow or malformed, the same input is split locally
// with simple rules so planning never blocks (PLAN-5, ARCH-2).

export type PlanGeneration = { items: PlannerItem[]; fallback: boolean };

const PROFILE_GUIDANCE: Record<string, string> = {
  sprinting:
    "Sprinting: keep more of the tasks, put heavier work earlier, and allow longer blocks.",
  maintenance: "Maintenance: balanced load and normal breaks.",
  low_energy: "Low-energy rescue: keep fewer tasks, put the easiest first, and keep every block short.",
};

const MAX_TITLE = CONFIG.tasks.maxTitleLength;

/** Rough but honest: word count stands in for effort when no model answers. */
export function estimateFor(title: string): PlannerItem {
  const words = title.split(/\s+/).filter(Boolean).length;
  if (words <= 3) {
    return { title, minutes: 5, load: "light" };
  }
  if (words <= 8) {
    return { title, minutes: 15, load: "light" };
  }
  if (words <= 16) {
    return { title, minutes: 30, load: "medium" };
  }
  return { title, minutes: 45, load: "heavy" };
}

/**
 * Deterministic split for fallback mode: one line per task, bullets and numbers
 * stripped, long paragraphs cut into sentences. It is deliberately plain — the
 * user reviews everything anyway.
 */
export function fallbackPlan(text: string): PlannerItem[] {
  const chunks: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const cleaned = line.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "").trim();
    if (!cleaned) {
      continue;
    }
    if (cleaned.length > 100) {
      for (const sentence of cleaned.split(/(?<=[.!?])\s+/)) {
        if (sentence.trim()) {
          chunks.push(sentence.trim());
        }
      }
    } else {
      chunks.push(cleaned);
    }
  }

  const titles = chunks.length > 0 ? chunks : [text.trim()];
  const seen = new Set<string>();
  const items: PlannerItem[] = [];
  for (const title of titles) {
    const clipped = title.slice(0, MAX_TITLE).trim();
    if (!clipped || seen.has(clipped)) {
      continue;
    }
    seen.add(clipped);
    items.push(estimateFor(clipped));
    if (items.length >= CONFIG.ai.maxPlanItems) {
      break;
    }
  }
  return items;
}

export async function generatePlan(
  input: { text: string; profile: string },
  deps: { chat?: ChatFn; model: string },
): Promise<PlanGeneration> {
  const chat = deps.chat ?? ollamaChat;
  const system = fillPrompt(loadPrompt("planner"), {
    maxItems: String(CONFIG.ai.maxPlanItems),
    profile: input.profile,
    profileGuidance: PROFILE_GUIDANCE[input.profile] ?? PROFILE_GUIDANCE.maintenance,
  });

  try {
    const raw = await chat({ model: deps.model, system, user: input.text });
    return { items: parsePlannerOutput(raw), fallback: false };
  } catch {
    return { items: fallbackPlan(input.text), fallback: true };
  }
}

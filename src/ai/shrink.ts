import { COPY } from "../copy.ts";
import { ollamaChat, type ChatFn } from "./ollama.ts";
import { fillPrompt, loadPrompt } from "./prompts.ts";
import { parseShrinkOutput } from "./validate.ts";

// Task shrinkage through the model, replacing the Phase 2 presets while keeping
// them as the fallback (P3 scope; ARCH-2).

export type ShrinkSuggestion = { title: string; minutes: number; fallback: boolean };

/** Deterministic choice so the same task always gets the same preset step. */
export function fallbackShrink(taskTitle: string): ShrinkSuggestion {
  const actions = COPY.checkin.microActions;
  const index = taskTitle.trim().length % actions.length;
  return { title: actions[index], minutes: 5, fallback: true };
}

export async function generateShrink(
  input: { taskTitle: string; load: "light" | "medium" | "heavy" },
  deps: { chat?: ChatFn; model: string },
): Promise<ShrinkSuggestion> {
  const chat = deps.chat ?? ollamaChat;
  const system = fillPrompt(loadPrompt("shrink"), {
    taskTitle: input.taskTitle,
    load: input.load,
  });
  try {
    const raw = await chat({ model: deps.model, system, user: input.taskTitle });
    return { ...parseShrinkOutput(raw), fallback: false };
  } catch {
    return fallbackShrink(input.taskTitle);
  }
}

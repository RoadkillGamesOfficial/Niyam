import { ollamaChat, type ChatFn } from "./ollama.ts";
import { fillPrompt, loadPrompt } from "./prompts.ts";
import { parseReplanOutput } from "./validate.ts";

// PLAN-4: re-plan the rest of the day from the current time and state. The model
// only chooses an order for work that already exists; it never renames, deletes
// or invents tasks, and a refusal or a malformed reply keeps the current order.

export type ReplanItem = { title: string; minutes: number; load: string };

export type ReplanGeneration = { order: number[]; fallback: boolean };

export function fallbackOrder(count: number): number[] {
  return Array.from({ length: count }, (_, index) => index);
}

export async function generateReplan(
  input: {
    items: ReplanItem[];
    profile: string;
    time: string;
    note?: string;
  },
  deps: { chat?: ChatFn; model: string },
): Promise<ReplanGeneration> {
  if (input.items.length <= 1) {
    return { order: fallbackOrder(input.items.length), fallback: false };
  }

  const chat = deps.chat ?? ollamaChat;
  const items = input.items
    .map((item, index) => `${index}. ${item.title} (${item.minutes} min, ${item.load})`)
    .join("\n");
  const system = fillPrompt(loadPrompt("replan"), {
    profile: input.profile,
    time: input.time,
    note: input.note ? `Note from the user: ${input.note}` : "",
    items,
    count: String(input.items.length),
    last: String(input.items.length - 1),
  });

  try {
    const raw = await chat({
      model: deps.model,
      system,
      user: "Re-order these tasks for the rest of today.",
    });
    return { order: parseReplanOutput(raw, input.items.length), fallback: false };
  } catch {
    return { order: fallbackOrder(input.items.length), fallback: true };
  }
}

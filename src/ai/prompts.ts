import { readFileSync } from "node:fs";
import { join } from "node:path";

// Prompts live in prompts/*.md, not in code, so the voice writer can revise them
// without touching logic (docs/roles/voice-writer.md). They are read once per
// process; the file is local, so there is no cost after the first call.
export type PromptName = "planner" | "reframe" | "shrink" | "replan";

const cache = new Map<PromptName, string>();

export function loadPrompt(name: PromptName): string {
  const cached = cache.get(name);
  if (cached) {
    return cached;
  }
  const prompt = readFileSync(join(process.cwd(), "prompts", `${name}.md`), "utf8");
  cache.set(name, prompt);
  return prompt;
}

/** Replaces {{placeholders}}. Unknown placeholders are left visible, not blank. */
export function fillPrompt(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => values[key] ?? match);
}

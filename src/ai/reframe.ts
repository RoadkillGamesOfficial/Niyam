import { COPY } from "../copy.ts";
import { ollamaChat, type ChatFn } from "./ollama.ts";
import { fillPrompt, loadPrompt } from "./prompts.ts";
import { detectDistress } from "./safety.ts";
import { parseReframeOutput, type ReframeCategory } from "./validate.ts";

// The Reframe reading: a blockage category, a short diagnosis and one step that
// starts in under five minutes (REF-2, REF-3). Safety is checked before the
// model so the response is the same whether or not Ollama is running (R7).

export type ReframeGeneration = {
  category: ReframeCategory;
  diagnosis: string;
  microAction: string;
  safety: boolean;
  fallback: boolean;
};

export function safetyResponse(): ReframeGeneration {
  return {
    category: "distress",
    diagnosis: COPY.reframe.safetyDiagnosis,
    microAction: COPY.reframe.safetyAction,
    safety: true,
    fallback: false,
  };
}

export function fallbackReframe(): ReframeGeneration {
  return {
    category: "overwhelm",
    diagnosis: COPY.reframe.fallbackDiagnosis,
    microAction: COPY.reframe.fallbackAction,
    safety: false,
    fallback: true,
  };
}

export async function generateReframe(
  input: { text: string; context: string },
  deps: { chat?: ChatFn; model: string },
): Promise<ReframeGeneration> {
  if (detectDistress(input.text)) {
    return safetyResponse();
  }

  const chat = deps.chat ?? ollamaChat;
  const system = fillPrompt(loadPrompt("reframe"), { context: input.context });
  try {
    const raw = await chat({ model: deps.model, system, user: input.text });
    const reading = parseReframeOutput(raw);
    if (reading.category === "distress") {
      return safetyResponse();
    }
    return {
      category: reading.category,
      diagnosis: reading.diagnosis,
      microAction: reading.microAction,
      safety: false,
      fallback: false,
    };
  } catch {
    return fallbackReframe();
  }
}

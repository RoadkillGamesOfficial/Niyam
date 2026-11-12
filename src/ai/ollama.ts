import { CONFIG } from "../config.ts";
import { AiFormatError, extractJson } from "./validate.ts";

// The Ollama client. It uses the built-in fetch, so there is no dependency.
// Only loopback addresses are allowed: the app must never talk to a model on
// another machine, which would be an outbound network call (ARCH-1).

export class AiUnavailableError extends Error {}
export class AiConfigError extends Error {}

export type ChatRequest = {
  model: string;
  system: string;
  user: string;
  baseUrl?: string;
  timeoutMs?: number;
  temperature?: number;
};

export type ChatFn = (request: ChatRequest) => Promise<unknown>;

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

/** Throws unless the address points back at this laptop. */
export function assertLoopback(baseUrl: string): URL {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new AiConfigError("The local AI address is not a URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new AiConfigError("The local AI address must be http or https.");
  }
  if (!LOOPBACK_HOSTS.has(url.hostname)) {
    throw new AiConfigError("Local AI must run on this machine.");
  }
  return url;
}

async function postChat(request: ChatRequest): Promise<string> {
  const base = assertLoopback(request.baseUrl ?? CONFIG.ai.baseUrl);
  const endpoint = new URL("/api/chat", base);

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: request.model,
        messages: [
          { role: "system", content: request.system },
          { role: "user", content: request.user },
        ],
        stream: false,
        format: "json",
        options: {
          temperature: request.temperature ?? CONFIG.ai.temperature,
          num_predict: CONFIG.ai.maxTokens,
        },
      }),
      signal: AbortSignal.timeout(request.timeoutMs ?? CONFIG.ai.timeoutMs),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new AiUnavailableError(`The local model did not answer (${reason}).`);
  }

  if (!response.ok) {
    throw new AiUnavailableError(`The local model returned ${response.status}.`);
  }

  const payload = (await response.json()) as { message?: { content?: unknown } };
  const content = payload.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new AiFormatError("The local model returned an empty reply.");
  }
  return content;
}

/**
 * One chat turn that must produce JSON. A parse failure is retried once with a
 * terse reminder; a transport failure is not retried, so a stopped Ollama fails
 * fast and the caller falls back.
 */
export async function ollamaChat(request: ChatRequest): Promise<unknown> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const content = await postChat(
      attempt === 0
        ? request
        : { ...request, user: `${request.user}\n\nReply with JSON only.` },
    );
    try {
      return extractJson(content);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new AiFormatError("The model did not return JSON.");
}

export type OllamaStatus = { ok: boolean; models: string[] };

/** A running Ollama is not enough: the configured model must be installed. */
export function modelIsInstalled(models: string[], model: string): boolean {
  const wanted = model.trim();
  return wanted.length > 0 && models.includes(wanted);
}

/** Short probe for the settings button. It never throws. */
export async function checkOllama(
  baseUrl: string = CONFIG.ai.baseUrl,
  timeoutMs: number = CONFIG.ai.healthTimeoutMs,
): Promise<OllamaStatus> {
  let endpoint: URL;
  try {
    endpoint = new URL("/api/tags", assertLoopback(baseUrl));
  } catch {
    return { ok: false, models: [] };
  }
  try {
    const response = await fetch(endpoint, { signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) {
      return { ok: false, models: [] };
    }
    const body = (await response.json()) as { models?: Array<{ name?: unknown }> };
    const models = (body.models ?? [])
      .map((entry) => entry.name)
      .filter((name): name is string => typeof name === "string");
    return { ok: true, models };
  } catch {
    return { ok: false, models: [] };
  }
}

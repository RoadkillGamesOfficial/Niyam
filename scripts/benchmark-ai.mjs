#!/usr/bin/env node
// Phase 3 model benchmark (PDD §8.1, Risk R9). It talks to Ollama on this laptop
// and records how each candidate answers the same messy inputs: time, whether
// the reply was JSON, and whether it matched the required shape. Nothing leaves
// the machine.
//
//   node scripts/benchmark-ai.mjs
//   node scripts/benchmark-ai.mjs --models qwen2.5:1.5b-instruct,llama3.2:1b
//   node scripts/benchmark-ai.mjs --out docs/ai-benchmark.md
//
// It never runs as part of the app or the test suite.

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const index = args.indexOf(name);
  return index !== -1 && args[index + 1] ? args[index + 1] : fallback;
};

const baseUrl = process.env.OLLAMA_URL ?? "http://127.0.0.1:11434";
const models = flag("--models", "qwen2.5:1.5b-instruct,llama3.2:1b,gemma2:2b")
  .split(",")
  .map((model) => model.trim())
  .filter(Boolean);
const outPath = flag("--out", null);
const timeoutMs = Number(process.env.OLLAMA_TIMEOUT_MS ?? 120000);

const url = new URL(baseUrl);
if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) {
  console.error(`Refusing a non-local address: ${baseUrl}`);
  process.exit(1);
}

const testSet = JSON.parse(readFileSync(join(root, "docs/ai-test-set.json"), "utf8"));
const prompts = {
  planner: readFileSync(join(root, "prompts/planner.md"), "utf8"),
  reframe: readFileSync(join(root, "prompts/reframe.md"), "utf8"),
};
const fill = (template, values) =>
  template.replace(/\{\{(\w+)\}\}/g, (match, key) => values[key] ?? match);

function promptFor(kind, entry) {
  if (kind === "plan") {
    return {
      system: fill(prompts.planner, {
        maxItems: "12",
        profile: entry.profile,
        profileGuidance: "Match the profile's load and ordering.",
      }),
      user: entry.text,
      valid: (value) => Array.isArray(value.tasks) && value.tasks.length > 0,
    };
  }
  return {
    system: fill(prompts.reframe, {
      context: "Profile: maintenance. Current task: none. No check-ins answered yet.",
    }),
    user: entry.text,
    valid: (value) =>
      typeof value.category === "string" &&
      typeof value.diagnosis === "string" &&
      typeof value.action === "string",
  };
}

async function ask(model, prompt) {
  const started = Date.now();
  try {
    const response = await fetch(new URL("/api/chat", baseUrl), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: prompt.system },
          { role: "user", content: prompt.user },
        ],
        stream: false,
        format: "json",
        options: { temperature: 0.2, num_predict: 600 },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      return { ms: Date.now() - started, json: false, schema: false, note: `HTTP ${response.status}` };
    }
    const body = await response.json();
    const content = body?.message?.content ?? "";
    let parsed = null;
    try {
      const cleaned = content.replace(/```(?:json)?/gi, "").trim();
      const start = cleaned.indexOf("{");
      const end = cleaned.lastIndexOf("}");
      parsed = start !== -1 && end > start ? JSON.parse(cleaned.slice(start, end + 1)) : null;
    } catch {
      parsed = null;
    }
    return {
      ms: Date.now() - started,
      json: parsed !== null,
      schema: parsed !== null && prompt.valid(parsed),
      note: "",
    };
  } catch (error) {
    return {
      ms: Date.now() - started,
      json: false,
      schema: false,
      note: error instanceof Error ? error.message : String(error),
    };
  }
}

async function availableModels() {
  try {
    const response = await fetch(new URL("/api/tags", baseUrl), {
      signal: AbortSignal.timeout(2500),
    });
    if (!response.ok) return [];
    const body = await response.json();
    return (body.models ?? []).map((entry) => entry.name).filter(Boolean);
  } catch {
    return [];
  }
}

const installed = await availableModels();
console.log(`Ollama at ${baseUrl}: ${installed.length > 0 ? `${installed.length} model(s)` : "not answering"}`);
if (installed.length > 0) {
  console.log(`Installed: ${installed.join(", ")}`);
}

const rows = [];
for (const model of models) {
  for (const [kind, entries] of Object.entries(testSet)) {
    for (const entry of entries) {
      const prompt = promptFor(kind, entry);
      const result = await ask(model, prompt);
      rows.push({ model, kind, ...result });
      console.log(
        `${model.padEnd(24)} ${kind.padEnd(8)} ${String(result.ms).padStart(6)}ms  ` +
          `json=${result.json ? "yes" : "no "}  schema=${result.schema ? "yes" : "no "}` +
          (result.note ? `  ${result.note}` : ""),
      );
    }
  }
}

const summary = models.map((model) => {
  const mine = rows.filter((row) => row.model === model);
  const times = mine.map((row) => row.ms).sort((a, b) => a - b);
  const median = times.length ? times[Math.floor(times.length / 2)] : 0;
  const passing = mine.filter((row) => row.schema).length;
  return { model, median, passing, total: mine.length };
});

console.log("\n| Model | Median reply | Structured |");
console.log("| --- | --- | --- |");
for (const row of summary) {
  console.log(`| ${row.model} | ${row.median} ms | ${row.passing}/${row.total} |`);
}

if (outPath) {
  const lines = [
    "# Local model benchmark",
    "",
    `Run on ${new Date().toISOString()}. Ollama at ${baseUrl}.`,
    "",
    "| Model | Median reply | Structured |",
    "| --- | --- | --- |",
    ...summary.map((row) => `| ${row.model} | ${row.median} ms | ${row.passing}/${row.total} |`),
    "",
  ];
  writeFileSync(join(root, outPath), lines.join("\n"));
  console.log(`\nWrote ${outPath}`);
}

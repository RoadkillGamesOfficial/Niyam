import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CONFIG } from "../config.ts";
import { AiConfigError, assertLoopback } from "./ollama.ts";
import { fillPrompt, loadPrompt } from "./prompts.ts";
import { estimateFor, fallbackPlan, generatePlan, peakGuidance } from "./planner.ts";
import { fallbackReframe, generateReframe, safetyResponse } from "./reframe.ts";
import { fallbackOrder, generateReplan } from "./replan.ts";
import { detectDistress } from "./safety.ts";
import { fallbackShrink, generateShrink } from "./shrink.ts";
import {
  AiFormatError,
  extractJson,
  parsePlannerOutput,
  parseReframeOutput,
  parseReplanOutput,
  parseShrinkOutput,
} from "./validate.ts";

// Everything here is offline: the model is a stub, so the rules that protect the
// app from bad model output are testable without Ollama running.

describe("planner validation", () => {
  it("accepts a tasks object and normalises its fields", () => {
    const items = parsePlannerOutput({
      tasks: [{ title: "  Email   Sam ", minutes: "25", load: "Heavy" }],
    });
    assert.deepEqual(items, [{ title: "Email Sam", minutes: 25, load: "heavy" }]);
  });

  it("skips unusable rows and rejects an empty list", () => {
    const items = parsePlannerOutput([
      { title: "", minutes: 10, load: "light" },
      { title: "  ", minutes: 10 },
      { nope: true },
      { title: "Write one paragraph", minutes: 15, load: "light" },
    ]);
    assert.equal(items.length, 1);
    assert.throws(() => parsePlannerOutput({ tasks: [] }), AiFormatError);
    assert.throws(() => parsePlannerOutput(null), AiFormatError);
  });

  it("caps the list so one reply cannot flood the plan", () => {
    const tasks = Array.from({ length: CONFIG.ai.maxPlanItems + 6 }, (_, index) => ({
      title: `Task ${index}`,
      minutes: 10,
      load: "light",
    }));
    assert.equal(parsePlannerOutput({ tasks }).length, CONFIG.ai.maxPlanItems);
  });

  it("clamps wild durations instead of writing them", () => {
    assert.equal(parsePlannerOutput({ tasks: [{ title: "Long", minutes: 999 }] })[0].minutes, 180);
    assert.equal(parsePlannerOutput({ tasks: [{ title: "Odd", minutes: -4 }] })[0].minutes, 5);
  });
});

describe("reframe validation and safety", () => {
  it("maps the PDD category names onto slugs", () => {
    const reading = parseReframeOutput({
      category: "Overwhelm or Scope Creep",
      diagnosis: "Three unrelated deadlines are competing for the same hour.",
      action: "Write the three deadlines on one line each.",
    });
    assert.equal(reading.category, "overwhelm");
  });

  it("rejects an unknown category or a missing step", () => {
    assert.throws(
      () => parseReframeOutput({ category: "vibes", diagnosis: "x", action: "y" }),
      AiFormatError,
    );
    assert.throws(
      () => parseReframeOutput({ category: "fatigue", diagnosis: "Tired." }),
      AiFormatError,
    );
  });

  it("detects explicit distress and leaves ordinary stress alone", () => {
    assert.equal(detectDistress("some nights I think about suicide"), true);
    assert.equal(detectDistress("I want to kill myself"), true);
    assert.equal(detectDistress("I am stressed about the invoice"), false);
    assert.equal(detectDistress("this task is killing me"), false);
  });

  it("answers distress without calling the model", async () => {
    let calls = 0;
    const result = await generateReframe(
      { text: "I keep thinking I would be better off dead.", context: "" },
      {
        model: "test",
        chat: async () => {
          calls += 1;
          return { category: "clarity", diagnosis: "x", action: "y" };
        },
      },
    );
    assert.equal(calls, 0);
    assert.equal(result.safety, true);
    assert.deepEqual(result, safetyResponse());
  });

  it("falls back when the model fails", async () => {
    const result = await generateReframe(
      { text: "I cannot start the report.", context: "" },
      {
        model: "test",
        chat: async () => {
          throw new Error("offline");
        },
      },
    );
    assert.deepEqual(result, fallbackReframe());
  });
});

describe("shrink validation", () => {
  it("accepts a step and clamps its minutes", () => {
    assert.deepEqual(parseShrinkOutput({ title: "Open the file", minutes: 30 }), {
      title: "Open the file",
      minutes: 15,
    });
    assert.throws(() => parseShrinkOutput({ title: "  " }), AiFormatError);
  });

  it("falls back to a preset step when the model fails", async () => {
    const result = await generateShrink(
      { taskTitle: "Write the report", load: "heavy" },
      {
        model: "test",
        chat: async () => {
          throw new Error("offline");
        },
      },
    );
    assert.equal(result.fallback, true);
    assert.ok(result.minutes > 0 && result.minutes <= 15);
    assert.deepEqual(result, fallbackShrink("Write the report"));
  });
});

describe("offline planner fallback", () => {
  it("splits lines, strips bullets and estimates effort", () => {
    const items = fallbackPlan("- Email Sam\n2. Fix the leak under the sink\n\nRead one page");
    assert.deepEqual(
      items.map((item) => item.title),
      ["Email Sam", "Fix the leak under the sink", "Read one page"],
    );
    assert.equal(items[0].minutes, 5);
    assert.equal(items[2].load, "light");
  });

  it("cuts a long paragraph into sentences and caps the count", () => {
    const paragraph = Array.from(
      { length: 20 },
      (_, index) => `Sentence number ${index} about a fairly long piece of work.`,
    ).join(" ");
    const items = fallbackPlan(paragraph);
    assert.ok(items.length > 1);
    assert.ok(items.length <= CONFIG.ai.maxPlanItems);
  });

  it("uses the model when it answers and the fallback when it does not", async () => {
    const ok = await generatePlan(
      { text: "Email Sam", profile: "maintenance" },
      {
        model: "test",
        chat: async () => ({ tasks: [{ title: "Email Sam", minutes: 10, load: "light" }] }),
      },
    );
    assert.equal(ok.fallback, false);
    assert.equal(ok.items[0].minutes, 10);

    const failed = await generatePlan(
      { text: "Email Sam\nFix the sink", profile: "low_energy" },
      {
        model: "test",
        chat: async () => {
          throw new Error("offline");
        },
      },
    );
    assert.equal(failed.fallback, true);
    assert.equal(failed.items.length, 2);
  });

  it("passes detected peak windows into the planner prompt", async () => {
    let system = "";
    const result = await generatePlan(
      {
        text: "Write the report",
        profile: "maintenance",
        peaks: [{ startHour: 9, endHour: 11, score: 0.82, samples: 9 }],
      },
      {
        model: "test",
        chat: async (request) => {
          system = request.system;
          return { tasks: [{ title: "Write the report", minutes: 30, load: "heavy" }] };
        },
      },
    );
    assert.equal(result.fallback, false);
    assert.match(system, /Peak windows from local history: 9:00-11:00/);
    assert.match(system, /heavy tasks inside a peak window/);
    assert.match(peakGuidance([]), /No peak window/);
  });

  it("parses the planner prompt and fills its placeholders", () => {
    const prompt = loadPrompt("planner");
    assert.match(prompt, /JSON only/);
    assert.match(prompt, /\{\{profile\}\}/);
    assert.match(prompt, /\{\{peakGuidance\}\}/);
    const filled = fillPrompt("A {{one}} B {{two}}", { one: "1" });
    assert.equal(filled, "A 1 B {{two}}");
  });

  it("keeps the estimate bands stable", () => {
    assert.deepEqual(estimateFor("One two three"), { title: "One two three", minutes: 5, load: "light" });
    assert.equal(estimateFor("a b c d e f g h").load, "light");
    assert.equal(estimateFor("a b c d e f g h i").load, "medium");
    assert.equal(estimateFor("a ".repeat(20).trim()).load, "heavy");
  });
});

describe("replanning", () => {
  it("accepts only a full permutation", () => {
    assert.deepEqual(parseReplanOutput({ order: [2, 0, 1] }, 3), [2, 0, 1]);
    assert.throws(() => parseReplanOutput({ order: [0, 0, 1] }, 3), AiFormatError);
    assert.throws(() => parseReplanOutput({ order: [0, 1] }, 3), AiFormatError);
    assert.throws(() => parseReplanOutput({ order: [0, 1, 3] }, 3), AiFormatError);
    assert.throws(() => parseReplanOutput({ order: [0] }, 0), AiFormatError);
  });

  it("uses a valid model order and keeps the current one on failure", async () => {
    const items = [
      { title: "Email Sam", minutes: 15, load: "light" },
      { title: "Write the report", minutes: 45, load: "heavy" },
    ];
    const ok = await generateReplan(
      { items, profile: "maintenance", time: "10:00" },
      { model: "test", chat: async () => ({ order: [1, 0] }) },
    );
    assert.deepEqual(ok, { order: [1, 0], fallback: false });

    const failed = await generateReplan(
      { items, profile: "maintenance", time: "10:00" },
      {
        model: "test",
        chat: async () => {
          throw new Error("offline");
        },
      },
    );
    assert.deepEqual(failed, { order: [0, 1], fallback: true });
    assert.deepEqual(fallbackOrder(3), [0, 1, 2]);
  });
});

describe("ollama client contract", () => {
  it("only accepts loopback addresses", () => {
    assert.equal(assertLoopback("http://127.0.0.1:11434").hostname, "127.0.0.1");
    assert.equal(assertLoopback("http://localhost:11434").hostname, "localhost");
    assert.equal(assertLoopback("http://[::1]:11434").hostname, "[::1]");
    assert.throws(() => assertLoopback("http://192.168.1.10:11434"), AiConfigError);
    assert.throws(() => assertLoopback("https://example.com"), AiConfigError);
    assert.throws(() => assertLoopback("not a url"), AiConfigError);
  });

  it("extracts JSON from a fenced reply and rejects prose only", () => {
    assert.deepEqual(extractJson('```json\n{"tasks":[]}\n```'), { tasks: [] });
    assert.deepEqual(extractJson('Sure! {"ok":true} hope that helps'), { ok: true });
    assert.throws(() => extractJson("no json here"), AiFormatError);
  });
});

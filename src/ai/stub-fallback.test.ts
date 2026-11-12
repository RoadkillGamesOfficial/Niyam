import assert from "node:assert/strict";
import { createServer } from "node:http";
import { describe, it } from "node:test";
import { COPY } from "../copy.ts";
import { getOrCreateDayForDate } from "../db/days.ts";
import { addPlanItem, confirmPlan, listPlan, reorderOpenItems } from "../db/plan.ts";
import { createProposal, getProposal } from "../db/plan-proposals.ts";
import { createBrainDump } from "../db/brain-dumps.ts";
import { createTask } from "../db/tasks.ts";
import { withTempDatabase } from "../db/test-helpers.ts";
import { localDateString } from "../time.ts";
import { ollamaChat, type ChatFn } from "./ollama.ts";
import { generatePlan } from "./planner.ts";
import { generateReframe } from "./reframe.ts";
import { generateReplan } from "./replan.ts";
import { fallbackShrink, generateShrink } from "./shrink.ts";

// A real loopback HTTP server, not a stubbed ChatFn. This covers the client,
// JSON retry, validation and the generator fallback in one path.
async function withStub(
  body: (setReply: (content: string) => void, baseUrl: string) => Promise<void>,
): Promise<void> {
  let reply = "";
  const server = createServer((request, response) => {
    if (request.url !== "/api/chat") {
      response.writeHead(404);
      response.end();
      return;
    }
    request.resume();
    request.on("end", () => {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ message: { content: reply } }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("The stub did not bind a port.");
  }
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    await body((content) => {
      reply = content;
    }, baseUrl);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

function chatAt(baseUrl: string): ChatFn {
  return (request) => ollamaChat({ ...request, baseUrl, timeoutMs: 2_000 });
}

const BAD_PLANNER = [
  ["invalid JSON", "this is not JSON"],
  ["truncated JSON", '{"tasks":[{"title":"Cut off'],
  ["wrong-schema JSON", JSON.stringify({ tasks: "not a list" })],
  ["an out-of-range duration", JSON.stringify({ tasks: [{ title: "Absurd", minutes: 999 }] })],
  ["an empty task list", JSON.stringify({ tasks: [] })],
] as const;

const BAD_REFRAME = [
  ["invalid JSON", "this is not JSON"],
  ["truncated JSON", '{"category":"clarity"'],
  ["wrong-schema JSON", JSON.stringify({ not: "a reading" })],
  [
    "an absurd value",
    JSON.stringify({ category: "vibes", diagnosis: "x", action: "y".repeat(400) }),
  ],
] as const;

const BAD_REPLAN = [
  ["invalid JSON", "this is not JSON"],
  ["truncated JSON", '{"order":[0,1'],
  ["wrong-schema JSON", JSON.stringify({ order: "nope" })],
  ["an absurd order", JSON.stringify({ order: [0, 0, 1] })],
] as const;

const BAD_SHRINK = [
  ["invalid JSON", "this is not JSON"],
  ["truncated JSON", '{"title":"Open the file"'],
  ["wrong-schema JSON", JSON.stringify({ minutes: 5 })],
  ["an out-of-range duration", JSON.stringify({ title: "Absurd", minutes: 999 })],
] as const;

describe("malformed model replies at the HTTP boundary", () => {
  for (const [name, content] of BAD_PLANNER) {
    it(`planner falls back for ${name}`, async () => {
      await withStub(async (setReply, baseUrl) => {
        setReply(content);
        const result = await generatePlan(
          { text: "Email Sam\nFix the sink", profile: "maintenance" },
          { model: "test", chat: chatAt(baseUrl) },
        );
        assert.equal(result.fallback, true);
        assert.deepEqual(
          result.items.map((item) => item.title),
          ["Email Sam", "Fix the sink"],
        );
        assert.ok(result.items.every((item) => item.minutes >= 5 && item.minutes <= 180));
      });
    });
  }

  for (const [name, content] of BAD_REFRAME) {
    it(`reframe falls back for ${name}`, async () => {
      await withStub(async (setReply, baseUrl) => {
        setReply(content);
        const result = await generateReframe(
          { text: "I cannot start the report.", context: "" },
          { model: "test", chat: chatAt(baseUrl) },
        );
        assert.equal(result.fallback, true);
        assert.equal(result.safety, false);
        assert.equal(result.category, "overwhelm");
      });
    });
  }

  for (const [name, content] of BAD_REPLAN) {
    it(`re-plan falls back for ${name}`, async () => {
      await withStub(async (setReply, baseUrl) => {
        setReply(content);
        const result = await generateReplan(
          {
            items: [
              { title: "Email Sam", minutes: 15, load: "light" },
              { title: "Write the report", minutes: 45, load: "heavy" },
            ],
            profile: "maintenance",
            time: "10:00",
          },
          { model: "test", chat: chatAt(baseUrl) },
        );
        assert.equal(result.fallback, true);
        assert.deepEqual(result.order, [0, 1]);
      });
    });
  }

  for (const [name, content] of BAD_SHRINK) {
    it(`shrink falls back for ${name}`, async () => {
      await withStub(async (setReply, baseUrl) => {
        setReply(content);
        const result = await generateShrink(
          { taskTitle: "Write the report", load: "heavy" },
          { model: "test", chat: chatAt(baseUrl) },
        );
        assert.equal(result.fallback, true);
        assert.deepEqual(result, fallbackShrink("Write the report"));
        assert.ok((COPY.checkin.microActions as readonly string[]).includes(result.title));
      });
    });
  }
});

describe("malformed replies never become stored work", () => {
  it("stores a fallback-marked proposal and no tasks", async () => {
    await withStub(async (setReply, baseUrl) => {
      setReply(JSON.stringify({ tasks: [{ title: "Absurd", minutes: 999 }] }));
      const result = await generatePlan(
        { text: "Email Sam\nFix the sink", profile: "maintenance" },
        { model: "test", chat: chatAt(baseUrl) },
      );
      withTempDatabase((db) => {
        const date = localDateString();
        const day = getOrCreateDayForDate(db, date);
        const proposal = createProposal(db, {
          dayId: day.id,
          sourceText: "Email Sam\nFix the sink",
          model: "test",
          fallback: result.fallback,
          items: result.items,
        });
        assert.equal(proposal.fallback, 1);
        assert.equal(listPlan(db, day.id).length, 0);
        assert.equal(getProposal(db, proposal.id)?.status, "proposed");
      });
    });
  });

  it("stores a fallback-marked reading instead of the bad one", async () => {
    await withStub(async (setReply, baseUrl) => {
      setReply(JSON.stringify({ category: "vibes", diagnosis: "x", action: "y" }));
      const result = await generateReframe(
        { text: "I cannot start the report.", context: "" },
        { model: "test", chat: chatAt(baseUrl) },
      );
      withTempDatabase((db) => {
        const date = localDateString();
        const day = getOrCreateDayForDate(db, date);
        const dump = createBrainDump(db, {
          dayId: day.id,
          text: "I cannot start the report.",
          category: result.category,
          diagnosis: result.diagnosis,
          microAction: result.microAction,
          safety: result.safety,
          fallback: result.fallback,
          model: "test",
        });
        assert.equal(dump.fallback, 1);
        assert.equal(dump.category, "overwhelm");
        assert.equal(listPlan(db, day.id).length, 0);
      });
    });
  });

  it("keeps the existing order and adds no task on a bad re-plan", async () => {
    await withStub(async (setReply, baseUrl) => {
      setReply(JSON.stringify({ order: [0, 0] }));
      const result = await generateReplan(
        {
          items: [
            { title: "First", minutes: 15, load: "light" },
            { title: "Second", minutes: 15, load: "light" },
          ],
          profile: "maintenance",
          time: "10:00",
        },
        { model: "test", chat: chatAt(baseUrl) },
      );
      withTempDatabase((db) => {
        const date = localDateString();
        const day = getOrCreateDayForDate(db, date);
        const first = createTask(db, { dayId: day.id, title: "First" });
        const second = createTask(db, { dayId: day.id, title: "Second" });
        addPlanItem(db, day.id, first.id);
        addPlanItem(db, day.id, second.id);
        confirmPlan(db, day.id, `${date} 10:00:00`);
        reorderOpenItems(db, day.id, result.order.map((index) => [first.id, second.id][index]));
        assert.equal(result.fallback, true);
        assert.deepEqual(
          listPlan(db, day.id).map((item) => item.title),
          ["First", "Second"],
        );
      });
    });
  });
});

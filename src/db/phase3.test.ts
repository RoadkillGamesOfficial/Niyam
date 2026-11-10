import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CONFIG } from "../config.ts";
import {
  createBrainDump,
  deleteBrainDump,
  getBrainDump,
  listBrainDumps,
  setBrainDumpTask,
  updateBrainDumpReading,
  updateBrainDumpText,
} from "./brain-dumps.ts";
import { getOrCreateDayForDate } from "./days.ts";
import { addPlanItem, listPlan, reorderOpenItems } from "./plan.ts";
import {
  acceptProposal,
  createProposal,
  discardProposal,
  getProposal,
  latestProposedProposal,
  proposalItems,
} from "./plan-proposals.ts";
import { getSettings, updateAiSettings } from "./settings.ts";
import { createTask, getTask } from "./tasks.ts";
import { withTempDatabase } from "./test-helpers.ts";

const today = (() => {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
})();

describe("AI settings", () => {
  it("starts on with the small default model", () => {
    withTempDatabase((db) => {
      const settings = getSettings(db);
      assert.equal(settings.ai_enabled, 1);
      assert.equal(settings.ai_model, CONFIG.ai.defaultModel);
    });
  });

  it("saves the switch and a valid model name", () => {
    withTempDatabase((db) => {
      const saved = updateAiSettings(db, { enabled: false, model: "llama3.2:1b" });
      assert.equal(saved.ai_enabled, 0);
      assert.equal(saved.ai_model, "llama3.2:1b");
      assert.equal(getSettings(db).ai_model, "llama3.2:1b");
    });
  });

  it("rejects a model name that is not a tag", () => {
    withTempDatabase((db) => {
      assert.throws(() => updateAiSettings(db, { enabled: true, model: "bad model!" }));
      assert.throws(() => updateAiSettings(db, { enabled: true, model: "" }));
    });
  });
});

describe("brain dumps", () => {
  it("stores the text with its reading and can list newest first", () => {
    withTempDatabase((db) => {
      const day = getOrCreateDayForDate(db, today);
      const first = createBrainDump(db, {
        dayId: day.id,
        text: "The invoice is still sitting there.",
        category: "avoidance",
        diagnosis: "The first step is unnamed, so it feels bigger than it is.",
        microAction: "Open the invoice and read the first line.",
        safety: false,
        fallback: false,
        model: "test",
      });
      createBrainDump(db, {
        dayId: day.id,
        text: "Too many things.",
        category: "overwhelm",
        diagnosis: "Several unrelated things are competing.",
        microAction: "List three and circle one.",
        safety: false,
        fallback: true,
        model: "test",
      });

      assert.equal(getBrainDump(db, first.id)?.text, "The invoice is still sitting there.");
      assert.deepEqual(
        listBrainDumps(db).map((dump) => dump.category),
        ["overwhelm", "avoidance"],
      );
    });
  });

  it("updates the reading without rewriting the user's text", () => {
    withTempDatabase((db) => {
      const day = getOrCreateDayForDate(db, today);
      const dump = createBrainDump(db, {
        dayId: day.id,
        text: "I cannot start.",
        category: "fatigue",
        diagnosis: "Low energy.",
        microAction: "Open the document.",
        safety: false,
        fallback: false,
        model: "test",
      });
      updateBrainDumpReading(db, dump.id, {
        category: "clarity",
        diagnosis: "The next step is unclear.",
        microAction: "Write the next sentence.",
        safety: false,
        fallback: false,
        model: "test",
      });
      const updated = getBrainDump(db, dump.id);
      assert.equal(updated?.text, "I cannot start.");
      assert.equal(updated?.category, "clarity");

      updateBrainDumpText(db, dump.id, "I cannot start the report.");
      assert.equal(getBrainDump(db, dump.id)?.text, "I cannot start the report.");
    });
  });

  it("keeps every dump reachable, not only the newest ten", () => {
    withTempDatabase((db) => {
      const day = getOrCreateDayForDate(db, today);
      for (let index = 0; index < 12; index += 1) {
        createBrainDump(db, {
          dayId: day.id,
          text: `Dump ${index}`,
          category: "clarity",
          diagnosis: "The next step is unclear.",
          microAction: "Write it down.",
          safety: false,
          fallback: false,
          model: "test",
        });
      }
      assert.equal(listBrainDumps(db).length, 12);
      assert.equal(listBrainDumps(db, 3).length, 3);
    });
  });

  it("remembers the task a dump is about", () => {
    withTempDatabase((db) => {
      const day = getOrCreateDayForDate(db, today);
      const task = createTask(db, { dayId: day.id, title: "Write the report" });
      const dump = createBrainDump(db, {
        dayId: day.id,
        text: "The report is too big.",
        category: "overwhelm",
        diagnosis: "The whole report is being held in one piece.",
        microAction: "Write the heading.",
        safety: false,
        fallback: false,
        model: "test",
        sourceTaskId: task.id,
      });
      assert.equal(dump.source_task_id, task.id);
    });
  });

  it("deletes the dump but keeps the task it created", () => {
    withTempDatabase((db) => {
      const day = getOrCreateDayForDate(db, today);
      const dump = createBrainDump(db, {
        dayId: day.id,
        text: "Write the thing.",
        category: "clarity",
        diagnosis: "The first step is unnamed.",
        microAction: "Open the file.",
        safety: false,
        fallback: false,
        model: "test",
      });
      const task = createTask(db, { dayId: day.id, title: "Open the file" });
      db.prepare("UPDATE task SET brain_dump_id = ? WHERE id = ?").run(dump.id, task.id);
      setBrainDumpTask(db, dump.id, task.id);
      addPlanItem(db, day.id, task.id);

      deleteBrainDump(db, dump.id);
      assert.equal(getBrainDump(db, dump.id), undefined);
      assert.equal(getTask(db, task.id)?.brain_dump_id, null);
      assert.equal(listPlan(db, day.id).length, 1);
    });
  });
});

describe("re-planning the rest", () => {
  it("orders the open work and leaves finished work below it", () => {
    withTempDatabase((db) => {
      const day = getOrCreateDayForDate(db, today);
      const first = createTask(db, { dayId: day.id, title: "First" });
      const second = createTask(db, { dayId: day.id, title: "Second" });
      const third = createTask(db, { dayId: day.id, title: "Third" });
      addPlanItem(db, day.id, first.id);
      addPlanItem(db, day.id, second.id);
      addPlanItem(db, day.id, third.id);
      db.prepare("UPDATE task SET status = 'done' WHERE id = ?").run(second.id);

      reorderOpenItems(db, day.id, [third.id, first.id]);
      assert.deepEqual(
        listPlan(db, day.id).map((item) => item.title),
        ["Third", "First", "Second"],
      );

      // A partial order keeps the omitted open task instead of dropping it.
      reorderOpenItems(db, day.id, [first.id]);
      assert.deepEqual(
        listPlan(db, day.id).map((item) => item.title),
        ["First", "Third", "Second"],
      );
    });
  });

  it("stores a parent link for a shrunken task", () => {
    withTempDatabase((db) => {
      const day = getOrCreateDayForDate(db, today);
      const parent = createTask(db, { dayId: day.id, title: "Write the report" });
      const tiny = createTask(db, {
        dayId: day.id,
        title: "Open the file",
        parentTaskId: parent.id,
      });
      assert.equal(tiny.parent_task_id, parent.id);
    });
  });
});

describe("plan proposals", () => {
  it("creates a reusable proposal with ordered items", () => {
    withTempDatabase((db) => {
      const day = getOrCreateDayForDate(db, today);
      const proposal = createProposal(db, {
        dayId: day.id,
        sourceText: "Email Sam, fix the sink",
        model: "test",
        fallback: false,
        items: [
          { title: "Email Sam", minutes: 15, load: "light" },
          { title: "Fix the sink", minutes: 45, load: "heavy" },
        ],
      });
      assert.equal(proposal.status, "proposed");
      assert.deepEqual(
        proposalItems(db, proposal.id).map((item) => item.title),
        ["Email Sam", "Fix the sink"],
      );
      assert.equal(latestProposedProposal(db, day.id)?.id, proposal.id);
    });
  });

  it("adds only included items, with the edits made in review", () => {
    withTempDatabase((db) => {
      const day = getOrCreateDayForDate(db, today);
      const proposal = createProposal(db, {
        dayId: day.id,
        sourceText: "Email Sam, fix the sink",
        model: "test",
        fallback: false,
        items: [
          { title: "Email Sam", minutes: 15, load: "light" },
          { title: "Fix the sink", minutes: 45, load: "heavy" },
        ],
      });
      const [first, second] = proposalItems(db, proposal.id);

      const result = acceptProposal(db, proposal.id, [
        { itemId: first.id, include: true, title: "Email Sam about the invoice", minutes: 20, load: "medium" },
        { itemId: second.id, include: false, title: second.title, minutes: 45, load: "heavy" },
      ]);

      assert.equal(result.added, 1);
      assert.deepEqual(
        listPlan(db, day.id).map((item) => item.title),
        ["Email Sam about the invoice"],
      );
      assert.equal(getProposal(db, proposal.id)?.status, "accepted");
      assert.equal(latestProposedProposal(db, day.id), undefined);
    });
  });

  it("ignores a second acceptance and a discarded proposal", () => {
    withTempDatabase((db) => {
      const day = getOrCreateDayForDate(db, today);
      const proposal = createProposal(db, {
        dayId: day.id,
        sourceText: "One task",
        model: "test",
        fallback: false,
        items: [{ title: "One task", minutes: 10, load: "light" }],
      });
      const [item] = proposalItems(db, proposal.id);
      const edit = {
        itemId: item.id,
        include: true,
        title: item.title,
        minutes: 10,
        load: "light" as const,
      };

      assert.equal(acceptProposal(db, proposal.id, [edit]).added, 1);
      assert.equal(acceptProposal(db, proposal.id, [edit]).added, 0);
      assert.equal(listPlan(db, day.id).length, 1);

      const other = createProposal(db, {
        dayId: day.id,
        sourceText: "Other",
        model: "test",
        fallback: true,
        items: [{ title: "Other", minutes: 5, load: "light" }],
      });
      discardProposal(db, other.id);
      assert.equal(getProposal(db, other.id)?.status, "discarded");
      assert.equal(latestProposedProposal(db, day.id), undefined);
    });
  });

  it("refuses a proposal with no items", () => {
    withTempDatabase((db) => {
      const day = getOrCreateDayForDate(db, today);
      assert.throws(() =>
        createProposal(db, {
          dayId: day.id,
          sourceText: "",
          model: null,
          fallback: true,
          items: [],
        }),
      );
    });
  });
});

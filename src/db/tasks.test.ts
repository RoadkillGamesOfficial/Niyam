import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CONFIG } from "../config.ts";
import { openDatabase } from "./database.ts";
import { getOrCreateDayForDate } from "./days.ts";
import {
  createTask,
  getTask,
  listTasksForDay,
  setTaskStatus,
} from "./tasks.ts";
import { withTempDatabase } from "./test-helpers.ts";

describe("tasks", () => {
  it("stores a task with the defaults Phase 1 promises", () => {
    withTempDatabase((db) => {
      const day = getOrCreateDayForDate(db, "2026-11-07");
      const task = createTask(db, { dayId: day.id, title: "Write the tests" });

      assert.equal(task.title, "Write the tests");
      assert.equal(task.day_id, day.id);
      assert.equal(task.status, "open");
      assert.equal(task.cognitive_load, "medium");
      assert.equal(task.notes, null);
      assert.equal(task.estimated_minutes, null);
      assert.equal(task.parent_task_id, null);
      assert.ok(task.created_at);
    });
  });

  it("trims the title and rejects an empty one", () => {
    withTempDatabase((db) => {
      const day = getOrCreateDayForDate(db, "2026-11-07");
      const task = createTask(db, { dayId: day.id, title: "  feed the cat  " });

      assert.equal(task.title, "feed the cat");
      assert.throws(() => createTask(db, { dayId: day.id, title: "   " }), /title/);
    });
  });

  it("rejects a title past the configured limit", () => {
    withTempDatabase((db) => {
      const day = getOrCreateDayForDate(db, "2026-11-07");
      const longTitle = "a".repeat(CONFIG.tasks.maxTitleLength + 1);

      assert.throws(() => createTask(db, { dayId: day.id, title: longTitle }), /at most/);
    });
  });

  it("lists only the requested day, oldest first", () => {
    withTempDatabase((db) => {
      const today = getOrCreateDayForDate(db, "2026-11-07");
      const tomorrow = getOrCreateDayForDate(db, "2026-11-08");

      createTask(db, { dayId: today.id, title: "first" });
      createTask(db, { dayId: today.id, title: "second" });
      createTask(db, { dayId: tomorrow.id, title: "later" });

      assert.deepEqual(
        listTasksForDay(db, today.id).map((task) => task.title),
        ["first", "second"],
      );
      assert.deepEqual(
        listTasksForDay(db, tomorrow.id).map((task) => task.title),
        ["later"],
      );
    });
  });

  it("refuses a task for a day that does not exist", () => {
    withTempDatabase((db) => {
      assert.throws(
        () => createTask(db, { dayId: 999, title: "orphan" }),
        /FOREIGN KEY/i,
      );
    });
  });

  it("marks a task done, and the change survives reopening the file", () => {
    withTempDatabase((db, path) => {
      const day = getOrCreateDayForDate(db, "2026-11-07");
      const task = createTask(db, { dayId: day.id, title: "mark me" });

      const done = setTaskStatus(db, task.id, "done");
      assert.equal(done?.status, "done");

      // A second connection sees what the first one wrote: the change is on
      // disk, not just in memory.
      const reopened = openDatabase(path);
      try {
        assert.equal(getTask(reopened, task.id)?.status, "done");
      } finally {
        reopened.close();
      }

      const reopenedTask = setTaskStatus(db, task.id, "open");
      assert.equal(reopenedTask?.status, "open");
    });
  });

  it("returns undefined for a task that is not there", () => {
    withTempDatabase((db) => {
      assert.equal(getTask(db, 12345), undefined);
      assert.equal(setTaskStatus(db, 12345, "done"), undefined);
    });
  });
});

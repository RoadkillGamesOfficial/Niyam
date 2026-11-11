import assert from "node:assert/strict";
import { existsSync, mkdirSync, utimesSync } from "node:fs";
import { describe, it } from "node:test";
import { dirname, join } from "node:path";
import {
  backupDirectoryFor,
  createBackup,
  ensureAutomaticBackup,
  exportDatabase,
  getBackupStatus,
  listBackups,
  pruneBackups,
  snapshotDatabase,
} from "./backup.ts";
import { openDatabase } from "./database.ts";
import { getOrCreateDayForDate } from "./days.ts";
import { createTask, getTask } from "./tasks.ts";
import { withTempDatabase } from "./test-helpers.ts";

describe("database export", () => {
  it("writes a standalone snapshot that restores the pre-mutation state", () => {
    withTempDatabase((db, path) => {
      const day = getOrCreateDayForDate(db, "2026-01-02");
      const task = createTask(db, {
        dayId: day.id,
        title: "Before the change",
        estimatedMinutes: 15,
        cognitiveLoad: "light",
      });
      const snapshotPath = join(dirname(path), "manual-export.db");

      const result = exportDatabase(db, snapshotPath);
      assert.equal(result.path, snapshotPath);
      assert.ok(result.bytes > 0);
      assert.equal(existsSync(`${snapshotPath}-wal`), false);

      db.prepare("UPDATE task SET title = 'After the change' WHERE id = ?").run(task.id);
      assert.equal(getTask(db, task.id)?.title, "After the change");

      const restored = openDatabase(snapshotPath);
      try {
        assert.equal(getTask(restored, task.id)?.title, "Before the change");
        assert.equal(getOrCreateDayForDate(restored, "2026-01-02").id, day.id);
      } finally {
        restored.close();
      }
    });
  });

  it("refuses to overwrite an existing snapshot", () => {
    withTempDatabase((db, path) => {
      const snapshotPath = join(dirname(path), "already-there.db");
      snapshotDatabase(db, snapshotPath);
      assert.throws(() => snapshotDatabase(db, snapshotPath), /already exists/);
    });
  });
});

describe("automatic backups", () => {
  it("creates one, then waits for the interval and prunes to the retention limit", () => {
    withTempDatabase((db, path) => {
      const directory = join(dirname(path), "backups");
      const now = new Date("2026-11-11T12:00:00.000Z");
      mkdirSync(directory, { recursive: true });

      for (let index = 1; index <= 5; index += 1) {
        const oldPath = join(directory, `niyam-backup-old-${index}.db`);
        snapshotDatabase(db, oldPath);
        const at = new Date(now.getTime() - (index + 1) * 24 * 60 * 60 * 1000);
        utimesSync(oldPath, at, at);
      }

      const created = ensureAutomaticBackup(db, path, {
        directory,
        now,
        retain: 3,
        intervalHours: 24,
      });
      assert.equal(created.created, true);
      assert.ok(created.path);
      assert.equal(listBackups(directory).length, 3);
      assert.equal(created.pruned.length, 3);
      utimesSync(created.path, now, now);

      const recent = ensureAutomaticBackup(db, path, {
        directory,
        now: new Date(now.getTime() + 60 * 60 * 1000),
        retain: 3,
        intervalHours: 24,
      });
      assert.equal(recent.created, false);
      assert.equal(recent.reason, "recent");
      assert.equal(listBackups(directory).length, 3);

      const later = ensureAutomaticBackup(db, path, {
        directory,
        now: new Date(now.getTime() + 25 * 60 * 60 * 1000),
        retain: 3,
        intervalHours: 24,
      });
      assert.equal(later.created, true);
      assert.equal(listBackups(directory).length, 3);

      const status = getBackupStatus(path, {
        directory,
        retain: 3,
        intervalHours: 24,
      });
      assert.equal(status.count, 3);
      assert.equal(status.latestName, listBackups(directory)[0]?.name);
      assert.equal(status.retain, 3);
    });
  });

  it("keeps the newest backups by modification time", () => {
    withTempDatabase((db, path) => {
      const directory = join(dirname(path), "backups");
      mkdirSync(directory, { recursive: true });
      const now = new Date("2026-11-11T12:00:00.000Z");

      for (let index = 0; index < 4; index += 1) {
        const backupPath = join(directory, `niyam-backup-${index}.db`);
        snapshotDatabase(db, backupPath);
        const at = new Date(now.getTime() - index * 60 * 60 * 1000);
        utimesSync(backupPath, at, at);
      }

      const removed = pruneBackups(directory, 2);
      assert.equal(removed.length, 2);
      assert.equal(listBackups(directory).length, 2);
      assert.deepEqual(
        listBackups(directory).map((entry) => entry.name),
        ["niyam-backup-0.db", "niyam-backup-1.db"],
      );
    });
  });

  it("puts a throwaway database's backups beside it, not in the live folder", () => {
    withTempDatabase((_db, path) => {
      assert.equal(backupDirectoryFor(path), join(dirname(path), "test-backups"));
    });
  });

  it("creates a manual backup and applies the same retention limit", () => {
    withTempDatabase((db, path) => {
      const directory = join(dirname(path), "backups");
      const first = createBackup(db, path, { directory, retain: 2 });
      const second = createBackup(db, path, { directory, retain: 2 });
      const third = createBackup(db, path, { directory, retain: 2 });
      assert.ok(first.path);
      assert.ok(second.path);
      assert.ok(third.path);
      assert.equal(listBackups(directory).length, 2);
    });
  });
});

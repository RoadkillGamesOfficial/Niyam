import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { CONFIG } from "../config.ts";
import { runMigrations } from "./migrations.ts";

// Server-side only. Never import this from a "use client" module, and never run
// it on the edge runtime: node:sqlite needs the Node runtime.
// See docs/decisions.md.

export function databasePath(): string {
  return join(process.cwd(), CONFIG.database.directory, CONFIG.database.filename);
}

/**
 * Opens the database, turns on the pragmas we rely on, and brings the schema up
 * to date. Opening the same file twice in one process would give two
 * connections, so keep one connection per process (see src/db/index.ts).
 */
export function openDatabase(path: string = databasePath()): DatabaseSync {
  // First run: data/ does not exist yet. mkdir with recursive is a no-op if it does.
  mkdirSync(dirname(path), { recursive: true });

  const db = new DatabaseSync(path);
  // WAL lets a read happen while a write is in flight, which suits a local app.
  db.exec("PRAGMA journal_mode = WAL");
  // Off by default in SQLite; without it references are documentation only.
  db.exec("PRAGMA foreign_keys = ON");
  // Wait instead of failing if another connection holds the write lock.
  db.exec("PRAGMA busy_timeout = 5000");

  runMigrations(db);
  return db;
}

import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { CONFIG } from "../config.ts";

// A backup is a SQLite snapshot, never a copy of a live database file. VACUUM
// INTO asks SQLite to write one consistent database image while the app keeps
// its connection open, so the WAL and any in-flight write cannot tear it.
// See docs/decisions.md (2026-11-11).

export type BackupEntry = {
  name: string;
  path: string;
  bytes: number;
  modifiedAt: Date;
};

export type BackupStatus = {
  directory: string;
  count: number;
  latestName: string | null;
  intervalHours: number;
  retain: number;
};

export type BackupResult = {
  created: boolean;
  path: string | null;
  pruned: string[];
  reason?: "recent";
};

export type SnapshotResult = {
  path: string;
  bytes: number;
};

export type BackupOptions = {
  directory?: string;
  now?: Date;
  retain?: number;
};

const LIVE_DATABASE = resolve(
  process.cwd(),
  CONFIG.database.directory,
  CONFIG.database.filename,
);

function stamp(now: Date): string {
  return now.toISOString().replace(/[:.]/g, "-");
}

export function backupFileName(now: Date = new Date()): string {
  return `${CONFIG.backup.filenamePrefix}${stamp(now)}.db`;
}

export function exportFilePath(now: Date = new Date()): string {
  return resolve(
    process.cwd(),
    CONFIG.export.directory,
    `${CONFIG.export.filenamePrefix}${stamp(now)}.db`,
  );
}

/**
 * The live database gets the configured backup folder. A seed or throwaway
 * database gets a sibling folder, so reviewing demo data cannot prune the real
 * backups.
 */
export function backupDirectoryFor(databaseFile: string): string {
  const target = resolve(databaseFile);
  if (target === LIVE_DATABASE) {
    return resolve(process.cwd(), CONFIG.backup.directory);
  }
  const leaf = basename(target, extname(target));
  return join(dirname(target), `${leaf}-backups`);
}

function uniquePath(directory: string, filename: string): string {
  let target = join(directory, filename);
  let suffix = 1;
  while (existsSync(target)) {
    target = join(directory, filename.replace(/\.db$/, `-${suffix}.db`));
    suffix += 1;
  }
  return target;
}

/** Writes one self-contained, restorable database image. */
export function snapshotDatabase(db: DatabaseSync, destination: string): SnapshotResult {
  const target = resolve(destination);
  mkdirSync(dirname(target), { recursive: true });
  if (existsSync(target)) {
    throw new Error(`Snapshot destination already exists: ${target}`);
  }
  db.prepare("VACUUM INTO ?").run(target);
  return { path: target, bytes: statSync(target).size };
}

export function exportDatabase(
  db: DatabaseSync,
  destination: string = exportFilePath(),
): SnapshotResult {
  return snapshotDatabase(db, destination);
}

export function listBackups(directory: string): BackupEntry[] {
  if (!existsSync(directory)) {
    return [];
  }
  return readdirSync(directory, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name.startsWith(CONFIG.backup.filenamePrefix) &&
        entry.name.endsWith(".db"),
    )
    .map((entry) => {
      const path = join(directory, entry.name);
      const info = statSync(path);
      return {
        name: entry.name,
        path,
        bytes: info.size,
        modifiedAt: info.mtime,
      };
    })
    .sort((a, b) => b.modifiedAt.getTime() - a.modifiedAt.getTime());
}

/** Keeps the newest `retain` backups and removes the rest. */
export function pruneBackups(
  directory: string,
  retain: number = CONFIG.backup.keep,
): string[] {
  const keep = Math.max(1, Math.trunc(retain));
  const removed = listBackups(directory).slice(keep);
  for (const entry of removed) {
    rmSync(entry.path, { force: true });
  }
  return removed.map((entry) => entry.name);
}

/** Creates one backup now, then applies the retention policy. */
export function createBackup(
  db: DatabaseSync,
  databaseFile: string,
  options: BackupOptions = {},
): BackupResult {
  const directory = options.directory ?? backupDirectoryFor(databaseFile);
  const now = options.now ?? new Date();
  const retain = options.retain ?? CONFIG.backup.keep;
  const destination = uniquePath(directory, backupFileName(now));
  const snapshot = snapshotDatabase(db, destination);
  const pruned = pruneBackups(directory, retain);
  return { created: true, path: snapshot.path, pruned };
}

/**
 * Called whenever the app opens the database. It is periodic rather than
 * per-request: the newest backup must be older than the interval before another
 * is written. A failure is caught by the caller so backups never block the app.
 */
export function ensureAutomaticBackup(
  db: DatabaseSync,
  databaseFile: string,
  options: BackupOptions & { intervalHours?: number } = {},
): BackupResult {
  const directory = options.directory ?? backupDirectoryFor(databaseFile);
  const now = options.now ?? new Date();
  const retain = options.retain ?? CONFIG.backup.keep;
  const intervalHours = options.intervalHours ?? CONFIG.backup.intervalHours;
  const latest = listBackups(directory)[0];
  const intervalMs = Math.max(0, intervalHours) * 60 * 60 * 1000;

  if (latest && intervalMs > 0 && now.getTime() - latest.modifiedAt.getTime() < intervalMs) {
    return {
      created: false,
      path: null,
      pruned: pruneBackups(directory, retain),
      reason: "recent",
    };
  }

  return createBackup(db, databaseFile, { directory, now, retain });
}

export function getBackupStatus(
  databaseFile: string,
  options: Pick<BackupOptions, "directory"> & { intervalHours?: number; retain?: number } = {},
): BackupStatus {
  const directory = options.directory ?? backupDirectoryFor(databaseFile);
  const entries = listBackups(directory);
  return {
    directory,
    count: entries.length,
    latestName: entries[0]?.name ?? null,
    intervalHours: options.intervalHours ?? CONFIG.backup.intervalHours,
    retain: options.retain ?? CONFIG.backup.keep,
  };
}

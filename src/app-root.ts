import { isAbsolute, join, resolve } from "node:path";
import { CONFIG } from "./config.ts";

// Two different questions once the app is packaged:
//   appRoot()  — where the app's own files live (migrations, prompts)
//   dataRoot() — where the user's data lives (database, backups, exports)
//
// Both are resolved from the environment so one build can run from the project
// folder, from an installed resources/app folder, or from a temp dir in a test.
// With neither variable set, every path is exactly what it was before.
//
// Relative import and erasable TypeScript only: the data layer loads this with
// plain Node, which does not understand the "@/" alias.

function fromEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

/** The app folder: the parent of migrations/ and prompts/. */
export function appRoot(): string {
  const override = fromEnv("NIYAM_APP_ROOT");
  if (!override) {
    return process.cwd();
  }
  return isAbsolute(override) ? override : resolve(process.cwd(), override);
}

/** The user's data folder: the database, its backups and exports. */
export function dataRoot(): string {
  const override = fromEnv("NIYAM_DATA_DIR");
  if (!override) {
    return join(appRoot(), CONFIG.database.directory);
  }
  return isAbsolute(override) ? override : resolve(appRoot(), override);
}

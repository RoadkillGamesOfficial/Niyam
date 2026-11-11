import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { COPY } from "@/copy";
import { snapshotDatabase } from "@/db/backup";
import { getDatabase } from "@/db/index";
import { localDateString } from "@/time";

// The download is a real SQLite snapshot, prepared off the live file and then
// removed with the temp directory. Nothing is sent to a server.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  const directory = mkdtempSync(join(tmpdir(), "niyam-export-"));
  const snapshotPath = join(directory, "niyam-export.db");
  try {
    snapshotDatabase(getDatabase(), snapshotPath);
    const bytes = readFileSync(snapshotPath);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/vnd.sqlite3",
        "Content-Disposition": `attachment; filename="niyam-export-${localDateString()}.db"`,
        "Content-Length": String(bytes.length),
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return new Response(COPY.settings.exportError, {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

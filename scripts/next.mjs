// Runs the local Next.js CLI with telemetry forced off.
//
// docs/knowledge.md rules out telemetry, but Next phones home once per build or
// dev session unless NEXT_TELEMETRY_DISABLED is set. Wrapping the CLI keeps the
// npm scripts identical on Windows and POSIX shells, unlike an inline
// `VAR=1 next build` prefix, which cmd.exe does not understand.
process.env.NEXT_TELEMETRY_DISABLED = "1";
await import("next/dist/bin/next");

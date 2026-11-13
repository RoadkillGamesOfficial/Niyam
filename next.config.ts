import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The desktop shell ships this self-contained server bundle (see
  // docs/phase-0-desktop-spike.md). Standalone output is additive: the normal
  // build and `npm start` keep working, so the browser version is unchanged.
  output: "standalone",

  // src/app-root.ts falls back to process.cwd(), which the file tracer cannot
  // scope, so without this the bundle carries the whole project: data/ alone
  // took it to 1.8 GB. None of these are runtime input. migrations/, prompts/,
  // public/ and .next/ are, so they stay traced.
  outputFileTracingExcludes: {
    "*": ["./data/**", "./desktop/**", "./docs/**", "./scripts/**"],
  },
};

export default nextConfig;

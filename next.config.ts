import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The desktop shell ships this self-contained server bundle (see
  // docs/phase-0-desktop-spike.md). Standalone output is additive: the normal
  // build and `npm start` keep working, so the browser version is unchanged.
  output: "standalone",
};

export default nextConfig;

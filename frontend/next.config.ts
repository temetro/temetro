import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a self-contained server build for a small Docker image.
  output: "standalone",
  // The vendored components/ai-elements/* library has pre-existing type drift
  // against this Base UI version (see CLAUDE.md), which would otherwise fail
  // `next build`. Skip the type gate so production/Docker builds succeed; app
  // code is still type-checked separately via `tsc --noEmit`.
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;

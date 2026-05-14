import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Phase 3 / MON-14 (14-05-2026): standalone output emits a self-contained
  // `.next/standalone` server bundle + minimal node_modules — required by the
  // Dockerfile's runner stage to keep the production image small and to avoid
  // copying the full repo into the final layer.
  output: "standalone",
};

export default nextConfig;

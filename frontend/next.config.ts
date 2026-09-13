import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 'standalone' bundles a minimal server.js suitable for Docker production images.
  output: "standalone",
};

export default nextConfig;

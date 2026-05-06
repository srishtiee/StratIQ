import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@stratiq/shared"],
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;

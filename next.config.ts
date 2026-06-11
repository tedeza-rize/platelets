import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: ["127.0.0.1"],
  devIndicators: false,
  reactCompiler: true,
  serverExternalPackages: ["sqlite3"],
};

export default nextConfig;

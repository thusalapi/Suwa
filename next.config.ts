import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-hosted on the clinic PC: build a standalone Node server (no Vercel/serverless).
  output: "standalone",
  reactStrictMode: true,
  // @react-pdf/renderer is a native-ish Node lib; keep it out of the bundler so PDF
  // generation works in the standalone server.
  serverExternalPackages: ["@react-pdf/renderer"],
};

export default nextConfig;

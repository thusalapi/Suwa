import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-hosted on the clinic PC: build a standalone Node server (no Vercel/serverless).
  output: "standalone",
  reactStrictMode: true,
};

export default nextConfig;

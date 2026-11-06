import type { NextConfig } from "next";

// NEXT_PUBLIC_DEMO_MODE=1 builds a static, mock-data demo for GitHub Pages.
const demo = process.env.NEXT_PUBLIC_DEMO_MODE === "1";

const nextConfig: NextConfig = demo
  ? { output: "export", basePath: "/voice-ai-dashboard", images: { unoptimized: true } }
  : {};

export default nextConfig;

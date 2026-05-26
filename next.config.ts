import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "192.168.100.200"],
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;

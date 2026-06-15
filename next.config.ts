import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "192.168.100.200"],
  turbopack: {
    root: process.cwd(),
  },
  async headers() {
    const homepageImageHeaders = [
      "/images/home-board-6p-beginner-seer.webp",
      "/images/home-board-9p-seer-witch-hunter.webp",
      "/images/home-board-12p-standard-sheriff.webp",
      "/images/home-board-12p-white-wolf-king-knight.webp",
      "/images/homepage-table-preview-bg.webp",
      "/images/werewolf-table-bg.jpg",
    ];

    return homepageImageHeaders.map((source) => ({
      source,
      headers: [
        {
          key: "Cache-Control",
          value: "public, max-age=604800, stale-while-revalidate=86400",
        },
      ],
    }));
  },
};

export default nextConfig;

import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  webpack: (config) => {
    // Fix tailwindcss resolution: ensure modules resolve from project root
    // (avoids "Can't resolve 'tailwindcss'" when webpack uses wrong context)
    const projectNodeModules = path.resolve(process.cwd(), "node_modules");
    config.resolve = config.resolve ?? {};
    config.resolve.modules = [
      projectNodeModules,
      ...(Array.isArray(config.resolve.modules) ? config.resolve.modules : ["node_modules"]),
    ];
    return config;
  },
};

export default nextConfig;

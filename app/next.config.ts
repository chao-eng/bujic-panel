import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {
    // 固定工作区根目录，避免因上级目录存在 pnpm-lock.yaml / pnpm-workspace.yaml
    // 而被推断为错误的根目录，导致外部模块（@prisma/client 等）解析失败
    root: path.resolve(__dirname),
  },
};

export default nextConfig;

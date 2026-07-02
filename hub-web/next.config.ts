import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  transpilePackages: ['graph-ui'],
  serverExternalPackages: ['@colbymchenry/codegraph', 'tree-sitter-wasms'],
};

export default nextConfig;

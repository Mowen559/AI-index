import type { NextConfig } from "next";
import path from "path";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n.ts');

const workspaceRoot = path.resolve(__dirname, "..");

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  transpilePackages: ['graph-ui'],
  serverExternalPackages: ['@colbymchenry/codegraph', 'tree-sitter-wasms'],
  outputFileTracingRoot: workspaceRoot,
  outputFileTracingIncludes: {
    '/**': ['./src/locales/**/*'],
  },
  turbopack: {
    root: workspaceRoot,
  },
};

export default withNextIntl(nextConfig);

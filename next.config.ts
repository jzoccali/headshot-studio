import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // sharp ships native binaries (libvips) that must not be bundled and must be
  // traced into the serverless function output, or it fails at runtime on Vercel
  // with ERR_DLOPEN_FAILED.
  serverExternalPackages: ['sharp'],
  outputFileTracingIncludes: {
    '/api/generate': ['./node_modules/@img/**/*'],
  },
};

export default nextConfig;

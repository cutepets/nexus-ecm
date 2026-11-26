import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@nexus/shared'],
  images: {
    remotePatterns: [
      {
        protocol: process.env.MINIO_USE_SSL === 'true' ? 'https' : 'http',
        hostname: process.env.MINIO_ENDPOINT ?? 'localhost',
        port: process.env.MINIO_PORT ?? '9000',
        pathname: '/**',
      },
    ],
  },
  // C:\Dev2 contains unrelated workspaces and lockfiles. Keep production
  // tracing constrained to this application repository.
  outputFileTracingRoot: path.join(__dirname, '../..'),
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  async rewrites() {
    return [
      {
        source: '/backend/:path*',
        destination: `${process.env.API_URL ?? 'http://localhost:4100'}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;

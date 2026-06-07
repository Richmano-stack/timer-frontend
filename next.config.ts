import path from 'path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  turbopack: {
    root: path.resolve(process.cwd()),
  },
  allowedDevOrigins: ['192.168.183.71'],
}

export default nextConfig;
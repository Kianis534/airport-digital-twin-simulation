/** @type {import('next').NextConfig} */

// NEXT_OUTPUT=export builds a fully static site (used for the GitHub Pages demo).
// NEXT_PUBLIC_BASE_PATH serves it from a sub-path, e.g. /airport-digital-twin-simulation.
const isStaticExport = process.env.NEXT_OUTPUT === 'export';
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['three'],
  ...(basePath ? { basePath } : {}),
  ...(isStaticExport
    ? {
        output: 'export',
        trailingSlash: true,
        images: { unoptimized: true },
      }
    : {}),
};

module.exports = nextConfig;

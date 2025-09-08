/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@rcrt-builder/core',
    '@rcrt-builder/sdk',
    '@rcrt-builder/ui',
    '@rcrt-builder/management',
    '@rcrt-builder/heroui-breadcrumbs'
  ],
  env: {
    NEXT_PUBLIC_RCRT_URL: process.env.RCRT_URL || 'http://localhost:8081',
    NEXT_PUBLIC_OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || ''
  },
  async rewrites() {
    return [
      {
        source: '/rcrt/:path*',
        destination: '/api/rcrt/:path*'
      }
    ];
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': __dirname
    };
    return config;
  }
};

module.exports = nextConfig;

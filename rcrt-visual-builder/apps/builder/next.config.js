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
  webpack: (config, { isServer, dev }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': __dirname
    };
    
    // Fix webpack WasmHash issues in dev mode
    if (dev && isServer) {
      // Keep layers enabled but disable other problematic features
      config.experiments = {
        ...config.experiments,
        asyncWebAssembly: false,
        layers: true,  // Keep this enabled as Next.js requires it
        lazyCompilation: false,
      };
      
      // Disable webpack cache in dev to prevent hash corruption
      config.cache = false;
      
      // Simplify optimization to reduce hash computation
      config.optimization = {
        ...config.optimization,
        moduleIds: 'named',
        chunkIds: 'named',
      };
    }
    
    return config;
  }
};

module.exports = nextConfig;

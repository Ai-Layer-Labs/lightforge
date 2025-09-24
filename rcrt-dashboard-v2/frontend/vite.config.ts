import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  
  // Development server configuration
  server: {
    port: 5173,
    host: true, // Allow external connections
    cors: true, // Enable CORS for all origins
    proxy: {
      // Proxy all API requests to the existing RCRT server
      '/api': {
        target: 'http://127.0.0.1:8081',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace('/api', ''),
        configure: (proxy, _options) => {
          proxy.on('error', (err, req, res) => {
            console.log('🚨 API proxy error:', err);
            console.log('Failed URL:', req.url);
            console.log('Error details:', err.message);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('📡 API request to RCRT:', req.method, req.url);
            console.log('Target:', proxyReq.protocol + '//' + proxyReq.host + ':' + proxyReq.port + proxyReq.path);
            console.log('Headers:', proxyReq.getHeaders());
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('✅ API response from RCRT:', proxyRes.statusCode, req.url);
            console.log('Response headers:', proxyRes.headers);
          });
        },
      },
      // Proxy SSE events stream with special handling
      '/events': {
        target: 'http://127.0.0.1:8081',
        changeOrigin: true,
        secure: false,
        ws: true,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('🚨 SSE proxy error:', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('📡 SSE request to RCRT:', req.method, req.url);
            // Forward Authorization header if present in query params
            if (req.url?.includes('token=')) {
              const token = new URL(req.url, 'http://localhost').searchParams.get('token');
              if (token) {
                proxyReq.setHeader('Authorization', `Bearer ${token}`);
              }
            }
          });
        },
      },
      // Proxy health check (should go through /api like other endpoints)
      '/health': {
        target: 'http://127.0.0.1:8081',
        changeOrigin: true,
        secure: false,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('🚨 Health proxy error:', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('🏥 Health request to RCRT:', req.method, req.url);
          });
        },
      }
    }
  },
  
  // Build configuration
  build: {
    outDir: 'dist',
    sourcemap: true,
    // Optimize bundle
    rollupOptions: {
      output: {
        manualChunks: {
          // Separate vendor chunks for better caching
          'react-vendor': ['react', 'react-dom'],
          'three-vendor': ['three', '@react-three/fiber', '@react-three/drei'],
          'animation-vendor': ['framer-motion', 'react-spring'],
          'query-vendor': ['@tanstack/react-query']
        }
      }
    }
  },
  
  // Path resolution
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@components': resolve(__dirname, 'src/components'),
      '@stores': resolve(__dirname, 'src/stores'),
      '@hooks': resolve(__dirname, 'src/hooks'),
      '@types': resolve(__dirname, 'src/types'),
      '@utils': resolve(__dirname, 'src/utils')
    }
  },
  
  // Define global constants
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '2.0.0'),
    __RCRT_API_URL__: JSON.stringify(process.env.VITE_RCRT_API_URL || 'http://localhost:8080'),
  },
  
  // Optimize dependencies
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'three',
      '@react-three/fiber',
      '@react-three/drei',
      'framer-motion',
      'zustand',
      '@tanstack/react-query'
    ]
  }
})
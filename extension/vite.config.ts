import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { viteStaticCopy } from 'vite-plugin-static-copy'

export default defineConfig({
  base: './',
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        {
          src: 'manifest.json',
          dest: ''
        },
        {
          src: 'icons/*',
          dest: 'icons'
        },
        {
          src: 'public/buildDomTree.js',
          dest: ''
        },
        {
          src: 'src/sidepanel/index.html',
          dest: 'sidepanel'
        },
        {
          src: 'src/popup/index.html',
          dest: 'popup'
        }
      ]
    })
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
          rollupOptions: {
        input: {
          'popup/index': resolve(__dirname, 'src/popup/index.html'),
          'sidepanel/index': resolve(__dirname, 'src/sidepanel/index.html'),
          background: resolve(__dirname, 'src/background/index.js'),
        },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.includes('sidepanel')) {
            return 'sidepanel/[name].[ext]'
          }
          if (assetInfo.name?.includes('popup')) {
            return 'popup/[name].[ext]'
          }
          return '[name].[ext]'
        },
      },
    },
  },
  // Add dev server configuration
  server: {
    port: 5173,
    open: '/dev.html'
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
})
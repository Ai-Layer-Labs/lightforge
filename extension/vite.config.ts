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
        }
      ]
    })
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
          rollupOptions: {
        input: {
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
          return '[name].[ext]'
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
})
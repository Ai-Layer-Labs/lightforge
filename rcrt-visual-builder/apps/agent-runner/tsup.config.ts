import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: false, // Disable DTS generation temporarily
  clean: true,
  sourcemap: true,
  external: ['@rcrt-builder/sdk', '@rcrt-builder/runtime', '@rcrt-builder/core'],
  target: 'node18'
});

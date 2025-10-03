import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: false,
  sourcemap: true,
  clean: true,
  external: ['@rcrt-builder/sdk', '@rcrt-builder/tools', '@rcrt-builder/core']
});


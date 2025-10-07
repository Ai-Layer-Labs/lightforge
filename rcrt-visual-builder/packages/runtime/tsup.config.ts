import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: false,  // Skip DTS generation (workspace deps cause issues)
  splitting: false,
  sourcemap: true,
  clean: true,
  external: ['eventsource', '@rcrt-builder/sdk', '@rcrt-builder/core', '@rcrt-builder/node-sdk'],
});

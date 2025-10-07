import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: {
    resolve: true
  },
  splitting: false,
  sourcemap: true,
  clean: true,
  external: ['eventsource', '@rcrt-builder/sdk', '@rcrt-builder/core', '@rcrt-builder/node-sdk'],
});

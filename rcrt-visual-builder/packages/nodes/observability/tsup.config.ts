import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ['@rcrt-builder/core', '@rcrt-builder/node-sdk', '@rcrt-builder/sdk', 'langfuse'],
});

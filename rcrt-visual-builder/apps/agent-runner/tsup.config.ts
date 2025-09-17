import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  external: ['@rcrt-builder/sdk', '@rcrt-builder/agents'],
  target: 'node18'
});

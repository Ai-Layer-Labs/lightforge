import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  // Disable DTS in container builds to avoid rollup path resolution issues
  dts: process.env.TSUP_DTS === 'true',
  splitting: false,
  sourcemap: true,
  clean: true,
  external: [],
});

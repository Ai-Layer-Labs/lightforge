import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs'],
  dts: false,
  splitting: false,
  sourcemap: true,
  clean: true,
  external: ['langchain'],
  noExternal: ['dotenv', '@rcrt-builder/core', '@rcrt-builder/sdk', '@rcrt-builder/tools'],
  target: 'node18',
  // No shebang banner; we run with `node dist/index.js` in Docker
});

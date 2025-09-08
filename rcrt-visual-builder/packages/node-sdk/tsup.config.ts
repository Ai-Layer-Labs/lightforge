import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/registry.ts', 'src/helpers.ts', 'src/dev-server.ts', 'src/testing.ts'],
  format: ['cjs', 'esm'],
  dts: false,  // Disabled to get build working - TypeScript types can be added later
  splitting: false,
  sourcemap: true,
  clean: true,
  external: ['chokidar', 'fs', 'path'],
});

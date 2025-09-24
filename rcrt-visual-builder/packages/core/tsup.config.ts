import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  // Disable DTS temporarily due to build issues
  dts: false,
  splitting: false,
  sourcemap: true,
  clean: true,
  external: [],
});

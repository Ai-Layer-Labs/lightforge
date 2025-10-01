import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts'
  },
  format: ['cjs', 'esm'],
  // Disable DTS by default to avoid type resolution during Docker builds
  dts: process.env.TSUP_DTS === 'true',
  splitting: false,
  sourcemap: true,
  clean: true,
});

import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.tsx'],
  format: ['cjs', 'esm'],
  dts: false,  // Disabled to get build working - TypeScript types can be added later
  sourcemap: true,
  clean: true,
  external: ['react', 'react-dom', '@heroui/react', 'framer-motion'],
  esbuildOptions(options) {
    options.jsx = 'automatic';
  },
});

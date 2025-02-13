import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['cjs', 'esm'],
    target: 'node14',
    clean: true,
    minify: true,
    dts: true,
    outDir: 'dist',
  },
]);

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['**/*.{test,spec}.ts?(x)'],
    exclude: ['**/node_modules/**'],
    setupFiles: ['./src/__tests__/test-setup.ts'],
    silent: true,
    watch: false,
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
  },
});

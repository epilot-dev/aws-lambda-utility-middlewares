import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['**/*.{test,spec}.ts?(x)'],
    exclude: ['**/node_modules/**'],
    silent: false,
    watch: false,
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
  },
});

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: {
      DISABLE_RATE_LIMIT: 'true',
      DB_PATH: ':memory:',
      JWT_SECRET: 'test-secret-key-for-testing-only'
    },
    globals: true
  }
});

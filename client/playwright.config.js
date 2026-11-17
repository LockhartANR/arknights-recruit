import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  retries: 0,
  workers: 1,
  fullyParallel: false,
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
    viewport: { width: 1280, height: 720 },
    actionTimeout: 10000
  },
  webServer: [
    {
      command: 'node ../server/start-e2e.js',
      url: 'http://localhost:3000/api/auth/me',
      timeout: 10000,
      reuseExistingServer: false
    },
    {
      command: 'npm run dev',
      url: 'http://localhost:5173',
      timeout: 10000,
      reuseExistingServer: false
    }
  ]
});

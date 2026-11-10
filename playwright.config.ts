import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  retries: 0,
  use: {
    baseURL: process.env.CI ? 'http://localhost:3100' : 'http://localhost:3000',
    headless: true,
    viewport: { width: 1280, height: 800 },
  },
  webServer: process.env.CI
    ? {
        command: 'bun run next dev -p 3100',
        url: 'http://localhost:3100',
        reuseExistingServer: false,
        timeout: 120_000,
      }
    : undefined,
});

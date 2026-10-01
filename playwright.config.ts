import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  webServer: {
    command: 'npm run start',
    env: { DEMO_MODE: 'true' },
    port: 4000,
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
  },
  use: {
    baseURL: 'http://localhost:4000',
  }
});

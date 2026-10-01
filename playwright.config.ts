import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  webServer: {
    command: 'cross-env PORT=4001 npm run start',
    env: { DEMO_MODE: 'true', PORT: '4001' },
    port: 4001,
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
  },
  use: {
    baseURL: 'http://localhost:4001',
    launchOptions: {
      args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream']
    }
  }
});

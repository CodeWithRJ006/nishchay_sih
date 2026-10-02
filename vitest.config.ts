import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Web component tests (jsdom) are omitted to focus on full E2E coverage 
    // for the golden path and field flows via Playwright, rather than mocking browser APIs.
    // Each test file runs in its own worker thread/process in vitest, so the ':memory:' 
    // better-sqlite3 database instantiated in db/index.ts is isolated per test file automatically.
    include: ['server/tests/**/*.test.ts', 'shared/tests/**/*.test.ts'],
  }
});

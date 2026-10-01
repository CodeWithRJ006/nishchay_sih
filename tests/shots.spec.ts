import { test } from '@playwright/test';

const routes = [
  { path: '/', name: 'home' },
  { path: '/login', name: 'login' }
];

test.describe('Visual Screenshots Desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  for (const route of routes) {
    test(`Desktop screenshot for ${route.name}`, async ({ page }) => {
      await page.goto(`http://localhost:5173${route.path}`);
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: `docs/screens/${route.name}-desktop.png`, fullPage: true });
    });
  }
});

test.describe('Visual Screenshots Mobile', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  for (const route of routes) {
    test(`Mobile screenshot for ${route.name}`, async ({ page }) => {
      await page.goto(`http://localhost:5173${route.path}`);
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: `docs/screens/${route.name}-mobile.png`, fullPage: true });
    });
  }
});

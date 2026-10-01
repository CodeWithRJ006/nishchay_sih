import { test } from '@playwright/test';

const publicRoutes = [
  { path: '/', name: 'home' },
  { path: '/login', name: 'login' }
];

const authRoutes = [
  { path: '/dashboard/business-profile', name: 'business-profile' },
  { path: '/dashboard/instruments', name: 'instruments' },
  { path: '/dashboard/apply', name: 'application-wizard' }
];

test.describe('Visual Screenshots Desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  for (const route of publicRoutes) {
    test(`Desktop screenshot for ${route.name}`, async ({ page }) => {
      await page.goto(`${route.path}`);
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: `docs/screens/${route.name}-desktop.png`, fullPage: true });
    });
  }

  test('Authenticated desktop screenshots', async ({ page }) => {
    // login via demo route
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await page.click('text="Business"');
    await page.waitForURL('**/dashboard');
    
    for (const route of authRoutes) {
      await page.goto(`${route.path}`);
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: `docs/screens/${route.name}-desktop.png`, fullPage: true });
    }
  });
});

test.describe('Visual Screenshots Mobile', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  for (const route of publicRoutes) {
    test(`Mobile screenshot for ${route.name}`, async ({ page }) => {
      await page.goto(`${route.path}`);
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: `docs/screens/${route.name}-mobile.png`, fullPage: true });
    });
  }

  test('Authenticated mobile screenshots', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await page.click('text="Business"');
    await page.waitForURL('**/dashboard');
    
    for (const route of authRoutes) {
      await page.goto(`${route.path}`);
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: `docs/screens/${route.name}-mobile.png`, fullPage: true });
    }
  });

  test('Field mobile screenshots', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await page.click('text="LMO"');
    await page.waitForURL('**/dashboard');
    
    await page.goto('/field');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: `docs/screens/field-list-mobile.png`, fullPage: true });

    // Assuming LMO has at least one scheduled job, try to navigate to it.
    // Wait for the job card to appear and click the first one
    const jobCard = page.locator('.bg-white.p-4.rounded-lg.shadow').first();
    if (await jobCard.count() > 0) {
      await jobCard.click();
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: `docs/screens/field-detail-mobile.png`, fullPage: true });
    }
  });
});

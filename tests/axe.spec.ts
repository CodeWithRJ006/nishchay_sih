import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('A11y checks', () => {
  test('Home page should not have any automatically detectable accessibility issues', async ({ page }) => {
    await page.goto('/');
    
    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
    
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Portal shell should not have any automatically detectable accessibility issues', async ({ page }) => {
    await page.goto('/login');
    
    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
    
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Home page should not have horizontal scroll at 360px', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });

    expect(hasHorizontalOverflow).toBe(false);
  });

  test('Home page sample copy button and check button work', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Click first Copy button
    const copyButton = page.locator('button[aria-label^="Copy certificate code"]').first();
    await copyButton.click();

    // Check toast appears
    const toast = page.locator('text=Copied');
    await expect(toast).toBeVisible();

    // Click Check button on the valid sample
    const checkButton = page.locator('button[aria-label^="Check sample certificate"]').first();
    await checkButton.click();

    await page.waitForURL('**/v/sample-cert-val1d-0000');
    expect(page.url()).toContain('/v/sample-cert-val1d-0000');
  });
});


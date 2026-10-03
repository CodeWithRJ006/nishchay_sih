import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('A11y checks', () => {
  test('Home page should not have any automatically detectable accessibility issues', async ({ page }) => {
    await page.goto('http://localhost:4000/');
    
    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
    
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Portal shell should not have any automatically detectable accessibility issues', async ({ page }) => {
    await page.goto('http://localhost:4000/login');
    
    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
    
    expect(accessibilityScanResults.violations).toEqual([]);
  });
});

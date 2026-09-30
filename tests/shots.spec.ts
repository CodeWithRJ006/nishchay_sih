import { test } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const SCREENS_DIR = path.join(process.cwd(), 'docs', 'screens');

test('Take screenshots', async ({ page }) => {
  if (!fs.existsSync(SCREENS_DIR)) {
    fs.mkdirSync(SCREENS_DIR, { recursive: true });
  }

  // Desktop
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://localhost:4000');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(SCREENS_DIR, 'home-desktop.png') });

  // Mobile
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: path.join(SCREENS_DIR, 'home-mobile.png') });
});

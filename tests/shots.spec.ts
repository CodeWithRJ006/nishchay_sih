import { test, expect, Page } from '@playwright/test';

interface PageMonitor {
  assertClean: () => void;
}

function setupPageMonitors(page: Page): PageMonitor {
  const errors: string[] = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(`Console error: ${msg.text()}`);
    }
  });

  page.on('pageerror', err => {
    errors.push(`Page error: ${err.message}`);
  });

  page.on('dialog', dialog => {
    errors.push(`Native dialog detected: ${dialog.type()} "${dialog.message()}"`);
    dialog.dismiss().catch(() => {});
  });

  page.on('response', res => {
    if (res.status() >= 400 && res.url().includes('/api/')) {
      errors.push(`API failure ${res.status()} on ${res.url()}`);
    }
  });

  return {
    assertClean() {
      if (errors.length > 0) {
        throw new Error(`Audit failures:\n${errors.join('\n')}`);
      }
    }
  };
}

async function auditAndScreenshot(page: Page, screenshotPath: string, route: string, monitor: PageMonitor) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(400);

  // Verify no horizontal overflow
  const isOverflowing = await page.evaluate(() => {
    const docWidth = document.documentElement.scrollWidth;
    const bodyWidth = document.body.scrollWidth;
    const winWidth = window.innerWidth;
    return docWidth > winWidth + 1 || bodyWidth > winWidth + 1;
  });
  expect(isOverflowing, `Horizontal overflow detected on ${route}`).toBe(false);

  // Verify no visible text element has font-size under 14px
  const under14Elements = await page.evaluate(() => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
    const violations: { tag: string; text: string; fontSize: number }[] = [];
    while (walker.nextNode()) {
      const el = walker.currentNode as HTMLElement;
      if (!el || !el.innerText || !el.innerText.trim()) continue;
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;

      let hasDirectText = false;
      for (let i = 0; i < el.childNodes.length; i++) {
        if (el.childNodes[i].nodeType === Node.TEXT_NODE && el.childNodes[i].nodeValue?.trim()) {
          hasDirectText = true;
          break;
        }
      }
      if (hasDirectText) {
        const fontSize = parseFloat(style.fontSize);
        if (fontSize < 13.5) {
          violations.push({ tag: el.tagName, text: el.innerText.trim().slice(0, 30), fontSize });
        }
      }
    }
    return violations;
  });
  expect(under14Elements, `Text under 14px found on ${route}`).toHaveLength(0);

  // Verify no placeholder text remains ("goes here", "Lorem", "TODO")
  const placeholderViolations = await page.evaluate(() => {
    const content = document.body.innerText || '';
    const matches: string[] = [];
    if (/goes\s+here/i.test(content)) matches.push('goes here');
    if (/lorem\s+ipsum/i.test(content) || /\blorem\b/i.test(content)) matches.push('Lorem');
    if (/\bTODO\b/.test(content)) matches.push('TODO');
    return matches;
  });
  expect(placeholderViolations, `Placeholder text detected on ${route}`).toHaveLength(0);

  // Assert no monitored console or 4xx/5xx network errors
  monitor.assertClean();

  // Save full-page screenshot
  await page.screenshot({ path: screenshotPath, fullPage: true });
}

const publicRoutes = [
  { path: '/', name: 'home' },
  { path: '/login', name: 'login' },
  { path: '/v/sample-cert-val1d-0000', name: 'public-verify-valid', delay: 1800 },
  { path: '/v/sample-cert-exp1red-00', name: 'public-verify-expired', delay: 1800 },
  { path: '/v/sample-cert-rev0ked-00', name: 'public-verify-revoked', delay: 1800 }
];

const roleRoutes = {
  BUSINESS: [
    { path: '/dashboard', name: 'business-dashboard' },
    { path: '/dashboard/applications', name: 'business-applications' },
    { path: '/dashboard/instruments', name: 'business-instruments' },
    { path: '/dashboard/apply', name: 'business-apply' },
    { path: '/dashboard/profile', name: 'business-profile' },
    { path: '/dashboard/search', name: 'business-search' },
  ],
  LMO: [
    { path: '/dashboard', name: 'lmo-dashboard' },
    { path: '/dashboard/my-jobs', name: 'lmo-my-jobs' },
    { path: '/dashboard/profile', name: 'lmo-profile' },
    { path: '/dashboard/search', name: 'lmo-search' },
    { path: '/field', name: 'lmo-field' },
    { path: '/field/job/NSH-A-2026-000009', name: 'lmo-field-job-detail' },
    { path: '/field/job/NSH-A-2026-000009/inspection', name: 'lmo-field-job-inspection' },
  ],
  GATC: [
    { path: '/dashboard', name: 'gatc-dashboard' },
    { path: '/dashboard/my-jobs', name: 'gatc-my-jobs' },
    { path: '/dashboard/profile', name: 'gatc-profile' },
    { path: '/dashboard/search', name: 'gatc-search' },
    { path: '/field', name: 'gatc-field' },
  ],
  ADMIN: [
    { path: '/dashboard', name: 'admin-dashboard' },
    { path: '/dashboard/applications', name: 'admin-applications' },
    { path: '/dashboard/unassigned', name: 'admin-unassigned' },
    { path: '/dashboard/finance', name: 'admin-finance' },
    { path: '/dashboard/complaints', name: 'admin-complaints' },
    { path: '/dashboard/certificates', name: 'admin-certificates' },
    { path: '/dashboard/provision', name: 'admin-provision' },
    { path: '/dashboard/search', name: 'admin-search' },
  ]
};

test.describe('Visual Screenshots & Audit Desktop (1440x900)', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
  });

  for (const route of publicRoutes) {
    test(`Desktop: ${route.name}`, async ({ page }) => {
      test.setTimeout(60000);
      const monitor = setupPageMonitors(page);
      await page.goto(route.path);
      if (route.delay) await page.waitForTimeout(route.delay);
      await auditAndScreenshot(page, `docs/screens/${route.name}-desktop.png`, route.path, monitor);
    });
  }

  for (const [role, routes] of Object.entries(roleRoutes)) {
    test(`Desktop: All routes for ${role}`, async ({ page }) => {
      test.setTimeout(120000);
      const monitor = setupPageMonitors(page);
      await page.goto('/login');
      await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(400);
      await Promise.all([
        page.waitForResponse(res => res.url().includes(`/api/demo/login-as/${role.toUpperCase()}`) && res.status() === 200),
        page.click(`[data-testid="demo-login-${role.toLowerCase()}"]`)
      ]);
      await page.waitForURL('**/dashboard');
      await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(400);

      for (const route of routes) {
        await page.goto(route.path);
        await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(400);
        await auditAndScreenshot(page, `docs/screens/${route.name}-desktop.png`, route.path, monitor);
      }
    });
  }

  test('Desktop: Interactive Role Switcher Test', async ({ page }) => {
    test.setTimeout(60000);
    const monitor = setupPageMonitors(page);
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(400);
    await Promise.all([
      page.waitForResponse(res => res.url().includes('/api/demo/login-as/BUSINESS') && res.status() === 200),
      page.click('[data-testid="demo-login-business"]')
    ]);
    await page.waitForURL('**/dashboard');
    await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(400);

    // Switch to ADMIN using top bar dropdown
    await page.click('[data-testid="switch-role-button"]');
    await Promise.all([
      page.waitForResponse(res => res.url().includes('/api/demo/login-as/ADMIN') && res.status() === 200),
      page.click('[data-testid="switch-role-admin"]')
    ]);
    await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(400);
    await page.waitForTimeout(1000);
    await auditAndScreenshot(page, `docs/screens/role-switched-admin-desktop.png`, '/dashboard', monitor);
  });
});

test.describe('Visual Screenshots & Audit Mobile (390x844)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
  });

  for (const route of publicRoutes) {
    test(`Mobile: ${route.name}`, async ({ page }) => {
      test.setTimeout(60000);
      const monitor = setupPageMonitors(page);
      await page.goto(route.path);
      if (route.delay) await page.waitForTimeout(route.delay);
      await auditAndScreenshot(page, `docs/screens/${route.name}-mobile.png`, route.path, monitor);
    });
  }

  for (const [role, routes] of Object.entries(roleRoutes)) {
    test(`Mobile: All routes for ${role}`, async ({ page }) => {
      test.setTimeout(120000);
      const monitor = setupPageMonitors(page);
      await page.goto('/login');
      await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(400);
      await Promise.all([
        page.waitForResponse(res => res.url().includes(`/api/demo/login-as/${role.toUpperCase()}`) && res.status() === 200),
        page.click(`[data-testid="demo-login-${role.toLowerCase()}"]`)
      ]);
      await page.waitForURL('**/dashboard');
      await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(400);

      for (const route of routes) {
        await page.goto(route.path);
        await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(400);
        await auditAndScreenshot(page, `docs/screens/${route.name}-mobile.png`, route.path, monitor);
      }
    });
  }
});

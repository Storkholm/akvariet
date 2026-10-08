import { expect, test } from '@playwright/test';
import { PHONE, TABLET, waitForAquarium } from './helpers';

for (const [name, size] of [['tablet', TABLET], ['phone', PHONE]] as const) {
  test(`M0: scene renders without errors (${name})`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: size, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.goto('/');
    await waitForAquarium(page);
    await expect(page.locator('canvas.aquarium-canvas')).toBeVisible();
    expect(errors).toEqual([]);
    await ctx.close();
  });
}

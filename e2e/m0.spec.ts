import { expect, test } from '@playwright/test';
import { PHONE, TABLET, waitForAquarium } from './helpers';

for (const [name, size] of [['tablet', TABLET], ['phone', PHONE]] as const) {
  test(`M0: blue scene renders (${name})`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: size, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/');
    await waitForAquarium(page);
    await expect(page.locator('canvas.aquarium-canvas')).toBeVisible();
    await page.screenshot({ path: `docs/screenshots/M0-${name}.png` });
    expect(errors).toEqual([]);
    await ctx.close();
  });
}

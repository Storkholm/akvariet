import { expect, test } from '@playwright/test';
import { newTouchPage, openPanel, PHONE, TABLET, waitForAquarium } from './helpers';

// Without ?still: the real aquarium runs behind the picker and (blurred) behind the drawing panel.
for (const [name, size] of [['tablet', TABLET], ['ipad', { width: 1024, height: 768 }], ['phone', PHONE], ['phone-liggende', { width: 844, height: 390 }]] as const) {
  test(`M2: picker and panel over the live aquarium (${name})`, async ({ browser }) => {
    const { ctx, page, errors } = await newTouchPage(browser, size);
    await page.goto('/');
    await waitForAquarium(page);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `docs/screenshots/M2-${name}-0-vaelger.png` });
    await openPanel(page);
    await page.waitForTimeout(800);
    await page.screenshot({ path: `docs/screenshots/M2-${name}-1-tom.png` });
    expect(errors).toEqual([]);
    await ctx.close();
  });
}

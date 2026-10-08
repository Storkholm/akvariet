import { expect, test } from '@playwright/test';
import { drawingStats, line, newTouchPage, openPanel, PHONE, TABLET, tap, templateToScreen, touchDrag } from './helpers';

for (const [name, size] of [['tablet', TABLET], ['phone', PHONE]] as const) {
  test(`M2: colour a ray with touch (${name})`, async ({ browser }) => {
    const { ctx, page, cdp, errors } = await newTouchPage(browser, size);
    await page.goto('/?still');
    await page.waitForTimeout(800);

    await openPanel(page);
    await page.waitForTimeout(300);

    const at = await templateToScreen(page.locator('.canvas-wrap'));
    const crayon = (n: string) => page.getByRole('radio', { name: n, exact: true }).click();

    // Bucket: whole body dark green (tapping on the body, away from the eyes).
    await page.getByRole('button', { name: 'Fyld-spand' }).click();
    await crayon('Mørkegrøn');
    await tap(cdp, at(0.5, 0.45));
    await page.getByRole('button', { name: 'Fyld-spand' }).click(); // back to crayon

    // Yellow stripes that deliberately run past the outline.
    await crayon('Gul');
    await page.getByRole('radio', { name: 'Tyk', exact: true }).click();
    for (const x of [0.22, 0.34, 0.5, 0.66, 0.78]) {
      await touchDrag(cdp, line(at(x, 0.1), at(x, 0.82), 20));
    }

    // Some details in other colours, medium width.
    await page.getByRole('radio', { name: 'Mellem', exact: true }).click();
    await crayon('Rød');
    await touchDrag(cdp, [at(0.4, 0.3), at(0.45, 0.33), at(0.5, 0.31), at(0.55, 0.33), at(0.6, 0.3)]);
    await crayon('Turkis');
    await touchDrag(cdp, line(at(0.12, 0.38), at(0.3, 0.3), 12));
    await touchDrag(cdp, line(at(0.88, 0.38), at(0.7, 0.3), 12));
    await crayon('Lyserød');
    await page.getByRole('radio', { name: 'Tynd', exact: true }).click();
    await touchDrag(cdp, line(at(0.5, 0.78), at(0.5, 0.97), 10));

    // Nothing may ever exist outside the outline.
    const stats = await drawingStats(page);
    expect(stats.outsideFar).toBe(0);
    expect(stats.rim).toBeLessThan(8000); // only the 1px anti-aliased edge
    expect(stats.insideOpaque).toBeGreaterThan(stats.maskArea * 0.95);

    await page.waitForTimeout(200);
    await page.screenshot({ path: `docs/screenshots/M2-${name}-2-farvelagt.png` });
    expect(errors).toEqual([]);
    await ctx.close();
  });
}

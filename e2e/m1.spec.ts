import { expect, test } from '@playwright/test';
import { PHONE, TABLET, waitForAquarium } from './helpers';

for (const [name, size] of [['tablet', TABLET], ['phone', PHONE]] as const) {
  test(`M1: the aquarium looks alive (${name})`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: size, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.goto('/');
    await waitForAquarium(page);
    await page.waitForTimeout(1500);
    const a = await page.screenshot();
    await page.waitForTimeout(1200);
    const b = await page.screenshot({ path: `docs/screenshots/M1-${name}.png` });
    // Background life and plants move: two frames a moment apart must differ.
    expect(Buffer.compare(a, b)).not.toBe(0);
    // Few draw calls keep the aquarium cheap enough to run behind the drawing panel (DESIGN 4.4).
    const info = await page.evaluate(() => {
      const r = (window as unknown as { aquarium: { renderer: { info: { render: { calls: number; triangles: number } } } } }).aquarium.renderer.info.render;
      return { calls: r.calls, triangles: r.triangles };
    });
    console.log(`M1 ${name}: ${info.calls} draw calls, ${info.triangles} triangles`);
    expect(info.calls).toBeLessThan(40);
    expect(errors).toEqual([]);
    await ctx.close();
  });
}

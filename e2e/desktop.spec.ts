import { expect, test } from '@playwright/test';

type Pg = import('@playwright/test').Page;
type W = {
  aquarium: { advance(s: number): void; rig: { x: number; y: number; zoom: number }; pickerBubbles: { scroll: { x: number; nearest(): number } } };
};
const adv = (page: Pg, s: number) => page.evaluate((x) => (window as unknown as W).aquarium.advance(x), s);
const rig = (page: Pg) => page.evaluate(() => ({ ...(window as unknown as W).aquarium.rig }));
const scrollX = (page: Pg) => page.evaluate(() => (window as unknown as W).aquarium.pickerBubbles.scroll.x);

async function desktop(browser: import('@playwright/test').Browser) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/?still');
  await page.evaluate(() => (window as unknown as { app: { restored: Promise<void> } }).app.restored);
  await adv(page, 2);
  return { ctx, page, errors };
}

test.describe('ADR 0013: computer – mus og tastatur', () => {
  test('pile ved karrusellen og musehjulet ruller artsrækken', async ({ browser }) => {
    const { ctx, page, errors } = await desktop(browser);
    const prev = page.getByRole('button', { name: 'Forrige dyr' });
    const next = page.getByRole('button', { name: 'Næste dyr' });
    await expect(next).toBeVisible();
    await expect(prev).toBeDisabled();
    await page.screenshot({ path: 'docs/screenshots/desktop-1-karrusel-med-pile.png' });
    expect(await scrollX(page)).toBe(0);
    await next.click();
    await adv(page, 1);
    const one = await scrollX(page);
    expect(one).toBeGreaterThan(50);
    await expect(prev).toBeEnabled();
    // The wheel over the row: one bubble per notch.
    await page.mouse.move(640, 300);
    await page.mouse.wheel(0, 120);
    await adv(page, 1);
    expect(await scrollX(page)).toBeGreaterThan(one + 50);
    await page.waitForTimeout(300); // (one step per swipe: a trackpad's string of small events is one step)
    await page.mouse.wheel(0, -120);
    await adv(page, 1);
    expect(await scrollX(page)).toBeLessThan(one + 50);
    // The end of the row: next is disabled there.
    for (let i = 0; i < 6; i++) {
      if (await next.isEnabled()) await next.click();
      await adv(page, 1);
    }
    await expect(next).toBeDisabled();
    expect(errors).toEqual([]);
    await ctx.close();
  });

  test('piletasterne: ← → ruller artsrækken, mens den er fremme; ellers flytter de kameraet; + − zoomer', async ({ browser }) => {
    const { ctx, page, errors } = await desktop(browser);
    await page.mouse.move(640, 60); // (no focus on a button)
    await page.keyboard.press('ArrowRight');
    await adv(page, 1);
    expect(await scrollX(page)).toBeGreaterThan(50);
    expect((await rig(page)).x).toBe(0);
    // With the row folded away (the "Kig" button) the arrows move the camera.
    await page.getByRole('button', { name: 'Kig' }).click();
    await adv(page, 3);
    await page.keyboard.down('ArrowRight');
    await adv(page, 1.2);
    await page.keyboard.up('ArrowRight');
    await adv(page, 1);
    const right = (await rig(page)).x;
    expect(right).toBeGreaterThan(3);
    await page.keyboard.down('a');
    await adv(page, 1.2);
    await page.keyboard.up('a');
    await adv(page, 1);
    expect((await rig(page)).x).toBeLessThan(right);
    await page.keyboard.down('+');
    await adv(page, 1.5);
    await page.keyboard.up('+');
    await adv(page, 1);
    expect((await rig(page)).zoom).toBeGreaterThan(1.5);
    await page.keyboard.press('Home');
    await adv(page, 3);
    const home = await rig(page);
    expect(home.x).toBeCloseTo(0, 1);
    expect(home.zoom).toBeCloseTo(1, 1);
    await page.screenshot({ path: 'docs/screenshots/desktop-2-kig-tastatur.png' });
    expect(errors).toEqual([]);
    await ctx.close();
  });

  test('tasterne gør ingenting, mens tegnefladen er åben', async ({ browser }) => {
    const { ctx, page, errors } = await desktop(browser);
    await page.getByRole('button', { name: 'Rokke' }).click({ force: true });
    await page.locator('.panel.open').waitFor();
    await adv(page, 1);
    await page.keyboard.down('ArrowRight');
    await adv(page, 1.5);
    await page.keyboard.up('ArrowRight');
    expect((await rig(page)).x).toBe(0);
    expect(errors).toEqual([]);
    await ctx.close();
  });
});

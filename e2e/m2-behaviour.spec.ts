import { expect, test } from '@playwright/test';
import { drawingStats, line, newTouchPage, openPanel, pixelAt, TABLET, tap, templateToScreen, touchDrag } from './helpers';

const BASE = [241, 244, 246, 255];

async function setup(browser: import('@playwright/test').Browser) {
  const t = await newTouchPage(browser, TABLET);
  await t.page.goto('/?still');
  await openPanel(t.page);
  const at = await templateToScreen(t.page.locator('.canvas-wrap'));
  const radio = (n: string) => t.page.getByRole('radio', { name: n, exact: true }).click();
  const button = (n: string) => t.page.getByRole('button', { name: n, exact: true });
  return { ...t, at, radio, button };
}

const near = (a: number[], b: number[], tol = 12) => a.every((v, i) => Math.abs(v - b[i]) <= tol);

test('fortryd: at least 20 steps, back to the blank template', async ({ browser }) => {
  const { ctx, page, cdp, at, radio, button } = await setup(browser);
  await radio('Rød');
  // 24 small marks spread over the body (all inside the outline).
  const spots: Array<[number, number]> = [];
  for (let i = 0; i < 24; i++) spots.push([0.34 + (i % 6) * 0.06, 0.22 + Math.floor(i / 6) * 0.035]);
  for (const [x, y] of spots) await touchDrag(cdp, line(at(x, y), at(x + 0.02, y), 3));
  expect(near(await pixelAt(page, spots[0][0] + 0.01, spots[0][1]), [232, 51, 42, 255], 60)).toBe(true);
  await expect(button('Fortryd')).toBeEnabled();
  for (let i = 0; i < 24; i++) await button('Fortryd').click();
  // 30 steps are kept, so all 24 marks are gone again.
  for (const [x, y] of spots) expect(await pixelAt(page, x + 0.01, y)).toEqual(BASE);
  await expect(button('Fortryd')).toBeDisabled();
  await ctx.close();
});

test('klip ved omrids: strokes and fills never colour outside the figure', async ({ browser }) => {
  const { ctx, page, cdp, at, radio, button } = await setup(browser);
  await radio('Mørkeblå');
  await radio('Tyk');
  // Scribble way across the whole screen, including the corners far outside the ray.
  await touchDrag(cdp, line(at(-0.2, 0.02), at(1.2, 0.98), 40));
  await touchDrag(cdp, line(at(1.1, 0.05), at(-0.1, 0.9), 40));
  await button('Fyld-spand').click();
  await radio('Orange');
  await tap(cdp, at(0.05, 0.05)); // outside the figure: nothing happens
  await tap(cdp, at(0.5, 0.2)); // inside: fills, but only inside
  const stats = await drawingStats(page);
  expect(stats.outsideFar).toBe(0);
  expect(await pixelAt(page, 0.05, 0.05)).toEqual([0, 0, 0, 0]);
  await ctx.close();
});

test('fyld-spand stops at strokes; viskelæder paints the base colour back', async ({ browser }) => {
  const { ctx, page, cdp, at, radio, button } = await setup(browser);
  // A thick black wall straight through the body.
  await radio('Sort');
  await radio('Tyk');
  await touchDrag(cdp, line(at(0.5, 0.05), at(0.5, 0.85), 24));
  await button('Fyld-spand').click();
  await radio('Rød');
  await tap(cdp, at(0.3, 0.3));
  expect(near(await pixelAt(page, 0.3, 0.3), [232, 51, 42, 255], 14)).toBe(true);
  expect(near(await pixelAt(page, 0.7, 0.3), BASE, 2)).toBe(true); // other side untouched
  expect(near(await pixelAt(page, 0.5, 0.3), [34, 34, 38, 255], 60)).toBe(true); // wall intact

  // Eraser removes part of the wall again.
  await button('Fyld-spand').click(); // bucket off
  await button('Viskelæder').click();
  await touchDrag(cdp, line(at(0.5, 0.25), at(0.5, 0.35), 8));
  expect(near(await pixelAt(page, 0.5, 0.3), BASE, 2)).toBe(true);
  await ctx.close();
});

test('only one finger draws; a second finger is ignored', async ({ browser }) => {
  const { ctx, page, cdp, at, radio } = await setup(browser);
  await radio('Lilla');
  await radio('Tyk');
  // Finger 1 draws a line along y=0.3; finger 2 rests at (0.65, 0.3) on the same wing.
  await touchDrag(cdp, line(at(0.3, 0.3), at(0.45, 0.3), 10), at(0.65, 0.3));
  expect(near(await pixelAt(page, 0.38, 0.3), [138, 69, 198, 255], 70)).toBe(true);
  expect(near(await pixelAt(page, 0.65, 0.3), BASE, 2)).toBe(true);
  await ctx.close();
});

test('mouse works too', async ({ browser }) => {
  const { ctx, page, at, radio } = await setup(browser);
  await radio('Turkis');
  const [x0, y0] = at(0.35, 0.3);
  const [x1, y1] = at(0.65, 0.3);
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  await page.mouse.move((x0 + x1) / 2, y0 + 30, { steps: 8 });
  await page.mouse.move(x1, y1, { steps: 8 });
  await page.mouse.up();
  expect(near(await pixelAt(page, 0.5, 0.3), [25, 191, 176, 255], 70)).toBe(false); // line bends away from y=0.3 …
  const stats = await drawingStats(page);
  expect(stats.outsideFar).toBe(0);
  expect(await page.evaluate(() => (window as unknown as { app: { panel: { currentDrawing: { canUndo: boolean } } } }).app.panel.currentDrawing.canUndo)).toBe(true);
  await ctx.close();
});

test('hjem: asks before throwing a drawing away', async ({ browser }) => {
  const { ctx, page, cdp, at, radio, button } = await setup(browser);
  // Nothing drawn: straight back.
  await button('Hjem').click();
  await expect(page.getByRole('button', { name: 'Rokke' })).toBeVisible();
  await openPanel(page);
  const at2 = await templateToScreen(page.locator('.canvas-wrap'));
  await radio('Gul');
  await touchDrag(cdp, line(at2(0.4, 0.3), at2(0.6, 0.3), 6));
  void at;
  await button('Hjem').click();
  await expect(page.getByText('Smid tegningen væk?')).toBeVisible();
  await button('Nej').click();
  await expect(page.getByText('Smid tegningen væk?')).toBeHidden();
  await expect(page.locator('.panel.open')).toBeVisible();
  await button('Hjem').click();
  await button('Ja').click();
  await expect(page.getByRole('button', { name: 'Rokke' })).toBeVisible();
  await expect(page.locator('.panel')).toBeHidden();
  await ctx.close();
});

test('slip løs hands the drawing on and returns to the picker', async ({ browser }) => {
  const { ctx, page, cdp, at, radio, button } = await setup(browser);
  await radio('Rød');
  await touchDrag(cdp, line(at(0.4, 0.3), at(0.6, 0.3), 6));
  await page.getByRole('button', { name: 'Slip løs' }).click();
  // M3: the picker returns once the creature has swum off (transition clock, advanced by hand here).
  await page.evaluate(() => (window as unknown as { aquarium: { advance(s: number): void } }).aquarium.advance(2.5));
  await expect(page.getByRole('button', { name: 'Rokke' })).toBeVisible();
  const info = await page.evaluate(async () => {
    const r = (window as unknown as { app: { lastRelease: { species: string; drawing: { toBlob(n: number): Promise<Blob> } } | null } }).app.lastRelease;
    if (!r) return null;
    const blob = await r.drawing.toBlob(512);
    const bmp = await createImageBitmap(blob);
    return { species: r.species, type: blob.type, w: bmp.width, h: bmp.height };
  });
  expect(info).toEqual({ species: 'ray', type: 'image/png', w: 512, h: 512 });
  void button;
  await ctx.close();
});

test('touch targets are at least 48 px', async ({ browser }) => {
  for (const size of [{ width: 1180, height: 820 }, { width: 1024, height: 768 }, { width: 390, height: 844 }, { width: 360, height: 740 }]) {
    const t = await newTouchPage(browser, size);
    await t.page.goto('/?still');
    await openPanel(t.page);
    const boxes = await t.page.locator('.panel button:visible').evaluateAll((els) =>
      els.map((e) => ({ label: e.getAttribute('aria-label') ?? e.textContent ?? '', ...(({ width, height, left, right, top, bottom }) => ({ width, height, left, right, top, bottom }))(e.getBoundingClientRect()) })),
    );
    for (const b of boxes) {
      expect(b.width, `${b.label} width @${size.width}`).toBeGreaterThanOrEqual(47.5);
      expect(b.height, `${b.label} height @${size.width}`).toBeGreaterThanOrEqual(47.5);
      expect(b.left, `${b.label} inside screen @${size.width}`).toBeGreaterThanOrEqual(-0.5);
      expect(b.right, `${b.label} inside screen @${size.width}`).toBeLessThanOrEqual(size.width + 0.5);
    }
    expect(boxes.length).toBeGreaterThanOrEqual(19); // 12 crayons + 2 + 3 + eraser/bucket... + release
    await t.ctx.close();
  }
});

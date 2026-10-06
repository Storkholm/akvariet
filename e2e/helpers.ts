import type { Page } from '@playwright/test';

export const TABLET = { width: 1180, height: 820 };
export const PHONE = { width: 390, height: 844 };

/** Wait until the Three.js aquarium has rendered a few frames. */
export async function waitForAquarium(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const a = (window as unknown as { aquarium?: { time: number } }).aquarium;
      return !!a && a.time > 0.3;
    },
    undefined,
    { timeout: 30_000 },
  );
}

import type { BrowserContext, CDPSession, Locator } from '@playwright/test';

export type Pt = [number, number];

export async function newTouchPage(browser: import('@playwright/test').Browser, size: { width: number; height: number }, dpr = 1) {
  const ctx: BrowserContext = await browser.newContext({ viewport: size, hasTouch: true, isMobile: true, deviceScaleFactor: dpr });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const cdp = await ctx.newCDPSession(page);
  return { ctx, page, cdp, errors };
}

/** Real touch drag through CDP (generates touch pointer events). */
export async function touchDrag(cdp: CDPSession, pts: Pt[], extraFinger?: Pt): Promise<void> {
  const tp = (p: Pt, id = 0) => ({ x: p[0], y: p[1], id });
  const withExtra = (p: Pt) => (extraFinger ? [tp(p), tp(extraFinger, 1)] : [tp(p)]);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: withExtra(pts[0]) });
  for (const p of pts.slice(1)) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: withExtra(p) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

export async function tap(cdp: CDPSession, p: Pt): Promise<void> {
  await touchDrag(cdp, [p]);
}

/** Interpolated straight line, so a "fast" drag still has intermediate events. */
export function line(a: Pt, b: Pt, steps = 14): Pt[] {
  return Array.from({ length: steps + 1 }, (_, i) => [a[0] + ((b[0] - a[0]) * i) / steps, a[1] + ((b[1] - a[1]) * i) / steps] as Pt);
}

/** Maps template coordinates (0–1) to screen pixels using the canvas box. */
export async function templateToScreen(canvasWrap: Locator): Promise<(x: number, y: number) => Pt> {
  const box = await canvasWrap.boundingBox();
  if (!box) throw new Error('canvas not visible');
  return (x, y) => [box.x + x * box.width, box.y + y * box.height];
}

export async function openPanel(page: import('@playwright/test').Page): Promise<void> {
  await page.getByRole('button', { name: 'Rokke' }).click({ force: true }); // the bubble bobs forever, so it is never "stable"
  await page.locator('.panel.open').waitFor();
  // Headless Chromium only advances CSS transitions when frames are produced, so poll (rAF) until the slide-in has settled.
  await page.waitForFunction(() => document.querySelector('.panel')?.getBoundingClientRect().y === 0);
}

/** Pixel stats of the current drawing, read straight from the canvas. */
export async function drawingStats(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const d = (window as unknown as { app: { panel: { currentDrawing: { canvas: HTMLCanvasElement; mask: Uint8Array } } } }).app.panel.currentDrawing;
    const ctx = d.canvas.getContext('2d') as CanvasRenderingContext2D;
    const img = ctx.getImageData(0, 0, 1024, 1024).data;
    let outside = 0; // coloured pixels farther than the 1px anti-aliasing rim from the figure
    let rim = 0;
    let inside = 0;
    const inMask = (x: number, y: number) => x >= 0 && y >= 0 && x < 1024 && y < 1024 && d.mask[y * 1024 + x] !== 0;
    for (let y = 0; y < 1024; y++) {
      for (let x = 0; x < 1024; x++) {
        const i = y * 1024 + x;
        const a = img[i * 4 + 3];
        if (d.mask[i]) { if (a > 250) inside++; continue; }
        if (a === 0) continue;
        let near = false;
        for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++) if (inMask(x + dx, y + dy)) { near = true; break; }
        if (near) rim++; else outside++;
      }
    }
    return { outsideFar: outside, rim, insideOpaque: inside, maskArea: d.mask.reduce((s, v) => s + (v ? 1 : 0), 0) };
  });
}

export async function pixelAt(page: import('@playwright/test').Page, x: number, y: number): Promise<number[]> {
  return page.evaluate(([px, py]) => {
    const d = (window as unknown as { app: { panel: { currentDrawing: { canvas: HTMLCanvasElement } } } }).app.panel.currentDrawing;
    const ctx = d.canvas.getContext('2d') as CanvasRenderingContext2D;
    return Array.from(ctx.getImageData(Math.round(px * 1024), Math.round(py * 1024), 1, 1).data);
  }, [x, y]);
}

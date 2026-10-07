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

export async function openPanel(page: import('@playwright/test').Page, species: 'Rokke' | 'Skildpadde' = 'Rokke'): Promise<void> {
  // The bubble floats and pops, so it is never "stable" for Playwright; the click is a real tap on its button.
  await page.getByRole('button', { name: species }).click({ force: true });
  await page.locator('.panel.open').waitFor();
  // In the real game the pop has long finished by now; with a paused aquarium (?still) we let it run out by hand.
  await page.evaluate(() => (window as unknown as { aquarium?: { advance(s: number): void } }).aquarium?.advance(0.6));
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

/**
 * Colours the open drawing like the reference ray (dark green body, yellow stripes) by driving the
 * Drawing API directly – much faster than touch events, which matters with software GL.
 */
export async function paintStripes(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(() => {
    type D = { tool: string; color: string; brush: number; pointerDown(x: number, y: number): void; pointerMove(x: number, y: number): void; pointerUp(): void };
    const d = (window as unknown as { app: { panel: { currentDrawing: D } } }).app.panel.currentDrawing;
    d.tool = 'bucket';
    d.color = '#1f8f4a';
    d.pointerDown(512, 460);
    d.pointerUp();
    d.tool = 'crayon';
    d.brush = 2;
    d.color = '#f9d21e';
    for (const x of [0.22, 0.34, 0.5, 0.66, 0.78]) {
      d.pointerDown(x * 1024, 0.1 * 1024);
      for (let i = 1; i <= 30; i++) d.pointerMove(x * 1024, (0.1 + (0.72 * i) / 30) * 1024);
      d.pointerUp();
    }
    d.brush = 1;
    d.color = '#e8332a';
    d.pointerDown(0.4 * 1024, 0.3 * 1024);
    for (let i = 1; i <= 12; i++) d.pointerMove((0.4 + 0.2 * (i / 12)) * 1024, (0.3 + 0.03 * Math.sin(i)) * 1024);
    d.pointerUp();
  });
}

type W = {
  aquarium: {
    camera: { position: { constructor: new () => Vec; }; updateMatrixWorld(): void };
    viewport: { width: number; height: number };
    advance(s: number): void;
    renderOnce(): void;
    creatures: { creatures: Array<{ group: { matrixWorld: unknown; updateMatrixWorld(f: boolean): void; position: Vec }; mesh: { geometry: Geo }; mode: string; swimmer: { pos: number[] } | null }> };
  };
  app: { lastRelease: { creature: W['aquarium']['creatures']['creatures'][number] } | null };
};
type Vec = { set(x: number, y: number, z: number): Vec; applyMatrix4(m: unknown): Vec; project(c: unknown): Vec; x: number; y: number; z: number };
type Geo = { getAttribute(n: string): { count: number; getX(i: number): number; getY(i: number): number; getZ(i: number): number } };

/** Largest distance (CSS px) between where the creature's outline vertices are on screen and where the drawing's outline was. */
export async function registrationError(page: import('@playwright/test').Page, rect: { x: number; y: number; width: number; height: number }): Promise<{ maxPx: number; rimVertices: number }> {
  return page.evaluate((r) => {
    const w = window as unknown as W;
    const a = w.aquarium;
    const c = (w.app.lastRelease as NonNullable<W['app']['lastRelease']>).creature;
    c.group.updateMatrixWorld(true);
    a.camera.updateMatrixWorld();
    const geo = c.mesh.geometry;
    const pos = geo.getAttribute('position');
    const uv = geo.getAttribute('uv');
    const lift = geo.getAttribute('lift');
    const V = new (a.camera.position.constructor as new () => Vec)();
    let maxPx = 0;
    let rim = 0;
    for (let i = 0; i < pos.count; i++) {
      // The swim shader takes each part's lift off while the body is flat; do the same here (the ray has no lift).
      const flatY = pos.getY(i) - (lift ? lift.getX(i) : 0);
      if (Math.abs(flatY) > 1e-6) continue; // outline vertices lie in the template plane
      rim++;
      V.set(pos.getX(i), flatY, pos.getZ(i)).applyMatrix4(c.group.matrixWorld).project(a.camera);
      const sx = (V.x * 0.5 + 0.5) * a.viewport.width;
      const sy = (-V.y * 0.5 + 0.5) * a.viewport.height;
      const ex = r.x + uv.getX(i) * r.width;
      const ey = r.y + (1 - uv.getY(i)) * r.height;
      maxPx = Math.max(maxPx, Math.hypot(sx - ex, sy - ey));
    }
    return { maxPx, rimVertices: rim };
  }, rect);
}

export async function screenBox(page: import('@playwright/test').Page): Promise<{ left: number; right: number; top: number; bottom: number }> {
  return page.evaluate(() => {
    const w = window as unknown as W;
    const a = w.aquarium;
    const c = (w.app.lastRelease as NonNullable<W['app']['lastRelease']>).creature;
    c.group.updateMatrixWorld(true);
    a.camera.updateMatrixWorld();
    const pos = c.mesh.geometry.getAttribute('position');
    const V = new (a.camera.position.constructor as new () => Vec)();
    let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      V.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(c.group.matrixWorld).project(a.camera);
      const sx = (V.x * 0.5 + 0.5) * a.viewport.width;
      const sy = (-V.y * 0.5 + 0.5) * a.viewport.height;
      left = Math.min(left, sx); right = Math.max(right, sx); top = Math.min(top, sy); bottom = Math.max(bottom, sy);
    }
    return { left, right, top, bottom };
  });
}

/** Does any button of the drawing panel overlap the template outline on screen? Returns the offending labels. */
export async function buttonsOverlappingTemplate(page: import('@playwright/test').Page, margin = 4): Promise<string[]> {
  return page.evaluate((m) => {
    type P = [number, number];
    const panel = (window as unknown as { app: { panel: { template: { parts: Array<{ outline: P[] }> } } } }).app.panel;
    const wrap = document.querySelector('.canvas-wrap') as HTMLElement;
    const r = wrap.getBoundingClientRect();
    const polys = panel.template.parts.map((p) => p.outline.map(([x, y]): P => [r.x + x * r.width, r.y + y * r.height]));
    const inside = (x: number, y: number, poly: P[]) => {
      let c = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [xi, yi] = poly[i];
        const [xj, yj] = poly[j];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
      }
      return c;
    };
    const bad: string[] = [];
    for (const b of document.querySelectorAll<HTMLElement>('.home-btn, .undo-btn')) {
      const q = b.getBoundingClientRect();
      const [x0, y0, x1, y1] = [q.left - m, q.top - m, q.right + m, q.bottom + m];
      const hit = polys.some(
        (poly) =>
          poly.some(([x, y]) => x >= x0 && x <= x1 && y >= y0 && y <= y1) ||
          [[x0, y0], [x1, y0], [x0, y1], [x1, y1], [(x0 + x1) / 2, (y0 + y1) / 2]].some(([x, y]) => inside(x, y, poly)),
      );
      if (hit) bad.push(b.getAttribute('aria-label') ?? b.className);
    }
    return bad;
  }, margin);
}

type AppM4 = {
  app: {
    restored: Promise<void>;
    keeper: { restore(): Promise<Array<{ id: string; createdAt: number }>>; add(c: unknown): Promise<boolean> };
    adult: { active: boolean };
  };
  aquarium: {
    camera: { position: { constructor: new () => Vec }; updateMatrixWorld(): void };
    viewport: { width: number; height: number };
    advance(s: number): void;
    creatures: { creatures: Array<{ id: string; mode: string; group: { position: Vec; updateMatrixWorld(f: boolean): void }; drawing: HTMLCanvasElement }>; living(): unknown[] };
  };
};

/** Puts `n` saved creatures straight into IndexedDB (oldest = seed-00), as if they had been released on earlier visits. */
export async function seedCreatures(page: import('@playwright/test').Page, n: number): Promise<void> {
  await page.evaluate(async (count) => {
    const w = window as unknown as AppM4;
    const hues = ['#e8332a', '#2150c8', '#1f8f4a', '#8a45c6', '#f58a1f', '#19bfb0', '#f7a6c8', '#8a5530'];
    for (let i = 0; i < count; i++) {
      const c = document.createElement('canvas');
      c.width = c.height = 512;
      const g = c.getContext('2d') as CanvasRenderingContext2D;
      g.fillStyle = hues[i % hues.length];
      g.fillRect(0, 0, 512, 512);
      g.fillStyle = '#f9d21e';
      for (let x = 60; x < 512; x += 90) g.fillRect(x, 0, 36, 512);
      const blob = await new Promise<Blob>((res) => c.toBlob((b) => res(b as Blob), 'image/png'));
      await w.app.keeper.add({ id: `seed-${String(i).padStart(2, '0')}`, species: 'ray', drawing: blob, createdAt: 1_000_000 + i });
    }
  }, n);
}

/** Reloads the page (keeping IndexedDB) and waits until the saved creatures are back in the water. */
export async function reloadAndRestore(page: import('@playwright/test').Page): Promise<void> {
  await page.reload();
  await page.waitForFunction(() => !!(window as unknown as AppM4).app);
  await page.evaluate(() => (window as unknown as AppM4).app.restored);
}

export async function storedIds(page: import('@playwright/test').Page): Promise<string[]> {
  return page.evaluate(async () => (await (window as unknown as AppM4).app.keeper.restore()).map((c) => c.id).sort());
}

export async function sceneInfo(page: import('@playwright/test').Page): Promise<{ total: number; living: number; modes: string[]; ids: string[] }> {
  return page.evaluate(() => {
    const m = (window as unknown as AppM4).aquarium.creatures;
    return { total: m.creatures.length, living: m.living().length, modes: m.creatures.map((c) => c.mode), ids: m.creatures.map((c) => c.id) };
  });
}

/** Screen position (CSS px) of the creature at `index`, or null when it is outside the picture. */
export async function creatureScreenPoint(page: import('@playwright/test').Page, id: string): Promise<{ x: number; y: number } | null> {
  return page.evaluate((cid) => {
    const w = window as unknown as AppM4;
    const a = w.aquarium;
    const c = a.creatures.creatures.find((k) => k.id === cid);
    if (!c) return null;
    a.camera.updateMatrixWorld();
    const v = new (a.camera.position.constructor as new () => Vec)();
    v.set(c.group.position.x, c.group.position.y, c.group.position.z).project(a.camera);
    if (Math.abs(v.x) > 0.85 || Math.abs(v.y) > 0.85 || v.z > 1) return null;
    return { x: (v.x * 0.5 + 0.5) * a.viewport.width, y: (-v.y * 0.5 + 0.5) * a.viewport.height };
  }, id);
}

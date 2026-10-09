import { writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { creatureScreenPoint, holdRelease, line, newTouchPage, openPanel, PHONE, registrationError, reloadAndRestore, rigState, seedCreatures, sceneInfo, spawnAt, TABLET, tap, touchDrag, touchPinch } from './helpers';

type Pg = import('@playwright/test').Page;
type W = {
  aquarium: {
    advance(s: number): void;
    renderOnce(): void;
    rig: { x: number; y: number; zoom: number; reset(): void; grab(): void; panBy(x: number, y: number): void; zoomBy(f: number): void; following: boolean };
    renderer: { info: { autoReset: boolean; render: { triangles: number; calls: number } } };
    pickerBubbles: {
      hitAreas(): Array<{ species: string; index: number; x: number; y: number; r: number }>;
      scroll: { x: number; nearest(): number; offsetFor(i: number): number };
      folded: boolean;
      foldedAway: boolean;
      stateOf(s: string): string;
    };
    creatures: { creatures: Array<{ id: string; reaction: unknown; group: { position: { x: number; y: number; z: number } } }> };
    following: { id: string } | null;
  };
};
const adv = (page: Pg, s: number) => page.evaluate((x) => (window as unknown as W).aquarium.advance(x), s);

async function open(browser: import('@playwright/test').Browser, size: { width: number; height: number }, query = '?still') {
  const t = await newTouchPage(browser, size);
  await t.page.goto(`/${query}`);
  await t.page.evaluate(() => (window as unknown as { app: { restored: Promise<void> } }).app.restored);
  await adv(t.page, 1.5);
  return t;
}

/** Hides the carousel so swipes anywhere belong to the camera. */
async function lookMode(page: Pg): Promise<void> {
  await page.getByRole('button', { name: 'Kig' }).click();
  await adv(page, 2);
}

test.describe('M8: kameraet', () => {
  test('ét finger glider langs akvariet – den rigtige vej – og slipper dyr løs ved et tryk, ikke ved et træk', async ({ browser }) => {
    const { ctx, page, cdp, errors } = await open(browser, TABLET);
    await lookMode(page);
    const id = await spawnAt(page, [0, 6, 0]);
    const p = await creatureScreenPoint(page, id);
    expect(p).not.toBeNull();
    const at = p as { x: number; y: number };

    // A swipe that starts ON the creature moves the camera and does not make the creature hop.
    expect((await rigState(page)).x).toBeCloseTo(0, 1);
    await touchDrag(cdp, line([at.x, at.y], [at.x - 360, at.y], 14));
    await adv(page, 0.5);
    const afterSwipe = await rigState(page);
    expect(afterSwipe.x, 'finger left → the camera moves right').toBeGreaterThan(3);
    const reacting = await page.evaluate((cid) => !!(window as unknown as W).aquarium.creatures.creatures.find((c) => c.id === cid)?.reaction, id);
    expect(reacting).toBe(false);

    // A short tap on a creature is still the joy hop (not a swipe).
    const id2 = await spawnAt(page, [afterSwipe.x, 6, 0]);
    await adv(page, 0.2);
    const q = (await creatureScreenPoint(page, id2)) as { x: number; y: number };
    expect(q).not.toBeNull();
    await tap(cdp, [q.x, q.y]);
    await expect.poll(() => page.evaluate((cid) => !!(window as unknown as W).aquarium.creatures.creatures.find((c) => c.id === cid)?.reaction, id2)).toBe(true);

    // 9 px of finger wobble is still a tap; the drag starts after ~10 px.
    const id3 = await spawnAt(page, [afterSwipe.x + 3, 5, 0]);
    await adv(page, 0.2);
    const r = (await creatureScreenPoint(page, id3)) as { x: number; y: number };
    const before = (await rigState(page)).x;
    await touchDrag(cdp, [[r.x, r.y], [r.x + 4, r.y + 3], [r.x + 6, r.y + 6]]);
    await adv(page, 0.3);
    expect(Math.abs((await rigState(page)).x - before)).toBeLessThan(0.2);
    expect(errors).toEqual([]);
    await ctx.close();
  });

  test('kameraet kan aldrig forlade akvariet – hverken til siden, op/ned eller ved zoom', async ({ browser }) => {
    for (const size of [TABLET, PHONE]) {
      const { ctx, page, cdp, errors } = await open(browser, size);
      await lookMode(page);
      const mid = size.height / 2;
      // Shove it far to the right, then far to the left (as many swipes as it takes to cross the whole aquarium).
      for (const dir of [-1, 1]) {
        for (let i = 0; i < 10; i++) {
          const x0 = dir < 0 ? size.width * 0.9 : size.width * 0.1;
          await touchDrag(cdp, line([x0, mid], [x0 + dir * size.width * 0.8, mid], 8));
          await adv(page, 0.6); // frames run between a child's swipes; the tests have to make them
        }
        await adv(page, 3);
        const s = await rigState(page);
        expect(Math.abs(s.x)).toBeLessThanOrEqual(s.limitX + 1e-6);
        expect(Math.abs(s.x), `at the edge (${size.width})`).toBeGreaterThan(s.limitX * 0.97);
        if (size === TABLET) await page.screenshot({ path: `docs/screenshots/M8-tablet-${dir < 0 ? '2-hoejre' : '3-venstre'}-kant.png` });
      }
      // Up and down.
      for (const dir of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
          await touchDrag(cdp, line([size.width / 2, size.height * (dir < 0 ? 0.9 : 0.1)], [size.width / 2, size.height * (dir < 0 ? 0.1 : 0.9)], 8));
          await adv(page, 0.6);
        }
        await adv(page, 3);
        const s = await rigState(page);
        expect(s.y).toBeGreaterThanOrEqual(-1.8 - 1e-6);
        expect(s.y).toBeLessThanOrEqual(3 + 1e-6);
      }
      // Camera height stays above the sand whatever happened.
      const camY = await page.evaluate(() => (window as unknown as { aquarium: { camera: { position: { y: number } } } }).aquarium.camera.position.y);
      expect(camY).toBeGreaterThan(1.5);
      expect(errors).toEqual([]);
      await ctx.close();
    }
  });

  test('knib zoomer 1×–2,5× (og holder sig inden for) – scrollhjulet også', async ({ browser }) => {
    const { ctx, page, cdp, errors } = await open(browser, TABLET);
    await lookMode(page);
    const c: [number, number] = [TABLET.width / 2, TABLET.height / 2];
    await touchPinch(cdp, c, 120, 360);
    await adv(page, 1);
    let s = await rigState(page);
    expect(s.zoom).toBeGreaterThan(1.8);
    expect(s.zoom).toBeLessThanOrEqual(2.5 + 1e-6);
    await touchPinch(cdp, c, 100, 700, 14);
    await adv(page, 1);
    s = await rigState(page);
    expect(s.zoom).toBeCloseTo(2.5, 1);
    await page.screenshot({ path: 'docs/screenshots/M8-tablet-4-zoom-2-5.png' });
    await touchPinch(cdp, c, 600, 80, 14);
    await touchPinch(cdp, c, 600, 80, 14);
    await adv(page, 1.5);
    s = await rigState(page);
    expect(s.zoom).toBeCloseTo(1, 1);
    // Wheel (mouse / trackpad).
    await page.mouse.move(c[0], c[1]);
    await page.mouse.wheel(0, -600);
    await adv(page, 1);
    expect((await rigState(page)).zoom).toBeGreaterThan(1.5);
    await page.mouse.wheel(0, 5000);
    await adv(page, 1.5);
    expect((await rigState(page)).zoom).toBeCloseTo(1, 1);
    expect(errors).toEqual([]);
    await ctx.close();
  });

  test('mus: træk med knappen nede glider kameraet; kort klik er et tryk', async ({ browser }) => {
    const { ctx, page, errors } = await open(browser, TABLET);
    await lookMode(page);
    await page.mouse.move(800, 400);
    await page.mouse.down();
    await page.mouse.move(500, 400, { steps: 10 });
    await page.mouse.up();
    await adv(page, 0.5);
    expect((await rigState(page)).x).toBeGreaterThan(3);
    // Moving the mouse without a button does nothing.
    await adv(page, 4); // let the glide after the drag die out first
    const x = (await rigState(page)).x;
    await page.mouse.move(100, 100, { steps: 5 });
    await page.mouse.move(900, 300, { steps: 5 });
    await adv(page, 0.3);
    expect((await rigState(page)).x).toBeCloseTo(x, 1);
    expect(errors).toEqual([]);
    await ctx.close();
  });

  test('efter 30 sek. uden berøring glider kameraet roligt tilbage til midten – ikke før', async ({ browser }) => {
    const { ctx, page, cdp, errors } = await open(browser, TABLET);
    await lookMode(page);
    await touchDrag(cdp, line([900, 400], [300, 420], 12));
    await adv(page, 1);
    await touchPinch(cdp, [590, 410], 100, 300);
    await adv(page, 1);
    const moved = await rigState(page);
    expect(moved.x).toBeGreaterThan(3);
    expect(moved.zoom).toBeGreaterThan(1.5);
    await adv(page, 25);
    const still = await rigState(page);
    expect(still.x).toBeCloseTo(moved.x, 0);
    expect(still.zoom).toBeCloseTo(moved.zoom, 1);
    await adv(page, 8);
    const gliding = await rigState(page);
    expect(gliding.x).toBeLessThan(moved.x);
    await adv(page, 15);
    const home = await rigState(page);
    expect(Math.abs(home.x)).toBeLessThan(0.1);
    expect(home.zoom).toBeCloseTo(1, 1);
    expect(errors).toEqual([]);
    await ctx.close();
  });
});

test.describe('M8: følg dyr', () => {
  test('dobbelttryk på et dyr følger det; swipe eller dobbelttryk på tomt vand stopper', async ({ browser }) => {
    const { ctx, page, cdp, errors } = await open(browser, TABLET);
    await lookMode(page);
    const id = await spawnAt(page, [0, 6.5, 0]);
    await adv(page, 0.2);
    const p = (await creatureScreenPoint(page, id)) as { x: number; y: number };
    expect(p).not.toBeNull();
    await tap(cdp, [p.x, p.y]);
    await page.waitForTimeout(120);
    await tap(cdp, [p.x, p.y]);
    await adv(page, 0.1);
    expect(await page.evaluate(() => (window as unknown as W).aquarium.following?.id)).toBe(id);
    // The creature swims off; the camera goes after it and zooms in.
    await adv(page, 12);
    const s = await rigState(page);
    expect(s.following).toBe(true);
    expect(s.zoom).toBeGreaterThan(1.5);
    const pos = await page.evaluate((cid) => (window as unknown as W).aquarium.creatures.creatures.find((c) => c.id === cid)?.group.position.x ?? 0, id);
    expect(Math.abs(s.x - pos)).toBeLessThan(4);
    const at = await creatureScreenPoint(page, id);
    expect(at, 'the followed creature stays in the picture').not.toBeNull();
    await page.screenshot({ path: 'docs/screenshots/M8-tablet-5-foelg-dyr.png' });

    // A swipe stops it.
    await touchDrag(cdp, line([900, 600], [700, 600], 8));
    expect((await rigState(page)).following).toBe(false);

    // Follow again, then a double tap on empty water stops it.
    const q = (await creatureScreenPoint(page, id)) as { x: number; y: number } | null;
    if (q) {
      await tap(cdp, [q.x, q.y]);
      await page.waitForTimeout(120);
      await tap(cdp, [q.x, q.y]);
      expect((await rigState(page)).following).toBe(true);
    } else {
      await page.evaluate((cid) => {
        const w = window as unknown as { aquarium: { follow(c: unknown): void; creatures: { creatures: Array<{ id: string }> } } };
        w.aquarium.follow(w.aquarium.creatures.creatures.find((c) => c.id === cid));
      }, id);
    }
    expect((await rigState(page)).following).toBe(true);
    await tap(cdp, [700, 760]);
    await page.waitForTimeout(120);
    await tap(cdp, [702, 762]);
    expect((await rigState(page)).following).toBe(false);
    expect(errors).toEqual([]);
    await ctx.close();
  });

  test('kameraet følger ikke videre, når dyret er væk', async ({ browser }) => {
    const { ctx, page, errors } = await open(browser, TABLET);
    await lookMode(page);
    const id = await spawnAt(page, [4, 6, 0]);
    await page.evaluate((cid) => {
      const w = window as unknown as { aquarium: { advance(s: number): void; follow(c: unknown): void; creatures: { creatures: Array<{ id: string }>; remove(c: unknown): void } } };
      const c = w.aquarium.creatures.creatures.find((k) => k.id === cid);
      w.aquarium.follow(c);
      w.aquarium.advance(2);
      w.aquarium.creatures.remove(c);
      w.aquarium.advance(0.2);
    }, id);
    expect((await rigState(page)).following).toBe(false);
    expect(errors).toEqual([]);
    await ctx.close();
  });
});

type Area = { species: string; index: number; x: number; y: number; r: number };
const areas = (page: Pg): Promise<Area[]> => page.evaluate(() => (window as unknown as W).aquarium.pickerBubbles.hitAreas());
const scrollX = (page: Pg): Promise<number> => page.evaluate(() => (window as unknown as W).aquarium.pickerBubbles.scroll.x);

test.describe('M8: følg dyr – tekstur og kamera ved udslip', () => {
  test('det fulgte dyr får tegningen i fuld opløsning; når man slipper det, er det igen 512', async ({ browser }) => {
    const { ctx, page, errors } = await open(browser, TABLET, '?still');
    await openPanel(page);
    await page.evaluate(() => {
      const d = (window as unknown as { app: { panel: { currentDrawing: { pointerDown(x: number, y: number): void; pointerUp(): void; color: string } } } }).app.panel.currentDrawing;
      d.color = '#2150c8';
      d.pointerDown(512, 400);
      d.pointerUp();
    });
    await holdRelease(page);
    await adv(page, 4);
    const sizes = await page.evaluate(() => {
      const w = window as unknown as { aquarium: { follow(c: unknown): void; creatures: { creatures: Array<{ textureSize: number }> } } };
      const c = w.aquarium.creatures.creatures[0];
      const normal = c.textureSize;
      w.aquarium.follow(c);
      const followed = c.textureSize;
      w.aquarium.follow(null);
      return { normal, followed, after: c.textureSize };
    });
    expect(sizes).toEqual({ normal: 512, followed: 1024, after: 512 });
    expect(errors).toEqual([]);
    await ctx.close();
  });

  test('Slip løs med kameraet zoomet ind: tegningen og kroppen passer stadig præcist over hinanden', async ({ browser }) => {
    const { ctx, page, errors } = await open(browser, TABLET, '?still');
    await lookMode(page);
    await page.evaluate(() => {
      const a = (window as unknown as W).aquarium;
      a.rig.grab();
      a.rig.zoomBy(2.2);
      a.rig.panBy(9, 1);
      a.advance(3);
    });
    await page.locator('.view-toggle').click();
    await adv(page, 1.5);
    await openPanel(page);
    const rect = (await page.locator('.canvas-wrap').boundingBox()) as { x: number; y: number; width: number; height: number };
    // The held countdown ends in exactly this call; the body then lies flat over the drawing (the same check as in M3).
    await page.evaluate(() => {
      const panel = (window as unknown as { app: { panel: { currentDrawing: unknown; onRelease?: (d: unknown, s: string) => void } } }).app.panel;
      panel.onRelease?.(panel.currentDrawing, 'ray');
    });
    await adv(page, 0);
    const err = await registrationError(page, rect);
    expect(err.rimVertices).toBeGreaterThan(100);
    expect(err.maxPx, 'outline vertices vs the drawing on screen (px), with the lens zoomed in').toBeLessThan(1);
    expect(errors).toEqual([]);
    await ctx.close();
  });
});

test.describe('M8: karrusellen', () => {
  test('8 bobler: ca. 3 ses ad gangen på tablet, 1½ på stående telefon', async ({ browser }) => {
    for (const [name, size, visible] of [['tablet', TABLET, 3], ['phone', PHONE, 1.5]] as const) {
      const { ctx, page, errors } = await open(browser, size, '?still&bubbles=8');
      await adv(page, 1);
      const a = await areas(page);
      expect(a).toHaveLength(8);
      const seen = a.filter((b) => b.x + b.r > 0 && b.x - b.r < size.width);
      const whole = a.filter((b) => b.x - b.r >= 0 && b.x + b.r <= size.width);
      expect(whole.length, `${name}: whole bubbles`).toBe(Math.floor(visible));
      expect(seen.length, `${name}: seen bubbles`).toBe(Math.ceil(visible));
      // The row is one line of equal bubbles that never overlap and all big enough to tap.
      for (const b of a) {
        expect(2 * b.r).toBeGreaterThanOrEqual(120);
        expect(b.y).toBeCloseTo(a[0].y, 3);
      }
      for (let i = 1; i < a.length; i++) expect(a[i].x - a[i - 1].x).toBeGreaterThan(2 * a[0].r);
      await page.screenshot({ path: `docs/screenshots/M8-${name}-1-karrusel.png` });
      expect(errors).toEqual([]);
      await ctx.close();
    }
  });

  test('swipe i båndet ruller karrusellen med snap – og flytter ikke kameraet', async ({ browser }) => {
    const { ctx, page, cdp, errors } = await open(browser, TABLET, '?still&bubbles=8');
    const a0 = await areas(page);
    const y = a0[0].y;
    await touchDrag(cdp, line([900, y], [300, y], 10));
    await adv(page, 1.5);
    const x1 = await scrollX(page);
    expect(x1).toBeGreaterThan(300);
    expect((await rigState(page)).x, 'the camera did not move').toBeCloseTo(0, 3);
    // It rests with a bubble in the middle (or at the end of the row).
    const rest = await page.evaluate(() => {
      const s = (window as unknown as W).aquarium.pickerBubbles.scroll;
      return Array.from({ length: 8 }, (_, i) => Math.abs(s.x - s.offsetFor(i))).some((d) => d < 0.01);
    });
    expect(rest).toBe(true);
    // A hard fling to the left goes to the very end and no further; a fling right comes all the way back.
    for (let i = 0; i < 3; i++) await touchDrag(cdp, line([1100, y], [100, y], 6));
    await adv(page, 2);
    const end = await scrollX(page);
    const last = (await areas(page))[7];
    expect(last.x + last.r).toBeLessThanOrEqual(TABLET.width);
    // (On a fast machine the first swipe may already have flung it to the end, so "at least as far", and flush with the screen edge.)
    expect(end).toBeGreaterThanOrEqual(x1 - 0.01);
    expect(last.x + last.r).toBeCloseTo(TABLET.width, 0);
    await page.screenshot({ path: 'docs/screenshots/M8-tablet-2-karrusel-swipet.png' });
    for (let i = 0; i < 3; i++) await touchDrag(cdp, line([100, y], [1100, y], 6));
    await adv(page, 2);
    expect(await scrollX(page)).toBeCloseTo(0, 1);
    expect(errors).toEqual([]);
    await ctx.close();
  });

  test('swipe uden for båndet styrer kameraet – ikke karrusellen', async ({ browser }) => {
    const { ctx, page, cdp, errors } = await open(browser, TABLET, '?still&bubbles=8');
    const a0 = await areas(page);
    const outside = Math.max(40, a0[0].y - a0[0].r - 0.1 * TABLET.height - 80);
    await touchDrag(cdp, line([900, outside], [300, outside], 10));
    await adv(page, 1);
    expect((await rigState(page)).x).toBeGreaterThan(3);
    expect(await scrollX(page)).toBeCloseTo(0, 3);
    expect(errors).toEqual([]);
    await ctx.close();
  });

  test('et tryk på en boble popper den og åbner tegnefladen til den art; et swipe gør ikke', async ({ browser }) => {
    const { ctx, page, cdp, errors } = await open(browser, TABLET, '?still&bubbles=8');
    const a = await areas(page);
    // A swipe that starts on a bubble does not pick it.
    await touchDrag(cdp, line([a[1].x, a[1].y], [a[1].x - 250, a[1].y], 8));
    await adv(page, 1);
    await expect(page.locator('.panel.open')).toHaveCount(0);
    // Scroll back and tap the turtle (slot index 1).
    await touchDrag(cdp, line([200, a[1].y], [1000, a[1].y], 8));
    await adv(page, 1.5);
    const b = await areas(page);
    const turtle = b.find((x) => x.species === 'turtle' && x.x > 100 && x.x < TABLET.width - 100) as Area;
    expect(turtle).toBeTruthy();
    // (A mouse click: a CDP touch tap that is held a bit too long in the slow software renderer turns into a long press.)
    await page.mouse.click(turtle.x, turtle.y);
    await adv(page, 0.8);
    await page.locator('.panel.open').waitFor();
    expect(await page.evaluate(() => (window as unknown as { app: { panel: { template: { species: string } } } }).app.panel.template.species)).toBe('turtle');
    expect(errors).toEqual([]);
    await ctx.close();
  });

  test('stående telefon: swipe bringer den anden boble helt ind i billedet', async ({ browser }) => {
    const { ctx, page, cdp, errors } = await open(browser, PHONE, '?still');
    const a0 = await areas(page);
    expect(a0[1].x + a0[1].r).toBeGreaterThan(PHONE.width); // peeks in
    await touchDrag(cdp, line([330, a0[0].y], [90, a0[0].y], 8));
    await adv(page, 1.5);
    const a1 = await areas(page);
    expect(a1[1].x - a1[1].r).toBeGreaterThanOrEqual(0);
    expect(a1[1].x + a1[1].r).toBeLessThanOrEqual(PHONE.width);
    await page.screenshot({ path: 'docs/screenshots/M8-phone-2-karrusel-swipet.png' });
    expect(errors).toEqual([]);
    await ctx.close();
  });

  test('tastatur: fokus på en boble ruller den ind i billedet', async ({ browser }) => {
    const { ctx, page, errors } = await open(browser, TABLET, '?still&bubbles=8');
    const hits = page.locator('.bubble-hit');
    await hits.nth(6).focus();
    await adv(page, 1.5);
    const a = await areas(page);
    expect(a[6].x - a[6].r).toBeGreaterThanOrEqual(-1);
    expect(a[6].x + a[6].r).toBeLessThanOrEqual(TABLET.width + 1);
    expect(errors).toEqual([]);
    await ctx.close();
  });
});

test.describe('M8: kigge-knap og tegne-knap', () => {
  test('øjet folder karrusellen væk, blyanten folder den frem igen – knappen sidder samme sted', async ({ browser }) => {
    for (const [name, size] of [['tablet', TABLET], ['phone', PHONE]] as const) {
      const { ctx, page, cdp, errors } = await open(browser, size, '?still&bubbles=8');
      const btn = page.locator('.view-toggle');
      await expect(btn).toBeVisible();
      await expect(btn).toHaveAttribute('data-mode', 'look');
      const box0 = await btn.boundingBox();
      expect(box0 && box0.x + box0.width > size.width * 0.75 && box0.y + box0.height > size.height * 0.75).toBe(true); // bottom right
      expect(box0?.width ?? 0).toBeGreaterThanOrEqual(48);
      const before = await areas(page);

      await btn.click();
      await adv(page, 0.3);
      await page.screenshot({ path: `docs/screenshots/M8-${name}-3-karrusel-folder-vaek.png` });
      await adv(page, 1.5);
      expect(await page.evaluate(() => (window as unknown as W).aquarium.pickerBubbles.foldedAway)).toBe(true);
      await expect(btn).toHaveAttribute('data-mode', 'draw');
      await expect(btn).toHaveAttribute('aria-label', 'Tegn');
      expect(await btn.boundingBox()).toEqual(box0);
      await expect(page.locator('.bubble-hit').first()).toBeDisabled();
      await page.screenshot({ path: `docs/screenshots/M8-${name}-4-kig.png` });
      // With the row gone a swipe anywhere (also where the row was) moves the camera.
      await touchDrag(cdp, line([size.width * 0.8, before[0].y], [size.width * 0.2, before[0].y], 10));
      await adv(page, 1);
      expect((await rigState(page)).x).toBeGreaterThan(1);

      await btn.click();
      await adv(page, 2);
      await expect(btn).toHaveAttribute('data-mode', 'look');
      const after = await areas(page);
      expect(after.map((a) => [Math.round(a.x), Math.round(a.y)])).toEqual(before.map((a) => [Math.round(a.x), Math.round(a.y)]));
      await expect(page.locator('.bubble-hit').first()).toBeEnabled();
      // The (invisible) HTML buttons have followed the bubbles back, so a tap on a bubble still works.
      const hit = await page.locator('.bubble-hit').first().boundingBox();
      expect(Math.abs((hit?.x ?? 0) + (hit?.width ?? 0) / 2 - after[0].x)).toBeLessThan(1);
      expect(Math.abs((hit?.y ?? 0) + (hit?.height ?? 0) / 2 - after[0].y)).toBeLessThan(1);
      expect(errors).toEqual([]);
      await ctx.close();
    }
  });

  test('knappen er væk, mens man tegner og i voksentilstand', async ({ browser }) => {
    const { ctx, page, errors } = await open(browser, TABLET, '?still');
    await openPanel(page);
    await expect(page.locator('.view-toggle')).toBeHidden();
    await page.getByRole('button', { name: 'Hjem' }).click();
    await page.waitForFunction(() => !document.querySelector('.panel.open'));
    await expect(page.locator('.view-toggle')).toBeVisible();
    const lock = page.locator('.adult-lock');
    const box = (await lock.boundingBox()) as { x: number; y: number; width: number; height: number };
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(3300);
    await page.mouse.up();
    await expect(page.locator('.adult-frame')).toBeVisible();
    await expect(page.locator('.view-toggle')).toBeHidden();
    expect(errors).toEqual([]);
    await ctx.close();
  });
});

test.describe('M8: ydeevne og indhold', () => {
  // The first version drew its whole reef every frame: 259,406 triangles on the tablet (measured before M8, no creatures).
  const V1_TRIANGLES = 259_406;

  test('det synlige antal trekanter vokser ikke i forhold til v1 – uanset hvor kameraet står', async ({ browser }) => {
    // With the species there are today (two bubbles, as in the first version's measurement); the bubbles are part of the picture.
    const { ctx, page, errors } = await open(browser, TABLET, '?still');
    const rows: string[] = [];
    let worst = 0;
    const stops: Array<[number, number, number]> = [];
    for (const zoom of [1, 1.6, 2.5]) for (let x = -26; x <= 26; x += 4) for (const y of [0, 3]) stops.push([x, y, zoom]);
    for (const [x, y, zoom] of stops) {
      const r = await page.evaluate(([px, py, pz]) => {
        const a = (window as unknown as W).aquarium;
        a.rig.reset();
        a.rig.grab();
        a.rig.zoomBy(pz);
        a.rig.panBy(px, py);
        a.advance(6);
        a.renderer.info.autoReset = true;
        a.renderOnce();
        return { tri: a.renderer.info.render.triangles, calls: a.renderer.info.render.calls };
      }, [x, y, zoom] as const);
      worst = Math.max(worst, r.tri);
      rows.push(`${zoom}×  x=${x}  y=${y}: ${r.tri} triangles, ${r.calls} draw calls`);
    }
    // The same measurement on a phone held upright.
    await ctx.close();
    const phone = await open(browser, PHONE, '?still');
    let worstPhone = 0;
    for (let x = -32; x <= 32; x += 4) {
      const r = await phone.page.evaluate((px) => {
        const a = (window as unknown as W).aquarium;
        a.rig.reset();
        a.rig.grab();
        a.rig.panBy(px, 0);
        a.advance(6);
        a.renderer.info.autoReset = true;
        a.renderOnce();
        return a.renderer.info.render.triangles;
      }, x);
      worstPhone = Math.max(worstPhone, r);
    }
    writeFileSync('docs/screenshots/M8-triangles.txt', `${rows.join('\n')}\n\ntablet worst: ${worst}   phone worst: ${worstPhone}   v1 (tablet, whole reef every frame): ${V1_TRIANGLES}\n`);
    expect(worst).toBeLessThanOrEqual(V1_TRIANGLES);
    expect(worstPhone).toBeLessThanOrEqual(V1_TRIANGLES);
    expect(errors).toEqual([]);
    await phone.ctx.close();
  });

  test('30 dyr fordeler sig i hele akvariets bredde (ikke trængsel i midten), og kun en brøkdel ses ad gangen', async ({ browser }) => {
    const { ctx, page, errors } = await open(browser, TABLET, '?still');
    await seedCreatures(page, 30);
    await reloadAndRestore(page);
    await adv(page, 2);
    const info = await page.evaluate(() => {
      const w = window as unknown as W;
      const xs = w.aquarium.creatures.creatures.map((c) => c.group.position.x).sort((a, b) => a - b);
      let closest = Infinity;
      const cs = w.aquarium.creatures.creatures;
      for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) {
        const p = cs[i].group.position, q = cs[j].group.position;
        closest = Math.min(closest, Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z));
      }
      const inView = xs.filter((x) => Math.abs(x) < 12).length;
      return { n: xs.length, min: xs[0], max: xs[xs.length - 1], inView, closest };
    });
    expect(info.n).toBe(30);
    expect(info.max - info.min, 'spread over the width').toBeGreaterThan(50);
    expect(info.inView, 'a screen shows only part of them').toBeLessThan(20);
    expect(info.inView).toBeGreaterThan(2);
    await page.getByRole('button', { name: 'Kig' }).click();
    await adv(page, 2);
    await page.screenshot({ path: 'docs/screenshots/M8-tablet-6-30-dyr-midten.png' });
    expect(errors).toEqual([]);
    await ctx.close();
  });

  test('Slip løs med kameraet flyttet: dyret kommer ind i den del af akvariet man ser på', async ({ browser }) => {
    const { ctx, page, cdp, errors } = await open(browser, TABLET, '?still');
    await lookMode(page);
    await touchDrag(cdp, line([1000, 400], [200, 400], 12));
    await adv(page, 2);
    const cam = (await rigState(page)).x;
    expect(cam).toBeGreaterThan(8);
    await page.locator('.view-toggle').click();
    await adv(page, 1.5);
    await openPanel(page);
    // While the drawing is open, the camera is held still and does not glide home.
    await adv(page, 40);
    expect((await rigState(page)).x).toBeCloseTo(cam, 0);
    await holdRelease(page);
    await adv(page, 4);
    const pos = await page.evaluate(() => {
      const c = (window as unknown as W).aquarium.creatures.creatures;
      return c[c.length - 1].group.position.x;
    });
    expect(Math.abs(pos - cam), 'swims into the part that is on screen').toBeLessThan(14);
    const info = await sceneInfo(page);
    expect(info.total).toBe(1);
    await adv(page, 3);
    await page.screenshot({ path: 'docs/screenshots/M8-tablet-7-slip-loes-flyttet-kamera.png' });
    expect(errors).toEqual([]);
    await ctx.close();
  });

  test('voksentilstand: et swipe åbner ikke slet-spørgsmålet, et tryk gør', async ({ browser }) => {
    const { ctx, page, cdp, errors } = await open(browser, TABLET, '?still');
    await lookMode(page);
    const id = await spawnAt(page, [0, 6, 0]);
    await adv(page, 0.2);
    const p = (await creatureScreenPoint(page, id)) as { x: number; y: number };
    const lock = page.locator('.adult-lock');
    const box = (await lock.boundingBox()) as { x: number; y: number; width: number; height: number };
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(3300);
    await page.mouse.up();
    await expect(page.locator('.adult-frame')).toBeVisible();
    await touchDrag(cdp, line([p.x, p.y], [p.x - 300, p.y], 10));
    await expect(page.locator('.adult-confirm')).toBeHidden();
    // The swipe moved the camera (and the creature has swum on): bring the camera home and put a fresh creature in the middle.
    await page.evaluate(() => (window as unknown as W).aquarium.rig.reset());
    const id2 = await spawnAt(page, [0, 6, 0]);
    await adv(page, 0.2);
    const q = (await creatureScreenPoint(page, id2)) as { x: number; y: number };
    expect(q, 'a creature is in view').not.toBeNull();
    await tap(cdp, [q.x, q.y]);
    await expect(page.locator('.adult-confirm')).toBeVisible();
    expect(errors).toEqual([]);
    await ctx.close();
  });
});

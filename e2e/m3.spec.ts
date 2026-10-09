import { expect, test } from '@playwright/test';
import { holdRelease, newTouchPage, openPanel, paintStripes, PHONE, pixelAt, registrationError, screenBox, TABLET } from './helpers';

type Size = { width: number; height: number };

async function drawAndRelease(page: import('@playwright/test').Page) {
  await openPanel(page);
  await paintStripes(page);
  const box = await page.locator('.canvas-wrap').boundingBox();
  if (!box) throw new Error('no canvas');
  return box;
}

const classify = (rgb: number[]): string => {
  const [r, g, b] = rgb;
  // By hue, not brightness: lighting and water haze darken the 3D body compared with the flat drawing.
  if (r > 0.75 * g && b < 0.4 * g && g > 60) return 'yellow';
  if (g > 1.25 * r && g > 1.1 * b) return 'green';
  return `other(${rgb.join(',')})`;
};

for (const [name, size] of [['tablet', TABLET], ['phone', PHONE]] as Array<[string, Size]>) {
  test(`M3: the body appears exactly where the drawing was (${name})`, async ({ browser }) => {
    const { ctx, page, errors } = await newTouchPage(browser, size);
    await page.goto('/?still');
    const rect = await drawAndRelease(page);

    // What the drawing shows at a few template points (stripes at x = 0.22/0.34/0.5/0.66/0.78, body green between).
    // v=0.4 crosses the wide part of the wings; the red mouth sits around v=0.3, so it is avoided.
    const probes: Array<[number, number]> = [[0.5, 0.4], [0.42, 0.4], [0.34, 0.4], [0.58, 0.4], [0.66, 0.4], [0.5, 0.47], [0.4, 0.2], [0.6, 0.2]];
    const expected = [] as string[];
    for (const [u, v] of probes) expected.push(classify(await pixelAt(page, u, v)));
    expect(expected).toContain('yellow');
    expect(expected).toContain('green');

    const timing = await page.evaluate(() => {
      const t0 = performance.now();
      // The held countdown (M7) ends in exactly this call; time the work it starts.
      const panel = (window as unknown as { app: { panel: { currentDrawing: unknown; onRelease?: (d: unknown, s: string) => void } } }).app.panel;
      panel.onRelease?.(panel.currentDrawing, 'ray');
      return performance.now() - t0;
    });
    // Making the body from a drawing must not hitch the transition (DESIGN 4.2: < ~100 ms).
    expect(timing).toBeLessThan(100);

    await page.evaluate(() => (window as unknown as { aquarium: { renderOnce(): void } }).aquarium.renderOnce());
    const err = await registrationError(page, rect);
    expect(err.rimVertices).toBeGreaterThan(100);
    expect(err.maxPx, 'outline vertices vs the drawing on screen (px)').toBeLessThan(1);

    // Colours: the 3D picture (UI hidden) shows the same stripes at the same screen places.
    await page.addStyleTag({ content: '.ui { visibility: hidden !important; }' });
    await page.evaluate(() => (window as unknown as { aquarium: { renderOnce(): void } }).aquarium.renderOnce());
    const shot = await page.screenshot({ path: `docs/screenshots/M3-${name}-1-slip-loes.png` });
    expect(shot.length).toBeGreaterThan(1000);
    const b64 = shot.toString('base64');
    const seen = await page.evaluate(
      async ([data, r, pts]) => {
        const img = new Image();
        img.src = `data:image/png;base64,${data}`;
        await img.decode();
        const c2 = document.createElement('canvas');
        c2.width = img.width;
        c2.height = img.height;
        const ctx2 = c2.getContext('2d') as CanvasRenderingContext2D;
        ctx2.drawImage(img, 0, 0);
        const sx = img.width / window.innerWidth;
        return pts.map(([u, v]) => Array.from(ctx2.getImageData(Math.round((r.x + u * r.width) * sx), Math.round((r.y + v * r.height) * sx), 1, 1).data.slice(0, 3)));
      },
      [b64, rect, probes] as const,
    );
    expect(seen.map(classify)).toEqual(expected);
    // The eyes are painted on the body texture at their template positions; the stored drawing stays clean.
    const eyes = await page.evaluate(() => {
      const c = (window as unknown as { app: { lastRelease: { creature: { template: { eyes: Array<{ x: number; y: number }> }; drawing: HTMLCanvasElement; mesh: { material: { map: { image: HTMLCanvasElement } } } } } } }).app.lastRelease.creature;
      const eye = c.template.eyes[0];
      const at = (cv: HTMLCanvasElement) => Array.from((cv.getContext('2d') as CanvasRenderingContext2D).getImageData(Math.round(eye.x * 512) + 8, Math.round(eye.y * 512), 1, 1).data);
      return { texture: at(c.mesh.material.map.image), stored: at(c.drawing) };
    });
    expect(eyes.texture.slice(0, 3).every((v) => v > 230)).toBe(true); // white of the eye
    expect(eyes.stored.slice(0, 3).some((v) => v < 230)).toBe(true); // clean drawing: green body, no eye
    expect(errors).toEqual([]);
    await ctx.close();
  });
}

test('M3: unfold, turn and swim away; the picker comes back (tablet)', async ({ browser }) => {
  const { ctx, page, errors } = await newTouchPage(browser, TABLET);
  await page.goto('/?still');
  const rect = await drawAndRelease(page);
  await holdRelease(page);
  const adv = (s: number) => page.evaluate((x) => (window as unknown as { aquarium: { advance(s: number): void } }).aquarium.advance(x), s);
  const mode = () => page.evaluate(() => (window as unknown as { app: { lastRelease: { creature: { mode: string } } } }).app.lastRelease.creature.mode);
  // Headless Chromium only moves CSS transitions on when frames are produced; poll until the layer has cleared away.
  const waitCleared = () => page.waitForFunction(() => parseFloat(getComputedStyle(document.querySelector('.panel .bottom') as Element).opacity) < 0.02);

  await adv(0);
  await page.screenshot({ path: 'docs/screenshots/M3-tablet-2-overgang-start.png' });
  const b0 = await screenBox(page);
  expect(Math.abs((b0.right - b0.left) - rect.width)).toBeLessThan(rect.width * 0.06); // same size on screen

  await waitCleared();
  await adv(0.5);
  await page.screenshot({ path: 'docs/screenshots/M3-tablet-3-folder-ud.png' });
  expect(await mode()).toBe('transition');

  await adv(0.7);
  await page.screenshot({ path: 'docs/screenshots/M3-tablet-4-drejer.png' });
  const b1 = await screenBox(page);
  await adv(1.1);
  await page.screenshot({ path: 'docs/screenshots/M3-tablet-5-svoemmer-vaek.png' });
  const b2 = await screenBox(page);
  // It swims away from the viewer: smaller and smaller on screen.
  const w = (b: { left: number; right: number }) => b.right - b.left;
  expect(w(b1)).toBeLessThan(w(b0));
  expect(w(b2)).toBeLessThan(w(b1));
  expect(w(b2)).toBeLessThan(w(b0) * 0.75);

  await adv(1.2); // 3.5 s in: the 3.4 s flight is over
  expect(await mode()).toBe('swim'); // handed over to free swimming
  expect(w(await screenBox(page))).toBeLessThan(w(b0) * 0.5); // by the end of the flight it is far away
  await expect(page.getByRole('button', { name: 'Rokke' })).toBeVisible(); // picker is back
  await expect(page.locator('.panel')).toBeHidden();
  await adv(6);
  await page.screenshot({ path: 'docs/screenshots/M3-tablet-6-i-akvariet.png' });
  expect(errors).toEqual([]);
  await ctx.close();
});

for (const [name, size] of [['tablet', TABLET], ['phone', PHONE]] as Array<[string, Size]>) {
  test(`M3: several creatures swim around and stay in the aquarium (${name})`, async ({ browser }) => {
    const { ctx, page, errors } = await newTouchPage(browser, size);
    await page.goto('/?still');
    await openPanel(page);
    await paintStripes(page);
    // Release one for real (so there is a drawing), then add more swimming creatures with other colours.
    await holdRelease(page);
    await page.evaluate(() => {
      const w = window as unknown as { aquarium: { advance(s: number): void; creatures: { spawn(c: HTMLCanvasElement, s: string, p?: unknown, y?: number): unknown } }; app: { lastRelease: { drawing: { canvas: HTMLCanvasElement } } } };
      w.aquarium.advance(4);
      const colours = ['#e8332a', '#2150c8', '#f7a6c8', '#8a45c6'];
      const src = w.app.lastRelease.drawing.canvas;
      colours.forEach((col, i) => {
        // Same stripes, different body colour: tint a copy of the drawing.
        const c = document.createElement('canvas');
        c.width = c.height = 1024;
        const g = c.getContext('2d') as CanvasRenderingContext2D;
        g.drawImage(src, 0, 0);
        g.globalCompositeOperation = 'source-atop';
        g.globalAlpha = 0.55;
        g.fillStyle = col;
        g.fillRect(0, 0, 1024, 1024);
        w.aquarium.creatures.spawn(c, 'ray', undefined, i);
      });
    });
    // Sample positions over two simulated minutes.
    let inView = 0;
    let total = 0;
    for (let i = 0; i < 40; i++) {
      const frac = await page.evaluate(() => {
        const w = window as unknown as W2;
        w.aquarium.advance(3);
        // ADR 0006: the aquarium is ~3 screens wide, so "in the aquarium" means inside its walls, not inside the picture.
        let inside = 0;
        for (const c of w.aquarium.creatures.creatures) {
          const p = c.group.position;
          if (Math.abs(p.x) <= 37.5 && p.y > 0 && p.y < 11 && p.z > -12 && p.z < 8) inside++;
        }
        return [inside, w.aquarium.creatures.creatures.length];
      });
      inView += frac[0];
      total += frac[1];
    }
    expect(inView / total).toBe(1);
    await page.screenshot({ path: `docs/screenshots/M3-${name}-7-flere-dyr.png` });
    expect(errors).toEqual([]);
    await ctx.close();
  });
}

type V3 = { set(x: number, y: number, z: number): V3; project(c: unknown): V3; x: number; y: number; z: number };
type W2 = {
  aquarium: {
    advance(s: number): void;
    camera: { position: { constructor: new () => V3 }; updateMatrixWorld(): void };
    creatures: { creatures: Array<{ group: { position: V3 } }> };
  };
};

test('M3: the body seen obliquely, from the side and from below (tablet)', async ({ browser }) => {
  const { ctx, page, errors } = await newTouchPage(browser, TABLET);
  await page.goto('/?still');
  await drawAndRelease(page);
  await holdRelease(page);
  await page.evaluate(() => (window as unknown as { aquarium: { advance(s: number): void } }).aquarium.advance(4));
  await page.addStyleTag({ content: '.ui { visibility: hidden !important; }' });
  const shots: Array<[string, [number, number, number]]> = [
    ['8-krop-skraa', [2.5, 9.2, 7.5]],
    ['9-krop-side', [10, 5.5, 0.01]],
    ['10-krop-undefra', [4, 0.8, 7]],
  ];
  for (const [name, pos] of shots) {
    await page.evaluate((p) => {
      const w = window as unknown as {
        aquarium: {
          scene: { children: Array<{ visible: boolean; isLight?: boolean }> };
          camera: { position: { set(x: number, y: number, z: number): void }; lookAt(x: number, y: number, z: number): void };
          creatures: { creatures: Array<{ group: { visible: boolean; position: { set(x: number, y: number, z: number): void }; rotation: { set(x: number, y: number, z: number, o: string): void } } }> };
          renderOnce(): void;
        };
      };
      const a = w.aquarium;
      const c = a.creatures.creatures[0];
      // "Product shot": only the creature, level, in the middle of an empty aquarium.
      for (const ch of a.scene.children) if (!ch.isLight) ch.visible = false;
      c.group.visible = true;
      c.group.position.set(0, 5.5, 0);
      c.group.rotation.set(0, 0, 0, 'YXZ');
      a.camera.position.set(p[0], p[1], p[2]);
      a.camera.lookAt(0, 5.5, 0);
      a.renderOnce();
    }, pos);
    await page.screenshot({ path: `docs/screenshots/M3-tablet-${name}.png` });
  }
  expect(errors).toEqual([]);
  await ctx.close();
});

test('M3: the same hand-over on a phone (portrait)', async ({ browser }) => {
  const { ctx, page, errors } = await newTouchPage(browser, PHONE);
  await page.goto('/?still');
  const rect = await drawAndRelease(page);
  await holdRelease(page);
  const adv = (s: number) => page.evaluate((x) => (window as unknown as { aquarium: { advance(s: number): void } }).aquarium.advance(x), s);
  await adv(0);
  const err = await registrationError(page, rect);
  expect(err.maxPx).toBeLessThan(1);
  await page.waitForFunction(() => parseFloat(getComputedStyle(document.querySelector('.panel .bottom') as Element).opacity) < 0.02);
  await adv(0.1);
  await page.screenshot({ path: 'docs/screenshots/M3-phone-2-overgang-start.png' });
  await adv(1.0);
  await page.screenshot({ path: 'docs/screenshots/M3-phone-3-folder-ud.png' });
  await adv(1.4);
  await page.screenshot({ path: 'docs/screenshots/M3-phone-5-svoemmer-vaek.png' });
  await adv(1.2);
  await expect(page.getByRole('button', { name: 'Rokke' })).toBeVisible();
  await adv(5);
  await page.screenshot({ path: 'docs/screenshots/M3-phone-6-i-akvariet.png' });
  expect(errors).toEqual([]);
  await ctx.close();
});

import { expect, test } from '@playwright/test';
import { drawingStats, holdRelease, line, newTouchPage, openPanel, paintStripes, PHONE, reloadAndRestore, TABLET, templateToScreen, touchDrag, touchPinch, type Pt } from './helpers';

type Pg = import('@playwright/test').Page;
type D = {
  canvas: HTMLCanvasElement;
  canUndo: boolean;
  zoom: number;
  undo(): boolean;
  tool: string;
  color: string;
  busy: boolean;
};
type W = { aquarium: { advance(s: number): void }; app: { panel: { zoom: number; viewState: { zoom: number; x: number; y: number }; currentDrawing: D } } };
const zoom = (page: Pg) => page.evaluate(() => (window as unknown as W).app.panel.zoom);
const view = (page: Pg) => page.evaluate(() => (window as unknown as W).app.panel.viewState);

async function setup(browser: import('@playwright/test').Browser, size = TABLET) {
  const t = await newTouchPage(browser, size);
  await t.page.goto('/?still');
  await openPanel(t.page);
  const wrap = t.page.locator('.canvas-wrap');
  const box = (await wrap.boundingBox()) as { x: number; y: number; width: number; height: number };
  const centre: Pt = [box.x + box.width / 2, box.y + box.height / 2];
  const at = await templateToScreen(wrap);
  return { ...t, box, centre, at };
}

/** How many drawing pixels thick a horizontal stroke is, measured at the drawing column `x` (rows that differ from the base colour). */
async function thicknessAt(page: Pg, x: number, y: number): Promise<number> {
  return page.evaluate(([px, py]) => {
    const d = (window as unknown as W).app.panel.currentDrawing;
    const ctx = d.canvas.getContext('2d') as CanvasRenderingContext2D;
    const col = ctx.getImageData(px, Math.max(0, py - 120), 1, 240).data;
    let n = 0;
    for (let i = 0; i < 240; i++) if (Math.abs(col[i * 4] - 241) > 40 || Math.abs(col[i * 4 + 1] - 244) > 40) n++;
    return n;
  }, [x, y]);
}

test.describe('M9: zoom', () => {
  test('knib zoomer ind (op til 4×), "hele dyret"-knappen og to-finger-dobbelttryk går tilbage', async ({ browser }) => {
    const { ctx, page, cdp, centre, errors } = await setup(browser);
    expect(await zoom(page)).toBe(1);
    await expect(page.getByRole('button', { name: 'Hele dyret' })).toBeHidden();
    await touchPinch(cdp, centre, 100, 260, 10);
    const z1 = await zoom(page);
    expect(z1).toBeGreaterThan(1.8);
    await expect(page.getByRole('button', { name: 'Hele dyret' })).toBeVisible();
    await page.screenshot({ path: 'docs/screenshots/M9-tablet-1-zoomet-ind.png' });
    await touchPinch(cdp, centre, 80, 700, 12);
    expect(await zoom(page)).toBe(4); // the ceiling
    await touchPinch(cdp, centre, 400, 120, 12);
    expect(await zoom(page)).toBeLessThan(4);
    await page.getByRole('button', { name: 'Hele dyret' }).click();
    expect(await zoom(page)).toBe(1);
    await expect(page.getByRole('button', { name: 'Hele dyret' })).toBeHidden();
    // Two quick taps with two fingers also bring everything back.
    await touchPinch(cdp, centre, 100, 260, 8);
    expect(await zoom(page)).toBeGreaterThan(1.5);
    const tap2 = async () => {
      const pts = (d: number) => [{ x: centre[0] - d / 2, y: centre[1], id: 0 }, { x: centre[0] + d / 2, y: centre[1], id: 1 }];
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pts(120) });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };
    await tap2();
    await tap2();
    expect(await zoom(page)).toBe(1);
    expect(await drawingStats(page).then((s) => s.outsideFar)).toBe(0);
    expect(errors).toEqual([]);
    await ctx.close();
  });

  test('to fingre trækker flytter rundt, men aldrig forbi kanten', async ({ browser }) => {
    const { ctx, page, cdp, centre, errors } = await setup(browser);
    await touchPinch(cdp, centre, 100, 300, 8);
    const before = await view(page);
    expect(before.zoom).toBeGreaterThan(2);
    // Two fingers drag left together.
    const at = (dx: number) => [{ x: centre[0] - 40 + dx, y: centre[1], id: 0 }, { x: centre[0] + 40 + dx, y: centre[1], id: 1 }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: at(0) });
    for (let i = 1; i <= 8; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: at(-25 * i) });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    const after = await view(page);
    expect(after.zoom).toBeCloseTo(before.zoom, 1);
    expect(after.x).toBeLessThan(before.x - 100);
    // Far beyond the edge: clamped so the drawing always covers the window.
    const side = (await page.locator('.canvas-wrap').boundingBox())?.width ?? 600;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: at(0) });
    for (let i = 1; i <= 10; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: at(-300 * i) });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    const far = await view(page);
    expect(far.x).toBeGreaterThanOrEqual(side - side * far.zoom - 0.5);
    expect(errors).toEqual([]);
    await ctx.close();
  });

  test('stregen er i skærm-pixel: zoomet ind bliver den samme streg tyndere i tegningen', async ({ browser }) => {
    const { ctx, page, cdp, centre, box, errors } = await setup(browser);
    await page.getByRole('radio', { name: 'Mørkeblå' }).click();
    await page.getByRole('radio', { name: 'Tyk', exact: true }).click();
    // A stroke at zoom 1 …
    const y1 = box.y + box.height * 0.32;
    await touchDrag(cdp, line([centre[0] - 60, y1], [centre[0] + 60, y1], 8));
    const thick1 = await thicknessAt(page, 512, Math.round(((y1 - box.y) / box.height) * 1024));
    // … and the same finger movement at about 3.5× zoom.
    await touchPinch(cdp, centre, 60, 400, 12);
    expect(await zoom(page)).toBeGreaterThan(3);
    const z = await zoom(page);
    const v = await view(page);
    // A point in the middle of the window, in drawing pixels:
    const dy = 1024 * ((box.height / 2 - v.y) / z / box.height);
    await touchDrag(cdp, line([centre[0] - 60, centre[1]], [centre[0] + 60, centre[1]], 8));
    const thick2 = await thicknessAt(page, Math.round(1024 * ((box.width / 2 - v.x) / z / box.width)), Math.round(dy));
    expect(thick1).toBeGreaterThan(20);
    expect(thick2).toBeGreaterThan(4);
    expect(thick2).toBeLessThan(thick1 / 2.2);
    await page.screenshot({ path: 'docs/screenshots/M9-tablet-2-tynd-streg-zoomet.png' });
    expect(errors).toEqual([]);
    await ctx.close();
  });

  test('lander en anden finger midt i en streg, fjernes stregen igen – og ét fortryd er ikke brugt', async ({ browser }) => {
    const { ctx, page, cdp, box, errors } = await setup(browser);
    await page.getByRole('radio', { name: 'Rød', exact: true }).click();
    const y = box.y + box.height * 0.3;
    const x0 = box.x + box.width * 0.35;
    const tp = (x: number, extra = false) => [{ x, y, id: 0 }, ...(extra ? [{ x: box.x + box.width * 0.8, y: box.y + box.height * 0.8, id: 1 }] : [])];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: tp(x0) });
    for (let i = 1; i <= 6; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: tp(x0 + i * 12) });
    expect(await page.evaluate(() => (window as unknown as W).app.panel.currentDrawing.busy)).toBe(true);
    // The second finger lands.
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: tp(x0 + 80, true) });
    expect(await page.evaluate(() => (window as unknown as W).app.panel.currentDrawing.busy)).toBe(false);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    expect(await page.evaluate(() => (window as unknown as W).app.panel.currentDrawing.canUndo)).toBe(false);
    expect(await thicknessAt(page, Math.round(((x0 + 40 - box.x) / box.width) * 1024), Math.round(0.3 * 1024))).toBe(0);
    expect(errors).toEqual([]);
    await ctx.close();
  });

  test('mus: hjulet zoomer omkring markøren, mellemste knap og mellemrum+træk flytter', async ({ browser }) => {
    const { ctx, page, box, errors } = await setup(browser);
    const px = box.x + box.width * 0.7;
    const py = box.y + box.height * 0.3;
    // The drawing point under the cursor stays under the cursor.
    const under = () => page.evaluate(([cx, cy]) => {
      const p = (window as unknown as W).app.panel.viewState;
      const wrap = document.querySelector('.canvas-wrap') as HTMLElement;
      const r = wrap.getBoundingClientRect();
      return [((cx - r.left - p.x) / p.zoom / r.width) * 1024, ((cy - r.top - p.y) / p.zoom / r.height) * 1024];
    }, [px, py]);
    const before = await under();
    await page.mouse.move(px, py);
    await page.mouse.wheel(0, -400);
    expect(await zoom(page)).toBeGreaterThan(1.5);
    const after = await under();
    expect(Math.abs(after[0] - before[0])).toBeLessThan(2);
    expect(Math.abs(after[1] - before[1])).toBeLessThan(2);
    // Middle button: slide.
    const v0 = await view(page);
    await page.mouse.move(box.x + 300, box.y + 300);
    await page.mouse.down({ button: 'middle' });
    await page.mouse.move(box.x + 240, box.y + 270, { steps: 5 });
    await page.mouse.up({ button: 'middle' });
    const v1 = await view(page);
    expect(v1.x).toBeLessThan(v0.x - 20);
    expect(v1.y).toBeLessThan(v0.y - 10);
    // Space and the left button: slide too, and draw nothing.
    await page.keyboard.down(' ');
    await page.mouse.move(box.x + 300, box.y + 300);
    await page.mouse.down();
    await page.mouse.move(box.x + 330, box.y + 320, { steps: 5 });
    await page.mouse.up();
    await page.keyboard.up(' ');
    const v2 = await view(page);
    expect(v2.x).toBeGreaterThan(v1.x + 10);
    expect(await page.evaluate(() => (window as unknown as W).app.panel.currentDrawing.canUndo)).toBe(false);
    // The keys + − 0.
    await page.keyboard.press('0');
    expect(await zoom(page)).toBe(1);
    await page.keyboard.press('+');
    expect(await zoom(page)).toBeCloseTo(1.25, 2);
    expect(errors).toEqual([]);
    await ctx.close();
  });

  test('"Slip løs" starter altid fra hele dyret, også når der er zoomet ind', async ({ browser }) => {
    const { ctx, page, cdp, centre, errors } = await setup(browser);
    await paintStripes(page);
    await touchPinch(cdp, centre, 100, 300, 8);
    expect(await zoom(page)).toBeGreaterThan(2);
    await holdRelease(page);
    await page.evaluate(() => (window as unknown as W).aquarium.advance(1));
    expect(await zoom(page)).toBe(1);
    expect(errors).toEqual([]);
    await ctx.close();
  });

  test('på en telefon: knib og flyt, og knapperne ligger stadig frit', async ({ browser }) => {
    const { ctx, page, cdp, centre, errors } = await setup(browser, PHONE);
    await touchPinch(cdp, centre, 80, 240, 10);
    expect(await zoom(page)).toBeGreaterThan(1.8);
    await expect(page.getByRole('button', { name: 'Hele dyret' })).toBeVisible();
    await page.screenshot({ path: 'docs/screenshots/M9-phone-1-zoomet-ind.png' });
    expect(errors).toEqual([]);
    await ctx.close();
  });
});

test.describe('M9: tegningen gemmes i 1024', () => {
  test('en sluppet tegning gemmes som 1024 × 1024, og følger man dyret, hentes den i fuld størrelse', async ({ browser }) => {
    const { ctx, page, errors } = await setup(browser);
    await paintStripes(page);
    await holdRelease(page);
    await page.evaluate(() => (window as unknown as W).aquarium.advance(5));
    // The stored picture is 1024 wide.
    await expect.poll(async () => page.evaluate(async () => {
      const dbs = await indexedDB.databases();
      return dbs.some((d) => d.name === 'akvariet');
    })).toBe(true);
    await page.waitForTimeout(800);
    const stored = await page.evaluate(async () => {
      const open = indexedDB.open('akvariet');
      const db: IDBDatabase = await new Promise((res) => (open.onsuccess = () => res(open.result)));
      const store = db.transaction('creatures').objectStore('creatures');
      const all: Array<{ drawing: Blob; version?: number }> = await new Promise((res) => {
        const r = store.getAll();
        r.onsuccess = () => res(r.result);
      });
      const bmp = await createImageBitmap(all[0].drawing);
      return { width: bmp.width, version: all[0].version ?? 0, count: all.length };
    });
    expect(stored).toEqual({ width: 1024, version: 2, count: 1 });
    await reloadAndRestore(page);
    await page.evaluate(() => (window as unknown as W).aquarium.advance(6));
    // Saved creatures swim with a 512 texture, and get the full one when the camera follows them.
    const info = await page.evaluate(() => {
      const a = (window as unknown as { aquarium: { creatures: { creatures: Array<{ textureSize: number; setFullDetail(on: boolean): void }> } } }).aquarium;
      return a.creatures.creatures.map((c) => c.textureSize);
    });
    expect(info).toEqual([512]);
    await page.evaluate(() => {
      const a = (window as unknown as { aquarium: { creatures: { creatures: Array<{ setFullDetail(on: boolean): void }> } } }).aquarium;
      a.creatures.creatures[0].setFullDetail(true);
    });
    await expect.poll(() => page.evaluate(() => (window as unknown as { aquarium: { creatures: { creatures: Array<{ textureSize: number }> } } }).aquarium.creatures.creatures[0].textureSize)).toBe(1024);
    expect(errors).toEqual([]);
    await ctx.close();
  });
});

const near = (a: number[], b: number[], tol = 40) => b.every((v, i) => Math.abs(a[i] - v) <= tol);
const px = (page: Pg, x: number, y: number) =>
  page.evaluate(([cx, cy]) => {
    const d = (window as unknown as W).app.panel.currentDrawing;
    return Array.from((d.canvas.getContext('2d') as CanvasRenderingContext2D).getImageData(Math.round(cx), Math.round(cy), 1, 1).data);
  }, [x, y]);
const pageOf = (page: Pg) => page.locator('.bottom').getAttribute('data-page');

test.describe('M9: bakkens sider, stempler og mønstre', () => {
  test('to faner skifter side; swipe på bakken også; farven følger med, og pilene er tydelige', async ({ browser }) => {
    const { ctx, page, cdp, errors } = await setup(browser);
    expect(await pageOf(page)).toBe('crayons');
    await expect(page.getByRole('radio', { name: 'Rød', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Stempel: Stjerne' })).toBeHidden();
    await page.getByRole('radio', { name: 'Lilla' }).click();
    await page.getByRole('button', { name: 'Mønstre og stempler' }).click();
    expect(await pageOf(page)).toBe('patterns');
    await expect(page.getByRole('button', { name: 'Stempel: Stjerne' })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Rød', exact: true })).toBeHidden();
    // 4 patterns, 10 stamps, and the swatch with the colour that was chosen on the other page.
    expect(await page.locator('.patterns .pick-btn').count()).toBe(14);
    const swatch = await page.locator('.swatch').evaluate((e) => getComputedStyle(e).backgroundColor);
    expect(swatch).toBe('rgb(138, 69, 198)');
    await page.screenshot({ path: 'docs/screenshots/M9-tablet-3-moenstre-og-stempler.png' });
    await page.getByRole('button', { name: 'Blyanter', exact: true }).click();
    expect(await pageOf(page)).toBe('crayons');
    // Swiping the tray with a finger: left → patterns, right → crayons; a swipe is never also a tap on a crayon.
    const tray = (await page.locator('.bottom').boundingBox()) as { x: number; y: number; width: number; height: number };
    const y = tray.y + tray.height - 36;
    await touchDrag(cdp, line([tray.x + 600, y], [tray.x + 300, y], 8));
    expect(await pageOf(page)).toBe('patterns');
    await touchDrag(cdp, line([tray.x + 300, y], [tray.x + 600, y], 8));
    expect(await pageOf(page)).toBe('crayons');
    expect(await page.locator('.crayons [role=radio][aria-checked=true]').getAttribute('aria-label')).toBe('Lilla');
    // Every button on both pages is at least 48 px.
    for (const p of ['Mønstre og stempler', 'Blyanter']) {
      await page.getByRole('button', { name: p, exact: true }).click();
      const boxes = await page.locator('.bottom button:visible, .tabs button').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON() as DOMRect));
      for (const b of boxes) {
        expect(b.width).toBeGreaterThanOrEqual(47.5);
        expect(b.height).toBeGreaterThanOrEqual(47.5);
      }
    }
    expect(errors).toEqual([]);
    await ctx.close();
  });

  test('et stempel: tryk sætter ét, træk lægger en række, klippes ved omridset og fortrydes som ét trin', async ({ browser }) => {
    const { ctx, page, at, errors } = await setup(browser);
    await page.getByRole('radio', { name: 'Rød', exact: true }).click();
    await page.getByRole('button', { name: 'Mønstre og stempler' }).click();
    await page.getByRole('button', { name: 'Stempel: Stjerne' }).click();
    await page.getByRole('radio', { name: 'Tyk', exact: true }).click();
    const [sx, sy] = at(0.5, 0.3);
    await page.mouse.click(sx, sy);
    expect(near(await px(page, 0.5 * 1024, 0.3 * 1024), [232, 51, 42], 70)).toBe(true);
    expect(await page.evaluate(() => (window as unknown as W).app.panel.currentDrawing.canUndo)).toBe(true);
    // A drag lays a row.
    const [dx0, dy0] = at(0.3, 0.2);
    const [dx1] = at(0.7, 0.2);
    await page.mouse.move(dx0, dy0);
    await page.mouse.down();
    await page.mouse.move((dx0 + dx1) / 2, dy0, { steps: 6 });
    await page.mouse.move(dx1, dy0, { steps: 6 });
    await page.mouse.up();
    const reds = async () => {
      let n = 0;
      for (let x = 0.3; x <= 0.7; x += 0.01) if (near(await px(page, x * 1024, 0.2 * 1024), [232, 51, 42], 70)) n++;
      return n;
    };
    expect(await reds()).toBeGreaterThan(10);
    // One undo removes the whole row, a second the single stamp.
    await page.getByRole('button', { name: 'Fortryd' }).click();
    expect(await reds()).toBe(0);
    expect(near(await px(page, 0.5 * 1024, 0.3 * 1024), [232, 51, 42], 70)).toBe(true);
    await page.getByRole('button', { name: 'Fortryd' }).click();
    expect(near(await px(page, 0.5 * 1024, 0.3 * 1024), [241, 244, 246], 10)).toBe(true);
    // Never outside the outline: stamps over the edge are cut off.
    await page.mouse.click(...at(0.5, 0.135));
    await page.mouse.click(...at(0.985, 0.4));
    expect((await drawingStats(page)).outsideFar).toBe(0);
    await page.screenshot({ path: 'docs/screenshots/M9-tablet-4-stempler.png' });
    // The same stamp tapped again goes back to the crayon.
    await page.getByRole('button', { name: 'Stempel: Stjerne' }).click();
    expect(await page.evaluate(() => (window as unknown as W).app.panel.currentDrawing.tool)).toBe('crayon');
    expect(errors).toEqual([]);
    await ctx.close();
  });

  test('stempler og viskelæder bliver mindre, når man zoomer ind (skærm-pixel)', async ({ browser }) => {
    const { ctx, page, cdp, centre, errors } = await setup(browser);
    await page.getByRole('radio', { name: 'Gul', exact: true }).click();
    await page.getByRole('radio', { name: 'Tyk', exact: true }).click();
    await page.getByRole('button', { name: 'Mønstre og stempler' }).click();
    await page.getByRole('button', { name: 'Stempel: Prik' }).click();
    const area = async () =>
      page.evaluate(() => {
        const d = (window as unknown as W).app.panel.currentDrawing;
        const img = (d.canvas.getContext('2d') as CanvasRenderingContext2D).getImageData(0, 0, 1024, 1024).data;
        let n = 0;
        for (let i = 0; i < 1024 * 1024; i++) if (img[i * 4] > 200 && img[i * 4 + 1] > 170 && img[i * 4 + 2] < 120) n++;
        return n;
      });
    await page.mouse.click(centre[0], centre[1] - 60);
    const a1 = await area();
    await touchPinch(cdp, centre, 60, 400, 10);
    await page.mouse.click(centre[0], centre[1] + 40);
    const a2 = (await area()) - a1;
    expect(a1).toBeGreaterThan(3000);
    expect(a2).toBeGreaterThan(100);
    expect(a2).toBeLessThan(a1 / 6);
    expect(errors).toEqual([]);
    await ctx.close();
  });

  test('mønsterfyld: spanden fylder området med striber, prikker, skæl eller zigzag i den valgte farve – oven på områdets farve', async ({ browser }) => {
    const { ctx, page, at, errors } = await setup(browser);
    await page.getByRole('radio', { name: 'Mørkegrøn' }).click();
    await page.getByRole('button', { name: 'Fyld-spand' }).click();
    await page.mouse.click(...at(0.5, 0.3)); // a solid dark green body
    await page.getByRole('radio', { name: 'Gul', exact: true }).click();
    await page.getByRole('button', { name: 'Mønstre og stempler' }).click();
    const covered = async () =>
      page.evaluate(() => {
        const d = (window as unknown as W).app.panel.currentDrawing;
        const img = (d.canvas.getContext('2d') as CanvasRenderingContext2D).getImageData(0, 0, 1024, 1024).data;
        let yellow = 0;
        let green = 0;
        for (let i = 0; i < 1024 * 1024; i++) {
          if (img[i * 4 + 3] < 250) continue;
          if (img[i * 4] > 200 && img[i * 4 + 1] > 170 && img[i * 4 + 2] < 120) yellow++;
          else if (img[i * 4 + 1] > 110 && img[i * 4] < 80) green++;
        }
        return { yellow, green };
      });
    const shots: Record<string, { yellow: number; green: number }> = {};
    for (const [name, file] of [['Striber', 'striber'], ['Prikker', 'prikker'], ['Skæl', 'skael'], ['Zigzag', 'zigzag']] as const) {
      await page.getByRole('button', { name: `Mønster: ${name}` }).click();
      expect(await page.evaluate(() => (window as unknown as W).app.panel.currentDrawing.tool)).toBe('pattern');
      await page.mouse.click(...at(0.5, 0.3));
      shots[name] = await covered();
      await page.screenshot({ path: `docs/screenshots/M9-tablet-5-moenster-${file}.png` });
      await page.getByRole('button', { name: 'Fortryd' }).click(); // back to plain green for the next one
    }
    for (const s of Object.values(shots)) {
      expect(s.yellow).toBeGreaterThan(3000);
      expect(s.green).toBeGreaterThan(s.yellow * 0.4); // the region's own colour is still there between the pattern
    }
    expect((await drawingStats(page)).outsideFar).toBe(0);
    expect(errors).toEqual([]);
    await ctx.close();
  });
});

for (const [name, size] of [['tablet', TABLET], ['ipad-pro', { width: 1366, height: 1024 }], ['ipad', { width: 1024, height: 768 }], ['phone', PHONE], ['lille-telefon', { width: 360, height: 740 }], ['telefon-liggende', { width: 844, height: 390 }]] as const) {
  test(`M9: bakkens anden side ligger frit og passer på skærmen (${name})`, async ({ browser }) => {
    const { ctx, page, errors } = await setup(browser, size);
    await page.getByRole('button', { name: 'Mønstre og stempler' }).click();
    const boxes = await page.locator('.patterns button').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON() as DOMRect));
    expect(boxes).toHaveLength(15);
    for (const b of boxes) {
      expect(b.left).toBeGreaterThanOrEqual(-0.5);
      expect(b.right).toBeLessThanOrEqual(size.width + 0.5);
      expect(b.width).toBeGreaterThanOrEqual(47.5);
    }
    // Nothing from the shelf lies on top of the tools or "Slip løs".
    const overlap = await page.evaluate(() => {
      const shelf = document.querySelector('.patterns')?.getBoundingClientRect() as DOMRect;
      const others = [...document.querySelectorAll('.tools, .release-wrap')].map((e) => e.getBoundingClientRect());
      return others.some((o) => shelf.left < o.right - 1 && shelf.right > o.left + 1 && shelf.top < o.bottom - 1 && shelf.bottom > o.top + 1);
    });
    expect(overlap).toBe(false);
    await page.screenshot({ path: `docs/screenshots/M9-${name}-6-moenstersiden.png` });
    expect(errors).toEqual([]);
    await ctx.close();
  });
}


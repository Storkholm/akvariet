import { expect, test } from '@playwright/test';
import { line, newTouchPage, openPanel, PHONE, sceneInfo, TABLET, templateToScreen, touchDrag } from './helpers';

type Pg = import('@playwright/test').Page;

const creatureCount = async (page: Pg): Promise<number> => (await sceneInfo(page)).total;
const countdownText = (page: Pg) => page.locator('.countdown').evaluate((el) => ({ hidden: (el as HTMLElement).hidden, text: el.textContent }));

async function buttonCentre(page: Pg, selector: string): Promise<[number, number]> {
  const box = await page.locator(selector).boundingBox();
  if (!box) throw new Error(`${selector} not visible`);
  return [box.x + box.width / 2, box.y + box.height / 2];
}

test.describe('M7: Slip løs skal holdes nede', () => {
  test('et kort tryk slipper intet løs – kun en vippen', async ({ browser }) => {
    const { ctx, page, errors } = await newTouchPage(browser, TABLET);
    await page.goto('/?still');
    await openPanel(page);
    const before = await creatureCount(page);
    const [x, y] = await buttonCentre(page, '.release-btn');
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.waitForTimeout(150);
    expect((await countdownText(page)).text).toBe('3');
    await page.mouse.up();
    await page.waitForTimeout(600);
    expect(await creatureCount(page)).toBe(before);
    expect((await countdownText(page)).hidden).toBe(true);
    await expect(page.locator('.panel')).not.toHaveClass(/releasing/);
    await expect(page.locator('.release-wrap')).toHaveClass(/wiggle/);
    // A plain click (e.g. a screen reader pressing the button) does not release either.
    await page.locator('.release-btn').click();
    await page.waitForTimeout(300);
    expect(await creatureCount(page)).toBe(before);
    expect(errors).toEqual([]);
    await ctx.close();
  });

  test('holdes knappen, tæller 3 – 2 – 1, og først derefter slippes dyret løs', async ({ browser }) => {
    const { ctx, page, errors } = await newTouchPage(browser, TABLET);
    await page.goto('/?still');
    await openPanel(page);
    const before = await creatureCount(page);
    // Record every number that appears (a screenshot is slow, so we cannot poll for them).
    await page.evaluate(() => {
      const el = document.querySelector('.countdown') as HTMLElement;
      const seen: string[] = [];
      (window as unknown as { __seen: string[] }).__seen = seen;
      new MutationObserver(() => {
        if (!el.hidden && el.textContent && seen.at(-1) !== el.textContent) seen.push(el.textContent);
      }).observe(el, { childList: true, characterData: true, subtree: true, attributes: true });
    });
    const [x, y] = await buttonCentre(page, '.release-btn');
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.waitForFunction(() => (window as unknown as { __seen: string[] }).__seen.includes('2'));
    expect(await creatureCount(page)).toBe(before); // not released while counting
    // Headless Chromium only advances CSS animations when frames are produced: poll (rAF) until the pop-in is visible.
    await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('.countdown') as Element).opacity) > 0.9, undefined, { polling: 'raf', timeout: 400 }).catch(() => undefined);
    await page.screenshot({ path: 'docs/screenshots/M7-tablet-1-nedtaelling.png' });
    await page.waitForTimeout(1200);
    const seen = await page.evaluate(() => (window as unknown as { __seen: string[] }).__seen);
    expect(seen).toEqual(['3', '2', '1']);
    expect(await creatureCount(page)).toBe(before + 1);
    await page.mouse.up();
    expect(errors).toEqual([]);
    await ctx.close();
  });

  test('glider fingeren af knappen før tiden, sker der intet', async ({ browser }) => {
    const { ctx, page } = await newTouchPage(browser, PHONE);
    await page.goto('/?still');
    await openPanel(page);
    const before = await creatureCount(page);
    const [x, y] = await buttonCentre(page, '.release-btn');
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.waitForTimeout(700);
    await page.mouse.move(x, y - 160, { steps: 6 });
    await page.waitForTimeout(1400);
    await page.mouse.up();
    expect(await creatureCount(page)).toBe(before);
    expect((await countdownText(page)).hidden).toBe(true);
    await ctx.close();
  });

  test('tastatur: Enter holdt nede slipper løs, og Enter sluppet for tidligt gør ikke', async ({ browser }) => {
    const { ctx, page } = await newTouchPage(browser, TABLET);
    await page.goto('/?still');
    await openPanel(page);
    const before = await creatureCount(page);
    await page.locator('.release-btn').focus();
    await page.keyboard.down('Enter');
    await page.waitForTimeout(300);
    await page.keyboard.up('Enter');
    await page.waitForTimeout(300);
    expect(await creatureCount(page)).toBe(before);
    await page.keyboard.down('Enter');
    await page.waitForTimeout(1800);
    await page.keyboard.up('Enter');
    expect(await creatureCount(page)).toBe(before + 1);
    await ctx.close();
  });

  test('en rigtig berøring: hold fingeren på knappen', async ({ browser }) => {
    const { ctx, page, cdp } = await newTouchPage(browser, PHONE);
    await page.goto('/?still');
    await openPanel(page);
    const before = await creatureCount(page);
    const [x, y] = await buttonCentre(page, '.release-btn');
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 0 }] });
    await page.waitForTimeout(1900);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    expect(await creatureCount(page)).toBe(before + 1);
    await ctx.close();
  });
});

test.describe('M7: 15 farveblyanter', () => {
  test('grå ligger mellem brun og sort, regnbue sidst – og bakken passer på alle skærme', async ({ browser }) => {
    for (const [w, h] of [[1366, 1024], [1180, 820], [1024, 768], [390, 844], [360, 740]]) {
      const { ctx, page } = await newTouchPage(browser, { width: w, height: h });
      await page.goto('/?still');
      await openPanel(page);
      const names = await page.locator('.crayon').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
      expect(names).toEqual(['Rød', 'Orange', 'Gul', 'Lysegrøn', 'Mørkegrøn', 'Turkis', 'Lyseblå', 'Mørkeblå', 'Lilla', 'Lyserød', 'Brun', 'Grå', 'Sort', 'Hvid', 'Regnbue']);
      const boxes = await page.locator('.crayon').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON() as DOMRect));
      for (const b of boxes) {
        expect(b.left, `crayon inside @${w}`).toBeGreaterThanOrEqual(-0.5);
        expect(b.right, `crayon inside @${w}`).toBeLessThanOrEqual(w + 0.5);
        expect(b.width, `crayon wide enough @${w}`).toBeGreaterThanOrEqual(47.5);
      }
      // Nothing on the wooden bar is hidden behind or beside something else.
      const bar = await page.locator('.tools').boundingBox();
      const release = await page.locator('.release-wrap').boundingBox();
      const crayons = await page.locator('.crayons').boundingBox();
      expect(release && release.x + release.width, `release inside @${w}`).toBeLessThanOrEqual(w + 0.5);
      expect(bar && bar.x + bar.width, `tools inside @${w}`).toBeLessThanOrEqual(w);
      if (bar && release && bar.y < release.y + release.height && release.y < bar.y + bar.height) expect(bar.x + bar.width, `tools clear of release @${w}`).toBeLessThanOrEqual(release.x + 0.5);
      // Tools (on the bar) may sit under the crayons' tucked halves but never over their visible parts.
      if (bar && crayons && w >= 1360) expect(bar.x, `tools beside the crayons @${w}`).toBeGreaterThanOrEqual(crayons.x + crayons.width - 0.5);
      if (w === 1180 || w === 390) await page.screenshot({ path: `docs/screenshots/M7-${w === 1180 ? 'tablet' : 'phone'}-2-bakke-15-blyanter.png` });
      await ctx.close();
    }
  });

  test('regnbueblyanten: stregens farve løber gennem regnbuen; spanden fylder i bånd; grå er grå', async ({ browser }) => {
    const { ctx, page, cdp, errors } = await newTouchPage(browser, TABLET);
    await page.goto('/?still');
    await openPanel(page);
    const at = await templateToScreen(page.locator('.canvas-wrap'));
    const hues = async (y0: number, y1: number): Promise<number[]> =>
      page.evaluate(([a, b]) => {
        const d = (window as unknown as { app: { panel: { currentDrawing: { canvas: HTMLCanvasElement } } } }).app.panel.currentDrawing;
        const img = (d.canvas.getContext('2d') as CanvasRenderingContext2D).getImageData(0, a, 1024, b - a).data;
        const out = new Set<number>();
        for (let i = 0; i < img.length; i += 4) {
          const [r, g, bl] = [img[i], img[i + 1], img[i + 2]];
          const max = Math.max(r, g, bl), min = Math.min(r, g, bl);
          if (max - min < 90) continue; // base colour / grey
          const hue = max === r ? ((g - bl) / (max - min)) % 6 : max === g ? (bl - r) / (max - min) + 2 : (r - g) / (max - min) + 4;
          out.add(Math.round(((hue * 60 + 360) % 360) / 30) % 12);
        }
        return [...out];
      }, [y0, y1] as const);

    // Rainbow stroke along the body: at least five of the twelve hue buckets appear.
    await page.getByRole('radio', { name: 'Regnbue' }).click();
    await page.getByRole('radio', { name: 'Tyk' }).click();
    await touchDrag(cdp, line(at(0.2, 0.5), at(0.8, 0.5), 40));
    const strokeHues = await hues(400, 620);
    expect(strokeHues.length).toBeGreaterThanOrEqual(5);

    // Rainbow bucket on the tail (an untouched region): bands of different colours, top to bottom.
    await page.getByRole('button', { name: 'Fyld-spand' }).click();
    await page.evaluate(() => (window as unknown as { app: { panel: { currentDrawing: { tool: string } } } }).app.panel.currentDrawing.tool);
    const clearSpot = await page.evaluate(() => {
      const d = (window as unknown as { app: { panel: { currentDrawing: { mask: Uint8Array; canvas: HTMLCanvasElement } } } }).app.panel.currentDrawing;
      const img = (d.canvas.getContext('2d') as CanvasRenderingContext2D).getImageData(0, 0, 1024, 1024).data;
      // The base colour is light; find a masked pixel with that colour well above the stroke.
      for (let y = 100; y < 400; y += 4) for (let x = 100; x < 900; x += 4) if (d.mask[y * 1024 + x] && img[(y * 1024 + x) * 4] > 225 && img[(y * 1024 + x) * 4 + 1] > 225) return [x, y];
      return null;
    });
    expect(clearSpot).not.toBeNull();
    const [sx, sy] = clearSpot as [number, number];
    const box = await page.locator('.canvas-wrap').boundingBox();
    if (!box) throw new Error('no canvas');
    await page.mouse.click(box.x + (sx / 1024) * box.width, box.y + (sy / 1024) * box.height);
    const bandHues = await hues(0, 400);
    expect(bandHues.length).toBeGreaterThanOrEqual(4);
    await page.screenshot({ path: 'docs/screenshots/M7-tablet-3-regnbue.png' });

    // Grey: the stroke is neutral (r ≈ g ≈ b).
    await page.getByRole('button', { name: 'Fyld-spand' }).click(); // back to crayon
    await page.getByRole('radio', { name: 'Grå' }).click();
    await touchDrag(cdp, line(at(0.45, 0.62), at(0.55, 0.62), 6));
    const grey = await page.evaluate(() => {
      const d = (window as unknown as { app: { panel: { currentDrawing: { canvas: HTMLCanvasElement } } } }).app.panel.currentDrawing;
      const p = (d.canvas.getContext('2d') as CanvasRenderingContext2D).getImageData(512, Math.round(0.62 * 1024), 1, 1).data;
      return [p[0], p[1], p[2]];
    });
    expect(Math.abs(grey[0] - grey[1])).toBeLessThan(12);
    expect(Math.abs(grey[1] - grey[2])).toBeLessThan(12);
    expect(grey[0]).toBeGreaterThan(90);
    expect(grey[0]).toBeLessThan(190);
    expect(errors).toEqual([]);
    await ctx.close();
  });
});

test('M7: fyld-spand-ikonet (stort, til øjesyn)', async ({ browser }) => {
  const { ctx, page } = await newTouchPage(browser, TABLET, 6);
  await page.goto('/?still');
  await openPanel(page);
  await page.getByRole('button', { name: 'Fyld-spand' }).screenshot({ path: 'docs/screenshots/M7-fyld-spand-ikon.png' });
  await ctx.close();
});

test.describe('M7: fuldskærm og hjælp i voksentilstand', () => {
  test('fuldskærm-knappen sidder ved siden af lydknappen og skifter ikon', async ({ browser }) => {
    const { ctx, page } = await newTouchPage(browser, TABLET);
    await page.goto('/?still');
    const fs = page.locator('.fullscreen-btn');
    const supported = await page.evaluate(() => !!(document.fullscreenEnabled || (document as unknown as { webkitFullscreenEnabled?: boolean }).webkitFullscreenEnabled));
    if (!supported) {
      await expect(fs).toBeHidden();
    } else {
      await expect(fs).toBeVisible();
      const a = await fs.boundingBox();
      const b = await page.locator('.sound-btn').boundingBox();
      expect(a && b && a.x + a.width <= b.x).toBe(true);
      expect(a && b && Math.abs(a.y - b.y) < 1).toBe(true);
      expect(a?.width).toBeGreaterThanOrEqual(47.5);
      await expect(fs).toHaveAttribute('aria-pressed', 'false');
    }
    await ctx.close();
  });

  test('uden Fullscreen API (iPhone) findes knappen ikke', async ({ browser }) => {
    const { ctx, page } = await newTouchPage(browser, PHONE);
    await page.addInitScript(() => {
      for (const k of ['fullscreenEnabled', 'webkitFullscreenEnabled']) Object.defineProperty(Document.prototype, k, { get: () => false, configurable: true });
    });
    await page.goto('/?still');
    await expect(page.locator('.fullscreen-btn')).toBeHidden();
    await expect(page.locator('.sound-btn')).toBeVisible();
    await ctx.close();
  });

  test('voksentilstand viser hjælp til hjemmeskærm og barnelås – ikke i en installeret app', async ({ browser }) => {
    for (const [name, size, installed] of [['tablet', TABLET, false], ['phone', PHONE, false], ['tablet', TABLET, true]] as const) {
      const { ctx, page } = await newTouchPage(browser, size);
      if (installed) {
        await page.addInitScript(() => {
          const real = window.matchMedia.bind(window);
          window.matchMedia = (q: string) => (q.includes('display-mode: fullscreen') ? ({ ...real(q), matches: true } as MediaQueryList) : real(q));
        });
      }
      await page.goto('/?still');
      await page.evaluate(() => (window as unknown as { aquarium: { advance(s: number): void } }).aquarium.advance(0.6));
      const lock = page.locator('.adult-lock');
      const [x, y] = await buttonCentre(page, '.adult-lock');
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.waitForTimeout(3300);
      await page.mouse.up();
      await expect(page.locator('.adult-frame')).toBeVisible();
      if (installed) await expect(page.locator('.adult-help')).toBeHidden();
      else {
        await expect(page.locator('.adult-help')).toBeVisible();
        const text = await page.locator('.adult-help').innerText();
        for (const phrase of ['Læg spillet på hjemmeskærmen', 'Del', 'Føj til hjemmeskærm', 'Installer app', 'Lås barnet inde i spillet', 'Guidet adgang', 'Fastgør app']) expect(text).toContain(phrase);
        const box = await page.locator('.adult-help').boundingBox();
        expect(box && box.x >= 0 && box.x + box.width <= size.width).toBe(true);
        await page.screenshot({ path: `docs/screenshots/M7-${name}-4-voksenhjaelp.png` });
      }
      await lock.click();
      await expect(page.locator('.adult-help')).toBeHidden();
      await ctx.close();
    }
  });
});

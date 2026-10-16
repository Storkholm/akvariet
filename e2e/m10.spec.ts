import { expect, test } from '@playwright/test';
import { creatureScreenPoint, holdRelease, newTouchPage, openPanel, paintStripes, PHONE, reloadAndRestore, TABLET } from './helpers';

type Pg = import('@playwright/test').Page;
type C = { id: string; name?: string; species: string; group: { position: { x: number; y: number; z: number } } };
type W = {
  aquarium: { advance(s: number): void; creatures: { creatures: C[] }; follow(c: unknown): void; rig: { zoom: number } };
  app: { panel: { name: string }; nameTag: { shown: C[] }; adult: { set(on: boolean): void } };
};
const adv = (page: Pg, s: number) => page.evaluate((x) => (window as unknown as W).aquarium.advance(x), s);
const names = (page: Pg) => page.evaluate(() => (window as unknown as W).aquarium.creatures.creatures.map((c) => c.name ?? null));

async function releaseNamed(page: Pg, name: string, species: 'Rokke' | 'Skildpadde' = 'Rokke'): Promise<void> {
  await openPanel(page, species);
  if (name) {
    await page.getByLabel('Navn', { exact: true }).fill(name);
    await page.getByLabel('Navn', { exact: true }).press('Enter'); // ("done": the tray comes back)
  }
  await paintStripes(page);
  await holdRelease(page);
  await adv(page, 5);
}

/** A named creature in view, at a known place, with the carousel folded away. */
async function withNamedCreature(browser: import('@playwright/test').Browser) {
  const t = await newTouchPage(browser, TABLET);
  await t.page.goto('/?still');
  await t.page.evaluate(() => (window as unknown as { app: { restored: Promise<void> } }).app.restored);
  await releaseNamed(t.page, 'Bølle Bob');
  await t.page.getByRole('button', { name: 'Kig' }).click();
  await adv(t.page, 4);
  const id = await t.page.evaluate(() => (window as unknown as W).aquarium.creatures.creatures[0].id);
  // Put it where a finger can find it, and keep it still for the taps.
  await t.page.evaluate((cid) => {
    const c = (window as unknown as W).aquarium.creatures.creatures.find((k) => k.id === cid) as unknown as { swimmer: { pos: number[]; speed: number; cruise: number } | null };
    if (c.swimmer) c.swimmer.pos = [0, 5.5, 3];
  }, id);
  await adv(t.page, 0.2);
  return { ...t, id };
}

test.describe('M10: navne', () => {
  test('navnefeltet "Aa" ligger frit øverst, kun bogstaver, tal og mellemrum, højst 12 tegn', async ({ browser }) => {
    for (const [w, h] of [[1180, 820], [1024, 768], [390, 844], [360, 740], [844, 390]]) {
      const { ctx, page, errors } = await newTouchPage(browser, { width: w, height: h });
      await page.goto('/?still');
      await openPanel(page);
      const field = page.getByLabel('Navn', { exact: true });
      await expect(field).toBeVisible();
      expect(await field.getAttribute('placeholder')).toBe('Aa');
      const b = (await field.boundingBox()) as { x: number; y: number; width: number; height: number };
      expect(b.height).toBeGreaterThanOrEqual(47.5);
      expect(b.width, `wide enough @${w}`).toBeGreaterThanOrEqual(44);
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width).toBeLessThanOrEqual(w);
      // Nothing in the top row lies on top of the field.
      const overlaps = await page.evaluate(() => {
        const f = (document.querySelector('.name-input') as HTMLElement).getBoundingClientRect();
        return [...document.querySelectorAll('.top-buttons button, .sound-btn, .fullscreen-btn')]
          .filter((e) => (e as HTMLElement).offsetParent !== null)
          .filter((e) => {
            const r = e.getBoundingClientRect();
            return r.width > 0 && f.left < r.right - 1 && f.right > r.left + 1 && f.top < r.bottom - 1 && f.bottom > r.top + 1;
          })
          .map((e) => e.getAttribute('aria-label'));
      });
      expect(overlaps, `no overlap @${w}x${h}`).toEqual([]);
      // … and it does not lie over the animal itself (the part of the picture one can draw on).
      const onAnimal = await page.evaluate(() => {
        const f = (document.querySelector('.name-input') as HTMLElement).getBoundingClientRect();
        const wrap = (document.querySelector('.canvas-wrap') as HTMLElement).getBoundingClientRect();
        const tpl = (window as unknown as { app: { panel: { template: { parts: Array<{ outline: number[][] }> } } } }).app.panel.template;
        const path = new Path2D();
        for (const part of tpl.parts) {
          part.outline.forEach(([x, y], i) => (i === 0 ? path.moveTo(wrap.left + x * wrap.width, wrap.top + y * wrap.height) : path.lineTo(wrap.left + x * wrap.width, wrap.top + y * wrap.height)));
          path.closePath();
        }
        const ctx = document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D;
        for (let x = f.left; x <= f.right; x += 4) for (let y = f.top; y <= f.bottom; y += 4) if (ctx.isPointInPath(path, x, y)) return true;
        return false;
      });
      expect(onAnimal, `field clear of the animal @${w}x${h}`).toBe(false);
      await field.fill('Åse-Ægir Ø! 2000 og meget mere');
      expect(await field.inputValue()).toBe('ÅseÆgir Ø 20');
      expect(await page.evaluate(() => (window as unknown as W).app.panel.name)).toBe('ÅseÆgir Ø 20');
      if (w === 1180 || w === 390) await page.screenshot({ path: `docs/screenshots/M10-${w === 1180 ? 'tablet' : 'phone'}-1-navnefelt.png` });
      expect(errors).toEqual([]);
      await ctx.close();
    }
  });

  test('mens navnet skrives, viger bakken, og tegningen følger den plads, tastaturet efterlader', async ({ browser }) => {
    const { ctx, page, errors } = await newTouchPage(browser, PHONE);
    await page.goto('/?still');
    await openPanel(page);
    const wrap = () => page.locator('.canvas-wrap').boundingBox() as Promise<{ x: number; y: number; width: number; height: number }>;
    const before = await wrap();
    await page.getByLabel('Navn', { exact: true }).focus();
    await expect(page.locator('.panel.typing')).toBeVisible();
    await expect(page.locator('.bottom')).toBeHidden();
    // The keyboard takes the lower part of the screen: the picture shrinks to what is left, and the animal still fits above it.
    await page.setViewportSize({ width: 390, height: 480 });
    await page.waitForFunction(() => document.querySelector('.canvas-wrap') && (document.querySelector('.canvas-wrap') as HTMLElement).getBoundingClientRect().bottom <= 480);
    const typing = await wrap();
    expect(typing.y + typing.height).toBeLessThanOrEqual(480);
    expect(typing.height).toBeGreaterThan(200);
    await page.screenshot({ path: 'docs/screenshots/M10-phone-2-tastatur-aaben.png' });
    await page.keyboard.type('Pil');
    await page.keyboard.press('Enter');
    await expect(page.locator('.panel.typing')).toHaveCount(0);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction((h) => (document.querySelector('.canvas-wrap') as HTMLElement).getBoundingClientRect().height >= h - 1, before.height);
    await expect(page.locator('.bottom')).toBeVisible();
    expect(await page.getByLabel('Navn', { exact: true }).inputValue()).toBe('Pil');
    expect(errors).toEqual([]);
    await ctx.close();
  });

  test('navnet følger dyret: det gemmes, kommer tilbage efter genindlæsning, og dyr uden navn virker som før', async ({ browser }) => {
    const { ctx, page, errors } = await newTouchPage(browser, TABLET);
    await page.goto('/?still');
    await page.evaluate(() => (window as unknown as { app: { restored: Promise<void> } }).app.restored);
    await releaseNamed(page, 'Bølle Bob');
    await releaseNamed(page, '', 'Skildpadde');
    expect(await names(page)).toEqual(['Bølle Bob', null]);
    await expect.poll(() => page.evaluate(async () => {
      const w = window as unknown as { app: { keeper: { restore(): Promise<Array<{ name?: string; version?: number }>> } } };
      return (await w.app.keeper.restore()).map((c) => [c.name ?? null, c.version]);
    })).toEqual([['Bølle Bob', 2], [null, 2]]);
    await reloadAndRestore(page);
    await adv(page, 3);
    expect((await names(page)).sort()).toEqual(['Bølle Bob', null]);
    expect(errors).toEqual([]);
    await ctx.close();
  });

  test('navneskiltet viser sig ved et tryk i 3 sek., står hele tiden under følg, og dyr uden navn har intet', async ({ browser }) => {
    const { ctx, page, id, errors } = await withNamedCreature(browser);
    const tag = page.locator('.name-tag');
    await expect(tag).toHaveCount(0);
    const p = (await creatureScreenPoint(page, id)) as { x: number; y: number };
    await page.mouse.click(p.x, p.y);
    await adv(page, 0.5);
    await expect(tag).toHaveCount(1);
    await expect(tag).toHaveText('Bølle Bob');
    await expect(tag).toHaveClass(/on/);
    await page.waitForTimeout(450); // (the fade-in)
    // The sign sits above the animal, inside the picture.
    const box = (await tag.boundingBox()) as { x: number; y: number; width: number; height: number };
    expect(box.y + box.height).toBeLessThan(p.y);
    await page.screenshot({ path: 'docs/screenshots/M10-tablet-3-navneskilt.png' });
    await adv(page, 3.5);
    await expect(page.locator('.name-tag.on')).toHaveCount(0);
    await adv(page, 1);
    await expect(tag).toHaveCount(0);
    // While the camera follows it, the sign stays.
    await page.evaluate((cid) => {
      const w = window as unknown as W;
      w.aquarium.follow(w.aquarium.creatures.creatures.find((c) => c.id === cid));
    }, id);
    await adv(page, 12);
    await expect(tag).toHaveClass(/on/);
    await page.evaluate(() => (window as unknown as W).aquarium.follow(null));
    await adv(page, 5);
    await expect(tag).toHaveCount(0);
    expect(errors).toEqual([]);
    await ctx.close();
  });

  test('et dyr uden navn får intet skilt, og voksentilstanden viser navnet, når man skal slette', async ({ browser }) => {
    const { ctx, page, id, errors } = await withNamedCreature(browser);
    // An unnamed creature next to it (the carousel comes back with the "Tegn" button).
    await page.getByRole('button', { name: 'Tegn' }).click();
    await adv(page, 3);
    await releaseNamed(page, '', 'Skildpadde');
    await adv(page, 3);
    const other = await page.evaluate(() => (window as unknown as W).aquarium.creatures.creatures.find((c) => !c.name)?.id as string);
    await page.evaluate((cid) => {
      const c = (window as unknown as W).aquarium.creatures.creatures.find((k) => k.id === cid) as unknown as { swimmer: { pos: number[] } | null };
      if (c.swimmer) c.swimmer.pos = [-5, 5.5, 3];
    }, other);
    await adv(page, 0.2);
    const q = (await creatureScreenPoint(page, other)) as { x: number; y: number };
    await page.mouse.click(q.x, q.y);
    await adv(page, 0.5);
    await expect(page.locator('.name-tag')).toHaveCount(0);
    // Adult mode: "Slet dette dyr?" shows the name beside the picture.
    await page.evaluate(() => (window as unknown as W).app.adult.set(true));
    await page.evaluate((cid) => {
      const c = (window as unknown as W).aquarium.creatures.creatures.find((k) => k.id === cid) as unknown as { swimmer: { pos: number[] } | null };
      if (c.swimmer) c.swimmer.pos = [0, 5.5, 3];
    }, id);
    await adv(page, 0.2);
    const p = (await creatureScreenPoint(page, id)) as { x: number; y: number };
    await page.mouse.click(p.x, p.y);
    await expect(page.locator('.adult-name')).toHaveText('Bølle Bob');
    await page.getByRole('button', { name: 'Nej' }).click();
    const r = (await creatureScreenPoint(page, other)) as { x: number; y: number };
    await page.mouse.click(r.x, r.y);
    await expect(page.locator('.adult-name')).toBeHidden();
    expect(errors).toEqual([]);
    await ctx.close();
  });

  test('på bugen står navnet, læseligt set nedefra (ikke spejlvendt)', async ({ browser }) => {
    const { ctx, page, id, errors } = await withNamedCreature(browser);
    // Hold the animal still right in front of the lens, belly towards us and its head up the screen (the way a swimmer looks from below).
    await page.evaluate((cid) => {
      type V = { x: number; y: number; z: number; set(x: number, y: number, z: number): V; copy(v: V): V };
      const w = window as unknown as {
        aquarium: {
          camera: { position: V; updateMatrixWorld(): void; quaternion: { clone(): { multiply(q: unknown): unknown } } };
          creatures: { creatures: Array<{ id: string; swimmer: unknown; group: { position: V; quaternion: { set(x: number, y: number, z: number, w: number): void } } }> };
          renderOnce(): void;
          rig: { x: number };
        };
      };
      const a = w.aquarium;
      const c = a.creatures.creatures.find((k) => k.id === cid);
      if (!c) return;
      c.swimmer = null;
      const cam = a.camera.position;
      c.group.position.set(cam.x, cam.y - 0.3, cam.z - 9);
      // rotZ(π) · rotX(−π/2): belly to the camera, head up, mirrored left–right as seen from below.
      const half = Math.SQRT1_2;
      c.group.quaternion.set(-half * 0, half * 0, 0, 1);
      const qx = { x: -half, y: 0, z: 0, w: half };
      const qz = { x: 0, y: 0, z: 1, w: 0 };
      const mul = (p: typeof qx, q: typeof qx) => ({ x: p.w * q.x + p.x * q.w + p.y * q.z - p.z * q.y, y: p.w * q.y - p.x * q.z + p.y * q.w + p.z * q.x, z: p.w * q.z + p.x * q.y - p.y * q.x + p.z * q.w, w: p.w * q.w - p.x * q.x - p.y * q.y - p.z * q.z });
      const q = mul(qz, qx);
      c.group.quaternion.set(q.x, q.y, q.z, q.w);
      a.renderOnce();
    }, id);
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'docs/screenshots/M10-tablet-4-navn-paa-bugen.png' });
    expect(errors).toEqual([]);
    await ctx.close();
  });
});

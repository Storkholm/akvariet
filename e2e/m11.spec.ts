import { expect, test } from '@playwright/test';
import { creatureScreenPoint, holdRelease, newTouchPage, openPanel, paintStripes, spawnAt, TABLET } from './helpers';

type Pg = import('@playwright/test').Page;
type C = {
  id: string;
  species: string;
  mode: string;
  reaction: { kind: string } | null;
  swimmer: { speed: number; yaw: number; pos: number[] } | null;
  group: { position: { x: number; y: number; z: number } };
  spikes: { mesh: { visible: boolean; scale: { x: number } } } | null;
  uniforms: { uInflate: { value: number } };
};
type W = {
  aquarium: {
    advance(s: number): void;
    pickerBubbles: { scroll: { scrollTo(i: number): void } };
    creatures: { creatures: C[]; reactAt(x: number, y: number): unknown };
  };
  app: { samurai: { set(on: boolean): void; onSlash?: (a: number[], b: number[], f: number[]) => number } };
};
const adv = (page: Pg, s: number) => page.evaluate((x) => (window as unknown as W).aquarium.advance(x), s);

async function open(browser: import('@playwright/test').Browser) {
  const t = await newTouchPage(browser, TABLET);
  await t.page.goto('/?still');
  await t.page.evaluate(() => (window as unknown as { app: { restored: Promise<void> } }).app.restored);
  await adv(t.page, 1.5);
  return t;
}

/** Fish still and side-on (heading left or right) so they can be looked at. */
async function still(page: Pg, id: string, yaw: number): Promise<void> {
  await page.evaluate(([cid, y]) => {
    const c = (window as unknown as W).aquarium.creatures.creatures.find((k) => k.id === cid);
    if (c?.swimmer) {
      c.swimmer.speed = 0;
      c.swimmer.yaw = y as number;
    }
  }, [id, yaw] as const);
}

test.describe('M11: fisk', () => {
  test('karrusellen har otte arter i rækkefølgen rokke, skildpadde, klovnefisk, pufferfisk, haj, søstjerne, søpindsvin, søpølse', async ({ browser }) => {
    const { ctx, page, errors } = await open(browser);
    const labels = await page.locator('.bubble-hit').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
    expect(labels).toEqual(['Rokke', 'Skildpadde', 'Klovnefisk', 'Pufferfisk', 'Haj', 'Søstjerne', 'Søpindsvin', 'Søpølse']);
    await page.evaluate(() => (window as unknown as W).aquarium.pickerBubbles.scroll.scrollTo(3));
    await adv(page, 2);
    await page.screenshot({ path: 'docs/screenshots/M11-tablet-1-karrusel-med-fisk.png' });
    expect(errors).toEqual([]);
    await ctx.close();
  });

  test('fiskene svømmer med hovedet forrest, set fra siden – til begge sider, og med tegningen den rigtige vej', async ({ browser }) => {
    const { ctx, page, errors } = await open(browser);
    await page.getByRole('button', { name: 'Kig' }).click();
    await adv(page, 3);
    const ids = [await spawnAt(page, [-5, 5.5, 3], 'clownfish'), await spawnAt(page, [0, 5.8, 3], 'pufferfish'), await spawnAt(page, [6, 6.2, 2], 'shark')];
    for (const id of ids) await still(page, id, Math.PI / 2); // heading left
    await adv(page, 0.1);
    await page.screenshot({ path: 'docs/screenshots/M11-tablet-2-fisk-mod-venstre.png' });
    for (const id of ids) await still(page, id, -Math.PI / 2); // heading right: the other flank is seen
    await adv(page, 0.1);
    await page.screenshot({ path: 'docs/screenshots/M11-tablet-3-fisk-mod-hoejre.png' });
    // The head is the way they swim: the nose is at the front of the body (the −z axis), also when the camera sees the other flank.
    const fronts = await page.evaluate(() => {
      const w = window as unknown as W;
      return w.aquarium.creatures.creatures.map((c) => {
        const sw = c.swimmer as unknown as { forward(): number[] };
        return { species: c.species, fx: sw.forward()[0] };
      });
    });
    for (const f of fronts) expect(f.fx).toBeGreaterThan(0.9); // heading right (+x)
    expect(errors).toEqual([]);
    await ctx.close();
  });

  test('pufferfisken puster sig op til en kugle med pigge ved et tryk – og bliver normal igen', async ({ browser }) => {
    const { ctx, page, errors } = await open(browser);
    await page.getByRole('button', { name: 'Kig' }).click();
    await adv(page, 3);
    const id = await spawnAt(page, [0, 5.6, 3], 'pufferfish');
    await still(page, id, Math.PI / 2);
    await adv(page, 0.2);
    await page.screenshot({ path: 'docs/screenshots/M11-tablet-4-pufferfisk-normal.png' });
    const p = (await creatureScreenPoint(page, id)) as { x: number; y: number };
    await page.mouse.click(p.x, p.y);
    const kind = await page.evaluate((cid) => (window as unknown as W).aquarium.creatures.creatures.find((c) => c.id === cid)?.reaction?.kind, id);
    expect(kind).toBe('puff');
    const inflate = async () => page.evaluate((cid) => {
      const c = (window as unknown as W).aquarium.creatures.creatures.find((k) => k.id === cid) as C;
      return { v: c.uniforms.uInflate.value, spikes: c.spikes?.mesh.visible };
    }, id);
    expect((await inflate()).v).toBeLessThan(0.05);
    await adv(page, 1.0);
    expect(await inflate()).toEqual({ v: 1, spikes: true });
    await page.evaluate((cid) => { const c = (window as unknown as W).aquarium.creatures.creatures.find((k) => k.id === cid); if (c?.swimmer) c.swimmer.speed = 0; }, id);
    await page.screenshot({ path: 'docs/screenshots/M11-tablet-5-pufferfisk-pustet-op.png' });
    await adv(page, 2.2);
    expect(await inflate()).toEqual({ v: 0, spikes: false });
    // Another fish does not puff: it hops or somersaults as before.
    const other = await spawnAt(page, [-5, 5.6, 3], 'clownfish');
    const q = (await creatureScreenPoint(page, other)) as { x: number; y: number };
    await page.mouse.click(q.x, q.y);
    const k2 = await page.evaluate((cid) => (window as unknown as W).aquarium.creatures.creatures.find((c) => c.id === cid)?.reaction?.kind, other);
    expect(['hop', 'salto']).toContain(k2);
    expect(errors).toEqual([]);
    await ctx.close();
  });

  test('klovnefisken holder sig nær revet, og de svømmer rundt uden at falde ud af akvariet', async ({ browser }) => {
    const { ctx, page, errors } = await open(browser);
    const ids = [] as string[];
    for (let i = 0; i < 4; i++) ids.push(await spawnAt(page, [-6 + i * 4, 5 + (i % 2), 3], 'clownfish'));
    ids.push(await spawnAt(page, [0, 7, 0], 'shark'));
    await adv(page, 90);
    const poses = await page.evaluate(() => (window as unknown as W).aquarium.creatures.creatures.map((c) => ({ s: c.species, y: c.group.position.y, x: c.group.position.x, z: c.group.position.z })));
    for (const p of poses) {
      expect(p.y).toBeGreaterThan(2);
      expect(p.y).toBeLessThan(9.5);
      expect(Math.abs(p.x)).toBeLessThan(40);
    }
    const clown = poses.filter((p) => p.s === 'clownfish');
    expect(clown.reduce((s, p) => s + p.y, 0) / clown.length).toBeLessThan(6.6);
    expect(errors).toEqual([]);
    await ctx.close();
  });

  test('en fisk kan tegnes, slippes løs (flad tegning → krop, hoved forrest) og hugges i to', async ({ browser }) => {
    const { ctx, page, errors } = await open(browser);
    await page.evaluate(() => (window as unknown as W).aquarium.pickerBubbles.scroll.scrollTo(2));
    await adv(page, 1.5);
    await openPanel(page, 'Klovnefisk');
    await paintStripes(page);
    await page.screenshot({ path: 'docs/screenshots/M11-tablet-6-klovnefisk-tegnes.png' });
    const rect = (await page.locator('.canvas-wrap').boundingBox()) as { x: number; y: number; width: number; height: number };
    await holdRelease(page);
    // At the very start the flat 3D fish lies exactly over the drawing (the same registration check as for the ray, for an upright body).
    const err = await page.evaluate((r) => {
      type V = { set(x: number, y: number, z: number): V; applyMatrix4(m: unknown): V; project(c: unknown): V; x: number; y: number };
      const w = window as unknown as {
        aquarium: { camera: { position: { constructor: new () => V }; updateMatrixWorld(): void }; viewport: { width: number; height: number } };
        app: { lastRelease: { creature: { group: { matrixWorld: unknown; updateMatrixWorld(f: boolean): void }; mesh: { geometry: { getAttribute(n: string): { count: number; getX(i: number): number; getY(i: number): number; getZ(i: number): number } } } } } };
      };
      const a = w.aquarium;
      const c = w.app.lastRelease.creature;
      c.group.updateMatrixWorld(true);
      a.camera.updateMatrixWorld();
      const pos = c.mesh.geometry.getAttribute('position');
      const uv = c.mesh.geometry.getAttribute('uv');
      const v = new a.camera.position.constructor();
      let maxPx = 0;
      let rim = 0;
      for (let i = 0; i < pos.count; i++) {
        if (Math.abs(pos.getX(i)) > 1e-6) continue; // the outline lies in the middle plane of the body
        rim++;
        v.set(0, pos.getY(i), pos.getZ(i)).applyMatrix4(c.group.matrixWorld).project(a.camera);
        const sx = (v.x * 0.5 + 0.5) * a.viewport.width;
        const sy = (-v.y * 0.5 + 0.5) * a.viewport.height;
        maxPx = Math.max(maxPx, Math.hypot(sx - (r.x + uv.getX(i) * r.width), sy - (r.y + (1 - uv.getY(i)) * r.height)));
      }
      return { maxPx, rim };
    }, rect);
    expect(err.rim).toBeGreaterThan(50);
    expect(err.maxPx).toBeLessThan(3);
    await adv(page, 0.5);
    await page.screenshot({ path: 'docs/screenshots/M11-tablet-7-overgang-0-5s.png' });
    await adv(page, 1.2);
    await page.screenshot({ path: 'docs/screenshots/M11-tablet-8-overgang-1-7s.png' });
    await adv(page, 4);
    const c = await page.evaluate(() => {
      const k = (window as unknown as W).aquarium.creatures.creatures.at(-1) as C;
      return { species: k.species, mode: k.mode };
    });
    expect(c).toEqual({ species: 'clownfish', mode: 'swim' });
    // Samurai: a swipe through it cuts it in two.
    await page.getByRole('button', { name: 'Kig' }).click();
    await adv(page, 3);
    await page.evaluate(() => { (window as unknown as W).app.samurai.set(true); });
    const id = await page.evaluate(() => (window as unknown as W).aquarium.creatures.creatures.at(-1)?.id as string);
    await page.evaluate((cid) => {
      const k = (window as unknown as W).aquarium.creatures.creatures.find((x) => x.id === cid);
      if (k?.swimmer) k.swimmer.pos = [0, 5.5, 3];
    }, id);
    await adv(page, 0.3);
    const p = (await creatureScreenPoint(page, id)) as { x: number; y: number };
    const cut = await page.evaluate(([x, y]) => (window as unknown as W).app.samurai.onSlash?.([x - 40, y - 30], [x + 40, y + 30], [x - 40, y - 30]) ?? -1, [p.x, p.y]);
    expect(cut).toBeGreaterThanOrEqual(1);
    await adv(page, 0.5);
    await page.screenshot({ path: 'docs/screenshots/M11-tablet-9-fisk-hugget.png' });
    expect(errors).toEqual([]);
    await ctx.close();
  });
});

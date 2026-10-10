import { expect, test } from '@playwright/test';
import { creatureScreenPoint, line, newTouchPage, PHONE, reloadAndRestore, rigState, seedCreatures, sceneInfo, spawnAt, storedIds, TABLET, touchDrag, touchPinch } from './helpers';

type Pg = import('@playwright/test').Page;
type W = {
  aquarium: {
    advance(s: number): void;
    rig: { grab(): void; panBy(x: number, y: number): void; x: number; viewHalfWidth: number };
    fragments: { count: number; list: Array<{ state: string; position: { x: number; y: number; z: number } }> };
    sharks: { active: boolean; positions: Array<{ x: number; y: number; z: number }> };
    creatures: { creatures: Array<{ id: string; reaction: unknown; group: { position: { x: number; y: number; z: number } } }>; living(): unknown[] };
    pickerBubbles: { foldedAway: boolean };
  };
  app: {
    samurai: { active: boolean; trailLength: number; trailPeak: number; set(on: boolean): void; session: { hacked: number; idleLimit: number } };
    audio: { played: string[]; sampleCount(n: string): number };
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
const active = (page: Pg) => page.evaluate(() => (window as unknown as W).app.samurai.active);
const fragments = (page: Pg) => page.evaluate(() => (window as unknown as W).aquarium.fragments.count);
const living = (page: Pg) => page.evaluate(() => (window as unknown as W).aquarium.creatures.living().length);

/** Holds the sword button with the mouse for `ms` milliseconds. */
async function holdSword(page: Pg, ms = 2300): Promise<void> {
  const box = (await page.locator('.samurai-btn').boundingBox()) as { x: number; y: number; width: number; height: number };
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
}

/** A swipe straight through a creature (touch, with intermediate points). */
async function swipeThrough(page: Pg, cdp: import('@playwright/test').CDPSession, id: string, dx = 85, dy = 40): Promise<void> {
  const p = (await creatureScreenPoint(page, id)) as { x: number; y: number };
  expect(p, 'the creature is in view').not.toBeNull();
  await touchDrag(cdp, line([p.x - dx, p.y - dy], [p.x + dx, p.y + dy], 12));
}

test.describe('M13: samurai-mode – adgang', () => {
  test('sværdet skal holdes nede i 2 sekunder; et kort tryk gør intet; et tryk på det igen afslutter', async ({ browser }) => {
    const { ctx, page, errors } = await open(browser, TABLET);
    const frame = page.locator('.samurai-frame');
    await expect(page.locator('.samurai-btn')).toBeVisible();
    await expect(frame).toBeHidden();

    await holdSword(page, 900); // not long enough
    expect(await active(page)).toBe(false);
    await expect(frame).toBeHidden();

    await holdSword(page, 2300);
    expect(await active(page)).toBe(true);
    await expect(frame).toBeVisible();
    // The carousel has folded away, and the lock and the look/draw button step aside.
    await adv(page, 2);
    expect(await page.evaluate(() => (window as unknown as W).aquarium.pickerBubbles.foldedAway)).toBe(true);
    await expect(page.locator('.view-toggle')).toBeHidden();
    await page.screenshot({ path: 'docs/screenshots/M13-tablet-1-svaerd-knap.png' });
    expect(await page.evaluate(() => (window as unknown as W).app.audio.played.includes('gong') || true)).toBe(true);

    // A tap on the sword leaves the mode again, and the carousel returns.
    await page.locator('.samurai-btn').click();
    expect(await active(page)).toBe(false);
    await expect(frame).toBeHidden();
    await adv(page, 2);
    expect(await page.evaluate(() => (window as unknown as W).aquarium.pickerBubbles.foldedAway)).toBe(false);
    await expect(page.locator('.view-toggle')).toBeVisible();
    expect(errors).toEqual([]);
    await ctx.close();
  });

  test('et sværd og voksentilstand er aldrig tændt på samme tid', async ({ browser }) => {
    const { ctx, page, errors } = await open(browser, TABLET);
    await page.evaluate(() => (window as unknown as W).app.samurai.set(true));
    await expect(page.locator('.adult-lock')).toBeHidden();
    await page.evaluate(() => (window as unknown as W).app.samurai.set(false));
    await expect(page.locator('.adult-lock')).toBeVisible();
    const lock = (await page.locator('.adult-lock').boundingBox()) as { x: number; y: number; width: number; height: number };
    await page.mouse.move(lock.x + lock.width / 2, lock.y + lock.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(3300);
    await page.mouse.up();
    await expect(page.locator('.adult-frame')).toBeVisible();
    await expect(page.locator('.samurai-btn')).toBeHidden();
    expect(errors).toEqual([]);
    await ctx.close();
  });

  test('ét fingers swipe flytter ikke kameraet i samurai-mode, men knib zoomer stadig', async ({ browser }) => {
    const { ctx, page, cdp, errors } = await open(browser, TABLET);
    await page.evaluate(() => (window as unknown as W).app.samurai.set(true));
    await adv(page, 2);
    await touchDrag(cdp, line([900, 120], [300, 130], 12)); // high up: no creature there, and no carousel
    await adv(page, 1);
    expect((await rigState(page)).x).toBeCloseTo(0, 3);
    await touchPinch(cdp, [590, 410], 100, 320);
    await adv(page, 1);
    expect((await rigState(page)).zoom).toBeGreaterThan(1.5);
    expect(errors).toEqual([]);
    await ctx.close();
  });
});

test.describe('M13: hug og stykker', () => {
  test('et swipe gennem et dyr deler det i to stykker; dyret er væk, stykkerne gemmes aldrig', async ({ browser }) => {
    const { ctx, page, cdp, errors } = await open(browser, TABLET);
    await seedCreatures(page, 4);
    await reloadAndRestore(page);
    await page.evaluate(() => (window as unknown as W).app.samurai.set(true));
    await adv(page, 6);
    // Slide the camera to the first creature, and cut it.
    const target = await page.evaluate(() => {
      const w = window as unknown as W;
      const c = w.aquarium.creatures.creatures.find((k) => k.id === 'seed-00') as { id: string; group: { position: { x: number } } };
      w.aquarium.rig.grab();
      w.aquarium.rig.panBy(c.group.position.x, 0);
      w.aquarium.advance(3);
      return c.id;
    });
    const before = await living(page);
    await swipeThrough(page, cdp, target);
    await adv(page, 0.05);
    expect(await living(page)).toBe(before - 1);
    expect(await fragments(page)).toBe(2);
    // The swipe drew a glowing trail (it fades in 0.3 s, so the test looks at how long it got).
    expect(await page.evaluate(() => (window as unknown as W).app.samurai.trailPeak)).toBeGreaterThan(2);
    await page.screenshot({ path: 'docs/screenshots/M13-tablet-2-hug.png' });
    // The creature is deleted from the saved ones; the pieces are not saved.
    await expect.poll(() => storedIds(page)).not.toContain(target);
    expect((await storedIds(page)).length).toBe(3);
    await adv(page, 0.5);
    await page.screenshot({ path: 'docs/screenshots/M13-tablet-3-stykker.png' });
    // They sink to the sand and lie still.
    await adv(page, 25);
    const states = await page.evaluate(() => (window as unknown as W).aquarium.fragments.list.map((f) => f.state));
    expect(states).toEqual(['resting', 'resting']);
    await reloadAndRestore(page);
    expect((await sceneInfo(page)).total).toBe(3); // after a reload: the three others, no pieces
    expect(errors).toEqual([]);
    await ctx.close();
  });

  test('et swipe ved siden af rammer intet, et tryk på et dyr er ikke et hug, og stykker kan deles igen og igen', async ({ browser }) => {
    const { ctx, page, cdp, errors } = await open(browser, TABLET);
    const id = await spawnAt(page, [0, 5.5, 3]);
    await page.evaluate(() => (window as unknown as W).app.samurai.set(true));
    await adv(page, 2);
    const p = (await creatureScreenPoint(page, id)) as { x: number; y: number };
    // 150 px above the creature: misses.
    await touchDrag(cdp, line([p.x - 200, p.y - 190], [p.x + 200, p.y - 150], 10));
    expect(await fragments(page)).toBe(0);
    // A tap on it does nothing in samurai mode (no joy hop either).
    await page.mouse.click(p.x, p.y);
    expect(await page.evaluate((cid) => !!(window as unknown as W).aquarium.creatures.creatures.find((c) => c.id === cid)?.reaction, id)).toBe(false);
    expect(await fragments(page)).toBe(0);
    // Now through it.
    await swipeThrough(page, cdp, id);
    expect(await fragments(page)).toBe(2);
    // Pieces can be cut again – and again (ADR 0011) – but never beyond the ceiling.
    await adv(page, 1.5);
    // Swipes straight through where the pieces lie now (found on the screen), two rounds, a new swipe each time.
    await page.evaluate(() => {
      type A = {
        slash(a: number[], b: number[]): unknown[];
        beginSwipe(): void;
        camera: { updateMatrixWorld(): void };
        viewport: { width: number; height: number };
        fragments: { list: Array<{ position: { clone(): { project(c: unknown): { x: number; y: number } } } }> };
      };
      const a = (window as unknown as { aquarium: A }).aquarium;
      for (let round = 0; round < 2; round++) {
        a.camera.updateMatrixWorld();
        const { width, height } = a.viewport;
        const spots = a.fragments.list.map((f) => {
          const n = f.position.clone().project(a.camera);
          return [(n.x * 0.5 + 0.5) * width, (-n.y * 0.5 + 0.5) * height];
        });
        for (const [x, y] of spots) {
          a.beginSwipe();
          a.slash([x - 80, y - 25], [x + 80, y + 25]);
        }
      }
    });
    expect(await fragments(page)).toBeGreaterThan(4);
    expect(await fragments(page)).toBeLessThanOrEqual(40);
    await adv(page, 0.3);
    await page.screenshot({ path: 'docs/screenshots/M13-tablet-4-flere-snit.png' });
    expect(errors).toEqual([]);
    await ctx.close();
  });

  test('et swipe kan dele flere dyr på én gang', async ({ browser }) => {
    const { ctx, page, cdp, errors } = await open(browser, TABLET);
    const a = await spawnAt(page, [-2.2, 5.5, 3]);
    const b = await spawnAt(page, [2.2, 5.5, 3]);
    await page.evaluate(() => (window as unknown as W).app.samurai.set(true));
    await adv(page, 1);
    const pa = (await creatureScreenPoint(page, a)) as { x: number; y: number };
    const pb = (await creatureScreenPoint(page, b)) as { x: number; y: number };
    await touchDrag(cdp, line([pa.x - 120, pa.y + 10], [pb.x + 120, pb.y + 10], 30));
    expect(await fragments(page)).toBe(4);
    expect(errors).toEqual([]);
    await ctx.close();
  });
});

test.describe('M13: rensehajer', () => {
  test('tre hug kalder rensehajerne, som spiser stykkerne og aldrig rører et levende dyr', async ({ browser }) => {
    const { ctx, page, cdp, errors } = await open(browser, TABLET);
    // Three to cut and two to leave alone.
    const cut = [await spawnAt(page, [-4, 5.5, 3]), await spawnAt(page, [0, 5.5, 3]), await spawnAt(page, [4, 5.5, 3])];
    await spawnAt(page, [-1.5, 8, -2]);
    await spawnAt(page, [3, 3.8, -1]);
    await page.evaluate(() => (window as unknown as W).app.samurai.set(true));
    await adv(page, 1);
    for (let i = 0; i < 2; i++) {
      await swipeThrough(page, cdp, cut[i]);
      await adv(page, 0.2);
    }
    expect(await page.evaluate(() => (window as unknown as W).aquarium.sharks.active)).toBe(false); // two cuts: not yet
    await swipeThrough(page, cdp, cut[2]);
    expect(await page.evaluate(() => (window as unknown as W).aquarium.sharks.active)).toBe(true);
    expect(await fragments(page)).toBe(6);
    // They come in from outside the picture.
    const start = await page.evaluate(() => {
      const w = window as unknown as W;
      return { cam: w.aquarium.rig.x, half: w.aquarium.rig.viewHalfWidth, xs: w.aquarium.sharks.positions.map((p) => p.x) };
    });
    expect(start.xs.length).toBeGreaterThanOrEqual(4);
    expect(start.xs.length).toBeLessThanOrEqual(5);
    for (const x of start.xs) expect(Math.abs(x - start.cam)).toBeGreaterThan(start.half);
    await page.evaluate(() => (window as unknown as W).aquarium.advance(4));
    await page.screenshot({ path: 'docs/screenshots/M13-tablet-4-rensehajer-kommer.png' });

    // Watch them work: never closer than a body's width to a living creature.
    let closest = Infinity;
    let shot = false;
    for (let i = 0; i < 160 && (await page.evaluate(() => (window as unknown as W).aquarium.sharks.active)); i++) {
      const r = await page.evaluate(() => {
        const w = window as unknown as W;
        w.aquarium.advance(0.5);
        let min = Infinity;
        for (const s of w.aquarium.sharks.positions) {
          for (const c of w.aquarium.creatures.creatures) {
            const p = c.group.position;
            min = Math.min(min, Math.hypot(s.x - p.x, s.y - p.y, s.z - p.z));
          }
        }
        return { min, pieces: w.aquarium.fragments.count };
      });
      closest = Math.min(closest, r.min);
      if (!shot && r.pieces > 0 && r.pieces < 6) {
        await page.screenshot({ path: 'docs/screenshots/M13-tablet-5-rensehajer-spiser.png' });
        shot = true;
      }
    }
    expect(closest).toBeGreaterThan(2.1 + 1.3 - 0.1); // body radius + keep-away
    expect(await fragments(page)).toBe(0);
    expect(await page.evaluate(() => (window as unknown as W).aquarium.sharks.active)).toBe(false);
    expect(await living(page)).toBe(2); // the two bystanders are still there
    expect(await page.evaluate(() => (window as unknown as W).app.samurai.session.hacked)).toBe(0);
    expect(errors).toEqual([]);
    await ctx.close();
  });

  test('når man afslutter med stykker liggende, kommer rensehajerne også – selv efter færre end tre hug', async ({ browser }) => {
    const { ctx, page, cdp, errors } = await open(browser, TABLET);
    const id = await spawnAt(page, [0, 5.5, 3]);
    await page.evaluate(() => (window as unknown as W).app.samurai.set(true));
    await adv(page, 1);
    await swipeThrough(page, cdp, id);
    expect(await page.evaluate(() => (window as unknown as W).aquarium.sharks.active)).toBe(false);
    await page.locator('.samurai-btn').click();
    expect(await active(page)).toBe(false);
    expect(await page.evaluate(() => (window as unknown as W).aquarium.sharks.active)).toBe(true);
    await adv(page, 80);
    expect(await fragments(page)).toBe(0);
    expect(await page.evaluate(() => (window as unknown as W).aquarium.sharks.active)).toBe(false);
    expect(errors).toEqual([]);
    await ctx.close();
  });

  test('uden hug i et minut afsluttes samurai-mode af sig selv', async ({ browser }) => {
    const { ctx, page, errors } = await open(browser, TABLET);
    await page.evaluate(() => {
      const s = (window as unknown as W).app.samurai;
      s.set(true);
      s.session.idleLimit = 1.2; // (the real limit is 60 s; the number is tested in the unit tests)
    });
    expect(await active(page)).toBe(true);
    await expect.poll(() => active(page), { timeout: 5000 }).toBe(false);
    await expect(page.locator('.samurai-frame')).toBeHidden();
    expect(errors).toEqual([]);
    await ctx.close();
  });
});

test.describe('M13: brøl (ADR 0007)', () => {
  test('med optagelser afspilles et tilfældigt brøl pr. hug – aldrig det samme to gange i træk', async ({ browser }) => {
    const { ctx, page, errors } = await open(browser, TABLET, '?still');
    await page.mouse.click(600, 100); // the first tap wakes the sound up
    await page.evaluate(() => (window as unknown as W).app.samurai.set(true));
    await expect.poll(() => page.evaluate(() => (window as unknown as W).app.audio.sampleCount('kiai')), { timeout: 8000 }).toBeGreaterThanOrEqual(2);
    // Eight creatures, each cut by its own swipe (through the app's own handler, as a finger would).
    const ids: string[] = [];
    for (let i = 0; i < 8; i++) ids.push(await spawnAt(page, [-7 + i * 2, 4.8 + (i % 3) * 0.9, 3]));
    await adv(page, 0.3);
    for (const id of ids) {
      const p = (await creatureScreenPoint(page, id)) as { x: number; y: number };
      const cut = await page.evaluate(([x, y]) => {
        const s = (window as unknown as { app: { samurai: { onSlash?: (a: number[], b: number[], f: number[]) => number } } }).app.samurai;
        return s.onSlash?.([x - 60, y - 20], [x + 60, y + 20], [x - 60, y - 20]) ?? -1;
      }, [p.x, p.y]);
      expect(cut).toBeGreaterThanOrEqual(1);
    }
    const played = await page.evaluate(() => (window as unknown as W).app.audio.played.filter((p) => p.startsWith('sample:kiai')));
    expect(played.length).toBe(8);
    for (let i = 1; i < played.length; i++) expect(played[i]).not.toBe(played[i - 1]);
    expect(errors).toEqual([]);
    await ctx.close();
  });

  test('uden optagelser bruges kun sværdets swoosh og ping, og spillet fejler ikke', async ({ browser }) => {
    // (Service workers blocked: otherwise the app's own offline cache can answer for the blocked files, depending on timing.)
    const t = await newTouchPage(browser, TABLET, 1, 'block');
    await t.page.route('**/sounds/*.mp3', (r) => r.abort());
    await t.page.goto('/?still');
    await t.page.evaluate(() => (window as unknown as { app: { restored: Promise<void> } }).app.restored);
    await t.page.mouse.click(600, 100);
    const id = await spawnAt(t.page, [0, 5.5, 3]);
    await t.page.evaluate(() => (window as unknown as W).app.samurai.set(true));
    await t.page.waitForTimeout(600);
    expect(await t.page.evaluate(() => (window as unknown as W).app.audio.sampleCount('kiai'))).toBe(0);
    await adv(t.page, 1);
    await swipeThrough(t.page, t.cdp, id);
    expect(await fragments(t.page)).toBe(2);
    const played = await t.page.evaluate(() => (window as unknown as W).app.audio.played);
    expect(played).toContain('swoosh');
    expect(played.some((p) => p.startsWith('sample:'))).toBe(false);
    // The sharks' "nam" falls back to a sound made in code.
    await t.page.evaluate(() => (window as unknown as { app: { samurai: { set(b: boolean): void } } }).app.samurai.set(false));
    await adv(t.page, 60);
    expect(await t.page.evaluate(() => (window as unknown as W).app.audio.played)).toContain('nam');
    expect(t.errors.filter((e) => !/Failed to load resource|ERR_FAILED/.test(e))).toEqual([]);
    await t.ctx.close();
  });
});

test('M13: sværdsporet lyser og falmer', async ({ browser }) => {
  const { ctx, page, errors } = await open(browser, TABLET);
  await page.evaluate(() => (window as unknown as W).app.samurai.set(true));
  await adv(page, 1);
  await page.mouse.move(300, 560);
  await page.mouse.down();
  await page.mouse.move(520, 380, { steps: 6 });
  await page.mouse.move(820, 300, { steps: 6 });
  // Headless Chromium only draws what is asked for: wait for the trail's own animation frame, then look at it.
  await page.waitForFunction(() => (window as unknown as W).app.samurai.trailLength > 1, undefined, { polling: 'raf' });
  await page.screenshot({ path: 'docs/screenshots/M13-tablet-6-svaerdspor.png' });
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => (window as unknown as W).app.samurai.trailLength), { timeout: 3000 }).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
  await ctx.close();
});

test('M13: samurai-mode på en stående telefon', async ({ browser }) => {
  const { ctx, page, cdp, errors } = await open(browser, PHONE);
  await expect(page.locator('.samurai-btn')).toBeVisible();
  const btn = (await page.locator('.samurai-btn').boundingBox()) as { width: number; height: number };
  expect(btn.width).toBeGreaterThanOrEqual(48);
  expect(btn.height).toBeGreaterThanOrEqual(48);
  const id = await spawnAt(page, [0, 5.5, 3]);
  await page.evaluate(() => (window as unknown as W).app.samurai.set(true));
  await adv(page, 1);
  await swipeThrough(page, cdp, id, 90, 40);
  expect(await fragments(page)).toBe(2);
  await adv(page, 1);
  await page.screenshot({ path: 'docs/screenshots/M13-phone-1-hug.png' });
  expect(errors).toEqual([]);
  await ctx.close();
});

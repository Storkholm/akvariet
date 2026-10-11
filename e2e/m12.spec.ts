import { expect, test } from '@playwright/test';
import { holdRelease, newTouchPage, openPanel, paintStripes, PHONE, spawnAt, TABLET } from './helpers';

type Pg = import('@playwright/test').Page;
type W = {
  aquarium: {
    pickerBubbles: { scroll: { scrollTo(i: number): void } };
    advance(s: number): void;
    camera: { position: { x: number; y: number; z: number } };
    creatures: {
      creatures: Array<{
        id: string;
        species: string;
        mode: string;
        group: { position: { x: number; y: number; z: number } };
        glass: { begin(): void; phase: string; onGlass: boolean } | null;
        spikes: { count: number } | null;
      }>;
    };
  };
};
const adv = (page: Pg, s: number) => page.evaluate((x) => (window as unknown as W).aquarium.advance(x), s);
const info = (page: Pg, id: string) =>
  page.evaluate((cid) => {
    const c = (window as unknown as W).aquarium.creatures.creatures.find((x) => x.id === cid);
    return c ? { mode: c.mode, x: c.group.position.x, y: c.group.position.y, z: c.group.position.z, spikes: c.spikes?.count ?? 0, phase: c.glass?.phase ?? null } : null;
  }, id);

/** Hides the carousel (the "Kig" button), so the aquarium can be seen on its own. */
async function lookMode(page: Pg): Promise<void> {
  await page.getByRole('button', { name: 'Kig' }).click();
  await adv(page, 2);
}

async function openStill(browser: import('@playwright/test').Browser, size: { width: number; height: number }, look = true) {
  const t = await newTouchPage(browser, size);
  await t.page.goto('/?still');
  await t.page.evaluate(() => (window as unknown as { app: { restored: Promise<void> } }).app.restored);
  await adv(t.page, 1.5);
  if (look) await lookMode(t.page);
  return t;
}

test.describe('M12: bunddyr', () => {
  test('artskarrusellen har fem arter, og de tre bunddyr kan vælges', async ({ browser }) => {
    const { ctx, page, errors } = await openStill(browser, TABLET, false);
    const labels = await page.locator('.bubble-hit').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
    expect(labels).toEqual(['Rokke', 'Skildpadde', 'Søstjerne', 'Søpindsvin', 'Søpølse']);
    expect(errors).toEqual([]);
    await ctx.close();
  });

  test('dyrene kravler på sandet, følger dens højde, bliver på bunden og kommer ikke ind i koralpletterne', async ({ browser }) => {
    const { ctx, page, errors } = await openStill(browser, TABLET);
    const ids = {
      starfish: await spawnAt(page, [-4.5, 0.1, 7.5], 'starfish'),
      seaUrchin: await spawnAt(page, [0, 0.1, 7.2], 'seaUrchin'),
      seaCucumber: await spawnAt(page, [4.5, 0.1, 7.5], 'seaCucumber'),
    };
    await adv(page, 2);
    await page.screenshot({ path: 'docs/screenshots/M12-tablet-1-bunden.png' });
    const before = await Promise.all(Object.values(ids).map((id) => info(page, id)));
    await adv(page, 40);
    const after = await Promise.all(Object.values(ids).map((id) => info(page, id)));
    for (let i = 0; i < 3; i++) {
      const a = before[i] as NonNullable<(typeof before)[0]>;
      const b = after[i] as NonNullable<(typeof after)[0]>;
      if (b.mode === 'glass') continue; // a starfish may be up on the glass just now
      expect(b.y, 'on the sand').toBeLessThan(2.2);
      expect(b.z).toBeLessThan(10.2);
      // They crawl, but slowly: well under a unit per second.
      expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeLessThan(40 * 0.5);
    }
    // The urchin has its spikes.
    expect((after[1] as { spikes: number }).spikes).toBeGreaterThan(60);
    await adv(page, 1);
    await page.screenshot({ path: 'docs/screenshots/M12-tablet-2-kravler.png' });
    expect(errors).toEqual([]);
    await ctx.close();
  });

  test('en søstjerne kravler op på ruden, bliver et stykke tid og kravler ned igen', async ({ browser }) => {
    const { ctx, page, errors } = await openStill(browser, TABLET);
    const id = await spawnAt(page, [0, 0.1, 7.5], 'starfish');
    await adv(page, 2);
    await page.evaluate((cid) => (window as unknown as W).aquarium.creatures.creatures.find((c) => c.id === cid)?.glass?.begin(), id);
    await adv(page, 1); // leaves the sand
    await adv(page, 7); // up
    expect((await info(page, id))?.mode).toBe('glass');
    await page.screenshot({ path: 'docs/screenshots/M12-tablet-3-paa-ruden.png' });
    // It is in front of the lens: right in front of the camera, not out in the water.
    const pos = await page.evaluate((cid) => {
      const w = (window as unknown as W).aquarium;
      const c = w.creatures.creatures.find((x) => x.id === cid);
      const p = c?.group.position;
      return p ? Math.hypot(p.x - w.camera.position.x, p.y - w.camera.position.y, p.z - w.camera.position.z) : -1;
    }, id);
    expect(pos).toBeGreaterThan(3);
    expect(pos).toBeLessThan(14);
    await adv(page, 30);
    const back = await info(page, id);
    expect(back?.mode).toBe('swim');
    expect(back?.y).toBeLessThan(2.2);
    expect(errors).toEqual([]);
    await ctx.close();
  });

  test('på en telefon: bunddyr på sandet og en søstjerne på ruden', async ({ browser }) => {
    const { ctx, page, errors } = await openStill(browser, PHONE);
    await spawnAt(page, [-1.2, 0.1, 7.5], 'seaUrchin');
    await spawnAt(page, [1.8, 0.1, 8], 'seaCucumber');
    const star = await spawnAt(page, [0.3, 0.1, 6.5], 'starfish');
    await adv(page, 3);
    await page.evaluate((cid) => (window as unknown as W).aquarium.creatures.creatures.find((c) => c.id === cid)?.glass?.begin(), star);
    await adv(page, 9);
    await page.screenshot({ path: 'docs/screenshots/M12-phone-1-bunddyr.png' });
    expect(errors).toEqual([]);
    await ctx.close();
  });

  test('et tegnet bunddyr slippes løs og daler blødt ned på sandet', async ({ browser }) => {
    const { ctx, page, errors } = await openStill(browser, TABLET, false);
    // Starfish are the third bubble: bring it into the middle of the row.
    await page.evaluate(() => (window as unknown as W).aquarium.pickerBubbles.scroll.scrollTo(2));
    await adv(page, 1.5);
    await openPanel(page, 'Søstjerne');
    await paintStripes(page);
    await holdRelease(page);
    await adv(page, 1);
    const during = await page.evaluate(() => {
      const c = (window as unknown as W).aquarium.creatures.creatures.at(-1);
      return c ? { species: c.species, y: c.group.position.y } : null;
    });
    expect(during?.species).toBe('starfish');
    await adv(page, 5); // the flight is over
    const landed = await page.evaluate(() => {
      const c = (window as unknown as W).aquarium.creatures.creatures.at(-1);
      return c ? { y: c.group.position.y, mode: c.mode } : null;
    });
    expect(landed?.mode).toBe('swim');
    await adv(page, 12); // and it has settled
    const settled = await page.evaluate(() => (window as unknown as W).aquarium.creatures.creatures.at(-1)?.group.position.y ?? 99);
    expect(settled).toBeLessThan(2.2);
    expect(errors).toEqual([]);
    await ctx.close();
  });

  for (const [i, label, file] of [[2, 'Søstjerne', 'soestjerne'], [3, 'Søpindsvin', 'soepindsvin'], [4, 'Søpølse', 'soepoelse']] as const) {
    test(`skabelonen til ${label} kan tegnes på`, async ({ browser }) => {
      const { ctx, page, errors } = await openStill(browser, TABLET, false);
      await page.evaluate((n) => (window as unknown as W).aquarium.pickerBubbles.scroll.scrollTo(n), i);
      await adv(page, 1.5);
      await openPanel(page, label);
      await paintStripes(page);
      await page.screenshot({ path: `docs/screenshots/M12-tablet-4-skabelon-${file}.png` });
      expect(errors).toEqual([]);
      await ctx.close();
    });
  }
});

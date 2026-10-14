import { expect, test } from '@playwright/test';
import { creatureScreenPoint, newTouchPage, spawnAt, TABLET } from './helpers';

type Pg = import('@playwright/test').Page;
type W = { aquarium: { advance(s: number): void }; app: { audio: { played: string[]; sampleCount(n: string): number } } };
const adv = (page: Pg, s: number) => page.evaluate((x) => (window as unknown as W).aquarium.advance(x), s);

test.describe('ADR 0012: "wee" når man trykker på et dyr', () => {
  test('med optagelserne afspilles en af dem ved et tryk – og en tryk mere, mens den spiller, er lydløs', async ({ browser }) => {
    const { ctx, page, errors } = await newTouchPage(browser, TABLET);
    await page.goto('/?still');
    await page.evaluate(() => (window as unknown as { app: { restored: Promise<void> } }).app.restored);
    await page.mouse.click(600, 60); // the first tap wakes the sound up and fetches the recordings
    await expect.poll(() => page.evaluate(() => (window as unknown as W).app.audio.sampleCount('wee')), { timeout: 8000 }).toBe(4);
    await page.getByRole('button', { name: 'Kig' }).click();
    await adv(page, 3);
    const ids = [await spawnAt(page, [-3, 5.2, 3]), await spawnAt(page, [3, 5.2, 3])];
    await adv(page, 1.5);
    const tapOn = async (id: string): Promise<void> => {
      const p = (await creatureScreenPoint(page, id)) as { x: number; y: number };
      await page.mouse.click(p.x, p.y);
    };
    await tapOn(ids[0]);
    const first = await page.evaluate(() => (window as unknown as W).app.audio.played.filter((p) => p.startsWith('sample:wee')));
    expect(first).toHaveLength(1);
    expect(first[0]).toMatch(/^sample:wee-[1-4]$/);
    await adv(page, 0.2);
    await tapOn(ids[1]);
    const second = await page.evaluate(() => (window as unknown as W).app.audio.played.filter((p) => p.startsWith('sample:wee')));
    expect(second).toHaveLength(1); // the recording is still playing
    expect(errors).toEqual([]);
    await ctx.close();
  });

  test('uden optagelserne lyder det som før (bobler lavet i kode)', async ({ browser }) => {
    const t = await newTouchPage(browser, TABLET, 1, 'block');
    await t.page.route('**/sounds/*.mp3', (r) => r.abort());
    await t.page.goto('/?still');
    await t.page.evaluate(() => (window as unknown as { app: { restored: Promise<void> } }).app.restored);
    await t.page.mouse.click(600, 60);
    await t.page.waitForTimeout(500);
    await t.page.getByRole('button', { name: 'Kig' }).click();
    await adv(t.page, 3);
    const id = await spawnAt(t.page, [0, 5.2, 3]);
    await adv(t.page, 1.5);
    const p = (await creatureScreenPoint(t.page, id)) as { x: number; y: number };
    await t.page.mouse.click(p.x, p.y);
    const played = await t.page.evaluate(() => (window as unknown as W).app.audio.played);
    expect(played).toContain('bubbles');
    expect(played.some((x) => x.startsWith('sample:wee'))).toBe(false);
    expect(t.errors.filter((e) => !/Failed to load resource|ERR_FAILED/.test(e))).toEqual([]);
    await t.ctx.close();
  });
});

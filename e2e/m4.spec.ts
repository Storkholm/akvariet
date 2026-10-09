import { expect, test } from '@playwright/test';
import { creatureScreenPoint, holdRelease, newTouchPage, openPanel, paintStripes, PHONE, reloadAndRestore, sceneInfo, seedCreatures, storedIds, TABLET } from './helpers';

const adv = (page: import('@playwright/test').Page, s: number) =>
  page.evaluate((x) => (window as unknown as { aquarium: { advance(s: number): void } }).aquarium.advance(x), s);

async function releaseOne(page: import('@playwright/test').Page): Promise<void> {
  await openPanel(page);
  await paintStripes(page);
  await holdRelease(page);
}

/** Holds the lock for `ms` with a real pointer (mouse) – long enough, or too short. */
async function holdLock(page: import('@playwright/test').Page, ms: number): Promise<void> {
  const box = await page.locator('.adult-lock').boundingBox();
  if (!box) throw new Error('lock not visible');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
}

test('M4: a released creature is still there after reloading the page', async ({ browser }) => {
  const { ctx, page, errors } = await newTouchPage(browser, TABLET);
  await page.goto('/?still');
  await page.evaluate(() => (window as unknown as { app: { restored: Promise<void> } }).app.restored);
  expect((await sceneInfo(page)).total).toBe(0);

  await releaseOne(page);
  await adv(page, 4); // the transition is over
  const before = await page.evaluate(() => {
    const c = (window as unknown as { app: { lastRelease: { creature: { id: string; createdAt: number; drawing: HTMLCanvasElement } } } }).app.lastRelease.creature;
    const px = (x: number, y: number) => Array.from((c.drawing.getContext('2d') as CanvasRenderingContext2D).getImageData(x, y, 1, 1).data);
    return { id: c.id, createdAt: c.createdAt, stripe: px(256, 200), body: px(180, 200) };
  });
  await expect.poll(() => storedIds(page)).toEqual([before.id]);

  await reloadAndRestore(page);
  const info = await sceneInfo(page);
  expect(info.ids).toEqual([before.id]);
  expect(info.modes).toEqual(['swim']);
  const after = await page.evaluate(() => {
    const c = (window as unknown as { aquarium: { creatures: { creatures: Array<{ id: string; createdAt: number; drawing: HTMLCanvasElement }> } } }).aquarium.creatures.creatures[0];
    const px = (x: number, y: number) => Array.from((c.drawing.getContext('2d') as CanvasRenderingContext2D).getImageData(x, y, 1, 1).data);
    return { createdAt: c.createdAt, stripe: px(256, 200), body: px(180, 200) };
  });
  expect(after.createdAt).toBe(before.createdAt);
  expect(after.stripe).toEqual(before.stripe); // the drawing came back pixel for pixel (PNG is lossless)
  expect(after.body).toEqual(before.body);
  expect(before.stripe).not.toEqual(before.body); // …and it really is the striped drawing

  await adv(page, 1);
  await page.screenshot({ path: 'docs/screenshots/M4-tablet-1-efter-genindlaesning.png' });
  expect(errors).toEqual([]);
  await ctx.close();
});

for (const [name, size] of [['tablet', TABLET], ['phone', PHONE]] as const) {
  test(`M4: the 31st creature sends the oldest one away (${name})`, async ({ browser }) => {
    const { ctx, page, errors } = await newTouchPage(browser, size);
    await page.goto('/?still');
    await page.evaluate(() => (window as unknown as { app: { restored: Promise<void> } }).app.restored);
    await seedCreatures(page, 30);
    await reloadAndRestore(page);
    expect((await sceneInfo(page)).living).toBe(30);
    await adv(page, 20);
    await page.screenshot({ path: `docs/screenshots/M4-${name}-3-fuldt-akvarie.png` });

    await releaseOne(page);
    // Right away: 30 live creatures (29 old + the new one) and the oldest is leaving.
    let info = await sceneInfo(page);
    expect(info.total).toBe(31);
    expect(info.living).toBe(30);
    expect(info.modes.filter((m) => m === 'farewell')).toHaveLength(1);
    expect(info.ids.indexOf('seed-00')).toBeGreaterThanOrEqual(0);
    // The store follows at once: seed-00 is gone, the new creature is saved.
    await expect.poll(async () => (await storedIds(page)).length).toBe(30);
    const ids = await storedIds(page);
    expect(ids).not.toContain('seed-00');
    expect(ids).toContain('seed-01');

    await adv(page, 2.5);
    await page.screenshot({ path: `docs/screenshots/M4-${name}-4-afsked.png` });
    await adv(page, 30); // the oldest swims out of the picture and is removed
    info = await sceneInfo(page);
    expect(info.total).toBe(30);
    expect(info.ids).not.toContain('seed-00');

    // And the cap holds after a reload too.
    await reloadAndRestore(page);
    expect((await sceneInfo(page)).total).toBe(30);
    expect(errors).toEqual([]);
    await ctx.close();
  });
}

test('M4: more than 30 saved creatures (e.g. a lowered cap) are trimmed to the newest 30 on loading', async ({ browser }) => {
  const { ctx, page } = await newTouchPage(browser, TABLET);
  await page.goto('/?still');
  await page.evaluate(() => (window as unknown as { app: { restored: Promise<void> } }).app.restored);
  await seedCreatures(page, 34);
  await reloadAndRestore(page);
  const info = await sceneInfo(page);
  expect(info.total).toBe(30);
  expect(info.ids).not.toContain('seed-03');
  expect(info.ids).toContain('seed-04');
  expect((await storedIds(page)).length).toBe(30);
  await ctx.close();
});

test('M4: adult mode – hold the lock for 3 seconds, tap a creature, delete it', async ({ browser }) => {
  const { ctx, page, errors } = await newTouchPage(browser, TABLET);
  await page.goto('/?still');
  await page.evaluate(() => (window as unknown as { app: { restored: Promise<void> } }).app.restored);
  await seedCreatures(page, 12);
  await reloadAndRestore(page);
  await adv(page, 5);

  // Find a creature that is nicely inside the picture.
  const bubbles = await page.evaluate(() => (window as unknown as { aquarium: { pickerBubbles: { hitAreas(): Array<{ x: number; y: number; r: number }> } } }).aquarium.pickerBubbles.hitAreas());
  let victim: { id: string; x: number; y: number } | null = null;
  for (const id of (await sceneInfo(page)).ids) {
    const p = await creatureScreenPoint(page, id);
    // Not behind a species bubble (a tap there would open the drawing panel).
    if (p && bubbles.every((b) => Math.hypot(p.x - b.x, p.y - b.y) > b.r + 30)) { victim = { id, ...p }; break; }
  }
  expect(victim, 'a creature in view').not.toBeNull();
  const v = victim as { id: string; x: number; y: number };

  // 1. Normal mode: tapping a creature does nothing.
  await page.mouse.click(v.x, v.y);
  await expect(page.getByText('Slet dette dyr?')).toBeHidden();

  // 2. A short press on the lock does nothing either (children cannot get in by accident).
  await expect(page.getByRole('button', { name: 'Rokke' })).toBeVisible();
  await holdLock(page, 800);
  await expect(page.locator('.adult-frame')).toBeHidden();

  // 3. Three seconds: the frame appears and the child's picker steps aside.
  await holdLock(page, 3300);
  await expect(page.locator('.adult-frame')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Rokke' })).toBeHidden();
  await page.screenshot({ path: 'docs/screenshots/M4-tablet-2-voksentilstand.png' });

  // 4. Tapping empty water does nothing; tapping a creature asks.
  await page.mouse.click(8, 8);
  await expect(page.getByText('Slet dette dyr?')).toBeHidden();
  await page.mouse.click(v.x, v.y);
  await expect(page.getByText('Slet dette dyr?')).toBeVisible();
  await page.screenshot({ path: 'docs/screenshots/M4-tablet-5-slet-dyr.png' });

  // 5. "Nej" keeps it.
  await page.getByRole('button', { name: 'Nej' }).last().click();
  await expect(page.getByText('Slet dette dyr?')).toBeHidden();
  expect((await sceneInfo(page)).ids).toContain(v.id);
  expect(await storedIds(page)).toContain(v.id);

  // 6. "Ja" deletes it from the aquarium and from storage.
  await page.mouse.click(v.x, v.y);
  await page.getByRole('button', { name: 'Ja' }).last().click();
  await expect(page.getByText('Slet dette dyr?')).toBeHidden();
  expect((await sceneInfo(page)).ids).not.toContain(v.id);
  await expect.poll(() => storedIds(page)).not.toContain(v.id);
  expect((await sceneInfo(page)).total).toBe(11);

  // 7. Tapping the lock again leaves adult mode.
  await page.locator('.adult-lock').click();
  await expect(page.locator('.adult-frame')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Rokke' })).toBeVisible();
  expect(errors).toEqual([]);
  await ctx.close();
});

test('M4: the lock works with a finger too, and is not offered while drawing', async ({ browser }) => {
  const { ctx, page, cdp } = await newTouchPage(browser, PHONE);
  await page.goto('/?still');
  await page.evaluate(() => (window as unknown as { app: { restored: Promise<void> } }).app.restored);
  const box = await page.locator('.adult-lock').boundingBox();
  if (!box) throw new Error('lock not visible');
  await seedCreatures(page, 8);
  await reloadAndRestore(page);
  const pt = { x: box.x + box.width / 2, y: box.y + box.height / 2, id: 0 };
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [pt] });
  await page.waitForTimeout(3300);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(page.locator('.adult-frame')).toBeVisible();
  await adv(page, 0.1); // draw one frame of the paused aquarium for the screenshot
  await page.screenshot({ path: 'docs/screenshots/M4-phone-2-voksentilstand.png' });
  await page.locator('.adult-lock').tap();
  await expect(page.locator('.adult-frame')).toBeHidden();

  await openPanel(page); // while drawing, the lock is not there
  await expect(page.locator('.adult-lock')).toBeHidden();
  await ctx.close();
});

test('M4: without IndexedDB the game still works (it just forgets on reload)', async ({ browser }) => {
  const { ctx, page, errors } = await newTouchPage(browser, TABLET);
  await page.addInitScript(() => Object.defineProperty(window, 'indexedDB', { value: undefined, configurable: true }));
  await page.goto('/?still');
  await page.evaluate(() => (window as unknown as { app: { restored: Promise<void> } }).app.restored);
  await releaseOne(page);
  await adv(page, 4);
  const info = await sceneInfo(page);
  expect(info.total).toBe(1);
  expect(info.modes).toEqual(['swim']);
  await expect(page.getByRole('button', { name: 'Rokke' })).toBeVisible();
  expect(errors).toEqual([]);
  await ctx.close();
});

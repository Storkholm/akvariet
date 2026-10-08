import { writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { creatureScreenPoint, newTouchPage, openPanel, paintStripes, PHONE, reloadAndRestore, seedCreatures, sceneInfo, tap, TABLET } from './helpers';

type Pg = import('@playwright/test').Page;
type W = {
  aquarium: {
    advance(s: number): void;
    bursts: { active: number };
    creatures: { creatures: Array<{ id: string; reaction: { kind: string } | null; group: { position: { y: number } } }> };
  };
  app: { audio: { played: string[]; muted: boolean; state: string; unlock(): void } };
};
const adv = (page: Pg, s: number) => page.evaluate((x) => (window as unknown as W).aquarium.advance(x), s);
const played = (page: Pg) => page.evaluate(() => (window as unknown as W).app.audio.played.slice());

async function seededAquarium(page: Pg, n: number): Promise<void> {
  await page.goto('/?still');
  await page.evaluate(() => (window as unknown as { app: { restored: Promise<void> } }).app.restored);
  await seedCreatures(page, n);
  await reloadAndRestore(page);
  await adv(page, 6); // the picker has stepped aside, the creatures have swum into view
}

for (const [name, size] of [['tablet', TABLET], ['phone', PHONE]] as const) {
  test(`M6: tapping a creature makes it hop or somersault in a cloud of bubbles (${name})`, async ({ browser }) => {
    const { ctx, page, cdp, errors } = await newTouchPage(browser, size);
    await seededAquarium(page, 3);
    await page.evaluate(() => (window as unknown as { app: { picker: { hide(): void } } }).app.picker.hide());

    // Find a creature that is fully in view and tap it.
    let target: { id: string; x: number; y: number } | null = null;
    for (let i = 0; i < 40 && !target; i++) {
      const ids = (await sceneInfo(page)).ids;
      for (const id of ids) {
        const p = await creatureScreenPoint(page, id);
        if (p) { target = { id, ...p }; break; }
      }
      if (!target) await adv(page, 1);
    }
    expect(target, 'a creature is in view').not.toBeNull();
    const t = target as { id: string; x: number; y: number };

    await tap(cdp, [t.x, t.y]);
    const readState = () => page.evaluate((id) => {
      const w = window as unknown as W;
      const c = w.aquarium.creatures.creatures.find((k) => k.id === id);
      return { reaction: c?.reaction?.kind ?? null, bursts: w.aquarium.bursts.active };
    }, t.id);
    await expect.poll(async () => (await readState()).reaction, { timeout: 3000 }).not.toBeNull();
    const state = await readState();
    expect(['hop', 'salto']).toContain(state.reaction);
    expect(state.bursts).toBeGreaterThan(0);

    // Mid-reaction: it is clearly lifted compared with the start, then it settles completely.
    await adv(page, 0.3);
    await page.screenshot({ path: `docs/screenshots/M6-${name}-1-glaedeshop.png` });
    await adv(page, 2);
    const after = await page.evaluate((id) => (window as unknown as W).aquarium.creatures.creatures.find((k) => k.id === id)?.reaction ?? null, t.id);
    expect(after).toBeNull();

    // Tapping empty water does nothing.
    const before = (await played(page)).length;
    await tap(cdp, [size.width * 0.5, size.height * 0.04]);
    expect((await played(page)).length).toBe(before);
    expect(errors).toEqual([]);
    await ctx.close();
  });
}

test('M6: no sound before the first tap; the first tap unlocks it; the crayons play different notes', async ({ browser }) => {
  const { ctx, page, cdp, errors } = await newTouchPage(browser, TABLET);
  await page.goto('/?still');
  await page.evaluate(() => (window as unknown as { app: { restored: Promise<void> } }).app.restored);
  expect(await page.evaluate(() => (window as unknown as W).app.audio.state)).toBe('locked');
  // Calling a sound while locked is silently ignored.
  await page.evaluate(() => (window as unknown as { app: { audio: { release(): void } } }).app.audio.release());
  expect(await played(page)).toEqual([]);

  await tap(cdp, [600, 20]);
  expect(await page.evaluate(() => (window as unknown as W).app.audio.state)).not.toBe('locked');

  await openPanel(page);
  const crayons = page.locator('.crayon');
  expect(await crayons.count()).toBe(12);
  await crayons.nth(0).click({ force: true });
  await crayons.nth(5).click({ force: true });
  expect((await played(page)).filter((p) => p === 'pling').length).toBeGreaterThanOrEqual(2);

  await paintStripes(page);
  await page.getByRole('button', { name: 'Slip løs' }).click();
  expect(await played(page)).toContain('swoosh');
  expect(errors).toEqual([]);
  await ctx.close();
});

test('M6: the sound button mutes everything and the choice is remembered', async ({ browser }) => {
  const { ctx, page, cdp, errors } = await newTouchPage(browser, TABLET);
  await page.goto('/?still');
  const btn = page.getByRole('button', { name: 'Lyd' });
  await expect(btn).toHaveAttribute('aria-pressed', 'true');
  await adv(page, 2.5); // paused (?still) aquariums only draw when asked
  const box = await btn.boundingBox();
  expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);

  await page.screenshot({ path: 'docs/screenshots/M6-tablet-2-lyd-til.png' });
  await btn.click();
  await expect(btn).toHaveAttribute('aria-pressed', 'false');
  expect(await page.evaluate(() => (window as unknown as W).app.audio.muted)).toBe(true);
  await page.screenshot({ path: 'docs/screenshots/M6-tablet-3-lyd-fra.png' });

  // Muted: a crayon makes no sound.
  await openPanel(page);
  await page.locator('.crayon').nth(3).click({ force: true });
  expect(await played(page)).toEqual([]);

  await page.reload();
  await page.waitForFunction(() => !!(window as unknown as { app?: unknown }).app);
  await expect(page.getByRole('button', { name: 'Lyd' })).toHaveAttribute('aria-pressed', 'false');
  await tap(cdp, [600, 20]);
  await page.getByRole('button', { name: 'Lyd' }).click();
  await expect(page.getByRole('button', { name: 'Lyd' })).toHaveAttribute('aria-pressed', 'true');
  expect(errors).toEqual([]);
  await ctx.close();
});

test('M6: the phone keeps the sound button clear of the drawing buttons', async ({ browser }) => {
  const { ctx, page, errors } = await newTouchPage(browser, PHONE);
  await page.goto('/?still');
  await openPanel(page);
  const rects = await page.evaluate(() => {
    const r = (sel: string) => document.querySelector(sel)?.getBoundingClientRect().toJSON() as { left: number; right: number; top: number; bottom: number };
    return { sound: r('.sound-btn'), home: r('.home-btn'), undo: r('.undo-btn') };
  });
  const overlap = (a: typeof rects.sound, b: typeof rects.sound) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  expect(overlap(rects.sound, rects.home)).toBe(false);
  expect(overlap(rects.sound, rects.undo)).toBe(false);
  expect(rects.sound.right).toBeLessThanOrEqual(PHONE.width);
  await page.screenshot({ path: 'docs/screenshots/M6-phone-1-tegneflade-lyd.png' });
  expect(errors).toEqual([]);
  await ctx.close();
});

test('M6: every sound recipe is audible, never clips, and dies away (rendered offline, saved to docs/sounds)', async ({ browser }) => {
  const { ctx, page, errors } = await newTouchPage(browser, TABLET);
  await page.goto('/?still');
  const results = await page.evaluate(async () => {
    const w = window as unknown as {
      sounds: Record<string, (...a: never[]) => unknown>;
      createRng: (s: number) => unknown;
    };
    type Make = (...a: unknown[]) => unknown;
    const S = w.sounds as unknown as { pling: Make; bubbles: Make; swoosh: Make; pop: Make; bloop: Make; ambience: Make; crayonFrequency: (i: number) => number };
    const rate = 44100;
    const render = async (seconds: number, make: (c: OfflineAudioContext, out: GainNode) => void) => {
      const c = new OfflineAudioContext(1, Math.ceil(seconds * rate), rate);
      const out = c.createGain();
      out.gain.value = 0.8;
      out.connect(c.destination);
      make(c, out);
      const buf = await c.startRendering();
      const d = buf.getChannelData(0);
      let peak = 0, sq = 0;
      for (const v of d) { peak = Math.max(peak, Math.abs(v)); sq += v * v; }
      // Where does the sound end (last sample above -60 dB)?
      let last = 0;
      for (let i = d.length - 1; i >= 0; i--) if (Math.abs(d[i]) > 0.001) { last = i; break; }
      const pcm = new Int16Array(d.length);
      for (let i = 0; i < d.length; i++) pcm[i] = Math.max(-1, Math.min(1, d[i])) * 32767;
      let bin = '';
      const bytes = new Uint8Array(pcm.buffer);
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      return { peak, rms: Math.sqrt(sq / d.length), endsAt: last / rate, pcm: btoa(bin), rate };
    };
    const out: Record<string, Awaited<ReturnType<typeof render>>> = {};
    out['pling-c4'] = await render(1.2, (c, o) => S.pling(c, o, 0.01, S.crayonFrequency(0)));
    out['pling-h'] = await render(1.2, (c, o) => S.pling(c, o, 0.01, S.crayonFrequency(11)));
    out['bobler'] = await render(1.2, (c, o) => S.bubbles(c, o, 0.01, w.createRng(5)));
    out['swoosh'] = await render(1.5, (c, o) => S.swoosh(c, o, 0.01, w.createRng(5)));
    out['pop'] = await render(1, (c, o) => S.pop(c, o, 0.01, w.createRng(5)));
    out['bloop'] = await render(1, (c, o) => S.bloop(c, o, 0.01));
    out['ambience'] = await render(4, (c, o) => S.ambience(c, o, 0, w.createRng(5)));
    return out;
  });

  for (const [name, r] of Object.entries(results)) {
    expect(r.peak, `${name} peak`).toBeGreaterThan(0.02); // audible
    expect(r.peak, `${name} peak`).toBeLessThan(0.95); // no clipping
    expect(r.rms, `${name} rms`).toBeGreaterThan(0.002);
    if (name !== 'ambience') expect(r.endsAt, `${name} end`).toBeLessThan(1.1); // short and sweet
    // A 44-byte WAV header plus 16-bit mono PCM, so the files can be listened to on the Mac.
    const pcm = Buffer.from(r.pcm, 'base64');
    const header = Buffer.alloc(44);
    header.write('RIFF', 0); header.writeUInt32LE(36 + pcm.length, 4); header.write('WAVEfmt ', 8);
    header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
    header.writeUInt32LE(r.rate, 24); header.writeUInt32LE(r.rate * 2, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34);
    header.write('data', 36); header.writeUInt32LE(pcm.length, 40);
    writeFileSync(`docs/sounds/${name}.wav`, Buffer.concat([header, pcm]));
  }
  expect(errors).toEqual([]);
  await ctx.close();
});

test('M6: installable app – manifest, icons and service worker', async ({ browser }) => {
  const { ctx, page, cdp, errors } = await newTouchPage(browser, TABLET);
  await page.goto('/');
  const manifestUrl = await page.evaluate(() => (document.querySelector('link[rel=manifest]') as HTMLLinkElement).href);
  const manifest = await (await page.request.get(manifestUrl)).json();
  expect(manifest.name).toBe('Akvariet');
  expect(manifest.lang).toBe('da');
  expect(manifest.display).toBe('standalone');
  expect(manifest.icons.map((i: { sizes: string; purpose: string }) => `${i.sizes}:${i.purpose}`)).toEqual(['192x192:any', '512x512:any', '512x512:maskable']);
  for (const icon of manifest.icons) expect((await page.request.get(new URL(icon.src, manifestUrl).href)).ok()).toBe(true);
  const touchIcon = await page.evaluate(() => (document.querySelector('link[rel=apple-touch-icon]') as HTMLLinkElement).href);
  expect((await page.request.get(touchIcon)).ok()).toBe(true);

  // The worker takes control of the page.
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  await cdp.send('Page.enable');
  const { installabilityErrors } = (await cdp.send('Page.getInstallabilityErrors')) as { installabilityErrors: Array<{ errorId: string }> };
  // Playwright contexts are incognito, which is the one reason Chromium may always give.
  expect(installabilityErrors.map((e) => e.errorId).filter((id) => id !== 'in-incognito')).toEqual([]);
  expect(errors).toEqual([]);
  await ctx.close();
});

test('M6: the aquarium opens offline, with the saved creatures', async ({ browser }) => {
  const { ctx, page, errors } = await newTouchPage(browser, TABLET);
  await page.goto('/');
  await page.evaluate(() => (window as unknown as { app: { restored: Promise<void> } }).app.restored);
  await seedCreatures(page, 2);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  // Everything is precached: wait until the worker has finished installing.
  await expect
    .poll(() => page.evaluate(async () => (await (await caches.keys()).length > 0) && (await (await caches.open((await caches.keys())[0])).keys()).length > 5))
    .toBe(true);

  await ctx.setOffline(true);
  await page.goto('/');
  // (`window.app` is the #app element until the script has run, so wait for the aquarium itself.)
  await page.waitForFunction(() => !!(window as unknown as Partial<W>).aquarium, undefined, { timeout: 15_000 });
  await page.evaluate(() => (window as unknown as { app: { restored: Promise<void> } }).app.restored);
  await page.waitForFunction(() => (window as unknown as W).aquarium.creatures.creatures.length === 2, undefined, { timeout: 15_000 });
  await adv(page, 2);
  await page.screenshot({ path: 'docs/screenshots/M6-tablet-4-offline.png' });
  expect(errors.filter((e) => !/Failed to load resource|net::ERR/.test(e))).toEqual([]);
  await ctx.close();
});

test('M6: saved creatures grow into view one by one, and the long-press menu is blocked', async ({ browser }) => {
  const { ctx, page, errors } = await newTouchPage(browser, TABLET);
  await page.goto('/?still');
  await page.evaluate(() => (window as unknown as { app: { restored: Promise<void> } }).app.restored);
  await seedCreatures(page, 4);
  await reloadAndRestore(page);
  const scales = () =>
    page.evaluate(() => (window as unknown as { aquarium: { creatures: { creatures: Array<{ group: { visible: boolean; scale: { x: number } } }> } } }).aquarium.creatures.creatures.map((c) => (c.group.visible ? c.group.scale.x : 0)));
  const start = await scales();
  expect(start[0]).toBe(0); // nobody is there at the very start …
  await adv(page, 0.5);
  const mid = await scales();
  expect(mid[0]).toBeGreaterThan(0.1); // … the oldest one comes first …
  expect(mid[3]).toBeLessThan(mid[0]); // … and the youngest has hardly begun
  await adv(page, 3);
  expect((await scales()).every((s) => Math.abs(s - 1) < 1e-6)).toBe(true);

  const prevented = await page.evaluate(() => {
    const e = new Event('contextmenu', { cancelable: true, bubbles: true });
    document.body.dispatchEvent(e);
    return e.defaultPrevented;
  });
  expect(prevented).toBe(true);
  expect(errors).toEqual([]);
  await ctx.close();
});

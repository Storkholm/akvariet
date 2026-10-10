import { expect, test } from '@playwright/test';
import { holdRelease, newTouchPage, openPanel, paintStripes, PHONE, pixelAt, registrationError, reloadAndRestore, sceneInfo, TABLET, waitForAquarium } from './helpers';

type W = {
  aquarium: {
    advance(s: number): void;
    pickerBubbles: { hitAreas(): Array<{ species: string; x: number; y: number; r: number }>; stateOf(s: string): string; hide(s?: string): void };
    creatures: { spawn(c: HTMLCanvasElement, s: string, p?: unknown, y?: number): { id: string } };
  };
  app: { panel: { template: { species: string; parts: Array<{ id: string }> } }; picker: { element: HTMLElement } };
};
const adv = (page: import('@playwright/test').Page, s: number) => page.evaluate((x) => (window as unknown as W).aquarium.advance(x), s);

const SIZES: Array<[string, { width: number; height: number }]> = [
  ['tablet', TABLET],
  ['ipad', { width: 1024, height: 768 }],
  ['phone', PHONE],
  ['smaa-telefon', { width: 320, height: 568 }],
  ['phone-liggende', { width: 844, height: 390 }],
];

for (const [name, size] of SIZES) {
  test(`M5: the species bubbles are laid out and tappable (${name})`, async ({ browser }) => {
    const { ctx, page, errors } = await newTouchPage(browser, size);
    await page.goto('/?still');
    await adv(page, 2.5);
    const areas = await page.evaluate(() => (window as unknown as W).aquarium.pickerBubbles.hitAreas());
    expect(areas.map((a) => a.species).sort()).toEqual(['ray', 'seaCucumber', 'seaUrchin', 'starfish', 'turtle']);

    // DESIGN 8.3: ~3 bubbles fit on a tablet (so both are whole); on an upright phone it is 1½, so the second one peeks in.
    const upright = size.height > size.width * 1.05;
    // (The first two are in view at the start; the others wait further along the row.)
    for (const a of areas.slice(0, 2)) {
      // Whole bubble on screen, big enough to tap easily.
      if (!upright || a.species === areas[0].species) {
        expect(a.x - a.r, `${a.species} left`).toBeGreaterThanOrEqual(0);
        expect(a.x + a.r, `${a.species} right`).toBeLessThanOrEqual(size.width);
      } else {
        expect(a.x - a.r, `${a.species} peeks in`).toBeLessThan(size.width);
        expect(a.x, `${a.species} is partly beyond the edge`).toBeGreaterThan(size.width * 0.8);
      }
      expect(a.y - a.r, `${a.species} top`).toBeGreaterThanOrEqual(0);
      expect(a.y + a.r, `${a.species} bottom`).toBeLessThanOrEqual(size.height);
      expect(2 * a.r).toBeGreaterThanOrEqual(120);
      // The HTML button sits exactly over its bubble.
      const label = a.species === 'ray' ? 'Rokke' : 'Skildpadde';
      const box = await page.getByRole('button', { name: label }).boundingBox();
      expect(box).not.toBeNull();
      expect(Math.abs((box?.x ?? 0) + (box?.width ?? 0) / 2 - a.x)).toBeLessThan(1);
      expect(Math.abs((box?.y ?? 0) + (box?.height ?? 0) / 2 - a.y)).toBeLessThan(1);
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(48);
    }
    // The two bubbles never overlap.
    const [a, b] = areas;
    expect(areas.map((x) => x.species).slice(0, 2)).toEqual(['ray', 'turtle']);
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(a.r + b.r);

    await page.screenshot({ path: `docs/screenshots/M5-${name}-1-vaelger.png` });
    expect(errors).toEqual([]);
    await ctx.close();
  });
}

test('M5: tapping a bubble pops it and opens that species\' drawing panel', async ({ browser }) => {
  const { ctx, page, errors } = await newTouchPage(browser, TABLET);
  await page.goto('/?still');
  await adv(page, 1);
  for (const [label, species, parts] of [['Skildpadde', 'turtle', 6], ['Rokke', 'ray', 2]] as const) {
    await page.getByRole('button', { name: label }).click({ force: true });
    // The tapped bubble pops, the other one fades away.
    const states = await page.evaluate(() => {
      const b = (window as unknown as W).aquarium.pickerBubbles;
      return { ray: b.stateOf('ray'), turtle: b.stateOf('turtle') };
    });
    expect(states[species]).toBe('popping');
    expect(states[species === 'ray' ? 'turtle' : 'ray']).toBe('hiding');
    await adv(page, 0.6);
    const after = await page.evaluate(() => {
      const b = (window as unknown as W).aquarium.pickerBubbles;
      return { ray: b.stateOf('ray'), turtle: b.stateOf('turtle') };
    });
    expect(after).toEqual({ ray: 'hidden', turtle: 'hidden' });

    await page.locator('.panel.open').waitFor();
    const tpl = await page.evaluate(() => (window as unknown as W).app.panel.template);
    expect(tpl.species).toBe(species);
    expect(tpl.parts).toHaveLength(parts);
    await expect(page.locator('.picker')).toBeHidden();

    // Home (nothing drawn) brings the bubbles back, inflating one after the other.
    await page.getByRole('button', { name: 'Hjem' }).click();
    await page.waitForFunction(() => !document.querySelector('.panel.open'));
    await adv(page, 1.5);
    const back = await page.evaluate(() => {
      const b = (window as unknown as W).aquarium.pickerBubbles;
      return { ray: b.stateOf('ray'), turtle: b.stateOf('turtle') };
    });
    expect(back).toEqual({ ray: 'shown', turtle: 'shown' });
  }
  expect(errors).toEqual([]);
  await ctx.close();
});

test('M5: a pop, caught half-way (tablet)', async ({ browser }) => {
  const { ctx, page } = await newTouchPage(browser, TABLET);
  await page.goto('/?still');
  await adv(page, 1.5);
  await page.evaluate(() => (window as unknown as W).aquarium.pickerBubbles.hide('turtle'));
  await adv(page, 0.13);
  await page.screenshot({ path: 'docs/screenshots/M5-tablet-2-pop.png' });
  await ctx.close();
});

test('M5: the species bubbles can be reached with the keyboard', async ({ browser }) => {
  const { ctx, page } = await newTouchPage(browser, TABLET);
  await page.goto('/?still');
  await page.getByRole('button', { name: 'Skildpadde' }).focus();
  await page.keyboard.press('Enter');
  await page.locator('.panel.open').waitFor();
  expect(await page.evaluate(() => (window as unknown as W).app.panel.template.species)).toBe('turtle');
  await ctx.close();
});

for (const [name, size] of [['tablet', TABLET], ['phone', PHONE]] as const) {
  test(`M5: colour a turtle, release it, and it swims (${name})`, async ({ browser }) => {
    const { ctx, page, errors } = await newTouchPage(browser, size);
    await page.goto('/?still');
    await page.evaluate(() => (window as unknown as { app: { restored: Promise<void> } }).app.restored);
    await openPanel(page, 'Skildpadde');
    await page.waitForTimeout(200);
    await page.screenshot({ path: `docs/screenshots/M5-${name}-3-skildpadde-tom.png` });
    await paintStripes(page);
    await page.waitForTimeout(150);
    await page.screenshot({ path: `docs/screenshots/M5-${name}-4-skildpadde-farvelagt.png` });
    const rect = await page.locator('.canvas-wrap').boundingBox();
    if (!rect) throw new Error('no canvas');

    // Nothing outside the outline, and the fill reached the whole turtle (shell, head and all four flippers).
    const stats = await page.evaluate(() => {
      const d = (window as unknown as { app: { panel: { currentDrawing: { canvas: HTMLCanvasElement; mask: Uint8Array } } } }).app.panel.currentDrawing;
      const img = (d.canvas.getContext('2d') as CanvasRenderingContext2D).getImageData(0, 0, 1024, 1024).data;
      let inside = 0, area = 0;
      for (let i = 0; i < 1024 * 1024; i++) if (d.mask[i]) { area++; if (img[i * 4 + 3] > 250) inside++; }
      return { inside, area };
    });
    expect(stats.inside).toBeGreaterThan(stats.area * 0.97);

    await holdRelease(page);
    await adv(page, 0);
    const err = await registrationError(page, rect);
    expect(err.rimVertices).toBeGreaterThan(200);
    expect(err.maxPx, 'turtle outline vs the drawing on screen (px)').toBeLessThan(1);
    await page.waitForFunction(() => parseFloat(getComputedStyle(document.querySelector('.panel .bottom') as Element).opacity) < 0.02);
    await adv(page, 0.1);
    await page.screenshot({ path: `docs/screenshots/M5-${name}-5-overgang-start.png` });
    await adv(page, 1.2);
    await page.screenshot({ path: `docs/screenshots/M5-${name}-6-folder-ud.png` });
    await adv(page, 1.4);
    await page.screenshot({ path: `docs/screenshots/M5-${name}-7-svoemmer-vaek.png` });
    await adv(page, 1.5); // 4.2 s: the flight is over
    const info = await sceneInfo(page);
    expect(info.modes).toEqual(['swim']);
    await expect(page.getByRole('button', { name: 'Skildpadde' })).toBeVisible();
    expect(errors).toEqual([]);
    await ctx.close();
  });
}

test('M5: the turtle\'s own colours are on the body, with eyes and a pale belly (tablet)', async ({ browser }) => {
  const { ctx, page } = await newTouchPage(browser, TABLET);
  await page.goto('/?still');
  await openPanel(page, 'Skildpadde');
  await paintStripes(page);
  const rect = await page.locator('.canvas-wrap').boundingBox();
  if (!rect) throw new Error('no canvas');
  // Shell stripes at v = 0.56 (x = 0.5 and 0.34 yellow, 0.42 and 0.58 green): same hues in 3D as in the drawing.
  // Plus one stripe on each front flipper (x = 0.22 and 0.78): the limbs sit under the shell, but start flat.
  const probes: Array<[number, number]> = [[0.5, 0.56], [0.42, 0.56], [0.34, 0.56], [0.58, 0.56], [0.66, 0.56], [0.22, 0.36], [0.78, 0.36]];
  const hue = (rgb: number[]): string => {
    const [r, g, b] = rgb;
    if (r > 0.75 * g && b < 0.55 * g && g > 60) return 'yellow';
    if (g > 1.25 * r && g > 1.1 * b) return 'green';
    return `other(${rgb.join(',')})`;
  };
  const expected: string[] = [];
  for (const [u, v] of probes) expected.push(hue(await pixelAt(page, u, v)));
  expect(expected).toEqual(['yellow', 'green', 'yellow', 'green', 'yellow', 'yellow', 'yellow']);

  await holdRelease(page);
  await adv(page, 0);
  await page.addStyleTag({ content: '.ui { visibility: hidden !important; }' });
  await adv(page, 0);
  const shot = await page.screenshot();
  const seen = await page.evaluate(
    async ([data, r, pts]) => {
      const img = new Image();
      img.src = `data:image/png;base64,${data}`;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const g = c.getContext('2d') as CanvasRenderingContext2D;
      g.drawImage(img, 0, 0);
      return pts.map(([u, v]) => Array.from(g.getImageData(Math.round(r.x + u * r.width), Math.round(r.y + v * r.height), 1, 1).data.slice(0, 3)));
    },
    [shot.toString('base64'), rect, probes] as const,
  );
  expect(seen.map(hue)).toEqual(expected);

  // Product shots from three sides, nothing else in the picture.
  await adv(page, 4);
  for (const [name, pos] of [['8-skildpadde-ovenfra', [0, 11, 0.01]], ['9-skildpadde-skraa', [5.5, 8, 6.5]], ['10-skildpadde-undefra', [3.5, 0.8, 7]]] as const) {
    await page.evaluate((p) => {
      const w = window as unknown as {
        aquarium: {
          scene: { children: Array<{ visible: boolean; isLight?: boolean }> };
          camera: { position: { set(x: number, y: number, z: number): void }; lookAt(x: number, y: number, z: number): void };
          creatures: { creatures: Array<{ swimmer: unknown; group: { visible: boolean; position: { set(x: number, y: number, z: number): void }; rotation: { set(x: number, y: number, z: number, o: string): void } } }> };
          renderOnce(): void;
        };
      };
      const a = w.aquarium;
      const c = a.creatures.creatures[0];
      for (const ch of a.scene.children) if (!ch.isLight) ch.visible = false;
      c.swimmer = null; // hold it still for the photo
      c.group.visible = true;
      c.group.position.set(0, 5.5, 0);
      c.group.rotation.set(0, 0, 0, 'YXZ');
      a.camera.position.set(p[0], p[1], p[2]);
      a.camera.lookAt(0, 5.5, 0);
      a.renderOnce();
    }, pos);
    await page.screenshot({ path: `docs/screenshots/M5-tablet-${name}.png` });
  }
  await ctx.close();
});

test('M5: both species swim together, are saved, and come back as the right species', async ({ browser }) => {
  const { ctx, page, errors } = await newTouchPage(browser, TABLET);
  await page.goto('/?still');
  await page.evaluate(() => (window as unknown as { app: { restored: Promise<void> } }).app.restored);
  for (const label of ['Skildpadde', 'Rokke', 'Skildpadde'] as const) {
    await openPanel(page, label);
    await paintStripes(page);
    await holdRelease(page);
    await adv(page, 4.2);
  }
  const species = () =>
    page.evaluate(() =>
      (window as unknown as { aquarium: { creatures: { creatures: Array<{ species: string }> } } }).aquarium.creatures.creatures.map((c) => c.species).sort(),
    );
  expect(await species()).toEqual(['ray', 'turtle', 'turtle']);
  await expect.poll(async () => (await page.evaluate(async () => (await (window as unknown as { app: { keeper: { restore(): Promise<Array<{ species: string }>> } } }).app.keeper.restore()).map((c) => c.species).sort()))).toEqual(['ray', 'turtle', 'turtle']);

  await reloadAndRestore(page);
  expect(await species()).toEqual(['ray', 'turtle', 'turtle']);
  await adv(page, 20);
  await page.screenshot({ path: 'docs/screenshots/M5-tablet-11-begge-arter.png' });
  expect(errors).toEqual([]);
  await ctx.close();
});

for (const [name, size] of [['tablet', TABLET], ['phone', PHONE]] as const) {
  test(`M5: rays and turtles together stay in the aquarium and keep apart (${name})`, async ({ browser }) => {
    const { ctx, page, errors } = await newTouchPage(browser, size);
    await page.goto('/?still');
    await page.evaluate(() => {
      const w = window as unknown as W;
      const c = document.createElement('canvas');
      c.width = c.height = 1024;
      const g = c.getContext('2d') as CanvasRenderingContext2D;
      g.fillStyle = '#2f9a5a';
      g.fillRect(0, 0, 1024, 1024);
      g.fillStyle = '#f9d21e';
      for (let x = 80; x < 1024; x += 150) g.fillRect(x, 0, 50, 1024);
      for (let i = 0; i < 6; i++) { w.aquarium.creatures.spawn(c, 'turtle'); w.aquarium.creatures.spawn(c, 'ray'); }
    });
    let inView = 0;
    let total = 0;
    let closest = Infinity;
    for (let i = 0; i < 40; i++) {
      const r = await page.evaluate(() => {
        const w = (window as unknown as {
          aquarium: {
            advance(s: number): void;
            camera: { position: { constructor: new () => { set(x: number, y: number, z: number): { project(c: unknown): { x: number; y: number; z: number } } } }; updateMatrixWorld(): void };
            creatures: { creatures: Array<{ group: { position: { x: number; y: number; z: number } } }> };
          };
        }).aquarium;
        w.advance(3);
        let inside = 0;
        const cs = w.creatures.creatures;
        for (const c of cs) {
          const p = c.group.position;
          if (Math.abs(p.x) <= 37.5 && p.y > 0 && p.y < 11 && p.z > -12 && p.z < 8) inside++;
        }
        let min = Infinity;
        for (let a = 0; a < cs.length; a++) for (let b = a + 1; b < cs.length; b++) {
          const p = cs[a].group.position, q = cs[b].group.position;
          min = Math.min(min, Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z));
        }
        return [inside, cs.length, min];
      });
      inView += r[0];
      total += r[1];
      if (i > 3) closest = Math.min(closest, r[2]);
    }
    expect(inView / total).toBe(1);
    // ADR 0006: the whole 75-unit width is swimming room now, on a phone as well as on a tablet.
    expect(closest).toBeGreaterThan(0.8);
    expect(errors).toEqual([]);
    await ctx.close();
  });
}

test('M5: waitForAquarium still works with the bubbles (smoke)', async ({ browser }) => {
  const { ctx, page, errors } = await newTouchPage(browser, TABLET);
  await page.goto('/');
  await waitForAquarium(page);
  expect(errors).toEqual([]);
  await ctx.close();
});

import { describe, expect, it } from 'vitest';
import { floodFill, parseHex } from '../src/drawing/floodFill';
import { RAINBOW_BANDS, RAINBOW_PERIOD, RAINBOW_STEPS, rainbowBand, rainbowColor } from '../src/drawing/palette';
import { isInstalledApp } from '../src/ui/AdultMode';

describe('rainbow crayon', () => {
  it('runs through one whole round per 600 px of stroke', () => {
    expect(RAINBOW_PERIOD).toBe(600);
    expect(rainbowColor(0)).toBe(rainbowColor(RAINBOW_PERIOD));
    expect(rainbowColor(0)).toBe(rainbowColor(RAINBOW_PERIOD * 3));
    expect(rainbowColor(0)).not.toBe(rainbowColor(RAINBOW_PERIOD / 3));
  });

  it('uses several distinct, saturated colours along the stroke', () => {
    const colours = new Set(Array.from({ length: 600 }, (_, d) => rainbowColor(d)));
    expect(colours.size).toBe(RAINBOW_STEPS);
    for (const c of colours) expect(c).toMatch(/^#[0-9a-f]{6}$/);
    const [r, g, b] = parseHex(rainbowColor(0));
    expect(r).toBeGreaterThan(g * 2);
    expect(r).toBeGreaterThan(b * 2);
  });

  it('the phase moves where a stroke begins', () => {
    expect(rainbowColor(0, 0.5)).toBe(rainbowColor(RAINBOW_PERIOD / 2));
  });

  it('picks band 0 on top to the last band at the bottom of a region', () => {
    expect(rainbowBand(100, 100, 399)).toBe(0);
    expect(rainbowBand(399, 100, 399)).toBe(RAINBOW_BANDS.length - 1);
    const seen = new Set(Array.from({ length: 300 }, (_, i) => rainbowBand(100 + i, 100, 399)));
    expect(seen.size).toBe(RAINBOW_BANDS.length);
    expect(rainbowBand(5, 5, 5)).toBe(0); // a one-row region does not crash
  });
});

describe('rainbow bucket', () => {
  it('fills a region with horizontal bands, top to bottom', () => {
    const w = 20, h = 60;
    const data = new Uint8ClampedArray(w * h * 4).fill(255);
    const mask = new Uint8Array(w * h).fill(255);
    const bands = RAINBOW_BANDS.map(parseHex);
    const rect = floodFill(data, w, h, 10, 30, (y, minY, maxY) => bands[rainbowBand(y, minY, maxY)], mask, { tolerance: 10 });
    expect(rect).not.toBeNull();
    const px = (y: number) => [data[(y * w + 5) * 4], data[(y * w + 5) * 4 + 1], data[(y * w + 5) * 4 + 2]];
    expect(px(0)).toEqual([...bands[0]]);
    expect(px(h - 1)).toEqual([...bands[bands.length - 1]]);
    const rows = new Set(Array.from({ length: h }, (_, y) => px(y).join(',')));
    expect(rows.size).toBe(RAINBOW_BANDS.length);
  });
});

describe('isInstalledApp', () => {
  const env = (matches: string[], standalone = false) => ({
    navigator: { standalone },
    matchMedia: (q: string) => ({ matches: matches.some((m) => q.includes(m)) }),
  });
  it('is true for a home-screen app, however it was installed', () => {
    expect(isInstalledApp(env([]))).toBe(false);
    expect(isInstalledApp(env(['standalone']))).toBe(true);
    expect(isInstalledApp(env(['fullscreen']))).toBe(true);
    expect(isInstalledApp(env([], true))).toBe(true);
  });
});

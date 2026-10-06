import { describe, expect, it } from 'vitest';
import { floodFill, grainNoise } from '../src/drawing/floodFill';

const W = 20;
const H = 20;

function canvas(fn: (x: number, y: number) => [number, number, number, number]): Uint8ClampedArray {
  const d = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) d.set(fn(x, y), (y * W + x) * 4);
  return d;
}
const px = (d: Uint8ClampedArray, x: number, y: number): number[] => Array.from(d.slice((y * W + x) * 4, (y * W + x) * 4 + 4));
const fullMask = new Uint8Array(W * H).fill(255);
const RED: [number, number, number] = [255, 0, 0];

describe('floodFill', () => {
  it('fills the connected region and stops at a wall of another colour', () => {
    const d = canvas((x) => (x === 10 ? [0, 0, 0, 255] : [240, 240, 240, 255]));
    const r = floodFill(d, W, H, 3, 5, RED, fullMask, { tolerance: 20 });
    expect(r).not.toBeNull();
    expect(px(d, 3, 5)).toEqual([255, 0, 0, 255]);
    expect(px(d, 9, 19)).toEqual([255, 0, 0, 255]);
    expect(px(d, 10, 5)).toEqual([0, 0, 0, 255]); // wall untouched
    expect(px(d, 15, 5)).toEqual([240, 240, 240, 255]); // other side untouched
  });

  it('never leaves the mask (outline), even where the colour is identical', () => {
    const d = canvas(() => [240, 240, 240, 255]);
    const mask = new Uint8Array(W * H);
    for (let y = 5; y < 15; y++) for (let x = 5; x < 15; x++) mask[y * W + x] = 255;
    floodFill(d, W, H, 8, 8, RED, mask, { tolerance: 20 });
    expect(px(d, 8, 8)).toEqual([255, 0, 0, 255]);
    expect(px(d, 4, 8)).toEqual([240, 240, 240, 255]);
    expect(px(d, 15, 8)).toEqual([240, 240, 240, 255]);
    expect(px(d, 8, 4)).toEqual([240, 240, 240, 255]);
  });

  it('returns null when tapping outside the figure', () => {
    const d = canvas(() => [0, 0, 0, 0]);
    const mask = new Uint8Array(W * H);
    expect(floodFill(d, W, H, 2, 2, RED, mask, { tolerance: 20 })).toBeNull();
    expect(floodFill(d, W, H, -5, 2, RED, fullMask, { tolerance: 20 })).toBeNull();
  });

  it('uses tolerance: slightly different shades join the region', () => {
    const d = canvas((x) => (x < 10 ? [200, 200, 200, 255] : [215, 205, 200, 255]));
    floodFill(d, W, H, 0, 0, RED, fullMask, { tolerance: 20 });
    expect(px(d, 19, 0)).toEqual([255, 0, 0, 255]);
    const d2 = canvas((x) => (x < 10 ? [200, 200, 200, 255] : [215, 205, 200, 255]));
    floodFill(d2, W, H, 0, 0, RED, fullMask, { tolerance: 5 });
    expect(px(d2, 19, 0)).toEqual([215, 205, 200, 255]);
  });

  it('covers the anti-aliased rim next to a wall (grows by one pixel)', () => {
    // Column 9 is a half-blended edge pixel that fails the tolerance; column 10 is the wall.
    const d = canvas((x) => (x === 10 ? [0, 0, 0, 255] : x === 9 ? [120, 120, 120, 255] : [240, 240, 240, 255]));
    floodFill(d, W, H, 3, 3, RED, fullMask, { tolerance: 20 });
    expect(px(d, 9, 3)).toEqual([255, 0, 0, 255]);
    expect(px(d, 10, 3)).toEqual([0, 0, 0, 255]);
  });

  it('reports the changed rectangle', () => {
    const d = canvas((x, y) => (x >= 5 && x < 9 && y >= 6 && y < 8 ? [240, 240, 240, 255] : [0, 0, 0, 255]));
    const r = floodFill(d, W, H, 6, 6, RED, fullMask, { tolerance: 10 });
    expect(r).not.toBeNull();
    const rect = r as NonNullable<typeof r>;
    expect(rect.x).toBeLessThanOrEqual(5);
    expect(rect.x + rect.w).toBeGreaterThanOrEqual(9);
    expect(rect.y).toBeLessThanOrEqual(6);
    expect(rect.y + rect.h).toBeGreaterThanOrEqual(8);
  });

  it('grain stays close to the chosen colour', () => {
    const d = canvas(() => [240, 240, 240, 255]);
    floodFill(d, W, H, 0, 0, [100, 100, 100], fullMask, { tolerance: 10, grain: true });
    for (let i = 0; i < W * H; i++) {
      expect(Math.abs(d[i * 4] - 100)).toBeLessThanOrEqual(5);
      expect(d[i * 4 + 3]).toBe(255);
    }
    expect(grainNoise(3, 4)).toBe(grainNoise(3, 4));
  });
});

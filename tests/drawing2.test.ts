import { describe, expect, it } from 'vitest';
import { floodFill } from '../src/drawing/floodFill';
import { PATTERNS, patternCoverage, PATTERN_PERIOD } from '../src/drawing/patterns';
import { STAMPS, stampTilt, STAMP_SCREEN_SIZES } from '../src/drawing/stamps';
import { clampView, DRAW_ZOOM_MAX, IDENTITY_VIEW, isZoomed, panView, windowToDrawing, zoomAround } from '../src/drawing/viewTransform';

describe('view transform (zoom of the drawing surface)', () => {
  const side = 700;

  it('zoom 1 is the identity: window pixels map straight onto the 1024 drawing', () => {
    expect(windowToDrawing(IDENTITY_VIEW, 0, 0, side)).toEqual([0, 0]);
    const [x, y] = windowToDrawing(IDENTITY_VIEW, side, side / 2, side);
    expect(x).toBeCloseTo(1024, 6);
    expect(y).toBeCloseTo(512, 6);
  });

  it('zooming around a point keeps the drawing point under it where it is', () => {
    let v = IDENTITY_VIEW;
    const under = (view: typeof v): [number, number] => windowToDrawing(view, 500, 200, side);
    const before = under(v);
    for (const f of [1.3, 1.5, 0.8, 2]) {
      v = zoomAround(v, f, 500, 200, side);
      const now = under(v);
      expect(now[0]).toBeCloseTo(before[0], 4);
      expect(now[1]).toBeCloseTo(before[1], 4);
    }
    expect(v.zoom).toBeGreaterThan(1);
  });

  it('zoom stays between 1× and 4×, and the drawing always covers the window', () => {
    let v = IDENTITY_VIEW;
    for (let i = 0; i < 30; i++) v = zoomAround(v, 1.5, 10, 690, side);
    expect(v.zoom).toBe(DRAW_ZOOM_MAX);
    expect(v.x).toBeGreaterThanOrEqual(side - side * v.zoom);
    expect(v.x).toBeLessThanOrEqual(0);
    for (let i = 0; i < 40; i++) v = zoomAround(v, 0.6, 350, 350, side);
    expect(v).toEqual({ zoom: 1, x: 0, y: 0 });
    expect(isZoomed(v)).toBe(false);
  });

  it('panning is limited so no edge of the window shows empty space', () => {
    let v = zoomAround(IDENTITY_VIEW, 2, 350, 350, side);
    v = panView(v, 5000, 5000, side);
    expect(v.x).toBe(0);
    expect(v.y).toBe(0);
    v = panView(v, -9000, -9000, side);
    expect(v.x).toBe(side - side * 2);
    expect(clampView({ zoom: 9, x: 99, y: -99999 }, side)).toEqual({ zoom: 4, x: 0, y: side - side * 4 });
  });

  it('at 4× a window pixel is a quarter of a drawing pixel step', () => {
    const v = zoomAround(IDENTITY_VIEW, 4, 0, 0, side);
    const a = windowToDrawing(v, 100, 100, side);
    const b = windowToDrawing(v, 101, 100, side);
    expect(b[0] - a[0]).toBeCloseTo((1024 / side) / 4, 6);
  });
});

describe('patterns (Mønsterfyld)', () => {
  it('there are four, with Danish names', () => {
    expect(PATTERNS.map((p) => p.name)).toEqual(['Striber', 'Prikker', 'Skæl', 'Zigzag']);
  });

  it.each(PATTERNS.map((p) => p.id))('%s: repeats with its period, is partly covered and partly not, and stays in 0…1', (id) => {
    const period = PATTERN_PERIOD[id];
    let on = 0;
    let off = 0;
    for (let y = 0; y < period * 2; y += 2) {
      for (let x = 0; x < period * 2; x += 2) {
        const c = patternCoverage(id, x, y);
        expect(c).toBeGreaterThanOrEqual(0);
        expect(c).toBeLessThanOrEqual(1);
        if (c > 0.9) on++;
        if (c < 0.1) off++;
        // The pattern sits on the drawing: it repeats after a whole period in x and y (dots and scales: two rows).
        expect(patternCoverage(id, x + period * 2, y + period * 2)).toBeCloseTo(c, 6);
      }
    }
    expect(on).toBeGreaterThan(50);
    expect(off).toBeGreaterThan(on * 0.5);
  });

  it('does not depend on anything but the position (the same wherever the child has zoomed)', () => {
    expect(patternCoverage('dots', 123, 456)).toBe(patternCoverage('dots', 123, 456));
  });
});

describe('pattern fill (flood fill with coverage)', () => {
  const W = 40;
  const base = (): Uint8ClampedArray => {
    const d = new Uint8ClampedArray(W * W * 4);
    for (let i = 0; i < W * W; i++) d.set([240, 244, 246, 255], i * 4);
    return d;
  };
  const mask = new Uint8Array(W * W).fill(255);

  it('paints only where the pattern covers, on top of the region colour', () => {
    const d = base();
    const rect = floodFill(d, W, W, 5, 5, [200, 0, 0], mask, { tolerance: 10, coverage: (x) => (x % 10 < 5 ? 1 : 0) });
    expect(rect).not.toBeNull();
    const at = (x: number, y: number): number[] => Array.from(d.slice((y * W + x) * 4, (y * W + x) * 4 + 3));
    expect(at(2, 10)).toEqual([200, 0, 0]);
    expect(at(7, 10)).toEqual([240, 244, 246]);
  });

  it('blends soft edges, and without coverage fills solid as before', () => {
    const d = base();
    floodFill(d, W, W, 5, 5, [200, 0, 0], mask, { tolerance: 10, coverage: () => 0.5 });
    expect(d[0]).toBeCloseTo(220, 0);
    const e = base();
    floodFill(e, W, W, 5, 5, [200, 0, 0], mask, { tolerance: 10 });
    expect(Array.from(e.slice(0, 3))).toEqual([200, 0, 0]);
  });
});

describe('stamps', () => {
  it('there are ten, each with a name', () => {
    expect(STAMPS).toHaveLength(10);
    expect(new Set(STAMPS.map((s) => s.id)).size).toBe(10);
    expect(STAMPS.map((s) => s.name)).toEqual(['Stjerne', 'Hjerte', 'Prik', 'Blomst', 'Øje', 'Skæl', 'Sol', 'Måne', 'Lyn', 'Smil']);
  });

  it('the tilt is small and the same for the same place', () => {
    for (let i = 0; i < 200; i++) {
      const t = stampTilt(i * 13, i * 7);
      expect(Math.abs(t)).toBeLessThanOrEqual(0.18 + 1e-9);
      expect(stampTilt(i * 13, i * 7)).toBe(t);
    }
  });

  it('the three sizes grow, and the largest is big enough to see and the smallest to tap with a finger', () => {
    expect(STAMP_SCREEN_SIZES[0]).toBeLessThan(STAMP_SCREEN_SIZES[1]);
    expect(STAMP_SCREEN_SIZES[1]).toBeLessThan(STAMP_SCREEN_SIZES[2]);
    expect(STAMP_SCREEN_SIZES[0]).toBeGreaterThanOrEqual(24);
  });
});

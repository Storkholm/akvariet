import { describe, expect, it } from 'vitest';
import { rasterizeMask } from '../src/drawing/mask';
import { rayTemplate } from '../src/species/ray';
import type { Vec2 } from '../src/drawing/geometry';

const SIZE = 100;
const at = (m: Uint8Array, x: number, y: number): number => m[y * SIZE + x];

describe('rasterizeMask', () => {
  it('covers the inside of a polygon and nothing outside (clip at the outline)', () => {
    const tri: Vec2[] = [[0.2, 0.2], [0.8, 0.2], [0.5, 0.8]];
    const m = rasterizeMask([tri], SIZE);
    expect(at(m, 50, 30)).toBe(255);
    expect(at(m, 10, 30)).toBe(0);
    expect(at(m, 90, 30)).toBe(0);
    expect(at(m, 50, 90)).toBe(0);
    // Area of the triangle is 0.18 of the square.
    const covered = m.reduce((s, v) => s + (v ? 1 : 0), 0) / (SIZE * SIZE);
    expect(covered).toBeGreaterThan(0.17);
    expect(covered).toBeLessThan(0.19);
  });

  it('is the union of several parts', () => {
    const a: Vec2[] = [[0.1, 0.1], [0.4, 0.1], [0.4, 0.4], [0.1, 0.4]];
    const b: Vec2[] = [[0.3, 0.3], [0.7, 0.3], [0.7, 0.7], [0.3, 0.7]];
    const m = rasterizeMask([a, b], SIZE);
    expect(at(m, 20, 20)).toBe(255);
    expect(at(m, 60, 60)).toBe(255);
    expect(at(m, 35, 35)).toBe(255);
    expect(at(m, 60, 20)).toBe(0);
  });

  it('rasterises the ray template: body and tail covered, corners empty', () => {
    const m = rasterizeMask(rayTemplate.parts.map((p) => p.outline), SIZE);
    expect(at(m, 50, 40)).toBe(255); // body
    expect(at(m, 50, 90)).toBe(255); // tail
    expect(at(m, 3, 3)).toBe(0);
    expect(at(m, 96, 96)).toBe(0);
    expect(at(m, 10, 80)).toBe(0);
  });
});

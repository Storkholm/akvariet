import { describe, expect, it } from 'vitest';
import { getTemplate, TEMPLATES } from '../src/species';
import { polygonBounds, signedArea } from '../src/drawing/geometry';
import { CRAYONS } from '../src/drawing/palette';

describe('ray template', () => {
  const t = getTemplate('ray');

  it('has a body and a tail with a pivot (DESIGN 4.1)', () => {
    expect(t.parts.map((p) => p.id)).toEqual(['body', 'tail']);
    expect(t.parts[1].pivot).toBeDefined();
  });

  it('stays inside the unit square with margin and is wide like a manta', () => {
    const all = t.parts.flatMap((p) => p.outline);
    const b = polygonBounds(all);
    expect(b.minX).toBeGreaterThan(0.01);
    expect(b.maxX).toBeLessThan(0.99);
    expect(b.minY).toBeGreaterThan(0.05);
    expect(b.maxY).toBeLessThan(0.99);
    expect(b.maxX - b.minX).toBeGreaterThan(0.85);
  });

  it('is left-right symmetric', () => {
    const b = t.parts[0].outline;
    const bb = polygonBounds(b);
    expect((bb.minX + bb.maxX) / 2).toBeCloseTo(0.5, 2);
  });

  it('all parts have the same winding (so the union can be clipped with one path)', () => {
    const signs = t.parts.map((p) => Math.sign(signedArea(p.outline)));
    expect(new Set(signs).size).toBe(1);
  });

  it('turtle has no template until M5', () => {
    expect(TEMPLATES.turtle).toBeUndefined();
    expect(() => getTemplate('turtle')).toThrow();
  });
});

describe('crayons', () => {
  it('has 12 distinct colours', () => {
    expect(CRAYONS).toHaveLength(12);
    expect(new Set(CRAYONS.map((c) => c.hex)).size).toBe(12);
  });
});

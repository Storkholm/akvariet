import { describe, expect, it } from 'vitest';
import { getTemplate, SPECIES, TEMPLATES } from '../src/species';
import { TURTLE_PARTS } from '../src/species/turtle';
import { pointInPolygon, polygonBounds, signedArea } from '../src/drawing/geometry';
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

  it('has the reference proportions: disc about 1.8× as wide as long, tail nearly as long as the body', () => {
    const body = polygonBounds(t.parts[0].outline);
    const tail = polygonBounds(t.parts[1].outline);
    expect((body.maxX - body.minX) / (body.maxY - body.minY)).toBeGreaterThan(1.6);
    expect((body.maxX - body.minX) / (body.maxY - body.minY)).toBeLessThan(2.1);
    expect((tail.maxY - tail.minY) / (body.maxY - body.minY)).toBeGreaterThan(0.7);
  });

  it('keeps the eyes inside the body, near the nose', () => {
    const body = polygonBounds(t.parts[0].outline);
    for (const e of t.eyes) {
      expect(e.y).toBeGreaterThan(body.minY);
      expect(e.y).toBeLessThan(body.minY + 0.15);
    }
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

  it('every species has a template, and the picker lists both', () => {
    expect(Object.keys(TEMPLATES).sort()).toEqual(['ray', 'turtle']);
    expect([...SPECIES].sort()).toEqual(['ray', 'turtle']);
    expect(getTemplate('turtle').species).toBe('turtle');
  });
});

describe('turtle template', () => {
  const t = getTemplate('turtle');
  const part = (id: string) => t.parts.find((p) => p.id === id) as NonNullable<(typeof t.parts)[number]>;

  it('has shell, head and four flippers in the order the swim shader expects', () => {
    expect(t.parts.map((p) => p.id)).toEqual([...TURTLE_PARTS]);
  });

  it('stays inside the unit square with a margin', () => {
    const b = polygonBounds(t.parts.flatMap((p) => p.outline));
    expect(b.minX).toBeGreaterThan(0.02);
    expect(b.maxX).toBeLessThan(0.98);
    expect(b.minY).toBeGreaterThan(0.02);
    expect(b.maxY).toBeLessThan(0.98);
  });

  it('is left-right symmetric', () => {
    for (const [l, r] of [['flipperFL', 'flipperFR'], ['flipperBL', 'flipperBR']]) {
      const [a, c] = [polygonBounds(part(l).outline), polygonBounds(part(r).outline)];
      expect(a.minX + c.maxX).toBeCloseTo(1, 2);
      expect(a.maxX + c.minX).toBeCloseTo(1, 2);
      expect(a.minY).toBeCloseTo(c.minY, 3);
      expect(a.maxY).toBeCloseTo(c.maxY, 3);
    }
    const eyes = t.eyes.map((e) => e.x).sort();
    expect(eyes[0] + eyes[1]).toBeCloseTo(1, 3);
  });

  it('the flippers are rooted well under the shell and reach out beyond it; the head overlaps the shell', () => {
    const shell = part('shell').outline;
    for (const id of ['flipperFL', 'flipperFR', 'flipperBL', 'flipperBR', 'head']) {
      const p = part(id);
      expect(p.pivot, id).toBeDefined();
      const [px, py] = p.pivot as [number, number];
      expect(pointInPolygon(px, py, shell), `${id} pivot under the shell`).toBe(true);
      expect(p.outline.some(([x, y]) => pointInPolygon(x, y, shell)), `${id} overlaps the shell`).toBe(true);
      expect(p.outline.some(([x, y]) => !pointInPolygon(x, y, shell)), `${id} sticks out`).toBe(true);
    }
    // The flipper root (pivot side) lies at least 0.04 inside the shell outline.
    for (const id of ['flipperFL', 'flipperFR', 'flipperBL', 'flipperBR']) {
      const [px, py] = part(id).pivot as [number, number];
      const d = Math.min(...shell.map(([x, y]) => Math.hypot(x - px, y - py)));
      expect(d, id).toBeGreaterThan(0.04);
    }
  });

  it('limbs sit below the shell plane, the shell does not', () => {
    expect(part('shell').body.offset ?? 0).toBe(0);
    for (const id of ['head', 'flipperFL', 'flipperFR', 'flipperBL', 'flipperBR']) expect(part(id).body.offset ?? 0, id).toBeLessThan(0);
  });

  it('all parts have the same winding', () => {
    expect(new Set(t.parts.map((p) => Math.sign(signedArea(p.outline)))).size).toBe(1);
  });

  it('swims slower and calmer than the ray', () => {
    expect(t.swim.style).toBe('turtle');
    expect(t.swim.cruiseSpeed[1]).toBeLessThan(getTemplate('ray').swim.cruiseSpeed[1]);
    expect(t.swim.flapHz).toBeLessThan(getTemplate('ray').swim.flapHz);
  });
});

describe('crayons', () => {
  it('has 15 distinct crayons: grey between brown and black, white before the rainbow, the rainbow last', () => {
    expect(CRAYONS).toHaveLength(15);
    expect(new Set(CRAYONS.map((c) => c.id)).size).toBe(15);
    const ids = CRAYONS.map((c) => c.id);
    expect(ids.indexOf('grey')).toBe(ids.indexOf('brown') + 1);
    expect(ids.indexOf('black')).toBe(ids.indexOf('grey') + 1);
    expect(ids.indexOf('white')).toBe(ids.indexOf('black') + 1);
    expect(ids.at(-1)).toBe('rainbow');
    expect(CRAYONS.filter((c) => c.rainbow)).toHaveLength(1);
  });
});

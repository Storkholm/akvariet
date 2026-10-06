import { describe, expect, it } from 'vitest';
import { bodyStats, buildBody } from '../src/body/buildBody';
import { buildPartMesh, profile, resampleClosed } from '../src/body/partMesh';
import { delaunay } from '../src/body/delaunay';
import { rayTemplate } from '../src/species/ray';
import { pointInPolygon, signedArea, type Vec2 } from '../src/drawing/geometry';

const body = rayTemplate.parts[0];
const tail = rayTemplate.parts[1];

describe('delaunay', () => {
  it('triangulates a square with a centre point into four triangles', () => {
    const pts: Vec2[] = [[0, 0], [1, 0], [1, 1], [0, 1], [0.5, 0.5]];
    expect(delaunay(pts)).toHaveLength(4 * 3);
  });
});

describe('resampleClosed', () => {
  it('spaces points evenly and keeps sharp corners', () => {
    const square: Vec2[] = [];
    for (let i = 0; i < 40; i++) square.push([i / 40, 0]);
    for (let i = 0; i < 40; i++) square.push([1, i / 40]);
    for (let i = 0; i < 40; i++) square.push([1 - i / 40, 1]);
    for (let i = 0; i < 40; i++) square.push([0, 1 - i / 40]);
    const out = resampleClosed(square, 0.1);
    expect(out.some(([x, y]) => x === 1 && y === 0)).toBe(true); // corner kept
    expect(out.length).toBeGreaterThan(30); // perimeter 4 / spacing 0.1 ≈ 40, minus rounding
    expect(out.length).toBeLessThan(48);
  });
});

describe('profile', () => {
  it('is 0 at the edge, 1 from the radius inwards and rises steeply then flattens', () => {
    expect(profile(0)).toBe(0);
    expect(profile(1)).toBe(1);
    expect(profile(2)).toBe(1);
    expect(profile(0.1)).toBeGreaterThan(0.4);
    expect(profile(0.5)).toBeGreaterThan(0.85);
  });
});

describe('part meshes', () => {
  for (const part of rayTemplate.parts) {
    it(`${part.id}: covers the outline area and stays inside it`, () => {
      const m = buildPartMesh(part);
      let area = 0;
      for (let i = 0; i < m.triangles.length; i += 3) {
        const [a, b, c] = [m.points[m.triangles[i]], m.points[m.triangles[i + 1]], m.points[m.triangles[i + 2]]];
        area += Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) / 2;
        const centroid: Vec2 = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3];
        expect(pointInPolygon(centroid[0], centroid[1], part.outline)).toBe(true);
      }
      const expected = Math.abs(signedArea(part.outline));
      expect(area / expected).toBeGreaterThan(0.97);
      expect(area / expected).toBeLessThan(1.03);
    });

    it(`${part.id}: every outline edge belongs to exactly one triangle (no notches)`, () => {
      const m = buildPartMesh(part);
      const count = new Map<string, number>();
      for (let i = 0; i < m.triangles.length; i += 3) {
        for (let k = 0; k < 3; k++) {
          const u = m.triangles[i + k];
          const v = m.triangles[i + (k + 1) % 3];
          const key = u < v ? `${u}-${v}` : `${v}-${u}`;
          count.set(key, (count.get(key) ?? 0) + 1);
        }
      }
      for (let i = 0; i < m.boundaryCount; i++) {
        const j = (i + 1) % m.boundaryCount;
        const key = i < j ? `${i}-${j}` : `${j}-${i}`;
        expect(count.get(key), `edge ${key}`).toBe(1);
      }
      // Interior edges are shared by exactly two triangles.
      for (const [key, c] of count) {
        const [u, v] = key.split('-').map(Number);
        const onOutline = u < m.boundaryCount && v < m.boundaryCount && (Math.abs(u - v) === 1 || Math.abs(u - v) === m.boundaryCount - 1);
        if (!onOutline) expect(c, key).toBe(2);
      }
    });
  }
});

describe('buildBody (ray)', () => {
  const g = buildBody(rayTemplate);
  const pos = g.getAttribute('position');
  const uv = g.getAttribute('uv');
  const side = g.getAttribute('side');
  const { size, center } = rayTemplate;

  it('builds in well under 100 ms (DESIGN 4.2)', () => {
    const t0 = performance.now();
    buildBody(rayTemplate);
    expect(performance.now() - t0).toBeLessThan(100);
  });

  it('has a reasonable triangle budget for 30 creatures', () => {
    const s = bodyStats(g);
    expect(s.triangles).toBeGreaterThan(800);
    expect(s.triangles).toBeLessThan(5000);
  });

  it('UV = template coordinates: x/z of a back vertex map exactly back to its UV', () => {
    for (let i = 0; i < pos.count; i++) {
      const u = pos.getX(i) / size + center[0];
      const v = pos.getZ(i) / size + center[1];
      expect(uv.getX(i)).toBeCloseTo(u, 5);
      expect(uv.getY(i)).toBeCloseTo(1 - v, 5);
    }
  });

  it('is thick in the middle and thin towards the edge', () => {
    let top = -Infinity;
    let bottom = Infinity;
    let topNearEdge = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) / size + center[0];
      const y = pos.getY(i);
      const z = pos.getZ(i) / size + center[1];
      if (z > 0.56) continue; // skip the tail
      top = Math.max(top, y);
      bottom = Math.min(bottom, y);
      if (Math.abs(x - 0.5) > 0.4) topNearEdge = Math.max(topNearEdge, y); // outer wings
    }
    const thickness = top - bottom;
    expect(top).toBeGreaterThan(0.08 * size); // clearly domed at the centre
    expect(thickness).toBeGreaterThan(0.1 * size);
    expect(topNearEdge).toBeLessThan(top * 0.35); // wings are much thinner than the centre
  });

  it('the back is above the belly and meets it at the outline', () => {
    const backY = new Map<string, number>();
    for (let i = 0; i < pos.count; i++) if (side.getX(i) === 0) backY.set(`${pos.getX(i).toFixed(5)},${pos.getZ(i).toFixed(5)}`, pos.getY(i));
    let meet = 0;
    for (let i = 0; i < pos.count; i++) {
      if (side.getX(i) !== 1) continue;
      const y = backY.get(`${pos.getX(i).toFixed(5)},${pos.getZ(i).toFixed(5)}`);
      expect(y).toBeDefined();
      expect(y as number).toBeGreaterThanOrEqual(pos.getY(i));
      if (Math.abs((y as number) - pos.getY(i)) < 1e-6) meet++;
    }
    const outlineVertices = rayTemplate.parts.reduce((sum, p) => sum + buildPartMesh(p).boundaryCount, 0);
    expect(meet).toBe(outlineVertices); // exactly the outline vertices, nothing else
  });

  it('the back faces up and the belly faces down', () => {
    const n = g.getAttribute('normal');
    let backUp = 0, backTotal = 0, bellyDown = 0, bellyTotal = 0;
    for (let i = 0; i < pos.count; i++) {
      if (pos.getZ(i) / size + center[1] > 0.56) continue;
      if (side.getX(i) === 0) { backTotal++; if (n.getY(i) > 0) backUp++; } else { bellyTotal++; if (n.getY(i) < 0) bellyDown++; }
    }
    // Rim vertices may point sideways; the rest must be correct.
    expect(backUp / backTotal).toBeGreaterThan(0.9);
    expect(bellyDown / bellyTotal).toBeGreaterThan(0.9);
  });

  it('only the tail has flex, growing from 0 at its pivot', () => {
    const flex = g.getAttribute('flex');
    let max = 0;
    for (let i = 0; i < pos.count; i++) {
      const v = pos.getZ(i) / size + center[1];
      if (flex.getX(i) > 0) expect(v).toBeGreaterThan(tail.pivot?.[1] ?? 0);
      max = Math.max(max, flex.getX(i));
    }
    expect(max).toBeCloseTo(1, 3);
    expect(body.pivot).toBeUndefined();
  });
});

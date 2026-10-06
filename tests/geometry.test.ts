import { describe, expect, it } from 'vitest';
import { pointInPolygon, polygonBounds, signedArea, smoothClosed, type Vec2 } from '../src/drawing/geometry';

const square: Vec2[] = [[0, 0], [1, 0], [1, 1], [0, 1]];

describe('geometry', () => {
  it('signedArea is positive for clockwise-on-screen polygons', () => {
    expect(signedArea(square)).toBeCloseTo(1);
    expect(signedArea([...square].reverse())).toBeCloseTo(-1);
  });

  it('pointInPolygon', () => {
    expect(pointInPolygon(0.5, 0.5, square)).toBe(true);
    expect(pointInPolygon(1.5, 0.5, square)).toBe(false);
    expect(pointInPolygon(-0.01, 0.5, square)).toBe(false);
  });

  it('smoothClosed passes through the control points and stays closed', () => {
    const out = smoothClosed(square, 8);
    expect(out).toHaveLength(32);
    expect(out[0]).toEqual([0, 0]);
    expect(out[8]).toEqual([1, 0]);
    const b = polygonBounds(out);
    expect(b.minX).toBeGreaterThan(-0.2);
    expect(b.maxX).toBeLessThan(1.2);
  });
});

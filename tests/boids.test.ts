import { describe, expect, it } from 'vitest';
import { Flock } from '../src/aquarium/boids';
import { terrainHeight } from '../src/aquarium/terrain';
import { createRng } from '../src/util/random';

const params = { count: 60, min: [-10, 1, -8] as [number, number, number], max: [10, 7, 4] as [number, number, number], minSpeed: 1, maxSpeed: 2.5 };

describe('Flock', () => {
  it('stays inside its box and above the sand', { timeout: 30_000 }, () => {
    const f = new Flock(params, createRng(1));
    for (let s = 0; s < 1500; s++) {
      const t = s / 60;
      f.step(1 / 60, [Math.sin(t * 0.3) * 8, 4, Math.cos(t * 0.2) * 3]);
      for (let i = 0; i < f.count; i++) {
        const [x, y, z] = [f.pos[i * 3], f.pos[i * 3 + 1], f.pos[i * 3 + 2]];
        expect(x).toBeGreaterThanOrEqual(-10);
        expect(x).toBeLessThanOrEqual(10);
        expect(z).toBeGreaterThanOrEqual(-8);
        expect(z).toBeLessThanOrEqual(4);
        expect(y).toBeLessThanOrEqual(7);
        expect(y).toBeGreaterThan(terrainHeight(x, z));
      }
    }
  });

  it('keeps speed within limits', () => {
    const f = new Flock(params, createRng(2));
    for (let s = 0; s < 300; s++) f.step(1 / 60, [0, 4, 0]);
    for (let i = 0; i < f.count; i++) {
      const sp = Math.hypot(f.vel[i * 3], f.vel[i * 3 + 1], f.vel[i * 3 + 2]);
      expect(sp).toBeGreaterThan(0.99);
      expect(sp).toBeLessThan(2.51);
    }
  });

  it('is deterministic for a given seed', () => {
    const a = new Flock(params, createRng(3));
    const b = new Flock(params, createRng(3));
    for (let s = 0; s < 50; s++) {
      a.step(1 / 60, [0, 4, 0]);
      b.step(1 / 60, [0, 4, 0]);
    }
    expect(Array.from(a.pos)).toEqual(Array.from(b.pos));
  });
});

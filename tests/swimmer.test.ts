import { describe, expect, it } from 'vitest';
import { terrainHeight } from '../src/aquarium/terrain';
import { Swimmer, type SwimBounds } from '../src/creature/swimmer';
import { rayTemplate } from '../src/species/ray';
import { createRng } from '../src/util/random';

const bounds: SwimBounds = { min: [-12, 2, -11], max: [12, 8.8, 4], floorMargin: 3 };
const make = (seed: number, i: number): Swimmer =>
  new Swimmer(rayTemplate.swim, createRng(seed), { pos: [-6 + i * 3, 5, -4 + i], yaw: i, pitch: 0, speed: 1.2 });

describe('Swimmer', () => {
  it('stays inside the box and above the sand for ten simulated minutes', () => {
    const swimmers = [0, 1, 2, 3, 4, 5].map((i) => make(10 + i, i));
    for (let s = 0; s < 36000; s++) {
      for (const sw of swimmers) sw.step(1 / 60, swimmers, bounds);
      if (s % 60) continue;
      for (const sw of swimmers) {
        const [x, y, z] = sw.pos;
        expect(x).toBeGreaterThanOrEqual(bounds.min[0]);
        expect(x).toBeLessThanOrEqual(bounds.max[0]);
        expect(z).toBeGreaterThanOrEqual(bounds.min[2]);
        expect(z).toBeLessThanOrEqual(bounds.max[2]);
        expect(y).toBeLessThanOrEqual(bounds.max[1]);
        expect(y).toBeGreaterThan(terrainHeight(x, z) + 1.5); // clear of the reef tops
        expect(Number.isFinite(sw.yaw + sw.pitch + sw.roll + sw.speed)).toBe(true);
      }
    }
  });

  it('turns smoothly: yaw rate never exceeds the species turn rate', () => {
    const sw = make(3, 0);
    let prev = sw.yaw;
    let maxRate = 0;
    for (let s = 0; s < 6000; s++) {
      sw.step(1 / 60, [sw], bounds);
      let d = sw.yaw - prev;
      if (d > Math.PI) d -= 2 * Math.PI;
      if (d < -Math.PI) d += 2 * Math.PI;
      maxRate = Math.max(maxRate, Math.abs(d) * 60);
      prev = sw.yaw;
    }
    expect(maxRate).toBeLessThanOrEqual(rayTemplate.swim.turnRate * 1.02);
    expect(maxRate).toBeGreaterThan(0.05); // it does turn
  });

  it('moves at about its cruise speed (slow, gliding)', () => {
    const sw = make(4, 0);
    for (let s = 0; s < 1800; s++) sw.step(1 / 60, [sw], bounds);
    expect(sw.speed).toBeGreaterThan(rayTemplate.swim.cruiseSpeed[0] * 0.6);
    expect(sw.speed).toBeLessThan(rayTemplate.swim.cruiseSpeed[1] * 1.05);
  });

  it('keeps apart from each other', () => {
    const swimmers = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => make(20 + i, i % 4));
    let closest = Infinity;
    for (let s = 0; s < 18000; s++) {
      for (const sw of swimmers) sw.step(1 / 60, swimmers, bounds);
      if (s < 600 || s % 30) continue;
      for (let i = 0; i < swimmers.length; i++) for (let j = i + 1; j < swimmers.length; j++) {
        const [a, c] = [swimmers[i].pos, swimmers[j].pos];
        closest = Math.min(closest, Math.hypot(a[0] - c[0], a[1] - c[1], a[2] - c[2]));
      }
    }
    expect(closest).toBeGreaterThan(0.8);
  });

  it('banks into turns: roll follows the turn direction and stays moderate', () => {
    const sw = make(5, 0);
    let maxRoll = 0;
    for (let s = 0; s < 6000; s++) {
      sw.step(1 / 60, [sw], bounds);
      maxRoll = Math.max(maxRoll, Math.abs(sw.roll));
      if (Math.abs(sw.yawRate) > 0.3) expect(Math.sign(sw.roll)).toBe(Math.sign(sw.yawRate));
    }
    expect(maxRoll).toBeLessThanOrEqual(0.451);
  });
});

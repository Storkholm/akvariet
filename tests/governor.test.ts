import { describe, expect, it } from 'vitest';
import { PixelRatioGovernor } from '../src/aquarium/governor';

const run = (g: PixelRatioGovernor, dt: number, seconds: number): number[] => {
  const changes: number[] = [];
  for (let t = 0; t < seconds; t += dt) {
    const r = g.sample(dt);
    if (r !== null) changes.push(r);
  }
  return changes;
};

describe('PixelRatioGovernor', () => {
  it('leaves a smooth 60 fps alone', () => {
    expect(run(new PixelRatioGovernor(2), 1 / 60, 30)).toEqual([]);
  });

  it('steps the resolution down when frames are slow, and stops at the minimum', () => {
    const g = new PixelRatioGovernor(2);
    const changes = run(g, 1 / 25, 30);
    expect(changes[0]).toBe(1.6);
    expect(changes).toEqual([...changes].sort((a, b) => b - a)); // only ever down
    expect(g.ratio).toBe(1);
    expect(changes[changes.length - 1]).toBe(1);
  });

  it('waits for the observation window before judging (a single slow frame is not enough)', () => {
    const g = new PixelRatioGovernor(2);
    expect(g.sample(0.2)).toBeNull();
    expect(run(g, 1 / 60, 1.5)).toEqual([]);
  });

  it('ignores stalls from hidden tabs and bad values', () => {
    const g = new PixelRatioGovernor(2);
    for (const bad of [0.5, 3, NaN, -1, 0]) expect(g.sample(bad)).toBeNull();
    expect(run(g, 1 / 60, 10)).toEqual([]);
  });

  it('never goes below the minimum, even when everything is slow', () => {
    const g = new PixelRatioGovernor(1.2, 1);
    run(g, 0.1, 60);
    expect(g.ratio).toBe(1);
  });
});

import { describe, expect, it } from 'vitest';
import { StrokeSmoother, type Segment } from '../src/drawing/smoothing';

function run(points: Array<[number, number]>): Segment[] {
  const s = new StrokeSmoother();
  s.start(points[0]);
  const out: Segment[] = [];
  for (const p of points.slice(1)) out.push(...s.push(p));
  out.push(...s.end());
  return out;
}

describe('StrokeSmoother', () => {
  it('produces a continuous chain from the first to the last point', () => {
    const segs = run([[0, 0], [10, 0], [20, 10], [30, 10], [60, 40]]);
    expect(segs[0]).toMatchObject({ x0: 0, y0: 0 });
    for (let i = 1; i < segs.length; i++) {
      expect(segs[i].x0).toBeCloseTo(segs[i - 1].x1);
      expect(segs[i].y0).toBeCloseTo(segs[i - 1].y1);
    }
    expect(segs[segs.length - 1]).toMatchObject({ x1: 60, y1: 40 });
  });

  it('handles very fast moves (big gaps) without jumping off the path', () => {
    const segs = run([[0, 0], [400, 0], [800, 400]]);
    for (const s of segs) {
      for (const v of [s.x0, s.x1, s.cx]) expect(v).toBeGreaterThanOrEqual(0);
      for (const v of [s.x0, s.x1, s.cx]) expect(v).toBeLessThanOrEqual(800);
    }
    expect(segs[segs.length - 1]).toMatchObject({ x1: 800, y1: 400 });
  });

  it('ignores jitter below the minimum distance and yields nothing for a tap', () => {
    const s = new StrokeSmoother(2);
    s.start([5, 5]);
    expect(s.push([5.5, 5.2])).toEqual([]);
    expect(s.end()).toEqual([]);
  });
});

import type { Vec2 } from './geometry';

export interface Segment {
  x0: number; y0: number;
  cx: number; cy: number;
  x1: number; y1: number;
}

/**
 * Turns raw pointer points into a smooth chain of quadratic curves through the midpoints
 * (control point = the raw point), so strokes stay smooth even when the finger moves fast.
 * Segments are continuous: each starts exactly where the previous one ended.
 */
export class StrokeSmoother {
  private cursor: Vec2 = [0, 0];
  private last: Vec2 = [0, 0];
  private started = false;

  constructor(private readonly minDistance = 1.5) {}

  start(p: Vec2): void {
    this.cursor = [p[0], p[1]];
    this.last = [p[0], p[1]];
    this.started = true;
  }

  push(p: Vec2): Segment[] {
    if (!this.started) throw new Error('StrokeSmoother.start() first');
    if (Math.hypot(p[0] - this.last[0], p[1] - this.last[1]) < this.minDistance) return [];
    const mid: Vec2 = [(this.last[0] + p[0]) / 2, (this.last[1] + p[1]) / 2];
    const seg: Segment = { x0: this.cursor[0], y0: this.cursor[1], cx: this.last[0], cy: this.last[1], x1: mid[0], y1: mid[1] };
    this.cursor = mid;
    this.last = [p[0], p[1]];
    return [seg];
  }

  /** Finishes the stroke with a straight run to the last raw point. */
  end(): Segment[] {
    if (!this.started) return [];
    this.started = false;
    const [x, y] = this.last;
    if (Math.hypot(x - this.cursor[0], y - this.cursor[1]) < 0.01) return [];
    return [{ x0: this.cursor[0], y0: this.cursor[1], cx: x, cy: y, x1: x, y1: y }];
  }
}

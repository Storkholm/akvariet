import { describe, expect, it } from 'vitest';
import { DOUBLE_TAP_MS, DRAG_THRESHOLD_PX, GestureTracker } from '../src/aquarium/CameraControls';

function make() {
  const log: string[] = [];
  const g = new GestureTracker();
  g.onTap = () => log.push('tap');
  g.onDoubleTap = () => log.push('double');
  g.onDragStart = () => log.push('dragStart');
  g.onDragEnd = (vx) => log.push(`dragEnd:${vx === 0 ? 'rest' : 'fling'}`);
  const moves: Array<[number, number, number, number]> = [];
  g.onMove = (dx, dy, scale, fingers) => moves.push([dx, dy, scale, fingers]);
  return { g, log, moves };
}

describe('GestureTracker', () => {
  it('a short touch that stays put is a tap', () => {
    const { g, log } = make();
    g.down(1, 100, 100, 0);
    g.move(1, 103, 102, 40);
    expect(g.up(1, 90)).toBe('tap');
    expect(log).toEqual(['tap']);
  });

  it('moving less than ~10 px is still a tap, 10 px or more is a drag (ADR 0006)', () => {
    const a = make();
    a.g.down(1, 0, 0, 0);
    a.g.move(1, DRAG_THRESHOLD_PX - 1, 0, 20);
    a.g.up(1, 60);
    expect(a.log).toEqual(['tap']);

    const b = make();
    b.g.down(1, 0, 0, 0);
    b.g.move(1, DRAG_THRESHOLD_PX + 1, 0, 20);
    b.g.move(1, 40, 0, 40);
    expect(b.g.up(1, 200)).toBe('drag');
    expect(b.log[0]).toBe('dragStart');
    expect(b.log).not.toContain('tap');
  });

  it('the first drag move carries what was moved before the threshold, so nothing jumps', () => {
    const { g, moves } = make();
    g.down(1, 50, 50, 0);
    g.move(1, 54, 50, 10);
    g.move(1, 64, 50, 20);
    expect(moves[0]).toEqual([14, 0, 1, 1]);
  });

  it('a long press that stays put is not a tap', () => {
    const { g, log } = make();
    g.down(1, 5, 5, 0);
    expect(g.up(1, 1500)).toBe('other');
    expect(log).toEqual([]);
  });

  it('two taps in a row at the same place are a double tap; slow or far apart ones are not', () => {
    const a = make();
    a.g.down(1, 100, 100, 0); a.g.up(1, 50);
    a.g.down(2, 105, 98, 200); a.g.up(2, 250);
    expect(a.log).toEqual(['tap', 'tap', 'double']);

    const b = make();
    b.g.down(1, 100, 100, 0); b.g.up(1, 50);
    b.g.down(2, 100, 100, 50 + DOUBLE_TAP_MS + 100); b.g.up(2, 50 + DOUBLE_TAP_MS + 150);
    expect(b.log).toEqual(['tap', 'tap']);

    const c = make();
    c.g.down(1, 100, 100, 0); c.g.up(1, 50);
    c.g.down(2, 300, 100, 150); c.g.up(2, 200);
    expect(c.log).toEqual(['tap', 'tap']);
  });

  it('a third quick tap does not make another double tap straight away', () => {
    const { g, log } = make();
    for (let i = 0; i < 3; i++) {
      g.down(i, 10, 10, i * 150);
      g.up(i, i * 150 + 40);
    }
    expect(log.filter((x) => x === 'double')).toHaveLength(1);
  });

  it('two fingers pinch: the scale follows the distance and neither finger lifting is a tap', () => {
    const { g, log, moves } = make();
    g.down(1, 100, 200, 0);
    g.down(2, 200, 200, 10);
    g.move(2, 300, 200, 30); // fingers 100 → 200 apart
    expect(moves.at(-1)?.[2]).toBeCloseTo(2, 5);
    expect(moves.at(-1)?.[3]).toBe(2);
    g.move(2, 250, 200, 50); // 200 → 150
    expect(moves.at(-1)?.[2]).toBeCloseTo(0.75, 5);
    g.up(2, 80);
    expect(g.up(1, 90)).toBe('drag');
    expect(log).not.toContain('tap');
    expect(log).toEqual(['dragStart', 'dragEnd:rest']);
  });

  it('a swipe that ends in motion flings; one that rests first does not', () => {
    const a = make();
    a.g.down(1, 0, 0, 0);
    for (let i = 1; i <= 8; i++) a.g.move(1, i * 20, 0, i * 16);
    a.g.up(1, 8 * 16 + 20);
    expect(a.log.at(-1)).toBe('dragEnd:fling');

    const b = make();
    b.g.down(1, 0, 0, 0);
    for (let i = 1; i <= 8; i++) b.g.move(1, i * 20, 0, i * 16);
    b.g.up(1, 8 * 16 + 400);
    expect(b.log.at(-1)).toBe('dragEnd:rest');
  });

  it('a cancelled touch ends a drag cleanly and is never a tap', () => {
    const { g, log } = make();
    g.down(1, 0, 0, 0);
    g.move(1, 50, 0, 20);
    g.cancel(1);
    expect(log).toEqual(['dragStart', 'dragEnd:rest']);
    expect(g.active).toBe(false);
  });
});

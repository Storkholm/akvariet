import { describe, expect, it } from 'vitest';
import { carouselGeometry, CarouselScroll } from '../src/ui/carouselScroll';

const settle = (s: CarouselScroll, seconds = 3): void => {
  for (let t = 0; t < seconds; t += 1 / 60) s.update(1 / 60);
};
const make = (count: number, viewport = 1180, spacing = viewport / 3): CarouselScroll => {
  const s = new CarouselScroll();
  s.configure(count, spacing, viewport);
  return s;
};

describe('carouselGeometry', () => {
  it('shows about three bubbles on a tablet and one and a half on an upright phone', () => {
    expect(carouselGeometry(1180, 820).visible).toBe(3);
    expect(carouselGeometry(390, 844).visible).toBe(1.5);
    const g = carouselGeometry(1180, 820);
    expect(g.spacing * 3).toBeCloseTo(1180, 5);
    const p = carouselGeometry(390, 844);
    expect(390 / p.spacing).toBeCloseTo(1.5, 5);
  });

  it('keeps bubbles big enough to tap and never taller than the screen', () => {
    for (const [w, h] of [[1180, 820], [1024, 768], [390, 844], [320, 568], [844, 390], [1366, 1024]]) {
      const g = carouselGeometry(w, h);
      expect(2 * g.r, `${w}x${h}`).toBeGreaterThanOrEqual(120);
      expect(g.cy + g.r).toBeLessThan(h);
      expect(g.cy - g.r).toBeGreaterThan(0);
      expect(g.bandTop).toBeGreaterThanOrEqual(0);
      expect(g.bandTop + g.bandHeight).toBeLessThanOrEqual(h);
      expect(2 * g.r).toBeLessThanOrEqual(g.spacing); // neighbours never overlap
    }
  });
});

describe('CarouselScroll', () => {
  it('centres a few bubbles and does not scroll', () => {
    const s = make(2);
    expect(s.scrollable).toBe(false);
    s.startDrag();
    s.dragBy(-300);
    s.release(-2000);
    settle(s);
    expect(s.itemX(0) + s.itemX(1)).toBeCloseTo(1180, 3); // symmetric around the middle
  });

  it('with eight bubbles starts at the left end and cannot be dragged past the ends by more than a little', () => {
    const s = make(8);
    expect(s.scrollable).toBe(true);
    expect(s.x).toBe(0);
    s.startDrag();
    s.dragBy(400); // finger right at the left end: nothing to show there
    expect(s.x).toBeLessThan(0);
    expect(s.x).toBeGreaterThan(-400 * 0.4);
    s.release(0);
    settle(s);
    expect(s.x).toBe(0);
  });

  it('always rests with a bubble in the middle (snap), also after a slow, short drag', () => {
    const s = make(8);
    s.startDrag();
    s.dragBy(-130);
    s.release(0);
    settle(s);
    const rests = [0, 1, 2, 3, 4, 5, 6, 7].some((i) => Math.abs(s.x - s.offsetFor(i)) < 0.01);
    expect(rests, `rested between bubbles at ${s.x}`).toBe(true);
    // …and the bubble nearest the middle really is centred (within the ends' limits).
    const mid = s.itemX(s.nearest());
    expect(Math.abs(mid - s.viewport / 2) < 0.01 || s.x === 0 || Math.abs(s.x - (s.contentWidth - s.viewport)) < 0.01).toBe(true);
  });

  it('a fast fling goes further than a slow drag and lands on a bubble', () => {
    const slow = make(8);
    slow.startDrag();
    slow.dragBy(-100);
    slow.release(-100);
    settle(slow);
    const fast = make(8);
    fast.startDrag();
    fast.dragBy(-100);
    fast.release(-2500);
    settle(fast);
    expect(fast.x).toBeGreaterThan(slow.x);
    expect([0, 1, 2, 3, 4, 5, 6, 7].some((i) => Math.abs(fast.x - fast.offsetFor(i)) < 0.01)).toBe(true);
  });

  it('stops at the last bubble however hard it is flung, and never shows empty space beyond it', () => {
    const s = make(8);
    s.startDrag();
    s.release(-90000);
    settle(s);
    expect(s.x).toBeCloseTo(s.contentWidth - s.viewport, 3);
    expect(s.itemX(7) + s.spacing / 2).toBeCloseTo(s.viewport, 3);
  });

  it('on a phone (1½ bubbles) a swipe brings the second bubble to the middle', () => {
    const s = make(2, 390, 260);
    expect(s.scrollable).toBe(true);
    expect(s.itemX(0)).toBeCloseTo(130, 3);
    s.startDrag();
    s.dragBy(-100);
    s.release(-600);
    settle(s);
    expect(s.nearest()).toBe(1);
    expect(s.itemX(1) - 130).toBeGreaterThan(100); // the second bubble is now fully on screen
    expect(s.itemX(1) + 130).toBeLessThanOrEqual(390.01);
  });

  it('scrollTo brings a bubble into view (keyboard focus)', () => {
    const s = make(8);
    s.scrollTo(5);
    settle(s);
    expect(s.nearest()).toBe(5);
  });

  it('survives a resize without ending up between bubbles', () => {
    const s = make(8);
    s.scrollTo(4);
    settle(s);
    s.configure(8, 500 / 1.5, 500);
    settle(s);
    expect([0, 1, 2, 3, 4, 5, 6, 7].some((i) => Math.abs(s.x - s.offsetFor(i)) < 0.01)).toBe(true);
  });
});

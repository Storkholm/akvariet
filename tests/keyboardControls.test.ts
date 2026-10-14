import { describe, expect, it } from 'vitest';
import { CameraRig } from '../src/aquarium/cameraRig';
import { KeyboardControls } from '../src/aquarium/KeyboardControls';
import { CarouselScroll } from '../src/ui/carouselScroll';

function setup(over: { blocked?: boolean; carousel?: boolean } = {}) {
  const rig = new CameraRig();
  const target = new EventTarget();
  const stepped: number[] = [];
  let moved = 0;
  const state = { blocked: over.blocked ?? false, carousel: over.carousel ?? false };
  const keys = new KeyboardControls(
    rig,
    {
      worldPerPixel: () => 0.02,
      height: () => 800,
      blocked: () => state.blocked,
      carouselShown: () => state.carousel,
      stepCarousel: (d) => stepped.push(d),
      onMoved: () => moved++,
    },
    target,
  );
  const press = (key: string, extra: Record<string, unknown> = {}): boolean => {
    const { target: from, ...rest } = extra;
    const e = Object.assign(new Event('keydown', { cancelable: true }), { key, repeat: false, ctrlKey: false, metaKey: false, altKey: false }, rest);
    if (from) Object.defineProperty(e, 'target', { value: from });
    target.dispatchEvent(e);
    return e.defaultPrevented;
  };
  const release = (key: string): void => void target.dispatchEvent(Object.assign(new Event('keyup'), { key }));
  const run = (seconds: number): void => {
    for (let t = 0; t < seconds; t += 1 / 30) {
      keys.update(1 / 30);
      rig.update(1 / 30);
    }
  };
  return { rig, keys, state, press, release, run, stepped, moved: () => moved };
}

describe('KeyboardControls (ADR 0013)', () => {
  it('the arrows slide the camera while held, and stop when released', () => {
    const k = setup();
    expect(k.press('ArrowRight')).toBe(true);
    k.run(1.5);
    const right = k.rig.x;
    expect(right).toBeGreaterThan(3);
    k.release('ArrowRight');
    k.run(1.5);
    expect(k.rig.x).toBeLessThan(right + 1.5); // eases to a stop, does not run on
    const stopped = k.rig.x;
    k.run(1);
    expect(k.rig.x).toBeCloseTo(stopped, 1);
    k.press('ArrowLeft');
    k.run(1);
    expect(k.rig.x).toBeLessThan(stopped);
  });

  it('W A S D do the same; up and down move the camera up and down', () => {
    const k = setup();
    k.press('w');
    k.run(1);
    expect(k.rig.y).toBeGreaterThan(0);
    k.release('w');
    k.press('d');
    k.run(1);
    expect(k.rig.x).toBeGreaterThan(0);
  });

  it('the camera never leaves the aquarium', () => {
    const k = setup();
    k.press('ArrowLeft');
    k.run(60);
    expect(Math.abs(k.rig.x)).toBeLessThanOrEqual(k.rig.limitX() + 1e-6);
  });

  it('+ and − zoom, Home brings the camera back', () => {
    const k = setup();
    k.press('+');
    k.run(1.5);
    expect(k.rig.zoom).toBeGreaterThan(1.5);
    k.release('+');
    k.press('ArrowRight');
    k.run(0.5);
    k.release('ArrowRight');
    k.press('-');
    k.run(3);
    expect(k.rig.zoom).toBeCloseTo(1, 1);
    k.press('Home');
    k.run(2);
    expect(k.rig.x).toBeCloseTo(0, 1);
  });

  it('while the species row is shown, ← → scroll it instead of the camera', () => {
    const k = setup({ carousel: true });
    expect(k.press('ArrowRight')).toBe(true);
    expect(k.press('ArrowLeft')).toBe(true);
    expect(k.press('d')).toBe(true);
    expect(k.stepped).toEqual([1, -1, 1]);
    k.run(1);
    expect(k.rig.x).toBe(0);
    // ↑ ↓ still move the camera.
    k.press('ArrowUp');
    k.run(1);
    expect(k.rig.y).toBeGreaterThan(0);
  });

  it('a held key does not step the row again and again', () => {
    const k = setup({ carousel: true });
    k.press('ArrowRight');
    k.press('ArrowRight', { repeat: true });
    k.press('ArrowRight', { repeat: true });
    expect(k.stepped).toEqual([1]);
  });

  it('does nothing while the keys belong to something else (drawing panel, dialog), with ctrl/cmd/alt held, or in a text field', () => {
    const k = setup({ blocked: true });
    expect(k.press('ArrowRight')).toBe(false);
    k.run(1);
    expect(k.rig.x).toBe(0);
    k.state.blocked = false;
    expect(k.press('ArrowRight', { ctrlKey: true })).toBe(false);
    expect(k.press('ArrowRight', { target: { tagName: 'INPUT' } })).toBe(false);
    k.run(1);
    expect(k.rig.x).toBe(0);
  });

  it('tells the app the camera was moved by hand (so following stops)', () => {
    const k = setup();
    k.press('ArrowRight');
    k.run(0.2);
    expect(k.moved()).toBeGreaterThan(0);
  });
});

describe('CarouselScroll steps (arrow buttons)', () => {
  const make = (): CarouselScroll => {
    const s = new CarouselScroll();
    s.configure(5, 300, 900);
    return s;
  };

  it('steps one bubble at a time, and says when there is no more in a direction', () => {
    const s = make();
    expect(s.canStep(-1)).toBe(false);
    expect(s.canStep(1)).toBe(true);
    s.step(1);
    for (let i = 0; i < 60; i++) s.update(1 / 30);
    expect(s.x).toBeGreaterThan(0);
    expect(s.canStep(-1)).toBe(true);
    for (let n = 0; n < 6; n++) {
      s.step(1);
      for (let i = 0; i < 60; i++) s.update(1 / 30);
    }
    expect(s.canStep(1)).toBe(false);
  });

  it('cannot step when everything fits on the screen', () => {
    const s = new CarouselScroll();
    s.configure(2, 300, 900);
    expect(s.canStep(1)).toBe(false);
    expect(s.canStep(-1)).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { CameraRig, FOLLOW_TIMEOUT_SECONDS, fitCamera, IDLE_RETURN_SECONDS, Y_RANGE, ZOOM_MAX, ZOOM_MIN } from '../src/aquarium/cameraRig';
import { createRng } from '../src/util/random';

const TABLET = 1180 / 820;
const PHONE = 390 / 844;

function make(aspect = TABLET): CameraRig {
  const rig = new CameraRig(37.5);
  rig.configure(fitCamera(aspect), aspect);
  return rig;
}
const run = (rig: CameraRig, seconds: number, dt = 1 / 60): void => {
  for (let t = 0; t < seconds; t += dt) rig.update(dt);
};

describe('CameraRig', () => {
  it('shows about a third of the aquarium at zoom 1 in landscape (ADR 0006: ~3 screen widths)', () => {
    const rig = make();
    // The camera can slide half the aquarium minus half a screen to each side: 3 screens in total.
    const visible = 37.5 - rig.limitX(1);
    expect(visible * 2 * 3).toBeGreaterThan(60);
    expect(visible * 2 * 3).toBeLessThan(90);
  });

  it('slides with the finger, in the right direction, and settles on the target', () => {
    const rig = make();
    rig.grab();
    rig.panBy(6, 1);
    run(rig, 1);
    expect(rig.x).toBeCloseTo(6, 1);
    expect(rig.y).toBeCloseTo(1, 1);
  });

  it('can never leave the aquarium, whatever it is told', () => {
    for (const aspect of [TABLET, PHONE]) {
      const rig = make(aspect);
      const rng = createRng(7);
      for (let i = 0; i < 4000; i++) {
        const r = rng.next();
        if (r < 0.3) rig.panBy(rng.range(-30, 30), rng.range(-8, 8));
        else if (r < 0.5) rig.zoomBy(rng.range(0.4, 2.5));
        else if (r < 0.6) rig.fling(rng.range(-60, 60), rng.range(-20, 20));
        else if (r < 0.62) rig.grab();
        rig.update(1 / 60);
        const lim = rig.limitX(rig.zoom);
        expect(Math.abs(rig.x)).toBeLessThanOrEqual(lim + 1e-9);
        expect(rig.y).toBeGreaterThanOrEqual(Y_RANGE[0] - 1e-9);
        expect(rig.y).toBeLessThanOrEqual(Y_RANGE[1] + 1e-9);
        expect(rig.zoom).toBeGreaterThanOrEqual(ZOOM_MIN - 1e-9);
        expect(rig.zoom).toBeLessThanOrEqual(ZOOM_MAX + 1e-9);
        // The picture's edge stays inside the aquarium: half a screen at the current zoom fits.
        const halfWidthAtZoom1 = 37.5 - rig.limitX(1);
        expect(Math.abs(rig.x) + halfWidthAtZoom1 / rig.zoom).toBeLessThanOrEqual(37.5 + 1e-6);
      }
    }
  });

  it('zoom stays within 1×–2.5×', () => {
    const rig = make();
    rig.zoomBy(10);
    run(rig, 2);
    expect(rig.zoom).toBeCloseTo(ZOOM_MAX, 2);
    rig.zoomBy(0.01);
    run(rig, 2);
    expect(rig.zoom).toBeCloseTo(ZOOM_MIN, 2);
  });

  it('brakes softly: a hard shove at the edge eases in over several frames instead of jumping', () => {
    const rig = make();
    rig.grab();
    rig.panBy(100, 0); // far past the edge
    rig.update(1 / 60);
    const lim = rig.limitX(1);
    expect(rig.x).toBeGreaterThan(0);
    expect(rig.x).toBeLessThan(lim * 0.5); // eased, not teleported
    run(rig, 2);
    expect(rig.x).toBeCloseTo(lim, 1);
  });

  it('keeps gliding after a fling and then stops', () => {
    const rig = make();
    rig.fling(20, 0);
    run(rig, 0.3);
    const early = rig.x;
    expect(early).toBeGreaterThan(1);
    run(rig, 5);
    const settled = rig.x;
    run(rig, 1);
    expect(rig.x).toBeCloseTo(settled, 3);
    expect(settled).toBeGreaterThan(early);
  });

  it('glides back to the middle only after 30 seconds without touch', () => {
    const rig = make();
    rig.grab();
    rig.panBy(10, 1.5);
    rig.zoomBy(2);
    run(rig, IDLE_RETURN_SECONDS - 1);
    expect(rig.x).toBeCloseTo(10, 0);
    expect(rig.zoom).toBeCloseTo(2, 1);
    run(rig, 2);
    expect(rig.returning).toBe(true);
    run(rig, 12);
    expect(rig.x).toBeCloseTo(0, 1);
    expect(rig.y).toBeCloseTo(0, 1);
    expect(rig.zoom).toBeCloseTo(1, 1);
    expect(rig.returning).toBe(false);
  });

  it('a touch starts the 30 seconds again', () => {
    const rig = make();
    rig.grab();
    rig.panBy(10, 0);
    run(rig, 25);
    rig.touch();
    run(rig, 25);
    expect(rig.x).toBeCloseTo(10, 0);
  });

  it('does not return while frozen (drawing / release transition)', () => {
    const rig = make();
    rig.grab();
    rig.panBy(10, 0);
    rig.frozen = true;
    run(rig, 120);
    expect(rig.x).toBeCloseTo(10, 0);
    rig.panBy(-5, 0); // and ignores input
    run(rig, 1);
    expect(rig.x).toBeCloseTo(10, 0);
  });

  describe('follow', () => {
    it('follows a moving point at the follow zoom and keeps up with it', () => {
      const rig = make();
      const p = { x: 0, y: 5 };
      rig.follow(() => p);
      for (let t = 0; t < 20; t += 1 / 60) {
        p.x = 8 + 4 * Math.sin(t * 0.3);
        rig.update(1 / 60);
      }
      expect(rig.zoom).toBeGreaterThan(1.9);
      expect(Math.abs(rig.x - p.x)).toBeLessThan(3);
      expect(rig.following).toBe(true);
    });

    it('does not stay at the 30 s return while following – it lets go after 2 minutes, then returns', () => {
      const rig = make();
      const p = { x: 12, y: 5 };
      rig.follow(() => p);
      run(rig, IDLE_RETURN_SECONDS + 10);
      expect(rig.following).toBe(true);
      expect(rig.x).toBeCloseTo(12, 0);
      run(rig, FOLLOW_TIMEOUT_SECONDS - (IDLE_RETURN_SECONDS + 10) - 5);
      expect(rig.following).toBe(true);
      run(rig, 10);
      expect(rig.following).toBe(false);
      run(rig, 20);
      expect(rig.x).toBeCloseTo(0, 1);
      expect(rig.zoom).toBeCloseTo(1, 1);
    });

    it('stopFollow keeps the camera where it is; a swipe stops following', () => {
      const rig = make();
      const p = { x: 14, y: 5 };
      rig.follow(() => p);
      run(rig, 6);
      const x = rig.x;
      rig.stopFollow();
      run(rig, 3);
      expect(rig.following).toBe(false);
      expect(rig.x).toBeCloseTo(x, 1);
    });

    it('a creature at the very edge cannot drag the camera out of the aquarium', () => {
      const rig = make();
      const p = { x: 37, y: 0.2 };
      rig.follow(() => p);
      run(rig, 8);
      expect(Math.abs(rig.x)).toBeLessThanOrEqual(rig.limitX(rig.zoom) + 1e-9);
      expect(rig.y).toBeGreaterThanOrEqual(Y_RANGE[0]);
    });
  });
});

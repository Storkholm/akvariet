import { describe, expect, it } from 'vitest';
import { fitCamera } from '../src/aquarium/cameraRig';

describe('fitCamera', () => {
  it('shows the intended width in landscape and portrait', () => {
    for (const [aspect, width] of [[1180 / 820, 25], [390 / 844, 10]] as const) {
      const f = fitCamera(aspect);
      const w = 2 * Math.tan((f.fov * Math.PI) / 360) * f.distance * aspect;
      expect(w).toBeGreaterThan(width * 0.95);
      expect(w).toBeLessThan(width * 1.15);
    }
  });
  it('keeps the camera at a sane distance for any aspect', () => {
    for (const a of [0.4, 0.46, 0.75, 1, 1.4, 2.2]) {
      const { distance } = fitCamera(a);
      expect(distance).toBeGreaterThan(10);
      expect(distance).toBeLessThan(45);
    }
  });
});

import { describe, expect, it } from 'vitest';
import { terrainHeight } from '../src/aquarium/terrain';

describe('terrainHeight', () => {
  it('is finite and gently varying near the camera', () => {
    for (let x = -24; x <= 24; x += 3) for (let z = -20; z <= 8; z += 3) {
      const h = terrainHeight(x, z);
      expect(Number.isFinite(h)).toBe(true);
      expect(Math.abs(h)).toBeLessThan(6);
    }
  });
});

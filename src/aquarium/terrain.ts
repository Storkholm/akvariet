/** Extent of the aquarium's "usable" water volume (world units). */
export const TANK = {
  minX: -37.5,
  maxX: 37.5,
  minZ: -22,
  maxZ: 8,
  /** Water surface; animals stay below this. */
  surfaceY: 11,
} as const;

/**
 * ADR 0006: the aquarium is about three screen widths wide (in landscape: 25 units visible × 3). Creatures and the
 * camera stay inside ±WORLD_HALF_WIDTH; the reef and the sand reach a little further so the edge is never seen.
 */
export const WORLD_HALF_WIDTH = 37.5;
export const REEF_HALF_WIDTH = 48;

/** Sand height at (x, z): gentle dunes, rising slowly towards the back wall. */
export function terrainHeight(x: number, z: number): number {
  const slope = Math.max(0, -z - 3) * 0.1;
  const dunes =
    Math.sin(x * 0.31 + z * 0.17) * 0.5 +
    Math.sin(x * 0.12 - z * 0.29 + 1.7) * 0.45 +
    Math.sin(x * 0.75 + z * 0.55) * 0.07;
  return slope + dunes * 0.7;
}

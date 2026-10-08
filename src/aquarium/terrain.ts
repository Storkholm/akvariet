/** Extent of the aquarium's "usable" water volume (world units). */
export const TANK = {
  minX: -24,
  maxX: 24,
  minZ: -22,
  maxZ: 8,
  /** Water surface; animals stay below this. */
  surfaceY: 11,
} as const;

/** Sand height at (x, z): gentle dunes, rising slowly towards the back wall. */
export function terrainHeight(x: number, z: number): number {
  const slope = Math.max(0, -z - 3) * 0.1;
  const dunes =
    Math.sin(x * 0.31 + z * 0.17) * 0.5 +
    Math.sin(x * 0.12 - z * 0.29 + 1.7) * 0.45 +
    Math.sin(x * 0.75 + z * 0.55) * 0.07;
  return slope + dunes * 0.7;
}

/** Cap the device pixel ratio so 3x phones don't render 9x the pixels (DESIGN 4.4). */
export function clampPixelRatio(devicePixelRatio: number, max = 2): number {
  if (!Number.isFinite(devicePixelRatio) || devicePixelRatio <= 0) return 1;
  return Math.min(devicePixelRatio, max);
}

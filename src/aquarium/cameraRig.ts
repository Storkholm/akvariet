const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export interface CameraFit {
  fov: number;
  distance: number;
  height: number;
  lookY: number;
}

/**
 * Landscape shows the wide reef; portrait must still work (DESIGN 2), so it
 * uses a wider fov, a narrower slice of the reef and a higher, steeper view.
 */
export function fitCamera(aspect: number): CameraFit {
  const portrait = 1 - clamp01((aspect - 0.6) / 0.7); // 0 = landscape, 1 = portrait
  const fov = lerp(45, 55, portrait);
  const visibleWidth = lerp(25, 10, portrait);
  const distance = visibleWidth / 2 / (Math.tan((fov * Math.PI) / 360) * aspect);
  return { fov, distance, height: lerp(3.8, 3.2, portrait), lookY: lerp(3.3, 1.9, portrait) };
}

/** Half width of the area creatures swim in: the visible width at mid-depth, so they stay on screen. */
export function swimHalfWidth(aspect: number, fit: CameraFit): number {
  const visible = Math.tan((fit.fov * Math.PI) / 360) * aspect * (fit.distance + 3) * 0.85;
  return Math.min(12.5, Math.max(5, visible));
}

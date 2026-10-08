import type { Vec2 } from './geometry';

/**
 * Rasterises the union of the polygons (template coordinates 0–1) into a size×size
 * coverage mask: 255 inside any polygon, 0 outside. Uses pixel centres, even-odd per polygon.
 */
export function rasterizeMask(polygons: readonly (readonly Vec2[])[], size: number): Uint8Array {
  const mask = new Uint8Array(size * size);
  const xs: number[] = [];
  for (const poly of polygons) {
    for (let y = 0; y < size; y++) {
      const cy = (y + 0.5) / size;
      xs.length = 0;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [xi, yi] = poly[i];
        const [xj, yj] = poly[j];
        if (yi > cy !== yj > cy) xs.push(xi + ((cy - yi) / (yj - yi)) * (xj - xi));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const from = Math.max(0, Math.ceil(xs[k] * size - 0.5));
        const to = Math.min(size - 1, Math.floor(xs[k + 1] * size - 0.5));
        for (let x = from; x <= to; x++) mask[y * size + x] = 255;
      }
    }
  }
  return mask;
}

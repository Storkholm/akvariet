export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Rgb = readonly [number, number, number];
/** A fill colour that depends on the row: used by the rainbow bucket (bands across the region's height). */
export type RowColor = (y: number, minY: number, maxY: number) => Rgb;

export interface FillOptions {
  /** Max per-channel difference still counted as "the same colour". */
  tolerance: number;
  /** Adds a faint crayon-like grain to the filled pixels. */
  grain?: boolean;
}

export function parseHex(hex: string): [number, number, number] {
  const v = parseInt(hex.replace('#', ''), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

/** Deterministic per-pixel noise in [-1, 1]. */
export function grainNoise(x: number, y: number): number {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 2147483648 - 1;
}

/**
 * Fill bucket (CONTEXT: Fyld-spand): fills the connected region of similar colour around (sx, sy)
 * with `rgb`, never leaving `mask` (the template outline). `data` is RGBA, modified in place.
 * Returns the changed rectangle, or null when the start point is outside the figure.
 */
export function floodFill(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  sx: number,
  sy: number,
  rgb: Rgb | RowColor,
  mask: Uint8Array,
  opts: FillOptions,
): Rect | null {
  sx = Math.floor(sx);
  sy = Math.floor(sy);
  if (sx < 0 || sy < 0 || sx >= width || sy >= height || !mask[sy * width + sx]) return null;

  const si = (sy * width + sx) * 4;
  const tr = data[si], tg = data[si + 1], tb = data[si + 2];
  const tol = opts.tolerance;
  const filled = new Uint8Array(width * height);

  const matches = (p: number): boolean => {
    if (!mask[p] || filled[p]) return false;
    const i = p * 4;
    return Math.abs(data[i] - tr) <= tol && Math.abs(data[i + 1] - tg) <= tol && Math.abs(data[i + 2] - tb) <= tol;
  };

  let minX = sx, maxX = sx, minY = sy, maxY = sy;
  const stack: number[] = [sx, sy];
  while (stack.length) {
    const y = stack.pop() as number;
    const x0 = stack.pop() as number;
    let x = x0;
    while (x >= 0 && matches(y * width + x)) x--;
    x++;
    let spanUp = false;
    let spanDown = false;
    while (x < width && matches(y * width + x)) {
      filled[y * width + x] = 1;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      if (y > 0) {
        const m = matches((y - 1) * width + x);
        if (m && !spanUp) stack.push(x, y - 1);
        spanUp = m;
      }
      if (y < height - 1) {
        const m = matches((y + 1) * width + x);
        if (m && !spanDown) stack.push(x, y + 1);
        spanDown = m;
      }
      x++;
    }
  }

  // Cover the anti-aliased rim next to strokes (no pale halo). A pixel next to the region is
  // taken only when it lies clearly *between* the region colour and a stronger neighbour;
  // solid strokes (even 1 px thin ones) and crayon grain are left alone.
  const diffAt = (p: number): number => {
    const i = p * 4;
    return Math.max(Math.abs(data[i] - tr), Math.abs(data[i + 1] - tg), Math.abs(data[i + 2] - tb));
  };
  const grown: number[] = [];
  for (let y = Math.max(0, minY - 1); y <= Math.min(height - 1, maxY + 1); y++) {
    for (let x = Math.max(0, minX - 1); x <= Math.min(width - 1, maxX + 1); x++) {
      const p = y * width + x;
      if (filled[p] || !mask[p]) continue;
      const touches =
        (x > 0 && filled[p - 1]) || (x < width - 1 && filled[p + 1]) ||
        (y > 0 && filled[p - width]) || (y < height - 1 && filled[p + width]);
      if (!touches) continue;
      const d = diffAt(p);
      let stronger = false;
      for (let dy = -1; dy <= 1 && !stronger; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if ((dx === 0 && dy === 0) || nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const q = ny * width + nx;
          if (mask[q] && !filled[q] && diffAt(q) >= d * 1.3 + 1) { stronger = true; break; }
        }
      }
      if (stronger) grown.push(p);
    }
  }
  for (const p of grown) filled[p] = 1;

  const rx0 = Math.max(0, minX - 1), ry0 = Math.max(0, minY - 1);
  const rx1 = Math.min(width - 1, maxX + 1), ry1 = Math.min(height - 1, maxY + 1);
  for (let y = ry0; y <= ry1; y++) {
    const color = typeof rgb === 'function' ? rgb(y, minY, maxY) : rgb;
    for (let x = rx0; x <= rx1; x++) {
      const p = y * width + x;
      if (!filled[p]) continue;
      const k = opts.grain ? 1 + grainNoise(x, y) * 0.04 : 1;
      const i = p * 4;
      data[i] = Math.min(255, color[0] * k);
      data[i + 1] = Math.min(255, color[1] * k);
      data[i + 2] = Math.min(255, color[2] * k);
      data[i + 3] = 255;
    }
  }
  return { x: rx0, y: ry0, w: rx1 - rx0 + 1, h: ry1 - ry0 + 1 };
}

/** CONTEXT: Mønsterfyld – the four patterns of the pattern bucket (DESIGN 8.4). They live in the drawing's own coordinates. */
export const PATTERNS = [
  { id: 'stripes', name: 'Striber' },
  { id: 'dots', name: 'Prikker' },
  { id: 'scales', name: 'Skæl' },
  { id: 'zigzag', name: 'Zigzag' },
] as const;
export type PatternId = (typeof PATTERNS)[number]['id'];

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
/** Coverage of a pixel whose centre is `d` px inside (negative: outside) a shape's edge: a one-pixel soft edge. */
const edge = (d: number): number => clamp01(0.5 + d);
const mod = (a: number, n: number): number => ((a % n) + n) % n;

/** Where the patterns repeat, in drawing pixels. */
export const PATTERN_PERIOD = { stripes: 56, dots: 44, scales: 48, zigzag: 52 } as const;

/**
 * How much of the pattern covers the drawing pixel (x, y): 0 (none) … 1 (full). A pure function of the position, so the
 * pattern sits on the drawing and looks the same however far the child has zoomed in.
 */
export function patternCoverage(id: PatternId, x: number, y: number): number {
  switch (id) {
    case 'stripes': {
      // Slanted bands, 28 px wide (along x) in a 56 px period.
      const t = mod(x + y, PATTERN_PERIOD.stripes);
      return Math.min(edge(t * 0.7071), edge((28 - t) * 0.7071));
    }
    case 'dots': {
      // Dots in rows that are staggered, radius 10.
      const row = Math.floor(y / PATTERN_PERIOD.dots);
      const dx = mod(x + (row % 2 ? PATTERN_PERIOD.dots / 2 : 0), PATTERN_PERIOD.dots) - PATTERN_PERIOD.dots / 2;
      const dy = mod(y, PATTERN_PERIOD.dots) - PATTERN_PERIOD.dots / 2;
      return edge(10 - Math.hypot(dx, dy));
    }
    case 'scales': {
      // Fish scales: rows of arcs, every other row shifted by half a scale.
      const w = PATTERN_PERIOD.scales;
      const row = Math.floor(y / (w / 2));
      const px = mod(x + (row % 2 ? w / 2 : 0), w) - w / 2;
      const py = mod(y, w / 2);
      // The arc is the lower half of a circle of radius w/2 centred a scale-height above the row.
      const d = Math.abs(Math.hypot(px, py - w / 2) - w / 2);
      return edge(3.2 - d);
    }
    case 'zigzag': {
      const w = PATTERN_PERIOD.zigzag;
      const tri = Math.abs(mod(x, w) - w / 2) / (w / 2); // 0 … 1 … 0
      const centre = w / 2 + (tri - 0.5) * 22;
      const d = Math.abs(mod(y, w) - centre);
      return edge(4.2 - d);
    }
  }
}

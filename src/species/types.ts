import type { Vec2 } from '../drawing/geometry';

/** CONTEXT: Art. */
export type Species = 'ray' | 'turtle';

/** CONTEXT: Del – one piece of the template that later becomes its own movable part of the body. */
export interface Part {
  id: string;
  /** Polygon in template coordinates (0–1 × 0–1, y down), already smoothed. */
  outline: Vec2[];
  /** Pivot for parts that move on their own (e.g. the ray's tail). */
  pivot?: Vec2;
}

/** CONTEXT: Skabelon – the species' outline seen from above. */
export interface Template {
  species: Species;
  parts: Part[];
  /** The only details on the template besides the contour. */
  eyes: Array<{ x: number; y: number; r: number }>;
  /** Light colour of unpainted areas. */
  baseColor: string;
}

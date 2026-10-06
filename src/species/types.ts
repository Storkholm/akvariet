import type { Vec2 } from '../drawing/geometry';

/** CONTEXT: Art. */
export type Species = 'ray' | 'turtle';

/** How a part is inflated into 3D (ADR 0001): thick in the middle, thin towards the edge. */
export interface PartBody {
  /** Target distance between mesh vertices, in template units. */
  spacing: number;
  /** Distance from the outline (template units) at which the part reaches full thickness. */
  radius: number;
  /** Max height of the back above the template plane, in template units. */
  dorsal: number;
  /** Max depth of the belly below the template plane, in template units. */
  ventral: number;
}

/** CONTEXT: Del – one piece of the template that later becomes its own movable part of the body. */
export interface Part {
  id: string;
  /** Polygon in template coordinates (0–1 × 0–1, y down), already smoothed. */
  outline: Vec2[];
  /** Pivot for parts that move on their own (e.g. the ray's tail). */
  pivot?: Vec2;
  body: PartBody;
}

/** Swimming style parameters (the wave itself runs in the vertex shader). */
export interface SwimParams {
  style: 'ray';
  /** Cruise speed range in world units per second. */
  cruiseSpeed: [number, number];
  /** Max turn rate in radians per second. */
  turnRate: number;
  /** Wing beats per second at cruise speed. */
  flapHz: number;
  /** Wing-tip travel as a fraction of the half wing span. */
  wingAmp: number;
  /** Sideways swing of the tail tip as a fraction of the body size. */
  tailAmp: number;
}

/** CONTEXT: Skabelon – the species' outline seen from above. */
export interface Template {
  species: Species;
  parts: Part[];
  /** The only details on the template besides the contour. */
  eyes: Array<{ x: number; y: number; r: number }>;
  /** Light colour of unpainted areas. */
  baseColor: string;
  /** Template point the body rotates around when swimming (roughly its middle). */
  center: Vec2;
  /** World units per template unit when the creature swims in the aquarium. */
  size: number;
  swim: SwimParams;
}

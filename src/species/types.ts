import type { Vec2 } from '../drawing/geometry';

/** CONTEXT: Art. */
export type Species = 'ray' | 'turtle' | 'starfish' | 'seaUrchin' | 'seaCucumber';

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
  /** Shifts the whole part up (+) or down (−) from the template plane, in template units (limbs tuck in under a shell). */
  offset?: number;
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
  /** Which wave runs in the vertex shader (see `patchWater`). */
  style: 'ray' | 'turtle' | 'starfish' | 'urchin' | 'cucumber';
  /** Cruise speed range in world units per second. */
  cruiseSpeed: [number, number];
  /** Max turn rate in radians per second. */
  turnRate: number;
  /** Wing/flipper beats per second at cruise speed. */
  flapHz: number;
  /** Ray: wing-tip travel as a fraction of the half wing span. Turtle: front-flipper stroke angle in radians. */
  wingAmp: number;
  /** Ray: sideways swing of the tail tip as a fraction of the body size. Turtle: steering angle of the back flippers in radians. */
  tailAmp: number;
  /** CONTEXT: Bunddyr – crawls on the sand instead of swimming (it settles on the bottom after "Slip løs"). */
  crawl?: boolean;
  /** From time to time the creature crawls up the glass in front of the picture (starfish). */
  glass?: boolean;
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

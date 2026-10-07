import type { Vec2 } from '../drawing/geometry';
import type { Part, Template } from './types';

function ellipse(cx: number, cy: number, rx: number, ry: number, deg: number, n = 56): Vec2[] {
  const a = (deg * Math.PI) / 180;
  const out: Vec2[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    const x = Math.cos(t) * rx;
    const y = Math.sin(t) * ry;
    out.push([cx + x * Math.cos(a) - y * Math.sin(a), cy + x * Math.sin(a) + y * Math.cos(a)]);
  }
  return out;
}

/** Order matters: the index in this list is the `part` attribute the swim shader reads (0 shell … 5 flipperBR). */
export const TURTLE_PARTS = ['shell', 'head', 'flipperFL', 'flipperFR', 'flipperBL', 'flipperBR'] as const;

const LIMB = { spacing: 0.02, radius: 0.05, dorsal: 0.03, ventral: 0.025, offset: -0.032 };

/**
 * Sea turtle seen from above (DESIGN 4.1): shell, head and four flippers. The flipper roots reach well in under
 * the shell and the limbs sit a little below the shell's plane, so they look attached from every side
 * (found with the `prototype/turtle` experiment).
 */
const parts: Part[] = [
  { id: 'shell', outline: ellipse(0.5, 0.56, 0.24, 0.29, 0), body: { spacing: 0.03, radius: 0.22, dorsal: 0.1, ventral: 0.06 } },
  { id: 'head', outline: ellipse(0.5, 0.2, 0.07, 0.11, 0), body: { spacing: 0.02, radius: 0.07, dorsal: 0.05, ventral: 0.035, offset: -0.02 }, pivot: [0.5, 0.31] },
  { id: 'flipperFL', outline: ellipse(0.235, 0.355, 0.21, 0.06, -22), body: LIMB, pivot: [0.45, 0.33] },
  { id: 'flipperFR', outline: ellipse(0.765, 0.355, 0.21, 0.06, 22), body: LIMB, pivot: [0.55, 0.33] },
  { id: 'flipperBL', outline: ellipse(0.35, 0.84, 0.11, 0.055, 38), body: LIMB, pivot: [0.44, 0.76] },
  { id: 'flipperBR', outline: ellipse(0.65, 0.84, 0.11, 0.055, -38), body: LIMB, pivot: [0.56, 0.76] },
];

export const turtleTemplate: Template = {
  species: 'turtle',
  baseColor: '#f1f4f6',
  center: [0.5, 0.5],
  size: 4.2,
  // Calm, heavy and slow: long synchronous strokes of the front flippers, the back flippers steer.
  swim: { style: 'turtle', cruiseSpeed: [0.7, 1.2], turnRate: 0.45, flapHz: 0.32, wingAmp: 0.55, tailAmp: 0.3 },
  eyes: [
    { x: 0.465, y: 0.165, r: 0.013 },
    { x: 0.535, y: 0.165, r: 0.013 },
  ],
  parts,
};

import { smoothClosed, type Vec2 } from '../drawing/geometry';
import type { Template } from './types';

/** A round body with a slightly irregular edge (a perfect circle would put every outline point on one circle: see seaUrchin.ts). */
function roundish(cx: number, cy: number, r: number, n = 56): Vec2[] {
  return Array.from({ length: n }, (_, i): Vec2 => {
    const a = (i / n) * Math.PI * 2;
    const k = r * (1 + 0.012 * Math.sin(a * 5 + 0.6) + 0.008 * Math.sin(a * 9 + 2));
    return [cx + Math.cos(a) * k, cy + Math.sin(a) * k];
  });
}

const TAIL: Vec2[] = [[0.7, 0.5], [0.8, 0.41], [0.92, 0.36], [0.93, 0.5], [0.92, 0.64], [0.8, 0.59]];
const TOP: Vec2[] = [[0.44, 0.22], [0.5, 0.12], [0.58, 0.14], [0.6, 0.24]];
// The little side fin that does the paddling (its pivot is at the root).
const FIN: Vec2[] = [[0.46, 0.6], [0.58, 0.55], [0.64, 0.64], [0.56, 0.7]];

/** Pufferfish seen from the side (DESIGN 8.5): a round body, a small tail and little fins. Puffs up into a spiky ball when tapped. */
export const pufferfishTemplate: Template = {
  species: 'pufferfish',
  view: 'side',
  baseColor: '#f1f4f6',
  center: [0.46, 0.5],
  size: 2.8,
  // Slow; the little fins paddle (the "waddle"), the tail swings a little.
  swim: { style: 'fish', cruiseSpeed: [0.35, 0.65], turnRate: 0.8, flapHz: 1.1, wingAmp: 0.01, tailAmp: 0.05, inflates: true },
  eyes: [{ x: 0.27, y: 0.43, r: 0.036 }],
  parts: [
    { id: 'body', outline: roundish(0.46, 0.5, 0.3), body: { spacing: 0.032, radius: 0.28, dorsal: 0.2, ventral: 0.2 } },
    { id: 'tail', outline: smoothClosed(TAIL, 6), body: { spacing: 0.025, radius: 0.04, dorsal: 0.02, ventral: 0.02 } },
    { id: 'top', outline: smoothClosed(TOP, 6), body: { spacing: 0.022, radius: 0.03, dorsal: 0.015, ventral: 0.015 } },
    { id: 'fin', outline: smoothClosed(FIN, 6), pivot: [0.47, 0.62], body: { spacing: 0.022, radius: 0.03, dorsal: 0.015, ventral: 0.015 } },
  ],
};

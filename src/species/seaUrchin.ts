import type { Vec2 } from '../drawing/geometry';
import type { Template } from './types';

/** A round body with a faintly irregular edge (a perfect circle would put all outline points on one circle, which the triangulation dislikes). */
function roundish(cx: number, cy: number, r: number, n = 64): Vec2[] {
  return Array.from({ length: n }, (_, i): Vec2 => {
    const a = (i / n) * Math.PI * 2;
    const k = r * (1 + 0.012 * Math.sin(a * 5 + 0.6) + 0.008 * Math.sin(a * 9 + 2));
    return [cx + Math.cos(a) * k, cy + Math.sin(a) * k];
  });
}

/** Sea urchin seen from above (DESIGN 8.5): a round body; the spikes are added in 3D (see `spikes.ts`) in the colour of the drawing. */
export const seaUrchinTemplate: Template = {
  species: 'seaUrchin',
  baseColor: '#f1f4f6',
  center: [0.5, 0.5],
  size: 1.9,
  swim: { style: 'urchin', cruiseSpeed: [0.07, 0.14], turnRate: 0.5, flapHz: 0.3, wingAmp: 0.04, tailAmp: 0, crawl: true },
  eyes: [
    { x: 0.43, y: 0.46, r: 0.03 },
    { x: 0.57, y: 0.46, r: 0.03 },
  ],
  parts: [{ id: 'body', outline: roundish(0.5, 0.5, 0.4), body: { spacing: 0.035, radius: 0.34, dorsal: 0.24, ventral: 0.08 } }],
};

import { smoothClosed, type Vec2 } from '../drawing/geometry';
import type { Template } from './types';

const BODY: Vec2[] = [[0.04, 0.5], [0.1, 0.45], [0.26, 0.4], [0.46, 0.38], [0.66, 0.41], [0.8, 0.46], [0.84, 0.5], [0.8, 0.55], [0.66, 0.58], [0.46, 0.62], [0.26, 0.6], [0.1, 0.56]];
// The tail has a tall upper lobe, like in the reference photos.
const TAIL: Vec2[] = [[0.8, 0.49], [0.88, 0.34], [0.94, 0.14], [0.975, 0.12], [0.95, 0.36], [0.97, 0.53], [0.94, 0.63], [0.88, 0.57]];
const DORSAL: Vec2[] = [[0.36, 0.4], [0.46, 0.18], [0.53, 0.18], [0.57, 0.41]];
const PECTORAL: Vec2[] = [[0.5, 0.6], [0.4, 0.72], [0.3, 0.76], [0.34, 0.58]]; // (same winding as the body)

/** Shark seen from the side (DESIGN 8.5): long and sleek, about 1.4 times as big as the ray. Peaceful: it never eats anything. */
export const sharkTemplate: Template = {
  species: 'shark',
  view: 'side',
  baseColor: '#f1f4f6',
  center: [0.5, 0.5],
  size: 6.0,
  // Slow, calm and gliding: long, lazy sweeps of the whole body.
  swim: { style: 'fish', cruiseSpeed: [0.55, 0.95], turnRate: 0.5, flapHz: 0.55, wingAmp: 0.012, tailAmp: 0.05 },
  eyes: [{ x: 0.14, y: 0.47, r: 0.017 }],
  parts: [
    { id: 'body', outline: smoothClosed(BODY, 6), body: { spacing: 0.035, radius: 0.1, dorsal: 0.075, ventral: 0.075 } },
    { id: 'tail', outline: smoothClosed(TAIL, 6), body: { spacing: 0.03, radius: 0.04, dorsal: 0.016, ventral: 0.016 } },
    { id: 'dorsal', outline: smoothClosed(DORSAL, 6), body: { spacing: 0.03, radius: 0.04, dorsal: 0.016, ventral: 0.016 } },
    { id: 'pectoral', outline: smoothClosed(PECTORAL, 6), body: { spacing: 0.03, radius: 0.04, dorsal: 0.016, ventral: 0.016 } },
  ],
};

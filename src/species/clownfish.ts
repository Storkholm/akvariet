import { smoothClosed, type Vec2 } from '../drawing/geometry';
import type { Template } from './types';

/** Clownfish seen from its left side, head to the left (DESIGN 8.5, ADR 0005): a plump body, a fan tail, a tall back fin and a small belly fin. */
const BODY: Vec2[] = [[0.08, 0.52], [0.14, 0.4], [0.28, 0.31], [0.46, 0.28], [0.62, 0.32], [0.74, 0.42], [0.8, 0.5], [0.74, 0.6], [0.62, 0.68], [0.46, 0.72], [0.28, 0.7], [0.14, 0.62]];
const TAIL: Vec2[] = [[0.74, 0.5], [0.86, 0.38], [0.97, 0.3], [0.95, 0.5], [0.97, 0.7], [0.86, 0.62]];
const DORSAL: Vec2[] = [[0.3, 0.32], [0.36, 0.18], [0.5, 0.14], [0.62, 0.2], [0.66, 0.34], [0.5, 0.29]];
const BELLY: Vec2[] = [[0.52, 0.69], [0.5, 0.78], [0.4, 0.8], [0.34, 0.68]]; // (same winding as the body, so the parts can be clipped as one)

export const clownfishTemplate: Template = {
  species: 'clownfish',
  view: 'side',
  baseColor: '#f1f4f6',
  center: [0.52, 0.5],
  size: 3.0,
  // Quick and lively, keeps to the reef; the whole body wags, most at the tail.
  swim: { style: 'fish', cruiseSpeed: [1.4, 2.2], turnRate: 1.3, flapHz: 2.2, wingAmp: 0.03, tailAmp: 0.1, lowBand: 2.2 },
  eyes: [{ x: 0.2, y: 0.46, r: 0.032 }],
  parts: [
    { id: 'body', outline: smoothClosed(BODY, 6), body: { spacing: 0.03, radius: 0.2, dorsal: 0.1, ventral: 0.1 } },
    { id: 'tail', outline: smoothClosed(TAIL, 6), body: { spacing: 0.025, radius: 0.04, dorsal: 0.02, ventral: 0.02 } },
    { id: 'dorsal', outline: smoothClosed(DORSAL, 6), body: { spacing: 0.025, radius: 0.04, dorsal: 0.02, ventral: 0.02 } },
    { id: 'belly', outline: smoothClosed(BELLY, 6), body: { spacing: 0.022, radius: 0.03, dorsal: 0.018, ventral: 0.018 } },
  ],
};

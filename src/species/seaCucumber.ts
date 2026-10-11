import { smoothClosed, type Vec2 } from '../drawing/geometry';
import type { Template } from './types';

/** A long, soft sausage with a slight bend and a rounded head end (up). */
const OUTLINE: Vec2[] = [
  [0.5, 0.07],
  [0.6, 0.12],
  [0.655, 0.25],
  [0.67, 0.42],
  [0.655, 0.6],
  [0.63, 0.78],
  [0.57, 0.92],
  [0.47, 0.95],
  [0.38, 0.88],
  [0.34, 0.72],
  [0.33, 0.52],
  [0.345, 0.32],
  [0.39, 0.15],
];

/** Sea cucumber seen from above (DESIGN 8.5): long and soft. A wave of stretching and squeezing runs down the body as it crawls. */
export const seaCucumberTemplate: Template = {
  species: 'seaCucumber',
  baseColor: '#f1f4f6',
  center: [0.5, 0.5],
  size: 3.2,
  swim: { style: 'cucumber', cruiseSpeed: [0.1, 0.2], turnRate: 0.45, flapHz: 0.4, wingAmp: 0.1, tailAmp: 0, crawl: true },
  eyes: [
    { x: 0.455, y: 0.2, r: 0.022 },
    { x: 0.545, y: 0.2, r: 0.022 },
  ],
  parts: [{ id: 'body', outline: smoothClosed(OUTLINE, 8), body: { spacing: 0.03, radius: 0.15, dorsal: 0.1, ventral: 0.05 } }],
};

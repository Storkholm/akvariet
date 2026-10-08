import { smoothClosed, type Vec2 } from '../drawing/geometry';
import type { Template } from './types';

/** Right half of the manta ray outline, clockwise from the nose to the rear (head up, y down). */
const RIGHT_HALF_RAW: Vec2[] = [
  [0.5, 0.13],
  [0.58, 0.145],
  [0.66, 0.19],
  [0.76, 0.25],
  [0.87, 0.31],
  [0.96, 0.37],
  [0.985, 0.4],
  [0.93, 0.425],
  [0.84, 0.455],
  [0.74, 0.5],
  [0.66, 0.57],
  [0.6, 0.65],
  [0.55, 0.73],
  [0.5, 0.77],
];

/**
 * Proportions follow reference photos 02/05: the disc is about 1.8 times as wide as it is long, and the tail
 * is nearly as long as the body. The raw points are squeezed vertically to leave room for that long tail.
 */
const squeeze = (y: number): number => 0.06 + (y - 0.13) * 0.82;
const RIGHT_HALF: Vec2[] = RIGHT_HALF_RAW.map(([x, y]): Vec2 => [x, squeeze(y)]);

function mirrored(half: Vec2[]): Vec2[] {
  // Skip the two points on the symmetry axis so they aren't duplicated.
  const left = half
    .slice(1, -1)
    .map(([x, y]): Vec2 => [1 - x, y])
    .reverse();
  return [...half, ...left];
}

export const rayTemplate: Template = {
  species: 'ray',
  baseColor: '#f1f4f6',
  center: [0.5, 0.34],
  size: 4.2,
  swim: { style: 'ray', cruiseSpeed: [1.0, 1.7], turnRate: 0.55, flapHz: 0.6, wingAmp: 0.2, tailAmp: 0.05 },
  eyes: [
    { x: 0.435, y: squeeze(0.215), r: 0.017 },
    { x: 0.565, y: squeeze(0.215), r: 0.017 },
  ],
  parts: [
    {
      id: 'body',
      outline: smoothClosed(mirrored(RIGHT_HALF), 8),
      body: { spacing: 0.03, radius: 0.2, dorsal: 0.13, ventral: 0.07 },
    },
    {
      id: 'tail',
      outline: [
        [0.486, 0.565],
        [0.514, 0.565],
        [0.507, 0.985],
        [0.493, 0.985],
      ],
      pivot: [0.5, 0.565],
      body: { spacing: 0.011, radius: 0.012, dorsal: 0.007, ventral: 0.007 },
    },
  ],
};

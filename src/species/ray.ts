import { smoothClosed, type Vec2 } from '../drawing/geometry';
import type { Template } from './types';

/** Right half of the manta ray outline, clockwise from the nose to the rear (head up, y down). */
const RIGHT_HALF: Vec2[] = [
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
  eyes: [
    { x: 0.435, y: 0.215, r: 0.017 },
    { x: 0.565, y: 0.215, r: 0.017 },
  ],
  parts: [
    { id: 'body', outline: smoothClosed(mirrored(RIGHT_HALF), 8) },
    {
      id: 'tail',
      outline: [
        [0.484, 0.74],
        [0.516, 0.74],
        [0.508, 0.985],
        [0.492, 0.985],
      ],
      pivot: [0.5, 0.74],
    },
  ],
};

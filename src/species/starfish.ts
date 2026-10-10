import { smoothClosed, type Vec2 } from '../drawing/geometry';
import type { Template } from './types';

/** Five arms, one pointing up (the head end): tips on a circle of radius 0.46, the valleys between them on 0.2. */
const STAR: Vec2[] = Array.from({ length: 10 }, (_, i): Vec2 => {
  const a = -Math.PI / 2 + (i * Math.PI) / 5;
  const r = i % 2 === 0 ? 0.455 : 0.2;
  return [0.5 + Math.cos(a) * r, 0.52 + Math.sin(a) * r];
});

/** Starfish seen from above (DESIGN 8.5): the middle and five arms in one piece. Crawls on the sand and now and then up the glass. */
export const starfishTemplate: Template = {
  species: 'starfish',
  baseColor: '#f1f4f6',
  center: [0.5, 0.52],
  size: 2.0,
  // Very slow; the arms ripple (wingAmp = how far the arm tips curl, as a fraction of the arm length).
  swim: { style: 'starfish', cruiseSpeed: [0.12, 0.22], turnRate: 0.7, flapHz: 0.22, wingAmp: 0.16, tailAmp: 0, crawl: true, glass: true },
  eyes: [
    { x: 0.455, y: 0.48, r: 0.02 },
    { x: 0.545, y: 0.48, r: 0.02 },
  ],
  parts: [{ id: 'body', outline: smoothClosed(STAR, 8), body: { spacing: 0.03, radius: 0.1, dorsal: 0.1, ventral: 0.03 } }],
};

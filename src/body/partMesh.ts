import { pointInPolygon, polygonBounds, type Vec2 } from '../drawing/geometry';
import { createRng } from '../util/random';
import type { Part } from '../species/types';
import { delaunay } from './delaunay';

export interface PartMesh {
  /** Template coordinates; the first `boundaryCount` points are the outline, the rest are interior. */
  points: Vec2[];
  boundaryCount: number;
  /** Triangle index triples, all inside the outline. */
  triangles: number[];
  /** 0 at the outline … 1 where the part reaches full thickness. */
  thickness: Float32Array;
}

/** Quarter-circle profile: steep at the edge, flat on top → rounded body, thin rim. */
export function profile(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return Math.sqrt(1 - (1 - c) * (1 - c));
}

function distToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.min(1, Math.max(0, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

export function distToPolyline(p: Vec2, poly: readonly Vec2[]): number {
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) best = Math.min(best, distToSegment(p, poly[i], poly[(i + 1) % poly.length]));
  return best;
}

/** Evenly spaced points along a closed polygon; sharp corners (wing tips) are always kept. */
export function resampleClosed(poly: readonly Vec2[], spacing: number, cornerDeg = 22): Vec2[] {
  const n = poly.length;
  const isCorner = (i: number): boolean => {
    const a = poly[(i - 1 + n) % n];
    const b = poly[i];
    const c = poly[(i + 1) % n];
    const a1 = Math.atan2(b[1] - a[1], b[0] - a[0]);
    const a2 = Math.atan2(c[1] - b[1], c[0] - b[0]);
    let d = Math.abs(a2 - a1);
    if (d > Math.PI) d = 2 * Math.PI - d;
    return (d * 180) / Math.PI > cornerDeg;
  };
  const out: Vec2[] = [[poly[0][0], poly[0][1]]];
  let acc = 0;
  for (let k = 1; k <= n; k++) {
    const i = k % n;
    const prev = poly[(k - 1) % n];
    acc += Math.hypot(poly[i][0] - prev[0], poly[i][1] - prev[1]);
    if (k === n) break;
    const corner = isCorner(i);
    if (acc >= spacing || corner) {
      const last = out[out.length - 1];
      const tooClose = Math.hypot(poly[i][0] - last[0], poly[i][1] - last[1]) < spacing * 0.4;
      if (tooClose && corner) out[out.length - 1] = [poly[i][0], poly[i][1]];
      else if (!tooClose) out.push([poly[i][0], poly[i][1]]);
      else continue;
      acc = 0;
    }
  }
  // Avoid a tiny last segment back to the start.
  const first = out[0];
  const last = out[out.length - 1];
  if (out.length > 3 && Math.hypot(first[0] - last[0], first[1] - last[1]) < spacing * 0.4) out.pop();
  return out;
}

/**
 * Triangulates one part (ADR 0001): outline samples + interior points, Delaunay, keep what is inside,
 * then derive a smooth 0..1 thickness from the distance to the outline.
 */
export function buildPartMesh(part: Part): PartMesh {
  const { spacing, radius } = part.body;
  const boundarySpacing = spacing * 0.7;
  const boundary = resampleClosed(part.outline, boundarySpacing);
  const points: Vec2[] = [...boundary];

  // Hex grid of interior points, slightly jittered (a perfect grid is cocircular and fragile).
  const rng = createRng(1234);
  const { minX, minY, maxX, maxY } = polygonBounds(boundary);
  const rowH = (spacing * Math.sqrt(3)) / 2;
  let row = 0;
  for (let y = minY; y <= maxY; y += rowH, row++) {
    for (let x = minX + (row % 2 ? spacing / 2 : 0); x <= maxX; x += spacing) {
      const p: Vec2 = [x + rng.range(-0.08, 0.08) * spacing, y + rng.range(-0.08, 0.08) * spacing];
      if (!pointInPolygon(p[0], p[1], boundary)) continue;
      if (distToPolyline(p, boundary) < boundarySpacing * 0.8) continue;
      points.push(p);
    }
  }

  const raw = delaunay(points);
  const triangles: number[] = [];
  for (let i = 0; i < raw.length; i += 3) {
    const [a, b, c] = [points[raw[i]], points[raw[i + 1]], points[raw[i + 2]]];
    const area = Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) / 2;
    if (area < 1e-9) continue;
    if (pointInPolygon((a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, boundary)) triangles.push(raw[i], raw[i + 1], raw[i + 2]);
  }

  // Thickness from distance to the outline, relaxed a few times to remove the ridge along the medial axis.
  const n = points.length;
  const thickness = new Float32Array(n);
  for (let i = boundary.length; i < n; i++) thickness[i] = profile(distToPolyline(points[i], boundary) / radius);
  const neighbours: Set<number>[] = Array.from({ length: n }, () => new Set<number>());
  for (let i = 0; i < triangles.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      neighbours[triangles[i + k]].add(triangles[i + (k + 1) % 3]);
      neighbours[triangles[i + k]].add(triangles[i + (k + 2) % 3]);
    }
  }
  const next = new Float32Array(n);
  for (let iter = 0; iter < 4; iter++) {
    for (let i = boundary.length; i < n; i++) {
      let sum = 0;
      for (const j of neighbours[i]) sum += thickness[j];
      next[i] = neighbours[i].size ? 0.5 * thickness[i] + (0.5 * sum) / neighbours[i].size : thickness[i];
    }
    for (let i = boundary.length; i < n; i++) thickness[i] = next[i];
  }

  return { points, boundaryCount: boundary.length, triangles, thickness };
}

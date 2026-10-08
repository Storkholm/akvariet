import type { Vec2 } from '../drawing/geometry';

interface Tri {
  a: number;
  b: number;
  c: number;
  cx: number;
  cy: number;
  r2: number;
}

function circumcircle(pts: readonly Vec2[], a: number, b: number, c: number): Tri {
  const [ax, ay] = pts[a];
  const [bx, by] = pts[b];
  const [cx, cy] = pts[c];
  const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
  const a2 = ax * ax + ay * ay;
  const b2 = bx * bx + by * by;
  const c2 = cx * cx + cy * cy;
  const ux = (a2 * (by - cy) + b2 * (cy - ay) + c2 * (ay - by)) / d;
  const uy = (a2 * (cx - bx) + b2 * (ax - cx) + c2 * (bx - ax)) / d;
  return { a, b, c, cx: ux, cy: uy, r2: (ax - ux) ** 2 + (ay - uy) ** 2 };
}

/** Bowyer–Watson Delaunay triangulation. Returns triangle index triples (orientation not defined). */
export function delaunay(points: readonly Vec2[]): number[] {
  const n = points.length;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of points) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  const span = Math.max(maxX - minX, maxY - minY) || 1;
  const mx = (minX + maxX) / 2;
  const my = (minY + maxY) / 2;
  const pts: Vec2[] = [...points, [mx - 20 * span, my - span], [mx, my + 20 * span], [mx + 20 * span, my - span]];

  let tris: Tri[] = [circumcircle(pts, n, n + 1, n + 2)];
  for (let i = 0; i < n; i++) {
    const [px, py] = pts[i];
    const keep: Tri[] = [];
    const edgeCount = new Map<number, number>();
    const addEdge = (u: number, v: number): void => {
      const key = u < v ? u * 100000 + v : v * 100000 + u;
      edgeCount.set(key, (edgeCount.get(key) ?? 0) + 1);
    };
    for (const t of tris) {
      if ((px - t.cx) ** 2 + (py - t.cy) ** 2 < t.r2) {
        addEdge(t.a, t.b);
        addEdge(t.b, t.c);
        addEdge(t.c, t.a);
      } else keep.push(t);
    }
    for (const [key, count] of edgeCount) {
      if (count !== 1) continue; // interior edge of the hole
      keep.push(circumcircle(pts, Math.floor(key / 100000), key % 100000, i));
    }
    tris = keep;
  }

  const out: number[] = [];
  for (const t of tris) if (t.a < n && t.b < n && t.c < n) out.push(t.a, t.b, t.c);
  return out;
}

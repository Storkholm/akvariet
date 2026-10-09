import * as THREE from 'three';

export type P2 = readonly [number, number];

/** Do the segments a–b and c–d cross? (Proper crossing or touching.) */
export function segmentsCross(a: P2, b: P2, c: P2, d: P2): boolean {
  const o = (p: P2, q: P2, r: P2): number => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const onSeg = (p: P2, q: P2, r: P2): boolean =>
    Math.min(p[0], q[0]) - 1e-9 <= r[0] && r[0] <= Math.max(p[0], q[0]) + 1e-9 && Math.min(p[1], q[1]) - 1e-9 <= r[1] && r[1] <= Math.max(p[1], q[1]) + 1e-9;
  const o1 = o(a, b, c);
  const o2 = o(a, b, d);
  const o3 = o(c, d, a);
  const o4 = o(c, d, b);
  if (((o1 > 0 && o2 < 0) || (o1 < 0 && o2 > 0)) && ((o3 > 0 && o4 < 0) || (o3 < 0 && o4 > 0))) return true;
  return (o1 === 0 && onSeg(a, b, c)) || (o2 === 0 && onSeg(a, b, d)) || (o3 === 0 && onSeg(c, d, a)) || (o4 === 0 && onSeg(c, d, b));
}

export function pointInPolygon(p: P2, poly: readonly P2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Does the swipe segment a–b touch this (closed) polygon: cross its edge, or lie inside it? */
export function segmentHitsPolygon(a: P2, b: P2, poly: readonly P2[]): boolean {
  if (poly.length < 3) return false;
  if (pointInPolygon(a, poly) || pointInPolygon(b, poly)) return true;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) if (segmentsCross(a, b, poly[j], poly[i])) return true;
  return false;
}

/**
 * The cut plane of a swipe (ADR 0008): the plane through the camera and the swipe line on the screen. Everything on the
 * screen-line is on the plane, so each piece shows exactly the half that was on its side of the line, seen from where the
 * child looks. Screen points are in pixels; `viewport` is the size of the canvas.
 */
export function cutPlane(camera: THREE.Camera, a: P2, b: P2, viewport: { width: number; height: number }): THREE.Plane | null {
  camera.updateMatrixWorld();
  const ray = (p: P2): THREE.Vector3 => {
    const ndc = new THREE.Vector3((p[0] / viewport.width) * 2 - 1, -((p[1] / viewport.height) * 2 - 1), 0.5).unproject(camera);
    return ndc.sub(camera.position).normalize();
  };
  const d1 = ray(a);
  const d2 = ray(b);
  const n = new THREE.Vector3().crossVectors(d1, d2);
  if (n.lengthSq() < 1e-12) return null; // a point, not a line
  n.normalize();
  return new THREE.Plane().setFromNormalAndCoplanarPoint(n, camera.position);
}

/** Which side of the swipe line is this screen point on? (+1 / −1; the sign of the cross product.) */
export function sideOfLine(a: P2, b: P2, p: P2): number {
  return Math.sign((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]));
}

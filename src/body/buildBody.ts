import * as THREE from 'three';
import type { Template } from '../species/types';
import { buildPartMesh } from './partMesh';

export interface BodyStats {
  vertices: number;
  triangles: number;
}

/**
 * CONTEXT: Krop. Generates the 3D body from the template's parts (ADR 0001).
 *
 * Coordinates: template (u, v) → local x = (u − cx)·size, z = (v − cy)·size, y up. The back (`side` 0)
 * lies above the template plane, the belly (`side` 1) below it; both meet at the outline.
 * UV = template coordinates, so the drawing sits exactly on the back.
 * Extra attributes: `side` (0 back / 1 belly), `lift` (how far the part was moved off the template plane – the swim shader
 * removes it while the body is still flat, so the start of the transition matches the flat drawing exactly), `part` (index of the part in the template), `pivot` (the part's
 * pivot in local coordinates) and `flex` (0 for rigid parts; for parts with a pivot, how far from the pivot towards
 * the part's tip, 0..1 – drives tail swing and flipper strokes in the vertex shader).
 */
/**
 * Where template point (u, v) lies in the body's own space, in the middle of the body's thickness. Top view: x = u, z = v, y up
 * (the drawing lies on the ground plane). Side view (ADR 0005): the drawing stands upright – z = u (head towards −z, the way it swims),
 * y = −v (up), and the body is thick along x.
 */
export function templateToLocal(template: Template, u: number, v: number): [number, number, number] {
  const { size, center } = template;
  return template.view === 'side' ? [0, -(v - center[1]) * size, (u - center[0]) * size] : [(u - center[0]) * size, 0, (v - center[1]) * size];
}

export function buildBody(template: Template): THREE.BufferGeometry {
  const { size } = template;
  const positions: number[] = [];
  const uvs: number[] = [];
  const side: number[] = [];
  const flex: number[] = [];
  const lifts: number[] = [];
  const partIndex: number[] = [];
  const pivots: number[] = [];
  const index: number[] = [];

  template.parts.forEach((part, partNo) => {
    const mesh = buildPartMesh(part);
    const n = mesh.points.length;
    const base = positions.length / 3;
    // Direction and length from the pivot to the part's tip (the outline point farthest from the pivot).
    let tipDir: [number, number] = [0, 0];
    let tipLen = 1;
    if (part.pivot) {
      const [px, py] = part.pivot;
      let best = 0;
      for (const [x, y] of part.outline) {
        const d = Math.hypot(x - px, y - py);
        if (d > best) { best = d; tipDir = [(x - px) / d, (y - py) / d]; }
      }
      tipLen = best || 1;
    }
    const sideView = template.view === 'side';
    const pivotLocal: [number, number, number] = part.pivot ? templateToLocal(template, part.pivot[0], part.pivot[1]) : [0, 0, 0];
    const lift = sideView ? 0 : (part.body.offset ?? 0) * size;

    for (const belly of [0, 1]) {
      for (let i = 0; i < n; i++) {
        const [u, v] = mesh.points[i];
        const t = mesh.thickness[i];
        // Side view: "back" is the left side of the fish (x < 0), "belly" its right side (x > 0); the same picture sits on both.
        const thick = (belly ? -part.body.ventral : part.body.dorsal) * t * size;
        const [lx, ly, lz] = templateToLocal(template, u, v);
        positions.push(sideView ? -thick : lx, sideView ? ly : thick + lift, lz);
        uvs.push(u, 1 - v);
        side.push(sideView ? 0 : belly);
        flex.push(part.pivot ? Math.min(1, Math.max(0, ((u - part.pivot[0]) * tipDir[0] + (v - part.pivot[1]) * tipDir[1]) / tipLen)) : 0);
        lifts.push(lift);
        partIndex.push(partNo);
        pivots.push(...pivotLocal);
      }
    }
    for (let i = 0; i < mesh.triangles.length; i += 3) {
      const a = mesh.triangles[i];
      let b = mesh.triangles[i + 1];
      let c = mesh.triangles[i + 2];
      // Make the back face upwards (+y): cross product y-component in the (x, z) plane.
      const [pa, pb, pc] = [mesh.points[a], mesh.points[b], mesh.points[c]];
      const ny = (pb[1] - pa[1]) * (pc[0] - pa[0]) - (pb[0] - pa[0]) * (pc[1] - pa[1]);
      if (ny < 0) [b, c] = [c, b];
      index.push(base + a, base + b, base + c); // back
      index.push(base + n + a, base + n + c, base + n + b); // belly, reversed
    }
  });

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setAttribute('side', new THREE.Float32BufferAttribute(side, 1));
  g.setAttribute('flex', new THREE.Float32BufferAttribute(flex, 1));
  g.setAttribute('lift', new THREE.Float32BufferAttribute(lifts, 1));
  g.setAttribute('part', new THREE.Float32BufferAttribute(partIndex, 1));
  g.setAttribute('pivot', new THREE.Float32BufferAttribute(pivots, 3));
  g.setIndex(index);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

export function bodyStats(g: THREE.BufferGeometry): BodyStats {
  return { vertices: g.getAttribute('position').count, triangles: (g.index?.count ?? 0) / 3 };
}

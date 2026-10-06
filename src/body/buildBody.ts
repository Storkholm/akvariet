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
 * Extra attributes: `side` (0 back / 1 belly) and `flex` (0 for rigid parts; for parts with a pivot,
 * how far along the part past its pivot, 0..1 – drives the tail swing).
 */
export function buildBody(template: Template): THREE.BufferGeometry {
  const { size, center } = template;
  const positions: number[] = [];
  const uvs: number[] = [];
  const side: number[] = [];
  const flex: number[] = [];
  const index: number[] = [];

  for (const part of template.parts) {
    const mesh = buildPartMesh(part);
    const n = mesh.points.length;
    const base = positions.length / 3;
    const maxV = Math.max(...part.outline.map((p) => p[1]));
    const pivotV = part.pivot ? part.pivot[1] : 0;

    for (const belly of [0, 1]) {
      for (let i = 0; i < n; i++) {
        const [u, v] = mesh.points[i];
        const t = mesh.thickness[i];
        const y = (belly ? -part.body.ventral : part.body.dorsal) * t * size;
        positions.push((u - center[0]) * size, y, (v - center[1]) * size);
        uvs.push(u, 1 - v);
        side.push(belly);
        flex.push(part.pivot ? Math.min(1, Math.max(0, (v - pivotV) / (maxV - pivotV))) : 0);
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
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setAttribute('side', new THREE.Float32BufferAttribute(side, 1));
  g.setAttribute('flex', new THREE.Float32BufferAttribute(flex, 1));
  g.setIndex(index);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

export function bodyStats(g: THREE.BufferGeometry): BodyStats {
  return { vertices: g.getAttribute('position').count, triangles: (g.index?.count ?? 0) / 3 };
}

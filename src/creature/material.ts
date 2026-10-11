import * as THREE from 'three';
import { patchWater } from '../aquarium/materials';
import { polygonBounds } from '../drawing/geometry';
import type { Template } from '../species/types';

/** Lambert material with the drawing on the back, a pale belly and the species' swim wave. */
export function createCreatureShader(
  template: Template,
  map: THREE.Texture,
  uniforms: { uPhase: { value: number }; uFlap: { value: number }; uTurn: { value: number } },
  /** A half of a creature that has been cut (ADR 0008): clipped by these planes (every cut so far), and the cut face closed in the base colour. */
  cut?: { planes: THREE.Plane[] },
): THREE.MeshLambertMaterial {
  const all = template.parts.flatMap((p) => p.outline);
  const b = polygonBounds(all);
  const halfSpan = ((b.maxX - b.minX) / 2) * template.size;
  const base = new THREE.Color(template.baseColor);
  const material = new THREE.MeshLambertMaterial(cut ? { map, side: THREE.DoubleSide, clippingPlanes: cut.planes } : { map });
  return patchWater(material, {
    creature: { style: template.swim.style, size: template.size, halfSpan, wingAmp: template.swim.wingAmp, tailAmp: template.swim.tailAmp, uniforms },
    cap: cut ? [base.r, base.g, base.b] : undefined,
  });
}

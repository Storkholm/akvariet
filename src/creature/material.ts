import * as THREE from 'three';
import { patchWater } from '../aquarium/materials';
import { polygonBounds } from '../drawing/geometry';
import type { Template } from '../species/types';

/** Lambert material with the drawing on the back, a pale belly and the species' swim wave. */
export function createCreatureShader(
  template: Template,
  map: THREE.Texture,
  uniforms: { uPhase: { value: number }; uFlap: { value: number }; uTurn: { value: number } },
): THREE.MeshLambertMaterial {
  const all = template.parts.flatMap((p) => p.outline);
  const b = polygonBounds(all);
  const halfSpan = ((b.maxX - b.minX) / 2) * template.size;
  return patchWater(new THREE.MeshLambertMaterial({ map }), {
    creature: { style: template.swim.style, size: template.size, halfSpan, wingAmp: template.swim.wingAmp, tailAmp: template.swim.tailAmp, uniforms },
  });
}

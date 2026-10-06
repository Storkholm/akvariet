import * as THREE from 'three';

/** Shared clock for all water shaders (swaying plants, caustics, fish tails). */
export const timeUniform = { value: 0 };

export interface WaterPatch {
  /** Material reads a per-vertex `sway` attribute (0 = rooted, 1 = free tip). */
  sway?: boolean;
  /** Add moving caustic light patterns (for the sand and nearby reef). */
  caustics?: number;
  /** Fish: per-vertex `tail` weight and per-instance `aPhase` drive a swimming wiggle. */
  fish?: boolean;
}

/**
 * Adds underwater look to a Lambert material: depth-dependent brightness,
 * optional caustics, vertex-shader sway and fish wiggle. Lambert keeps the
 * lighting cheap, which matters for tablets (DESIGN 4.4).
 */
export function patchWater<T extends THREE.MeshLambertMaterial>(mat: T, patch: WaterPatch = {}): T {
  const key = `water-${patch.sway ? 's' : ''}${patch.caustics ?? 0}${patch.fish ? 'f' : ''}`;
  mat.customProgramCacheKey = () => key;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = timeUniform;

    const vertexDecl = [
      'uniform float uTime;',
      'varying vec3 vWorld;',
      patch.sway ? 'attribute float sway;' : '',
      patch.fish ? 'attribute float tail; attribute float aPhase;' : '',
    ].join('\n');

    let vertexMotion = '';
    if (patch.sway) {
      vertexMotion += `
        {
          float ph = position.x * 0.6 + position.z * 0.45;
          transformed.x += sin(uTime * 1.25 + ph) * 0.32 * sway;
          transformed.z += sin(uTime * 0.95 + ph * 1.3 + 1.7) * 0.2 * sway;
        }`;
    }
    if (patch.fish) {
      vertexMotion += `
        {
          float w = tail * tail;
          transformed.z += sin(uTime * 9.0 + aPhase - position.x * 5.0) * 0.22 * w;
        }`;
    }

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${vertexDecl}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${vertexMotion}`)
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>\nvWorld = (modelMatrix * ${patch.fish ? 'instanceMatrix * ' : ''}vec4(transformed, 1.0)).xyz;`,
      );

    const caustics = patch.caustics ?? 0;
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uTime;
        varying vec3 vWorld;
        float caustic(vec2 p, float t) {
          float a = sin(p.x * 1.1 + t * 0.9 + sin(p.y * 0.8 - t * 0.6) * 1.5);
          float b = sin(p.y * 1.3 - t * 0.7 + sin(p.x * 0.9 + t * 0.5) * 1.5);
          float c = sin((p.x + p.y) * 0.7 + t * 0.4);
          float v = (a + b + c) / 3.0;
          return pow(max(0.0, 1.0 - abs(v) * 1.25), 4.0);
        }`,
      )
      .replace(
        '#include <opaque_fragment>',
        `outgoingLight *= mix(0.62, 1.12, smoothstep(-1.0, 9.0, vWorld.y));
        ${
          caustics > 0
            ? `outgoingLight += vec3(0.5, 0.85, 1.0) * caustic(vWorld.xz, uTime) * ${caustics.toFixed(3)} * (1.0 - smoothstep(0.0, 7.0, vWorld.y));`
            : ''
        }
        #include <opaque_fragment>`,
      );
  };
  return mat;
}

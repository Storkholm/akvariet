import * as THREE from 'three';

/** Shared clock for all water shaders (swaying plants, caustics, fish tails). */
export const timeUniform = { value: 0 };

/** Swim wave for a ray-style creature (DESIGN 3.4); numbers are baked into the shader source. */
export interface CreatureShader {
  /** World units per template unit. */
  size: number;
  /** World half span of the wings (distance from the centre line to the wing tip). */
  halfSpan: number;
  wingAmp: number;
  tailAmp: number;
  /** Per-creature: wave phase in radians and how far the body has "unfolded" (0 flat … 1 swimming). */
  uniforms: { uPhase: { value: number }; uFlap: { value: number } };
}

export interface WaterPatch {
  /** Material reads a per-vertex `sway` attribute (0 = rooted, 1 = free tip). */
  sway?: boolean;
  /** Add moving caustic light patterns (for the sand and nearby reef). */
  caustics?: number;
  /** Fish: per-vertex `tail` weight and per-instance `aPhase` drive a swimming wiggle. */
  fish?: boolean;
  /** Creature body: back/belly colouring plus swim wave driven by `side` and `flex` attributes. */
  creature?: CreatureShader;
}

/**
 * Adds underwater look to a Lambert material: depth-dependent brightness,
 * optional caustics, vertex-shader sway and fish wiggle. Lambert keeps the
 * lighting cheap, which matters for tablets (DESIGN 4.4).
 */
export function patchWater<T extends THREE.MeshLambertMaterial>(mat: T, patch: WaterPatch = {}): T {
  const cr = patch.creature;
  const key = `water-${patch.sway ? 's' : ''}${patch.caustics ?? 0}${patch.fish ? 'f' : ''}${
    cr ? `c${cr.size}-${cr.halfSpan.toFixed(3)}-${cr.wingAmp}-${cr.tailAmp}` : ''
  }`;
  mat.customProgramCacheKey = () => key;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = timeUniform;
    if (cr) {
      shader.uniforms.uPhase = cr.uniforms.uPhase;
      shader.uniforms.uFlap = cr.uniforms.uFlap;
    }

    const vertexDecl = [
      'uniform float uTime;',
      'varying vec3 vWorld;',
      patch.sway ? 'attribute float sway;' : '',
      patch.fish ? 'attribute float tail; attribute float aPhase;' : '',
      cr ? 'attribute float side; attribute float flex; uniform float uPhase; uniform float uFlap; varying float vSide;' : '',
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

    if (cr) {
      vertexMotion += `
        vSide = side;
        {
          float ax = abs(transformed.x);
          float k = ax / ${cr.halfSpan.toFixed(4)};
          // The wave runs from the body out to the wing tips; the trailing edge lags behind the leading edge.
          float wing = smoothstep(0.08, 1.0, k);
          float flap = sin(uPhase - ax * 1.0 + transformed.z * 0.6) * ${cr.wingAmp.toFixed(4)} * ${cr.halfSpan.toFixed(4)} * wing * (0.35 + 0.65 * k);
          // Unfolded wings hang a little at the tips, like in the reference photos.
          transformed.y += uFlap * (flap - 0.04 * ${cr.halfSpan.toFixed(4)} * k * k);
          // The tail trails behind: swings sideways with a delay growing towards its tip.
          float w = flex * flex;
          float tw = sin(uPhase * 0.7 - flex * 3.2);
          transformed.x += uFlap * tw * ${cr.tailAmp.toFixed(4)} * ${cr.size.toFixed(4)} * w;
          transformed.y += uFlap * sin(uPhase * 0.7 - flex * 3.2 + 1.6) * ${(cr.tailAmp * 0.3).toFixed(4)} * ${cr.size.toFixed(4)} * w;
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
        ${cr ? 'varying float vSide;' : ''}
        float caustic(vec2 p, float t) {
          float a = sin(p.x * 1.1 + t * 0.9 + sin(p.y * 0.8 - t * 0.6) * 1.5);
          float b = sin(p.y * 1.3 - t * 0.7 + sin(p.x * 0.9 + t * 0.5) * 1.5);
          float c = sin((p.x + p.y) * 0.7 + t * 0.4);
          float v = (a + b + c) / 3.0;
          return pow(max(0.0, 1.0 - abs(v) * 1.25), 4.0);
        }`,
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        ${
          cr
            ? // Belly = the drawing, paler and less saturated: ~65% towards a light cream (CONTEXT: Bug).
              // The belly faces away from the sun, so it also gets light bounced up from the pale sand.
              `diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.96, 0.92, 0.80), 0.65 * vSide);
        totalEmissiveRadiance += vSide * diffuseColor.rgb * 0.5;`
            : ''
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

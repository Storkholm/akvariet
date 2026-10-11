import * as THREE from 'three';

/** Shared clock for all water shaders (swaying plants, caustics, fish tails). */
export const timeUniform = { value: 0 };

/** Swim motion of a creature (DESIGN 3.4); numbers are baked into the shader source. */
export interface CreatureShader {
  style: 'ray' | 'turtle' | 'starfish' | 'urchin' | 'cucumber';
  /** World units per template unit. */
  size: number;
  /** World half span of the wings (distance from the centre line to the wing tip). */
  halfSpan: number;
  wingAmp: number;
  tailAmp: number;
  /** Per-creature: wave phase in radians, how far the body has "unfolded" (0 flat … 1 swimming) and how hard it turns (−1…1). */
  uniforms: { uPhase: { value: number }; uFlap: { value: number }; uTurn: { value: number } };
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
  /**
   * A body cut in two (CONTEXT: Stykke, ADR 0008): what is seen *inside* the clipped shell (the back faces) is painted in this flat
   * colour (r, g, b in 0–1), so the cut face looks closed – in the creature's base colour, no blood, nothing inside.
   */
  cap?: readonly [number, number, number];
}

/**
 * Adds underwater look to a Lambert material: depth-dependent brightness,
 * optional caustics, vertex-shader sway and fish wiggle. Lambert keeps the
 * lighting cheap, which matters for tablets (DESIGN 4.4).
 */
export function patchWater<T extends THREE.MeshLambertMaterial>(mat: T, patch: WaterPatch = {}): T {
  const cr = patch.creature;
  const key = `water-${patch.sway ? 's' : ''}${patch.caustics ?? 0}${patch.fish ? 'f' : ''}${
    cr ? `c${cr.style}${cr.size}-${cr.halfSpan.toFixed(3)}-${cr.wingAmp}-${cr.tailAmp}` : ''
  }${patch.cap ? `cap${patch.cap.map((v) => v.toFixed(2)).join('-')}` : ''}`;
  mat.customProgramCacheKey = () => key;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = timeUniform;
    if (cr) {
      shader.uniforms.uPhase = cr.uniforms.uPhase;
      shader.uniforms.uFlap = cr.uniforms.uFlap;
      shader.uniforms.uTurn = cr.uniforms.uTurn;
    }

    const vertexDecl = [
      'uniform float uTime;',
      'varying vec3 vWorld;',
      patch.sway ? 'attribute float sway;' : '',
      patch.fish ? 'attribute float tail; attribute float aPhase;' : '',
      cr
        ? 'attribute float side; attribute float flex; attribute float part; attribute float lift; attribute vec3 pivot; uniform float uPhase; uniform float uFlap; uniform float uTurn; varying float vSide;'
        : '',
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

    if (cr) vertexMotion += `
        vSide = side;
        // Parts that sit a little below the template plane (turtle limbs) start in the plane: "flat" means flat.
        transformed.y -= lift * (1.0 - uFlap);
        ${creatureMotion(cr)}`;

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
        }
        ${
          patch.cap
            ? // Seen from inside (through the cut) the shell is a flat, lit-from-everywhere cap in the base colour.
              `if (!gl_FrontFacing) {
          diffuseColor.rgb = vec3(${patch.cap.map((v) => v.toFixed(3)).join(', ')});
          totalEmissiveRadiance = diffuseColor.rgb * 0.55;
        }`
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

/** Vertex-shader code for a creature's swim motion; runs after `begin_vertex`, `transformed` is in body coordinates. */
function creatureMotion(cr: CreatureShader): string {
  const f = (n: number): string => n.toFixed(4);
  if (cr.style === 'turtle') {
    return `
        {
          // Parts (see TURTLE_PARTS): 0 shell, 1 head, 2 flipperFL, 3 flipperFR, 4 flipperBL, 5 flipperBR.
          // Even limb parts are on the left (−x), odd on the right (+x).
          float xdir = mod(part, 2.0) < 0.5 ? -1.0 : 1.0;
          float p = uPhase;
          vec3 pv = vec3(pivot.x, 0.0, pivot.z);
          vec3 d = transformed - pv;
          float w = pow(flex, 0.8);
          float rollA = 0.0;   // rotation about the body's length axis (z): flipper tip up/down
          float yawA = 0.0;    // rotation about the vertical axis (y): flipper tip forward/back
          if (part > 1.5 && part < 3.5) {
            // Front flippers: long, powerful, synchronous strokes.
            rollA = xdir * ${f(cr.wingAmp)} * sin(p) * w;
            yawA = xdir * 0.25 * cos(p) * w;
          } else if (part > 3.5) {
            // Back flippers: small movements that steer.
            rollA = xdir * ${f(cr.tailAmp)} * 0.6 * sin(p * 0.5 + 1.2) * w;
            yawA = xdir * ${f(cr.tailAmp)} * (0.5 * sin(p * 0.5) + 0.8 * uTurn) * w;
          } else if (part > 0.5) {
            // Head: turns a little into the turn and nods slowly.
            yawA = uTurn * 0.5 * w;
            d.y += sin(p * 0.5) * 0.02 * ${f(cr.size)} * w;
          }
          rollA *= uFlap;
          yawA *= uFlap;
          float cz = cos(rollA);
          float sz = sin(rollA);
          d.xy = vec2(d.x * cz - d.y * sz, d.x * sz + d.y * cz);
          float cy = cos(yawA);
          float sy = sin(yawA);
          d.xz = vec2(d.x * cy + d.z * sy, -d.x * sy + d.z * cy);
          transformed = pv + d;
          // The whole body rides gently up and down with the strokes.
          transformed.y += uFlap * 0.012 * ${f(cr.size)} * sin(p + 0.8);
        }`;
  }
  if (cr.style === 'starfish') {
    // Five arms ripple: the tips curl up and down in turn, and sway a little to the side.
    const reach = cr.size * 0.46;
    return `
        {
          float r = length(transformed.xz);
          float k = clamp(r / ${f(reach)}, 0.0, 1.0);
          float ang = atan(transformed.z, transformed.x);
          float arm = sin(uPhase * 2.0 + ang * 5.0);
          transformed.y += uFlap * arm * ${f(cr.wingAmp)} * ${f(reach)} * k * k;
          float sw = uFlap * 0.12 * sin(uPhase * 1.6 + ang * 5.0 + 1.3) * k * k;
          float cs = cos(sw);
          float sn = sin(sw);
          transformed.xz = vec2(transformed.x * cs - transformed.z * sn, transformed.x * sn + transformed.z * cs);
        }`;
  }
  if (cr.style === 'urchin') {
    // The round body breathes a little; the spikes (separate mesh) do the waving.
    return `
        {
          float br = 1.0 + uFlap * ${f(cr.wingAmp)} * sin(uPhase * 2.0);
          transformed.xz *= br;
          transformed.y *= 1.0 + uFlap * ${f(cr.wingAmp)} * 0.6 * sin(uPhase * 2.0 + 1.0);
        }`;
  }
  if (cr.style === 'cucumber') {
    // A wave runs from the head down the body: it bends sideways, and thickens and thins as it passes.
    return `
        {
          float z0 = transformed.z;
          float wave = sin(uPhase * 2.0 - z0 * 2.0);
          float thick = 1.0 + uFlap * ${f(cr.wingAmp)} * 1.4 * wave;
          transformed.x = transformed.x * thick + uFlap * ${f(cr.wingAmp * 0.9)} * ${f(cr.size)} * 0.5 * sin(uPhase * 2.0 - z0 * 2.0 + 1.2);
          transformed.y *= thick;
          transformed.z *= 1.0 + uFlap * ${f(cr.wingAmp)} * 0.5 * sin(uPhase * 2.0);
        }`;
  }
  // Ray: the wave runs from the body out to the wing tips; the trailing edge lags behind the leading edge.
  return `
        {
          float ax = abs(transformed.x);
          float k = ax / ${f(cr.halfSpan)};
          float wing = smoothstep(0.08, 1.0, k);
          float flap = sin(uPhase - ax * 1.0 + transformed.z * 0.6) * ${f(cr.wingAmp)} * ${f(cr.halfSpan)} * wing * (0.35 + 0.65 * k);
          // Unfolded wings hang a little at the tips, like in the reference photos.
          transformed.y += uFlap * (flap - 0.04 * ${f(cr.halfSpan)} * k * k);
          // The tail trails behind: swings sideways with a delay growing towards its tip.
          float w = flex * flex;
          float tw = sin(uPhase * 0.7 - flex * 3.2);
          transformed.x += uFlap * tw * ${f(cr.tailAmp)} * ${f(cr.size)} * w;
          transformed.y += uFlap * sin(uPhase * 0.7 - flex * 3.2 + 1.6) * ${f(cr.tailAmp * 0.3)} * ${f(cr.size)} * w;
        }`;
}

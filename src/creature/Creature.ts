import * as THREE from 'three';
import { createCreatureShader } from './material';
import { Swimmer, type SwimBounds } from './swimmer';
import { Transition } from './Transition';
import type { Species, Template } from '../species/types';
import { createRng, type Rng } from '../util/random';
import { createCreatureTexture, downscaleDrawing } from './texture';

let counter = 0;
function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `creature-${Date.now()}-${counter++}`;
}

/**
 * CONTEXT: Dyr. One drawn individual: species + drawing + creation time, plus its 3D body (shared
 * geometry, own texture/material) and its movement (Swimmer, or the Transition right after "Slip løs").
 */
export class Creature {
  readonly id: string;
  readonly species: Species;
  readonly createdAt: number;
  readonly group = new THREE.Group();
  readonly mesh: THREE.Mesh;
  /** The drawing at 512×512 – clean, without eyes (this is what gets stored in M4). */
  readonly drawing: HTMLCanvasElement;
  swimmer: Swimmer | null = null;
  transition: Transition | null = null;
  /** CONTEXT: Afsked – set while the creature swims out of the picture to be removed. */
  leaving: { dir: number; t: number } | null = null;

  private readonly texture: THREE.CanvasTexture;
  private readonly material: THREE.MeshLambertMaterial;
  private readonly uniforms: { uPhase: { value: number }; uFlap: { value: number } };
  private phase: number;

  constructor(
    readonly template: Template,
    geometry: THREE.BufferGeometry,
    drawingCanvas: HTMLCanvasElement,
    readonly rng: Rng = createRng((Math.random() * 2 ** 32) >>> 0),
    maxAnisotropy = 4,
    meta: { id?: string; createdAt?: number } = {},
  ) {
    this.id = meta.id ?? newId();
    this.createdAt = meta.createdAt ?? Date.now();
    this.species = template.species;
    this.drawing = downscaleDrawing(drawingCanvas, 512);
    this.texture = createCreatureTexture(this.drawing, template, maxAnisotropy);
    this.uniforms = { uPhase: { value: 0 }, uFlap: { value: 0 } };
    this.material = createCreatureShader(template, this.texture, this.uniforms);
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.frustumCulled = false;
    this.group.add(this.mesh);
    this.phase = rng.range(0, Math.PI * 2);
  }

  get mode(): 'transition' | 'swim' | 'farewell' {
    return this.leaving ? 'farewell' : this.transition ? 'transition' : 'swim';
  }

  /** Starts the farewell: the creature turns to the nearest side and swims out of the picture, a little away from the viewer. */
  beginFarewell(): void {
    if (this.leaving) return;
    this.swimmer = null;
    this.transition = null;
    this.uniforms.uFlap.value = 1;
    this.leaving = { dir: this.group.position.x >= 0 ? 1 : -1, t: 0 };
  }

  /** Starts free swimming at a given pose (used by the Transition hand-over and when loading saved creatures). */
  startSwimming(pos: [number, number, number], yaw: number, pitch: number, speed: number): void {
    this.swimmer = new Swimmer(this.template.swim, this.rng, { pos, yaw, pitch, speed });
    this.uniforms.uFlap.value = 1;
    this.applySwimmerPose();
  }

  update(dt: number, others: readonly Swimmer[], bounds: SwimBounds): void {
    let speed = 1;
    if (this.transition) {
      this.transition.update(dt, this.group);
      this.uniforms.uFlap.value = this.transition.flap;
      speed = 1.2;
      if (this.transition.done) {
        const { position, forward, speed: sp } = this.transition.end;
        const yaw = Math.atan2(-forward.x, -forward.z);
        const pitch = Math.asin(Math.min(1, Math.max(-1, forward.y)));
        this.transition = null;
        this.startSwimming([position.x, position.y, position.z], yaw, pitch, sp);
      }
    } else if (this.leaving) {
      this.stepFarewell(dt);
      speed = 1.3;
    } else if (this.swimmer) {
      this.swimmer.step(dt, others, bounds);
      this.applySwimmerPose();
      speed = this.swimmer.speed / this.swimmer.cruise;
    }
    const { flapHz } = this.template.swim;
    this.phase += dt * Math.PI * 2 * flapHz * (0.75 + 0.25 * speed);
    this.uniforms.uPhase.value = this.phase;
  }

  private stepFarewell(dt: number): void {
    const f = this.leaving;
    if (!f) return;
    f.t += dt;
    // Face sideways (towards the nearest edge) and slightly into the picture; turn at most 0.5 rad/s.
    const targetYaw = Math.atan2(-f.dir, 0.35);
    let d = targetYaw - this.group.rotation.y;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    this.group.rotation.set(0.05, this.group.rotation.y + Math.max(-0.5 * dt, Math.min(0.5 * dt, d)), 0, 'YXZ');
    const speed = Math.min(3.5, 1.4 + f.t * 0.7);
    const yaw = this.group.rotation.y;
    this.group.position.x += -Math.sin(yaw) * speed * dt;
    this.group.position.z += -Math.cos(yaw) * speed * dt;
    this.group.position.y += 0.15 * dt;
  }

  private applySwimmerPose(): void {
    const s = this.swimmer;
    if (!s) return;
    this.group.position.set(s.pos[0], s.pos[1], s.pos[2]);
    this.group.rotation.set(s.pitch, s.yaw, s.roll, 'YXZ');
  }

  dispose(): void {
    this.texture.dispose();
    this.material.dispose();
  }
}

import * as THREE from 'three';
import { createCreatureShader } from './material';
import { Swimmer, type SwimBounds } from './swimmer';
import { Crawler } from './crawler';
import { GlassClimb } from './glass';
import { UrchinSpikes } from './spikes';
import { timeUniform } from '../aquarium/materials';
import { Reaction, pickKind, type ReactionKind } from './reaction';
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
const APPEAR_SECONDS = 0.9;

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
  /** CONTEXT: Glædeshop – set while it hops or somersaults after a tap. */
  reaction: Reaction | null = null;
  /** CONTEXT: Ruden – set for species that now and then crawl up the glass in front of the picture (starfish). */
  readonly glass: GlassClimb | null;
  /** The 3D spikes of a sea urchin. */
  readonly spikes: UrchinSpikes | null = null;
  /** Saved creatures grow into view one by one after the page has loaded, instead of all popping up at once. */
  private appear: { delay: number; t: number } | null = null;

  private texture: THREE.CanvasTexture;
  /** False once the texture has been handed on to the pieces of a cut creature (they dispose it). */
  private ownsTexture = true;
  /** The drawing at the size it was made (when larger than the kept 512×512): used while the camera follows this creature. */
  private fullSource: HTMLCanvasElement | null;
  private fullTexture: THREE.CanvasTexture | null = null;
  private readonly material: THREE.MeshLambertMaterial;
  private readonly uniforms: { uPhase: { value: number }; uFlap: { value: number }; uTurn: { value: number } };
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
    this.fullSource = drawingCanvas.width > 512 ? drawingCanvas : null;
    // A full-size canvas is 4 MB: it is only kept for a minute (a child may release many creatures in one visit).
    // From M9 the full drawing is stored (ADR 0009), and then it can be fetched when a creature is followed.
    if (this.fullSource) globalThis.setTimeout(() => (this.fullSource = this.fullTexture ? this.fullSource : null), 60_000);
    this.texture = createCreatureTexture(this.drawing, template, maxAnisotropy);
    this.uniforms = { uPhase: { value: 0 }, uFlap: { value: 0 }, uTurn: { value: 0 } };
    this.material = createCreatureShader(template, this.texture, this.uniforms);
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.frustumCulled = false;
    this.group.add(this.mesh);
    if (template.species === 'seaUrchin') {
      this.spikes = new UrchinSpikes(geometry, this.drawing, template.size, () => rng.next());
      this.mesh.add(this.spikes.mesh);
    }
    this.glass = template.swim.glass ? new GlassClimb(rng) : null;
    this.phase = rng.range(0, Math.PI * 2);
  }

  /** 0 = flat as on the drawing, 1 = fully swimming. For display copies (species bubbles) that never swim for real. */
  setUnfold(amount: number): void {
    this.uniforms.uFlap.value = amount;
  }

  /**
   * ADR 0006: the creature the camera follows gets the drawing at full texture resolution; all the others keep 512×512
   * (30 creatures at full size would cost too much memory). Only possible when the full drawing is known: for creatures
   * released in this visit now, for saved ones once they are stored in full size (ADR 0009, M9).
   */
  setFullDetail(on: boolean): void {
    if (!this.fullSource) return;
    if (on && !this.fullTexture) {
      this.fullTexture = createCreatureTexture(this.fullSource, this.template, this.texture.anisotropy);
    }
    const next = on ? this.fullTexture : this.texture;
    if (next && this.material.map !== next) {
      this.material.map = next;
      this.material.needsUpdate = true;
    }
    if (!on && this.fullTexture) {
      this.fullTexture.dispose();
      this.fullTexture = null;
    }
  }

  /**
   * CONTEXT: Hug – hands the body over to the two pieces: the texture now belongs to them. The creature itself is
   * then removed (and deleted from the store) by the caller. Returns what the pieces need to look exactly like it.
   */
  takeBodyForCut(): { texture: THREE.CanvasTexture; geometry: THREE.BufferGeometry; template: Template; phase: number; flap: number; turn: number } {
    this.ownsTexture = false;
    const usingFull = !!this.fullTexture && this.material.map === this.fullTexture;
    if (usingFull) this.texture.dispose(); // the pieces carry the full-size one
    return {
      texture: usingFull && this.fullTexture ? this.fullTexture : this.texture,
      geometry: this.mesh.geometry,
      template: this.template,
      phase: this.uniforms.uPhase.value,
      flap: this.uniforms.uFlap.value,
      turn: this.uniforms.uTurn.value,
    };
  }

  /** Width in px of the texture the body is drawn with right now (for tests). */
  get textureSize(): number {
    return (this.material.map?.image as HTMLCanvasElement | undefined)?.width ?? 0;
  }

  /** Hidden for `delay` seconds, then grows to full size with a little overshoot. */
  appearAfter(delay: number): void {
    this.appear = { delay, t: 0 };
    this.group.scale.setScalar(0.0001);
    this.group.visible = false;
  }

  private stepAppear(dt: number): void {
    const a = this.appear;
    if (!a) return;
    a.t += dt;
    const u = Math.min(1, Math.max(0, (a.t - a.delay) / APPEAR_SECONDS));
    this.group.visible = u > 0;
    // Ease-out with a small overshoot (back easing).
    const k = 1.70158;
    const e = u >= 1 ? 1 : 1 + (k + 1) * (u - 1) ** 3 + k * (u - 1) ** 2;
    this.group.scale.setScalar(Math.max(0.0001, e));
    if (u >= 1) this.appear = null;
  }

  get mode(): 'transition' | 'swim' | 'farewell' | 'glass' {
    return this.leaving ? 'farewell' : this.transition ? 'transition' : this.glass?.onGlass ? 'glass' : 'swim';
  }

  /** A tap: hop or somersault. Ignored while it is being released, saying goodbye, or already reacting. */
  react(kind?: ReactionKind): boolean {
    if (this.leaving || this.transition || this.reaction) return false;
    this.reaction = new Reaction(kind ?? pickKind(this.rng.next()));
    return true;
  }

  /** Starts the farewell: the creature turns to the nearest side (`dir`: +1 right, −1 left, as seen from the camera) and swims out of the picture, a little away from the viewer. */
  beginFarewell(dir?: number): void {
    if (this.leaving) return;
    this.swimmer = null;
    this.transition = null;
    this.uniforms.uFlap.value = 1;
    this.reaction = null;
    this.mesh.rotation.x = 0;
    this.leaving = { dir: dir ?? (this.group.position.x >= 0 ? 1 : -1), t: 0 };
  }

  /** Starts free swimming at a given pose (used by the Transition hand-over and when loading saved creatures). */
  startSwimming(pos: [number, number, number], yaw: number, pitch: number, speed: number): void {
    const Mover = this.template.swim.crawl ? Crawler : Swimmer;
    this.swimmer = new Mover(this.template.swim, this.rng, { pos, yaw, pitch, speed });
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
    this.stepReaction(dt);
    this.stepAppear(dt);
    // How hard it is turning (−1…1): the turtle's head and back flippers follow it.
    this.uniforms.uTurn.value = this.swimmer ? Math.max(-1, Math.min(1, this.swimmer.yawRate / this.template.swim.turnRate)) : 0;
    const { flapHz } = this.template.swim;
    this.phase += dt * Math.PI * 2 * flapHz * (0.75 + 0.25 * speed);
    this.uniforms.uPhase.value = this.phase;
    this.spikes?.update(timeUniform.value, this.uniforms.uFlap.value);
  }

  /** The hop/somersault rides on top of whatever the swimmer does: a lift along world up and a flip about the wing axis. */
  private stepReaction(dt: number): void {
    const r = this.reaction;
    if (!r) return;
    const pose = r.step(dt);
    this.group.position.y += pose.lift;
    this.mesh.rotation.x = pose.pitch;
    if (r.done) {
      this.reaction = null;
      this.mesh.rotation.x = 0;
    }
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

  /**
   * CONTEXT: Ruden. Called after the camera has been placed: a starfish on its way up the glass is laid on the glass in front of the
   * lens (so it does not trail behind a moving camera) and drawn on top of the reef.
   */
  stepGlass(dt: number, camera: THREE.PerspectiveCamera, allowed: boolean): void {
    const g = this.glass;
    if (!g) return;
    const ok = allowed && !this.leaving && !this.transition && !this.appear && this.group.visible;
    g.update(dt, ok);
    const onTop = g.onGlass;
    if (this.material.depthTest === onTop) {
      this.material.depthTest = !onTop;
      this.mesh.renderOrder = onTop ? 999 : 0;
    }
    if (g.phase === 'leave' || g.phase === 'return') this.group.scale.setScalar(Math.max(0.001, g.scale));
    else if (!g.away && this.group.scale.x !== 1 && !this.appear) this.group.scale.setScalar(1);
    if (!onTop) return;
    camera.updateMatrixWorld();
    const tanHalf = Math.tan((camera.fov * Math.PI) / 360) / camera.zoom;
    const distance = (this.template.size * 0.92) / (0.2 * 2 * tanHalf);
    const q = camera.getWorldQuaternion(new THREE.Quaternion());
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(q);
    this.group.position
      .copy(camera.position)
      .addScaledVector(fwd, distance)
      .addScaledVector(up, g.y * distance * tanHalf)
      .addScaledVector(right, g.x * distance * tanHalf * camera.aspect);
    // Back towards the viewer, head up the screen (as in the transition), turned a little about the viewing direction.
    this.group.quaternion
      .copy(q)
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2))
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), g.spin));
    this.group.scale.setScalar(1);
  }

  private applySwimmerPose(): void {
    const s = this.swimmer;
    if (!s || this.glass?.away) return;
    this.group.position.set(s.pos[0], s.pos[1], s.pos[2]);
    this.group.rotation.set(s.pitch, s.yaw, s.roll, 'YXZ');
  }

  dispose(): void {
    if (this.ownsTexture) {
      this.texture.dispose();
      this.fullTexture?.dispose();
    }
    this.spikes?.dispose();
    this.material.dispose();
  }
}

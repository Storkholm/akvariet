import * as THREE from 'three';
import { terrainHeight } from '../aquarium/terrain';
import { createCreatureShader } from '../creature/material';
import type { Template } from '../species/types';
import { pointInPolygon, type P2 } from './slashGeometry';

/** What the two pieces of one cut creature share (and dispose together). */
export interface SharedBody {
  texture: THREE.CanvasTexture;
  geometry: THREE.BufferGeometry;
  template: Template;
  refs: number;
}

export type FragmentState = 'falling' | 'resting' | 'eaten' | 'gone';

/** How long (s) a piece takes to be eaten: it shrinks away in a burst of bubbles. */
export const EAT_SECONDS = 0.6;
/** The piece lies this high above the sand when it has come to rest (world units). */
const REST_HEIGHT = 0.18;

/**
 * CONTEXT: Stykke. One half of a creature that was cut in two (ADR 0008). The body is shown as a copy of the whole
 * body, clipped by a plane through the swipe line and the camera; seen through the cut, the shell is painted in the
 * base colour, so the cut face looks closed. The piece is pushed away from its other half, tumbles, sinks to the sand
 * and lies still until a cleanup shark eats it. It is never saved.
 */
export class Fragment {
  readonly group = new THREE.Group();
  readonly mesh: THREE.Mesh;
  state: FragmentState = 'falling';
  /** A shark is on its way to this piece. */
  claimed = false;
  /** The swipe that made this piece: that same swipe does not cut it again (it is made of many small segments). */
  swipe = 0;
  readonly velocity = new THREE.Vector3();
  private readonly spin = new THREE.Vector3();
  /** Every cut this piece has come out of, as world planes (the piece is what lies on the positive side of all of them). */
  private readonly planes: THREE.Plane[] = [];
  private readonly localPlanes: THREE.Plane[] = [];
  private readonly material: THREE.MeshLambertMaterial;
  private eatenFor = 0;
  private landed = 0;
  private flat = new THREE.Quaternion();
  private landQuat = new THREE.Quaternion();

  constructor(
    private readonly shared: SharedBody,
    worldPlane: THREE.Plane,
    from: { group: THREE.Group; mesh: THREE.Object3D },
    private readonly uniforms: { phase: number; flap: number; turn: number },
    /** +1: the half on the positive side of the plane; −1: the other half. */
    readonly side: 1 | -1,
    rng: () => number,
    /** The cuts the piece being cut had already been through (a piece may be cut again and again). */
    earlier: readonly THREE.Plane[] = [],
  ) {
    shared.refs++;
    const plane = worldPlane.clone();
    if (side < 0) plane.negate();
    this.planes.push(...earlier.map((e) => e.clone()), plane);
    this.group.position.copy(from.group.position);
    this.group.quaternion.copy(from.group.quaternion);
    this.group.scale.copy(from.group.scale);
    this.material = createCreatureShader(
      shared.template,
      shared.texture,
      { uPhase: { value: uniforms.phase }, uFlap: { value: uniforms.flap }, uTurn: { value: uniforms.turn } },
      { planes: this.planes },
    );
    this.mesh = new THREE.Mesh(shared.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.quaternion.copy(from.mesh.quaternion);
    this.group.add(this.mesh);
    this.group.updateMatrixWorld(true);
    // The plane is fixed to the body, not to the world: it moves and turns with the piece.
    const inverse = new THREE.Matrix4().copy(this.mesh.matrixWorld).invert();
    for (const p of this.planes) this.localPlanes.push(p.clone().applyMatrix4(inverse));

    // Pushed away from the other half (sideways in the water), with a small turn that makes it tumble.
    const away = new THREE.Vector3().copy(plane.normal);
    away.y *= 0.3;
    if (away.lengthSq() < 1e-6) away.set(side, 0, 0);
    away.normalize();
    this.velocity.copy(away).multiplyScalar(0.9).add(new THREE.Vector3(0, -0.15, 0));
    this.spin.set((rng() - 0.5) * 2.4, (rng() - 0.5) * 1.6, (rng() - 0.5) * 2.4);
  }

  get position(): THREE.Vector3 {
    return this.group.position;
  }

  /** True while the piece may still be chosen by a shark. */
  get edible(): boolean {
    return this.state === 'falling' || this.state === 'resting';
  }

  private floorY(): number {
    return terrainHeight(this.group.position.x, this.group.position.z) + REST_HEIGHT;
  }

  /** A shark bites: the piece shrinks away in bubbles. */
  eat(): void {
    if (!this.edible) return;
    this.state = 'eaten';
    this.eatenFor = 0;
  }

  update(dt: number): void {
    const g = this.group;
    if (this.state === 'falling') {
      // Water is thick: it drags the push to a halt and the piece sinks slowly, turning as it goes.
      this.velocity.multiplyScalar(Math.exp(-1.6 * dt));
      this.velocity.y -= 0.55 * dt;
      this.velocity.y = Math.max(this.velocity.y, -0.9);
      g.position.addScaledVector(this.velocity, dt);
      const turn = new THREE.Quaternion().setFromEuler(new THREE.Euler(this.spin.x * dt, this.spin.y * dt, this.spin.z * dt));
      g.quaternion.premultiply(turn);
      this.spin.multiplyScalar(Math.exp(-0.9 * dt));
      if (g.position.y <= this.floorY()) {
        g.position.y = this.floorY();
        this.state = 'resting';
        // Settle lying flat (back up), keeping the heading it landed with.
        const yaw = new THREE.Euler().setFromQuaternion(g.quaternion, 'YXZ').y;
        this.landQuat.copy(g.quaternion);
        this.flat.setFromEuler(new THREE.Euler((Math.sin(yaw * 3) * 0.08), yaw, Math.cos(yaw * 5) * 0.08, 'YXZ'));
        this.landed = 0;
      }
    } else if (this.state === 'resting') {
      if (this.landed < 1) {
        this.landed = Math.min(1, this.landed + dt / 0.8);
        g.quaternion.slerpQuaternions(this.landQuat, this.flat, this.landed * this.landed * (3 - 2 * this.landed));
      }
    } else if (this.state === 'eaten') {
      this.eatenFor += dt;
      const k = Math.min(1, this.eatenFor / EAT_SECONDS);
      g.scale.setScalar(Math.max(0.001, 1 - k * k));
      if (k >= 1) {
        this.state = 'gone';
        g.visible = false;
      }
    }
    g.updateMatrixWorld(true);
    for (let i = 0; i < this.planes.length; i++) this.planes[i].copy(this.localPlanes[i]).applyMatrix4(this.mesh.matrixWorld);
  }

  /**
   * Cuts this piece in two along `plane` (world space): two new pieces take its place, each keeping all the earlier cuts. The caller
   * removes this piece (without eating it).
   */
  splitAlong(plane: THREE.Plane, rng: () => number): [Fragment, Fragment] {
    this.group.updateMatrixWorld(true);
    const from = { group: this.group, mesh: this.mesh };
    const u = { phase: this.uniforms.phase, flap: this.uniforms.flap, turn: this.uniforms.turn };
    return [
      new Fragment(this.shared, plane, from, u, 1, rng, this.planes),
      new Fragment(this.shared, plane, from, u, -1, rng, this.planes),
    ];
  }

  /**
   * Does the swipe `a`→`b` (pixels) cut through what is left of this piece? Points along the swipe are tested against the outline of the
   * body and against the earlier cuts, so the part that has been cut away cannot be hit.
   */
  crossedBy(a: P2, b: P2, camera: THREE.PerspectiveCamera, viewport: { width: number; height: number }): boolean {
    if (!this.edible) return false;
    this.group.updateMatrixWorld(true);
    camera.updateMatrixWorld();
    const { size, center } = this.shared.template;
    const m = this.mesh.matrixWorld;
    const v = new THREE.Vector3();
    const polys = this.shared.template.parts.map((part) =>
      part.outline.map(([u, w]) => {
        const p = v.set((u - center[0]) * size, 0, (w - center[1]) * size).applyMatrix4(m).project(camera);
        return [(p.x * 0.5 + 0.5) * viewport.width, (-p.y * 0.5 + 0.5) * viewport.height] as P2;
      }),
    );
    // The body's own plane (local y = 0) in the world.
    const origin = new THREE.Vector3().setFromMatrixPosition(m);
    const normal = new THREE.Vector3(0, 1, 0).transformDirection(m);
    const bodyPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, origin);
    const ray = new THREE.Raycaster();
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const steps = Math.max(2, Math.min(240, Math.ceil(length / 5)));
    const hit = new THREE.Vector3();
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const pt: P2 = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      if (!polys.some((poly) => pointInPolygon(pt, poly))) continue;
      ray.setFromCamera(new THREE.Vector2((pt[0] / viewport.width) * 2 - 1, -(pt[1] / viewport.height) * 2 + 1), camera);
      if (!ray.ray.intersectPlane(bodyPlane, hit)) continue;
      if (this.planes.every((p) => p.distanceToPoint(hit) >= 0)) return true;
    }
    return false;
  }

  /** The world-space plane that clips this piece (for tests). */
  get clipPlane(): THREE.Plane {
    return this.planes[this.planes.length - 1];
  }

  dispose(): void {
    this.material.dispose();
    if (--this.shared.refs === 0) this.shared.texture.dispose();
  }
}

/** Cuts a creature body into its two pieces along a world plane (ADR 0008). */
export function splitBody(
  body: { texture: THREE.CanvasTexture; geometry: THREE.BufferGeometry; template: Template; phase: number; flap: number; turn: number },
  from: { group: THREE.Group; mesh: THREE.Object3D },
  plane: THREE.Plane,
  rng: () => number,
): [Fragment, Fragment] {
  const shared: SharedBody = { texture: body.texture, geometry: body.geometry, template: body.template, refs: 0 };
  const u = { phase: body.phase, flap: body.flap, turn: body.turn };
  return [new Fragment(shared, plane, from, u, 1, rng), new Fragment(shared, plane, from, u, -1, rng)];
}

import * as THREE from 'three';
import type { Template } from '../species/types';
import type { Rng } from '../util/random';
import type { SwimBounds } from './swimmer';

export interface ViewRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const smooth = (t: number): number => t * t * (3 - 2 * t);
const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/** Timeline (seconds). */
export const TRANSITION = {
  /** The body lies flat exactly where the drawing was, while the drawing layer fades out. */
  hold: 0.35,
  /** The wings unfold: wave amplitude 0 → 1. */
  unfoldStart: 0.3,
  unfoldEnd: 1.1,
  /** The body turns away and swims into the aquarium. */
  flightStart: 0.45,
  flightEnd: 3.4,
} as const;

/**
 * CONTEXT: Overgang (DESIGN 3.3, reference photo 03). After "Slip løs" the flat drawing is replaced by the
 * 3D body at the same place and size on screen. The body then "unfolds", turns and swims away from the
 * viewer into the aquarium along a curved path (perspective shrinks it naturally).
 */
export class Transition {
  time = 0;
  done = false;
  /** Pose at the end of the flight, for handing over to the Swimmer. */
  readonly end = { position: new THREE.Vector3(), forward: new THREE.Vector3(), speed: 1 };
  /** World position of the body (template centre) – exposed for tests. */
  readonly start = new THREE.Vector3();
  readonly flightTarget = new THREE.Vector3();

  private readonly p0 = new THREE.Vector3();
  private readonly p1 = new THREE.Vector3();
  private readonly p2 = new THREE.Vector3();
  private readonly camBack = new THREE.Vector3();
  private readonly camUp = new THREE.Vector3();
  private readonly startQuat = new THREE.Quaternion();
  private readonly timed: Array<{ at: number; fn: () => void }> = [];
  private readonly prev = new THREE.Vector3();
  private readonly tmp = {
    v: new THREE.Vector3(),
    f: new THREE.Vector3(),
    x: new THREE.Vector3(),
    y: new THREE.Vector3(),
    z: new THREE.Vector3(),
    u: new THREE.Vector3(),
    m: new THREE.Matrix4(),
  };

  constructor(
    template: Template,
    camera: THREE.PerspectiveCamera,
    viewport: { width: number; height: number },
    rect: ViewRect,
    bounds: SwimBounds,
    rng: Rng,
  ) {
    camera.updateMatrixWorld();
    // The lens may be zoomed in (ADR 0006): what matters is the field of view it really has.
    const tanHalf = Math.tan((camera.fov * Math.PI) / 360) / camera.zoom;
    // Distance at which a template-sized body (world size `size`) covers exactly the drawing's rect.
    const d0 = (template.size * viewport.height) / (rect.width * 2 * tanHalf);
    const upp = (2 * d0 * tanHalf) / viewport.height; // world units per CSS pixel at that depth
    const px = rect.x + template.center[0] * rect.width;
    const py = rect.y + template.center[1] * rect.height;
    this.p0.set((px - viewport.width / 2) * upp, -(py - viewport.height / 2) * upp, -d0).applyMatrix4(camera.matrixWorld);
    this.start.copy(this.p0);

    const camQuat = camera.getWorldQuaternion(new THREE.Quaternion());
    // Local axes → camera axes: x → right, y (back) → towards the viewer, z (tail) → down the screen.
    this.startQuat.copy(camQuat).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2));
    this.camBack.set(0, 0, 1).applyQuaternion(camQuat);
    this.camUp.set(0, 1, 0).applyQuaternion(camQuat);
    const camFwd = this.camBack.clone().negate();
    const camRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camQuat);

    // Target: further into the aquarium, a little to the side but still inside the picture.
    const farDepth = d0 + 9;
    const halfWidth = tanHalf * (viewport.width / viewport.height) * farDepth;
    this.p2
      .copy(this.p0)
      .addScaledVector(camFwd, 9)
      .addScaledVector(camRight, rng.range(-0.5, 0.5) * halfWidth)
      .addScaledVector(new THREE.Vector3(0, 1, 0), rng.range(0.5, 1.8));
    this.p2.x = Math.min(bounds.max[0] - 1, Math.max(bounds.min[0] + 1, this.p2.x));
    this.p2.z = Math.min(bounds.max[2] - 1, Math.max(bounds.min[2] + 1, this.p2.z));
    this.p2.y = Math.min(bounds.max[1] - 1, Math.max(this.p2.y, 4.8));
    this.flightTarget.copy(this.p2);
    // The first leg goes "up the screen": that is the way the head points on the flat drawing.
    this.p1.copy(this.p0).addScaledVector(this.camUp, 0.9);
    this.prev.copy(this.p0);
  }

  /** Runs `fn` once when the transition clock passes `seconds`. */
  when(seconds: number, fn: () => void): void {
    this.timed.push({ at: seconds, fn });
  }

  /** Flap amount for the shader, 0 flat … 1 swimming. */
  get flap(): number {
    return smooth(clamp01((this.time - TRANSITION.unfoldStart) / (TRANSITION.unfoldEnd - TRANSITION.unfoldStart)));
  }

  /** Advances the clock and writes the pose into `group`. */
  update(dt: number, group: THREE.Object3D): void {
    this.time += dt;
    for (let i = this.timed.length - 1; i >= 0; i--) {
      if (this.time >= this.timed[i].at) this.timed.splice(i, 1)[0].fn();
    }

    const u = clamp01((this.time - TRANSITION.flightStart) / (TRANSITION.flightEnd - TRANSITION.flightStart));
    // Slow start, then settles at a gliding pace (so the hand-over to free swimming has no jump).
    const s = 0.8 * smooth(u) + 0.2 * u * u;
    const { v, f, x, y, z, m } = this.tmp;

    // Quadratic Bézier p0 → p1 → p2 and its derivative.
    const a = (1 - s) * (1 - s);
    const b = 2 * (1 - s) * s;
    const c = s * s;
    group.position.set(
      a * this.p0.x + b * this.p1.x + c * this.p2.x,
      a * this.p0.y + b * this.p1.y + c * this.p2.y,
      a * this.p0.z + b * this.p1.z + c * this.p2.z,
    );
    v.copy(this.p1).sub(this.p0).multiplyScalar(2 * (1 - s)).addScaledVector(this.tmp.u.copy(this.p2).sub(this.p1), 2 * s);
    f.copy(v).normalize();

    if (u <= 0) {
      group.quaternion.copy(this.startQuat);
    } else {
      // Heading follows the path; "up" turns from "towards the viewer" (back visible) to world up.
      const blend = smooth(clamp01((u - 0.05) / 0.8));
      this.tmp.u.copy(this.camBack).lerp(new THREE.Vector3(0, 1, 0), blend).normalize();
      z.copy(f).negate();
      y.copy(this.tmp.u).addScaledVector(z, -this.tmp.u.dot(z)).normalize();
      x.crossVectors(y, z);
      m.makeBasis(x, y, z);
      group.quaternion.setFromRotationMatrix(m);
    }

    const dtSafe = Math.max(dt, 1e-4);
    const speed = group.position.distanceTo(this.prev) / dtSafe;
    this.prev.copy(group.position);

    if (this.time >= TRANSITION.flightEnd) {
      this.done = true;
      this.end.position.copy(group.position);
      this.end.forward.copy(f);
      this.end.speed = Math.min(3, Math.max(0.8, speed));
    }
  }
}

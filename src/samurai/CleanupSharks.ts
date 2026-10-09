import * as THREE from 'three';
import { fishGeometry } from '../aquarium/fishSchool';
import { patchWater } from '../aquarium/materials';
import { terrainHeight } from '../aquarium/terrain';
import { createRng, type Rng } from '../util/random';
import type { Fragment } from './Fragment';
import type { Fragments } from './Fragments';

/** How many sharks come (ADR 0008: 4–5). */
export const SHARK_COUNT = 5;
const SHARK_LENGTH = 3.2;
const CRUISE = 3.4;
const TURN_RATE = 2.2; // how fast the heading may change (1/s)
/** A shark bites a piece when its nose is this close to it. */
const BITE_DISTANCE = 1.35;
const BITE_SECONDS = 0.7;
/** The sharks keep this far from every living creature (its size × 0.5 + this). */
export const KEEP_AWAY = 1.9;

interface Shark {
  pos: THREE.Vector3;
  dir: THREE.Vector3;
  phase: number;
  target: Fragment | null;
  biting: number;
  /** After the last piece: swim out to this side (−1 / +1). */
  exitSide: number;
  state: 'in' | 'hunt' | 'out' | 'gone';
}

/** What the sharks need to know about a living creature: where it is and how big. */
export interface Living {
  position: THREE.Vector3;
  radius: number;
}

/**
 * CONTEXT: Rensehajer (ADR 0008). Four or five grey background sharks swim in from the side, go for the pieces on the
 * sand, bite them away (a nod of the head, a burst of bubbles, a "nam") and swim out again. They never touch a living
 * creature: each one steers around every living creature and is pushed out if it gets too close.
 */
export class CleanupSharks {
  readonly mesh: THREE.InstancedMesh;
  readonly sharks: Shark[] = [];
  private readonly rng: Rng;
  private readonly m = new THREE.Matrix4();
  private readonly fwd = new THREE.Vector3();
  private readonly side = new THREE.Vector3();
  private readonly up = new THREE.Vector3();
  private readonly worldUp = new THREE.Vector3(0, 1, 0);
  private time = 0;
  private idle = 0;
  /** A shark bit a piece (the piece begins to shrink): sound and bubbles. */
  onBite?: (f: Fragment) => void;
  /** All sharks have left (the counter of cut creatures starts again). */
  onGone?: () => void;

  constructor(scene: THREE.Scene, seed = 99) {
    this.rng = createRng(seed);
    const geometry = fishGeometry(SHARK_LENGTH, 0.3, 'shark');
    const phases = new Float32Array(SHARK_COUNT);
    for (let i = 0; i < SHARK_COUNT; i++) phases[i] = this.rng.range(0, 6.28);
    geometry.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phases, 1));
    const material = patchWater(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), { fish: true });
    this.mesh = new THREE.InstancedMesh(geometry, material, SHARK_COUNT);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.mesh.count = 0;
    scene.add(this.mesh);
  }

  /** Are sharks in the water? */
  get active(): boolean {
    return this.sharks.length > 0;
  }

  /**
   * They come in from the sides of the picture: `centreX` is the middle of what the child sees, `halfWidth` how far the
   * picture reaches to each side (at the depth where the sharks swim).
   */
  summon(centreX: number, halfWidth: number): void {
    if (this.active) return;
    this.idle = 0;
    for (let i = 0; i < SHARK_COUNT; i++) {
      const fromLeft = i % 2 === 0;
      const x = centreX + (fromLeft ? -1 : 1) * (halfWidth + 4 + this.rng.range(0, 6));
      const pos = new THREE.Vector3(x, this.rng.range(2.2, 5.5), this.rng.range(-4, 3));
      this.sharks.push({
        pos,
        dir: new THREE.Vector3(fromLeft ? 1 : -1, -0.05, this.rng.range(-0.2, 0.2)).normalize(),
        phase: this.rng.range(0, 6.28),
        target: null,
        biting: 0,
        exitSide: fromLeft ? -1 : 1,
        state: 'in',
      });
    }
    this.mesh.count = SHARK_COUNT;
    this.mesh.visible = true;
    this.write();
  }

  update(dt: number, fragments: Fragments, living: readonly Living[], centreX: number, halfWidth: number): void {
    if (!this.active) return;
    this.time += dt;
    const edible = fragments.edible();
    const unclaimed = (): Fragment[] => edible.filter((f) => !f.claimed && f.edible);
    // Nobody left to eat: after a moment they leave.
    this.idle = edible.length === 0 && this.sharks.every((s) => s.biting <= 0) ? this.idle + dt : 0;

    for (const s of this.sharks) {
      if (s.state === 'gone') continue;
      s.phase += dt;
      if (s.biting > 0) {
        s.biting -= dt;
        // A bite: the shark hangs in the water, nodding.
        s.pos.addScaledVector(s.dir, 0.4 * dt);
        continue;
      }
      if (s.target && !s.target.edible) {
        s.target.claimed = false;
        s.target = null;
      }
      if (this.idle > 0.8 && s.state !== 'out') {
        s.state = 'out';
        s.target = null;
        s.exitSide = s.pos.x < centreX ? -1 : 1;
      }
      if (s.state !== 'out' && !s.target) {
        const free = unclaimed();
        if (free.length) {
          // The nearest piece nobody else is after.
          let best = free[0];
          for (const f of free) if (f.position.distanceToSquared(s.pos) < best.position.distanceToSquared(s.pos)) best = f;
          best.claimed = true;
          s.target = best;
          s.state = 'hunt';
        }
      }

      const want = new THREE.Vector3();
      let speed = CRUISE;
      if (s.state === 'out') {
        want.set(s.exitSide, 0.05, 0);
        speed = CRUISE * 1.25;
        if (Math.abs(s.pos.x - centreX) > halfWidth + 9 || Math.abs(s.pos.x) > 49) s.state = 'gone';
      } else if (s.target) {
        const to = s.target.position.clone().sub(s.pos);
        const dist = to.length();
        want.copy(to).normalize();
        // A little above the sand, so the head dips onto the piece rather than ploughing into the dunes.
        if (dist < 4) speed = CRUISE * (0.45 + 0.55 * (dist / 4));
        if (dist < BITE_DISTANCE) {
          s.target.eat();
          this.onBite?.(s.target);
          s.target = null;
          s.biting = BITE_SECONDS;
          continue;
        }
      } else {
        // Still on its way in, or waiting for the pieces to land: swim towards the middle of the picture.
        want.set(centreX - s.pos.x, 0, 0).normalize();
        speed = CRUISE * 0.8;
      }

      // Steer around living creatures (they are never touched) and keep clear of the sand and the surface.
      for (const c of living) {
        const away = s.pos.clone().sub(c.position);
        const d = away.length();
        const R = c.radius + KEEP_AWAY;
        if (d < R * 1.8 && d > 1e-4) {
          const k = ((R * 1.8 - d) / (R * 1.8)) ** 1.5 * 3.2;
          want.addScaledVector(away.normalize(), k);
        }
      }
      const floor = terrainHeight(s.pos.x, s.pos.z) + 0.7;
      if (s.pos.y < floor + 0.5 && !s.target) want.y += (floor + 0.5 - s.pos.y) * 0.8;
      if (s.pos.y > 8.5) want.y -= (s.pos.y - 8.5) * 0.8;
      if (want.lengthSq() < 1e-8) want.copy(s.dir);
      want.normalize();

      s.dir.addScaledVector(want.sub(s.dir), Math.min(1, TURN_RATE * dt)).normalize();
      s.pos.addScaledVector(s.dir, speed * dt);

      // Hard rule: never inside a living creature, whatever the steering did.
      for (const c of living) {
        const away = s.pos.clone().sub(c.position);
        const d = away.length();
        const R = c.radius + KEEP_AWAY * 0.7;
        if (d < R && d > 1e-4) s.pos.copy(c.position).addScaledVector(away.normalize(), R);
      }
      s.pos.y = Math.max(s.pos.y, terrainHeight(s.pos.x, s.pos.z) + 0.45);
    }

    if (this.sharks.every((s) => s.state === 'gone')) {
      this.sharks.length = 0;
      this.mesh.visible = false;
      this.mesh.count = 0;
      this.onGone?.();
      return;
    }
    this.write();
  }

  private write(): void {
    let i = 0;
    for (const s of this.sharks) {
      if (s.state === 'gone') {
        // Park it far away (the instance stays, since the count is fixed while the group is out).
        this.m.makeScale(0.0001, 0.0001, 0.0001).setPosition(0, -50, 0);
        this.mesh.setMatrixAt(i++, this.m);
        continue;
      }
      this.fwd.copy(s.dir).normalize();
      // The head nods while biting.
      if (s.biting > 0) this.fwd.y -= Math.sin((1 - s.biting / BITE_SECONDS) * Math.PI * 3) * 0.45;
      this.fwd.normalize();
      this.side.crossVectors(this.fwd, this.worldUp);
      if (this.side.lengthSq() < 1e-6) this.side.set(0, 0, 1);
      this.side.normalize();
      this.up.crossVectors(this.side, this.fwd);
      this.m.makeBasis(this.fwd, this.up, this.side);
      this.m.setPosition(s.pos);
      this.mesh.setMatrixAt(i++, this.m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  /** The positions of the sharks that are still in the water (for tests). */
  get positions(): THREE.Vector3[] {
    return this.sharks.filter((s) => s.state !== 'gone').map((s) => s.pos);
  }
}

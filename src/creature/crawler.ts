import { reefObstacles } from '../aquarium/reef';
import { terrainHeight } from '../aquarium/terrain';
import { Swimmer, type SwimBounds } from './swimmer';

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

function wrapAngle(a: number): number {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

const OBSTACLES = reefObstacles();

/** How far into a coral patch's ellipse a point is: < 1 inside, 1 on the edge. */
export function reefDepth(x: number, z: number): number {
  let d = Infinity;
  for (const o of OBSTACLES) d = Math.min(d, Math.hypot((x - o.x) / o.rx, (z - o.z) / o.rz));
  return d;
}

/** The bottom dwellers stay between these depths (the open sand towards the camera, where it can be seen, back to just before the far reefs). */
const MAX_Z = 9;
const MIN_Z = -8;
/** Closest two bottom dwellers like to get (world units). */
const PERSONAL = 2.6;
/** The most a creature sinks or rises per second when it settles on the sand. */
const SETTLE_SPEED = 0.7;

/**
 * CONTEXT: Bunddyr (`Crawler`). Movement of a creature that crawls on the sand: wanders slowly between targets, stops to rest now and then,
 * walks round the coral patches and keeps away from the other bottom dwellers. It follows the height and the slope of the
 * sand and never leaves the bottom; after "Slip løs" it comes down to the sand slowly. Same interface as `Swimmer`.
 */
export class Crawler extends Swimmer {
  /** How far the body's origin sits above the sand surface (the belly lies a little in it). */
  restHeight = 0.12;
  private resting = 0;
  private pauseIn = 0;

  private groundAt(x: number, z: number): number {
    return terrainHeight(x, z) + this.restHeight;
  }

  private pickGroundTarget(b: SwimBounds): void {
    const zMin = Math.max(b.min[2] + 1, MIN_Z);
    const zMax = Math.min(b.max[2] - 1, MAX_Z);
    for (let tries = 0; tries < 12; tries++) {
      const a = this.rng.range(0, Math.PI * 2);
      const r = this.rng.range(2.5, 7);
      const x = clamp(this.pos[0] + Math.cos(a) * r, b.min[0] + 1, b.max[0] - 1);
      const z = clamp(this.pos[2] + Math.sin(a) * r, zMin, zMax);
      this.target = [x, this.groundAt(x, z), z];
      if (reefDepth(x, z) > 1.2) break;
    }
    this.pauseIn = this.rng.range(7, 16);
  }

  override step(dt: number, others: readonly Swimmer[], b: SwimBounds): void {
    const [px, , pz] = this.pos;
    this.pauseIn -= dt;
    if (this.resting > 0) {
      this.resting -= dt;
      this.speed += (0 - this.speed) * Math.min(1, dt * 2);
    } else {
      if (Math.hypot(this.target[0] - px, this.target[2] - pz) < 0.8 || this.pauseIn <= 0) {
        this.pickGroundTarget(b);
        if (this.rng.next() < 0.4) this.resting = this.rng.range(2, 6);
      }
      let dx = this.target[0] - px;
      let dz = this.target[2] - pz;
      const tl = Math.hypot(dx, dz) || 1;
      dx /= tl;
      dz /= tl;
      for (const o of others) {
        if (o === this || !(o instanceof Crawler)) continue;
        const ox = px - o.pos[0];
        const oz = pz - o.pos[2];
        const d = Math.hypot(ox, oz);
        if (d > PERSONAL || d < 1e-3) continue;
        const k = ((PERSONAL - d) / PERSONAL) ** 2 * 3;
        dx += (ox / d) * k;
        dz += (oz / d) * k;
      }
      // Round the corals: a push out of the patch, growing towards its middle.
      for (const o of OBSTACLES) {
        const ex = (px - o.x) / o.rx;
        const ez = (pz - o.z) / o.rz;
        const e = Math.hypot(ex, ez);
        if (e < 1.35 && e > 1e-3) {
          const k = (1.35 - e) * 3;
          dx += (ex / e) * k;
          dz += (ez / e) * k;
        }
      }
      const zMin = Math.max(b.min[2] + 1, MIN_Z);
      const zMax = Math.min(b.max[2] - 1, MAX_Z);
      if (pz > zMax - 1) dz -= (pz - (zMax - 1)) * 1.5;
      if (pz < zMin + 1) dz += (zMin + 1 - pz) * 1.5;
      if (px < b.min[0] + 2) dx += (b.min[0] + 2 - px) * 0.8;
      if (px > b.max[0] - 2) dx -= (px - (b.max[0] - 2)) * 0.8;
      const desiredYaw = Math.hypot(dx, dz) > 1e-4 ? Math.atan2(-dx, -dz) : this.yaw;
      const rate = clamp(wrapAngle(desiredYaw - this.yaw) * 1.5, -this.params.turnRate, this.params.turnRate);
      this.yawRate += (rate - this.yawRate) * Math.min(1, dt * 3);
      this.yaw = wrapAngle(this.yaw + this.yawRate * dt);
      const turnSlow = 1 - 0.6 * Math.min(1, Math.abs(this.yawRate) / this.params.turnRate);
      this.speed += (this.cruise * turnSlow - this.speed) * Math.min(1, dt * 1.2);
    }
    if (this.resting > 0) this.yawRate *= Math.exp(-3 * dt);

    const fx = -Math.sin(this.yaw);
    const fz = -Math.cos(this.yaw);
    this.pos[0] = clamp(px + fx * this.speed * dt, b.min[0], b.max[0]);
    this.pos[2] = clamp(pz + fz * this.speed * dt, MIN_Z, MAX_Z + 1);

    // Down to (or up with) the sand, softly; and lie along its slope.
    const ground = this.groundAt(this.pos[0], this.pos[2]);
    this.pos[1] += clamp(ground - this.pos[1], -SETTLE_SPEED * dt, SETTLE_SPEED * dt);
    const e = 0.4;
    const hF = terrainHeight(this.pos[0] + fx * e, this.pos[2] + fz * e) - terrainHeight(this.pos[0] - fx * e, this.pos[2] - fz * e);
    const rx = Math.cos(this.yaw);
    const rz = -Math.sin(this.yaw);
    const hR = terrainHeight(this.pos[0] + rx * e, this.pos[2] + rz * e) - terrainHeight(this.pos[0] - rx * e, this.pos[2] - rz * e);
    this.pitch += (Math.atan(hF / (2 * e)) - this.pitch) * Math.min(1, dt * 3);
    this.roll += (Math.atan(hR / (2 * e)) - this.roll) * Math.min(1, dt * 3);
  }
}

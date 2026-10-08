import { terrainHeight } from '../aquarium/terrain';
import type { SwimParams } from '../species/types';
import type { Rng } from '../util/random';

export type Vec3 = [number, number, number];

export interface SwimBounds {
  min: Vec3;
  max: Vec3;
  /** Creatures keep this far above the sand (reef tops reach ~3 units). */
  floorMargin: number;
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

function wrapAngle(a: number): number {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

/**
 * CONTEXT: Svømmer. Movement state of one creature in the aquarium: wanders between random targets
 * inside an invisible box, avoids sand, surface, walls and its neighbours, and turns naturally
 * (limited turn rate, banking into turns). Pure logic, no rendering.
 *
 * Heading convention: forward = (−sin yaw·cos pitch, sin pitch, −cos yaw·cos pitch), i.e. the body's −z axis.
 */
export class Swimmer {
  pos: Vec3;
  yaw: number;
  pitch: number;
  roll = 0;
  speed: number;
  yawRate = 0;
  target: Vec3;
  /** Cruise speed picked once per creature from the species range. */
  readonly cruise: number;
  private retargetIn = 0;

  constructor(
    readonly params: SwimParams,
    private readonly rng: Rng,
    init: { pos: Vec3; yaw: number; pitch: number; speed: number },
  ) {
    this.pos = [...init.pos];
    this.yaw = init.yaw;
    this.pitch = init.pitch;
    this.speed = init.speed;
    this.cruise = rng.range(params.cruiseSpeed[0], params.cruiseSpeed[1]);
    this.target = [...init.pos];
    this.retargetIn = 0;
  }

  forward(): Vec3 {
    const cp = Math.cos(this.pitch);
    return [-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp];
  }

  floorY(x: number, z: number, b: SwimBounds): number {
    return Math.max(b.min[1], terrainHeight(x, z) + b.floorMargin);
  }

  private pickTarget(b: SwimBounds): void {
    for (let tries = 0; tries < 8; tries++) {
      const x = this.rng.range(b.min[0] + 2, b.max[0] - 2);
      const z = this.rng.range(b.min[2] + 2, b.max[2] - 2);
      const y = this.rng.range(this.floorY(x, z, b) + 0.8, b.max[1] - 0.8);
      this.target = [x, y, z];
      if (Math.hypot(x - this.pos[0], z - this.pos[2]) > 6) break;
    }
    this.retargetIn = this.rng.range(8, 16);
  }

  step(dt: number, others: readonly Swimmer[], b: SwimBounds): void {
    this.retargetIn -= dt;
    const [px, py, pz] = this.pos;
    if (this.retargetIn <= 0 || Math.hypot(this.target[0] - px, this.target[1] - py, this.target[2] - pz) < 2.5) this.pickTarget(b);

    // Desired direction: towards the target + keep away from neighbours, sand, surface and walls.
    let dx = this.target[0] - px;
    let dy = this.target[1] - py;
    let dz = this.target[2] - pz;
    const tl = Math.hypot(dx, dy, dz) || 1;
    dx /= tl; dy /= tl; dz /= tl;

    // Rays turn slowly, so they start dodging early – and prefer to pass over/under each other.
    const personal = 7;
    for (const o of others) {
      if (o === this) continue;
      const ox = px - o.pos[0];
      const oy = py - o.pos[1];
      const oz = pz - o.pos[2];
      const d = Math.hypot(ox, oy, oz);
      if (d > personal || d < 1e-3) continue;
      const k = ((personal - d) / personal) ** 2 * 4;
      dx += (ox / d) * k; dy += (oy / d) * k * 1.4; dz += (oz / d) * k;
    }
    const floor = this.floorY(px, pz, b);
    if (py < floor + 1.5) dy += (floor + 1.5 - py) * 0.9;
    if (py > b.max[1] - 1.5) dy -= (py - (b.max[1] - 1.5)) * 0.9;
    const wall = 3;
    if (px < b.min[0] + wall) dx += (b.min[0] + wall - px) * 0.6;
    if (px > b.max[0] - wall) dx -= (px - (b.max[0] - wall)) * 0.6;
    if (pz < b.min[2] + wall) dz += (b.min[2] + wall - pz) * 0.6;
    if (pz > b.max[2] - wall) dz -= (pz - (b.max[2] - wall)) * 0.6;

    const dl = Math.hypot(dx, dy, dz) || 1;
    const desiredYaw = Math.hypot(dx, dz) > 1e-4 ? Math.atan2(-dx, -dz) : this.yaw;
    const desiredPitch = clamp(Math.asin(clamp(dy / dl, -1, 1)), -0.4, 0.4);

    const rate = clamp(wrapAngle(desiredYaw - this.yaw) * 1.3, -this.params.turnRate, this.params.turnRate);
    this.yawRate += (rate - this.yawRate) * Math.min(1, dt * 3);
    this.yaw = wrapAngle(this.yaw + this.yawRate * dt);
    this.pitch += (desiredPitch - this.pitch) * Math.min(1, dt * 1.2);
    // Left turn (yaw increasing) → left wing down → positive roll about the body's z axis.
    this.roll += (clamp(this.yawRate * 0.9, -0.45, 0.45) - this.roll) * Math.min(1, dt * 2);
    const turnSlow = 1 - 0.3 * Math.min(1, Math.abs(this.yawRate) / this.params.turnRate);
    this.speed += (this.cruise * turnSlow - this.speed) * Math.min(1, dt * 0.8);

    const f = this.forward();
    this.pos[0] = clamp(px + f[0] * this.speed * dt, b.min[0], b.max[0]);
    this.pos[2] = clamp(pz + f[2] * this.speed * dt, b.min[2], b.max[2]);
    this.pos[1] = clamp(py + f[1] * this.speed * dt, this.floorY(this.pos[0], this.pos[2], b) - 0.5, b.max[1]);
  }
}

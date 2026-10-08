import type { Rng } from '../util/random';
import { terrainHeight } from './terrain';

export type Vec3 = [number, number, number];

export interface FlockParams {
  count: number;
  min: Vec3;
  max: Vec3;
  minSpeed: number;
  maxSpeed: number;
  neighborRadius?: number;
  separationRadius?: number;
  /** Fish keep at least this far above the sand. */
  floorMargin?: number;
}

/** Simple boids (separation, alignment, cohesion) in a soft box above the sand (CONTEXT: Baggrundsliv). */
export class Flock {
  readonly pos: Float32Array;
  readonly vel: Float32Array;
  private readonly acc: Float32Array;
  readonly count: number;
  private readonly p: Required<FlockParams>;

  constructor(params: FlockParams, rng: Rng) {
    this.p = { neighborRadius: 2.2, separationRadius: 0.7, floorMargin: 0.8, ...params };
    this.count = params.count;
    this.pos = new Float32Array(this.count * 3);
    this.vel = new Float32Array(this.count * 3);
    this.acc = new Float32Array(this.count * 3);
    const { min, max } = this.p;
    for (let i = 0; i < this.count; i++) {
      const x = rng.range(min[0], max[0]);
      const z = rng.range(min[2], max[2]);
      const y = rng.range(Math.max(min[1], terrainHeight(x, z) + this.p.floorMargin), max[1]);
      this.pos.set([x, y, z], i * 3);
      const a = rng.range(0, Math.PI * 2);
      const s = rng.range(this.p.minSpeed, this.p.maxSpeed);
      this.vel.set([Math.cos(a) * s, 0, Math.sin(a) * s], i * 3);
    }
  }

  step(dt: number, target: Vec3): void {
    const { pos, vel, acc, count } = this;
    const { neighborRadius, separationRadius, minSpeed, maxSpeed, min, max, floorMargin } = this.p;
    const nr2 = neighborRadius * neighborRadius;
    const sr2 = separationRadius * separationRadius;
    acc.fill(0);

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      let n = 0;
      let cx = 0, cy = 0, cz = 0; // cohesion
      let ax = 0, ay = 0, az = 0; // alignment
      let sx = 0, sy = 0, sz = 0; // separation
      for (let j = 0; j < count; j++) {
        if (j === i) continue;
        const j3 = j * 3;
        const dx = pos[j3] - pos[i3];
        const dy = pos[j3 + 1] - pos[i3 + 1];
        const dz = pos[j3 + 2] - pos[i3 + 2];
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 > nr2) continue;
        n++;
        cx += dx; cy += dy; cz += dz;
        ax += vel[j3]; ay += vel[j3 + 1]; az += vel[j3 + 2];
        if (d2 < sr2 && d2 > 1e-6) {
          const inv = 1 / d2;
          sx -= dx * inv; sy -= dy * inv; sz -= dz * inv;
        }
      }
      if (n > 0) {
        acc[i3] += (cx / n) * 0.9 + (ax / n - vel[i3]) * 1.2 + sx * 1.6;
        acc[i3 + 1] += (cy / n) * 0.9 + (ay / n - vel[i3 + 1]) * 1.2 + sy * 1.6;
        acc[i3 + 2] += (cz / n) * 0.9 + (az / n - vel[i3 + 2]) * 1.2 + sz * 1.6;
      }
      // Pull gently towards the school's wandering target.
      acc[i3] += (target[0] - pos[i3]) * 0.18;
      acc[i3 + 1] += (target[1] - pos[i3 + 1]) * 0.12;
      acc[i3 + 2] += (target[2] - pos[i3 + 2]) * 0.18;

      // Soft walls; the floor follows the dunes.
      const floorY = Math.max(min[1], terrainHeight(pos[i3], pos[i3 + 2]) + floorMargin);
      const m = 1.5;
      const push = (v: number, lo: number, hi: number): number =>
        v < lo + m ? (lo + m - v) * 4 : v > hi - m ? (hi - m - v) * 4 : 0;
      acc[i3] += push(pos[i3], min[0], max[0]);
      acc[i3 + 1] += push(pos[i3 + 1], floorY, max[1]);
      acc[i3 + 2] += push(pos[i3 + 2], min[2], max[2]);
    }

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      vel[i3] += acc[i3] * dt;
      vel[i3 + 1] = (vel[i3 + 1] + acc[i3 + 1] * dt) * (1 - 0.8 * dt);
      vel[i3 + 2] += acc[i3 + 2] * dt;
      const sp = Math.hypot(vel[i3], vel[i3 + 1], vel[i3 + 2]) || 1e-6;
      const clamped = Math.min(maxSpeed, Math.max(minSpeed, sp));
      const k = clamped / sp;
      vel[i3] *= k; vel[i3 + 1] *= k; vel[i3 + 2] *= k;

      pos[i3] = Math.min(max[0], Math.max(min[0], pos[i3] + vel[i3] * dt));
      pos[i3 + 2] = Math.min(max[2], Math.max(min[2], pos[i3 + 2] + vel[i3 + 2] * dt));
      const floorY = Math.max(min[1], terrainHeight(pos[i3], pos[i3 + 2]) + floorMargin * 0.6);
      pos[i3 + 1] = Math.min(max[1], Math.max(floorY, pos[i3 + 1] + vel[i3 + 1] * dt));
    }
  }
}

import type { Rng } from '../util/random';

export type GlassPhase = 'idle' | 'leave' | 'up' | 'stay' | 'down' | 'return';

const LEAVE_SECONDS = 0.5;
const UP_SECONDS = 6;
const DOWN_SECONDS = 6;
const RETURN_SECONDS = 0.9;
/** Below the picture (−1 = the bottom edge, in normalised screen height). */
export const GLASS_BELOW = -1.35;

const smooth = (t: number): number => t * t * (3 - 2 * t);

/**
 * CONTEXT: Ruden. Now and then a starfish crawls up the glass in front of the picture, stays for a while and crawls down again
 * (DESIGN 8.5). Pure timing and path: `Creature` turns it into a pose. Screen coordinates are normalised (−1…1, up is +y).
 */
export class GlassClimb {
  phase: GlassPhase = 'idle';
  /** Where on the screen it is (while `onGlass`). */
  x = 0;
  y = GLASS_BELOW;
  /** Turn about the viewing direction (radians). */
  spin = 0;
  /** Body scale: it shrinks away on the sand before it appears at the bottom of the glass, and grows back when it returns. */
  scale = 1;
  private t = 0;
  private cooldown: number;
  private stayFor = 10;
  private topY = 0;

  constructor(private readonly rng: Rng, firstAfter?: number) {
    this.cooldown = firstAfter ?? rng.range(25, 70);
  }

  /** True while it is seen on the glass (and so not on the sand). */
  get onGlass(): boolean {
    return this.phase === 'up' || this.phase === 'stay' || this.phase === 'down';
  }

  /** True while the glass has taken it away from its place on the sand. */
  get away(): boolean {
    return this.phase !== 'idle' && this.phase !== 'return';
  }

  /** Starts a climb now (tests, and the timer). */
  begin(): void {
    this.phase = 'leave';
    this.t = 0;
    this.x = this.rng.range(-0.55, 0.55);
    this.topY = this.rng.range(-0.15, 0.4);
    this.spin = this.rng.range(-0.5, 0.5);
    this.stayFor = this.rng.range(7, 14);
  }

  /** Time passes; `allowed` is false while the creature must stay where it is (followed, being cut, …): a climb then ends at once. */
  update(dt: number, allowed: boolean): void {
    this.t += dt;
    switch (this.phase) {
      case 'idle':
        this.scale = 1;
        this.cooldown -= dt;
        if (this.cooldown <= 0 && allowed) this.begin();
        else if (this.cooldown <= 0) this.cooldown = 5;
        break;
      case 'leave':
        this.scale = Math.max(0.001, 1 - this.t / LEAVE_SECONDS);
        if (this.t >= LEAVE_SECONDS) this.go('up');
        break;
      case 'up':
        this.scale = 1;
        this.y = GLASS_BELOW + (this.topY - GLASS_BELOW) * smooth(Math.min(1, this.t / UP_SECONDS));
        if (this.t >= UP_SECONDS) this.go('stay');
        break;
      case 'stay':
        // Drifts a little while it sits there.
        this.y = this.topY + Math.sin(this.t * 0.4) * 0.015;
        if (this.t >= this.stayFor) this.go('down');
        break;
      case 'down':
        this.y = this.topY + (GLASS_BELOW - this.topY) * smooth(Math.min(1, this.t / DOWN_SECONDS));
        if (this.t >= DOWN_SECONDS) this.go('return');
        break;
      case 'return':
        this.scale = Math.min(1, this.t / RETURN_SECONDS);
        this.y = GLASS_BELOW;
        if (this.t >= RETURN_SECONDS) {
          this.scale = 1;
          this.phase = 'idle';
          this.cooldown = this.rng.range(40, 100);
        }
        break;
    }
    if (!allowed && this.away) this.abort();
  }

  /** Ends a climb at once: back on the sand. */
  abort(): void {
    this.phase = 'idle';
    this.scale = 1;
    this.y = GLASS_BELOW;
    this.cooldown = this.rng.range(20, 50);
  }

  private go(next: GlassPhase): void {
    this.phase = next;
    this.t = 0;
  }
}

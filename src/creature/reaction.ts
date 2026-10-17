/** CONTEXT: Glædeshop – what a creature does when it is tapped: a little hop or a somersault. */
/** `puff`: the pufferfish puffs itself up into a ball with small spikes for about two seconds and becomes normal again. */
export type ReactionKind = 'hop' | 'salto' | 'puff';

export const REACTION_SECONDS: Record<ReactionKind, number> = { hop: 0.95, salto: 1.4, puff: 2.6 };

export interface ReactionPose {
  /** How far above its swimming path (world units). */
  lift: number;
  /** Extra rotation about the body's wing axis (radians; negative = forward flip). */
  pitch: number;
  /** Pufferfish: how puffed up it is, 0…1. */
  inflate: number;
}

const smooth = (t: number): number => t * t * (3 - 2 * t);

/** The pose at progress `u` (0…1). Both kinds start and end at exactly "nothing extra", so there is never a jump. */
export function reactionPose(kind: ReactionKind, u: number): ReactionPose {
  const x = Math.min(1, Math.max(0, u));
  if (kind === 'hop') return { lift: 1.0 * 4 * x * (1 - x), pitch: 0.25 * Math.sin(Math.PI * x), inflate: 0 };
  if (kind === 'puff') {
    // Quickly up (0.4 s), held (about 1.7 s), then slowly back down (0.5 s); a little bob while it is puffed.
    const inflate = x < 0.15 ? smooth(x / 0.15) : x > 0.8 ? smooth((1 - x) / 0.2) : 1;
    return { lift: 0.25 * Math.sin(Math.PI * x) * inflate, pitch: 0, inflate };
  }
  return { lift: 0.8 * Math.sin(Math.PI * x), pitch: -2 * Math.PI * smooth(x), inflate: 0 };
}

export function pickKind(random: number): ReactionKind {
  return random < 0.6 ? 'hop' : 'salto';
}

export class Reaction {
  private t = 0;

  constructor(readonly kind: ReactionKind) {}

  get done(): boolean {
    return this.t >= REACTION_SECONDS[this.kind];
  }

  step(dt: number): ReactionPose {
    this.t += dt;
    return reactionPose(this.kind, this.t / REACTION_SECONDS[this.kind]);
  }
}

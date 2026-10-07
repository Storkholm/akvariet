/** CONTEXT: Glædeshop – what a creature does when it is tapped: a little hop or a somersault. */
export type ReactionKind = 'hop' | 'salto';

export const REACTION_SECONDS: Record<ReactionKind, number> = { hop: 0.95, salto: 1.4 };

export interface ReactionPose {
  /** How far above its swimming path (world units). */
  lift: number;
  /** Extra rotation about the body's wing axis (radians; negative = forward flip). */
  pitch: number;
}

const smooth = (t: number): number => t * t * (3 - 2 * t);

/** The pose at progress `u` (0…1). Both kinds start and end at exactly "nothing extra", so there is never a jump. */
export function reactionPose(kind: ReactionKind, u: number): ReactionPose {
  const x = Math.min(1, Math.max(0, u));
  if (kind === 'hop') return { lift: 1.0 * 4 * x * (1 - x), pitch: 0.25 * Math.sin(Math.PI * x) };
  return { lift: 0.8 * Math.sin(Math.PI * x), pitch: -2 * Math.PI * smooth(x) };
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

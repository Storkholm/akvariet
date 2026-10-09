/** ADR 0008: this many creatures cut in two call the cleanup sharks. */
export const HACKS_FOR_SHARKS = 3;
/** ADR 0008: this many seconds without a cut end samurai mode by itself. */
export const IDLE_END_SECONDS = 60;
/** ADR 0008: how long the sword button must be held (seconds). */
export const HOLD_SECONDS = 2;

/**
 * CONTEXT: Samurai-mode – the rules, without any screen: how many creatures have been cut since the sharks last came, when
 * the sharks are due, and when the mode ends by itself. Time is passed in, so tests need no clock.
 */
export class SamuraiSession {
  active = false;
  /** Creatures cut in two since the sharks were last called (reset when they have left). */
  hacked = 0;
  idleLimit = IDLE_END_SECONDS;
  private idle = 0;

  start(): void {
    this.active = true;
    this.idle = 0;
  }

  end(): void {
    this.active = false;
  }

  /** `n` creatures were cut by one swipe. */
  recordHack(n = 1): void {
    if (n <= 0) return;
    this.hacked += n;
    this.idle = 0;
  }

  /** Are the sharks due now (enough creatures cut, and none already there)? */
  sharksDue(sharksActive: boolean): boolean {
    return !sharksActive && this.hacked >= HACKS_FOR_SHARKS;
  }

  /** When the mode ends and pieces are lying around, the sharks come as well (even for fewer than 3 cuts). */
  sharksDueAtEnd(sharksActive: boolean, pieces: number): boolean {
    return !sharksActive && pieces > 0;
  }

  /** The sharks have left: the count starts from nothing. */
  sharksGone(): void {
    this.hacked = 0;
  }

  /** Time passes; returns true when the mode should end because nothing has been cut for too long. */
  tick(dt: number): boolean {
    if (!this.active) return false;
    this.idle += dt;
    return this.idle >= this.idleLimit;
  }
}

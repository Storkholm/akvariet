/** Seconds each number of the countdown is shown (DESIGN 8.1: 3 – 2 – 1, 0.5 s each). */
export const COUNT_SECONDS_PER_NUMBER = 0.5;
export const COUNT_FROM = 3;
export const COUNT_TOTAL_SECONDS = COUNT_FROM * COUNT_SECONDS_PER_NUMBER;

export interface CountdownEvents {
  /** A new number appears (3, then 2, then 1). */
  onNumber?: (n: number) => void;
  /** The button was let go (or the finger slid off) before the countdown ended: nothing happens. */
  onCancel?: () => void;
  /** The countdown ran to its end: the creature may be released. */
  onDone?: () => void;
}

/**
 * CONTEXT: Nedtælling. Pure logic behind holding "Slip løs": call `start()` when the button goes down,
 * `update(now)` every frame and `cancel()` when it is let go. Time is passed in, so tests need no clock.
 */
export class ReleaseCountdown {
  private startedAt: number | null = null;
  private shown = 0;

  constructor(private readonly events: CountdownEvents = {}) {}

  get running(): boolean {
    return this.startedAt !== null;
  }

  /** The number to show now, or null when idle. */
  get number(): number | null {
    return this.running ? this.shown : null;
  }

  /** How far along (0–1); drives the ring around the button. */
  progress(now: number): number {
    if (this.startedAt === null) return 0;
    return Math.min(1, Math.max(0, (now - this.startedAt) / 1000 / COUNT_TOTAL_SECONDS));
  }

  start(now: number): void {
    if (this.running) return;
    this.startedAt = now;
    this.shown = COUNT_FROM;
    this.events.onNumber?.(COUNT_FROM);
  }

  update(now: number): void {
    if (this.startedAt === null) return;
    const elapsed = (now - this.startedAt) / 1000;
    if (elapsed >= COUNT_TOTAL_SECONDS) {
      this.startedAt = null;
      this.shown = 0;
      this.events.onDone?.();
      return;
    }
    const n = COUNT_FROM - Math.floor(elapsed / COUNT_SECONDS_PER_NUMBER);
    if (n !== this.shown) {
      this.shown = n;
      this.events.onNumber?.(n);
    }
  }

  cancel(): void {
    if (this.startedAt === null) return;
    this.startedAt = null;
    this.shown = 0;
    this.events.onCancel?.();
  }
}

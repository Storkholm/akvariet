/**
 * DESIGN 4.4: 60 fps on an ordinary iPad. We cannot test real devices from here, so the game protects itself:
 * if frames are slow for a couple of seconds it renders at a lower resolution (down in steps, never back up, so it
 * cannot flip-flop). Pure logic; the Aquarium feeds it frame times and applies the answer.
 */
export class PixelRatioGovernor {
  private sum = 0;
  private frames = 0;
  private elapsed = 0;

  constructor(
    public ratio: number,
    private readonly min = 1,
    /** Average frame time (seconds) above which it steps down: 0.024 ≈ below 42 fps. */
    private readonly slow = 0.024,
    /** How long (seconds) to observe before judging. */
    private readonly window = 2,
    private readonly step = 0.8,
  ) {}

  /** Feed one frame's real duration. Returns the new pixel ratio when it should change, otherwise null. */
  sample(dt: number): number | null {
    // A hidden tab or a stall is not "slow rendering".
    if (!(dt > 0) || dt > 0.25) return null;
    this.sum += dt;
    this.frames++;
    this.elapsed += dt;
    if (this.elapsed < this.window) return null;
    const avg = this.sum / this.frames;
    this.sum = 0;
    this.frames = 0;
    this.elapsed = 0;
    if (avg <= this.slow || this.ratio <= this.min) return null;
    this.ratio = Math.max(this.min, Math.round(this.ratio * this.step * 20) / 20);
    return this.ratio;
  }
}

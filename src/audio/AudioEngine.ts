import { createRng, type Rng } from '../util/random';
import { ambience, blip, bloop, bubbleSchedule, bubbles, COUNTDOWN_PLING, crayonFrequency, pling, pop, swoosh, type AmbienceHandle } from './sounds';

const STORAGE_KEY = 'akvariet.muted';

/** The few things the engine needs from the browser, so it can be exercised without one. */
export interface AudioEnv {
  createContext(): AudioContext | null;
  load(): string | null;
  save(value: string): void;
  random(): number;
}

export const browserAudioEnv: AudioEnv = {
  createContext() {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    return Ctx ? new Ctx() : null;
  },
  load() {
    try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
  },
  save(value) {
    try { localStorage.setItem(STORAGE_KEY, value); } catch { /* private mode etc. – just not remembered */ }
  },
  random: Math.random,
};

/**
 * CONTEXT: Lyd (DESIGN 3.6). All sounds are generated with Web Audio. Browsers only allow sound after the first tap, so
 * nothing starts before `unlock()`; until then every call is silently ignored. One master gain handles mute and a gentle
 * limiter keeps overlapping sounds from distorting. Sound must never break the game: every call is guarded.
 */
export class AudioEngine {
  /** What has been played (for tests and debugging). */
  readonly played: string[] = [];
  muted: boolean;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private amb: AmbienceHandle | null = null;
  private blipTimer: number | undefined;
  private readonly rng: Rng;
  onMutedChange?: (muted: boolean) => void;

  constructor(private readonly env: AudioEnv = browserAudioEnv) {
    this.muted = env.load() === '1';
    this.rng = createRng((env.random() * 2 ** 32) >>> 0);
  }

  get state(): 'locked' | AudioContextState {
    return this.ctx ? this.ctx.state : 'locked';
  }

  /** Call from the first user gesture. Safe to call again. */
  unlock(): void {
    if (this.ctx) {
      if (!this.muted) void this.safe(() => this.ctx?.resume());
      return;
    }
    this.safe(() => {
      const ctx = this.env.createContext();
      if (!ctx) return;
      this.ctx = ctx;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -12;
      comp.knee.value = 18;
      comp.ratio.value = 6;
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.8;
      this.master.connect(comp).connect(ctx.destination);
      void ctx.resume();
      // Generating the hum's noise takes a moment: do it right after the tap, so the tap itself stays snappy.
      window.setTimeout(() => {
        if (this.ctx !== ctx || !this.master) return;
        this.safe(() => {
          this.amb = ambience(ctx, this.master as GainNode, ctx.currentTime, this.rng);
          this.scheduleBlips();
        });
      }, 0);
      document.addEventListener('visibilitychange', this.onVisibility);
    });
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.env.save(muted ? '1' : '0');
    this.safe(() => {
      if (!this.ctx || !this.master) return;
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.setTargetAtTime(muted ? 0 : 0.8, this.ctx.currentTime, 0.05);
      // Save battery while silent.
      if (muted) window.setTimeout(() => { if (this.muted) void this.ctx?.suspend(); }, 400);
      else void this.ctx.resume();
    });
    this.onMutedChange?.(muted);
  }

  /** A crayon was chosen: the twelve crayons are twelve notes of a pentatonic scale. */
  crayon(index: number): void {
    this.play('pling', (c, out, t) => pling(c, out, t, crayonFrequency(index)));
  }

  /** "Slip løs". */
  release(): void {
    this.play('swoosh', (c, out, t) => swoosh(c, out, t, this.rng));
  }

  /** One number of the "Slip løs" countdown (3, 2, 1): a soft, rising tone. */
  countdown(n: number): void {
    this.play('countdown', (c, out, t) => pling(c, out, t, crayonFrequency(7 + (3 - n) * 2), COUNTDOWN_PLING));
  }

  /** A species bubble pops. */
  pop(): void {
    this.play('pop', (c, out, t) => pop(c, out, t, this.rng));
  }

  /** A creature hops for joy (CONTEXT: Glædeshop). */
  react(): void {
    this.play('bubbles', (c, out, t) => bubbles(c, out, t, this.rng));
  }

  /** A creature is deleted in adult mode. */
  deleted(): void {
    this.play('bloop', (c, out, t) => bloop(c, out, t));
  }

  private play(name: string, make: (ctx: AudioContext, out: AudioNode, t: number) => unknown): void {
    if (this.muted || !this.ctx || !this.master) return;
    this.safe(() => {
      const ctx = this.ctx as AudioContext;
      if (ctx.state === 'suspended') void ctx.resume();
      make(ctx, this.master as GainNode, ctx.currentTime + 0.01);
      this.played.push(name);
      if (this.played.length > 200) this.played.shift();
    });
  }

  /** Every few seconds a few small bubbles drift up through the hum. */
  private scheduleBlips(): void {
    const next = (): void => {
      this.blipTimer = window.setTimeout(() => {
        if (!this.muted && this.ctx && this.master && this.ctx.state === 'running') {
          this.safe(() => {
            const ctx = this.ctx as AudioContext;
            const t = ctx.currentTime + 0.02;
            for (const b of bubbleSchedule(this.rng, this.rng.int(1, 4), 0.5)) blip(ctx, this.master as GainNode, t + b.at, b.freq * 0.8, b.dur, 0.05);
          });
        }
        next();
      }, 2500 + this.rng.next() * 4500);
    };
    next();
  }

  /** Stops everything (tests; the game itself never needs this). */
  dispose(): void {
    window.clearTimeout(this.blipTimer);
    this.amb?.stop();
    this.amb = null;
    document.removeEventListener('visibilitychange', this.onVisibility);
    void this.ctx?.close();
    this.ctx = null;
    this.master = null;
  }

  private readonly onVisibility = (): void => {
    if (!this.ctx) return;
    if (document.hidden) void this.ctx.suspend();
    else if (!this.muted) void this.ctx.resume();
  };

  private safe(fn: () => unknown): void {
    try {
      const r = fn();
      if (r instanceof Promise) r.catch(() => undefined);
    } catch (e) {
      console.warn('[akvariet] sound failed', e);
    }
  }
}

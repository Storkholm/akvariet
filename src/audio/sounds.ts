import type { Rng } from '../util/random';

/**
 * CONTEXT: Lyd. Every sound is made here, from oscillators and noise – no sound files (ADR 0004).
 * The recipes take any `BaseAudioContext`, so the game plays them live and the tests render them offline
 * to check that nothing is silent or clipping (and to export listening copies).
 */

/** Major pentatonic: any two notes sound fine together, so the crayons can never "play a wrong note". */
export const PENTATONIC = [0, 2, 4, 7, 9];

/** The fourteen crayons climb a pentatonic scale from A3 (220 Hz) to about 1.3 kHz. */
export function crayonFrequency(index: number, base = 220): number {
  const i = Math.max(0, Math.round(index));
  const semitones = PENTATONIC[i % PENTATONIC.length] + 12 * Math.floor(i / PENTATONIC.length);
  return base * Math.pow(2, semitones / 12);
}

/** A little group of bubble blips: when (seconds from the start), how high and how long. */
export function bubbleSchedule(rng: Rng, count: number, span: number): Array<{ at: number; freq: number; dur: number }> {
  const out = [];
  for (let i = 0; i < count; i++) {
    out.push({ at: rng.range(0, span) * (0.35 + 0.65 * (i / Math.max(1, count - 1))), freq: rng.range(420, 1300), dur: rng.range(0.045, 0.1) });
  }
  return out.sort((a, b) => a.at - b.at);
}

/** Fills `data` with noise: white, pink (Paul Kellet's filter) or brown (soft rumble). */
export function fillNoise(data: Float32Array, color: 'white' | 'pink' | 'brown', rng: Rng): void {
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
  for (let i = 0; i < data.length; i++) {
    const white = rng.next() * 2 - 1;
    if (color === 'white') data[i] = white * 0.5;
    else if (color === 'pink') {
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      b3 = 0.8665 * b3 + white * 0.3104856;
      b4 = 0.55 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.016898;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    } else {
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }
  }
}

export function noiseBuffer(ctx: BaseAudioContext, seconds: number, color: 'white' | 'pink' | 'brown', rng: Rng): AudioBuffer {
  const buf = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * seconds)), ctx.sampleRate);
  fillNoise(buf.getChannelData(0), color, rng);
  return buf;
}

/** Gain envelope: silent → peak over `attack`, then a smooth exponential fall to silence over `decay`. */
function envelope(ctx: BaseAudioContext, out: AudioNode, t: number, attack: number, peak: number, decay: number): GainNode {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  g.connect(out);
  return g;
}

function tone(ctx: BaseAudioContext, dest: AudioNode, t: number, type: OscillatorType, from: number, to: number, glide: number, dur: number): OscillatorNode {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(from, t);
  if (to !== from) o.frequency.exponentialRampToValueAtTime(to, t + glide);
  o.connect(dest);
  o.start(t);
  o.stop(t + dur);
  return o;
}

export interface PlingParams {
  attack: number;
  decay: number;
  /** Level of the second harmonic relative to the base note (0 = pure sine). */
  overtone: number;
  peak: number;
}
export const PLING: PlingParams = { attack: 0.006, decay: 0.45, overtone: 0.28, peak: 0.28 };

/** The softer, rounder tone of the "Slip løs" countdown. */
export const COUNTDOWN_PLING: PlingParams = { attack: 0.01, decay: 0.32, overtone: 0.1, peak: 0.2 };

/** The "pling" when a crayon is chosen. Returns how long it lasts (seconds). */
export function pling(ctx: BaseAudioContext, out: AudioNode, t: number, freq: number, p: PlingParams = PLING): number {
  const dur = p.attack + p.decay + 0.05;
  const g = envelope(ctx, out, t, p.attack, p.peak, p.decay);
  tone(ctx, g, t, 'sine', freq, freq, 0, dur);
  const h = ctx.createGain();
  h.gain.value = p.overtone;
  h.connect(g);
  tone(ctx, h, t, 'sine', freq * 2, freq * 2, 0, dur);
  return dur;
}

/** One rising bubble blip. */
export function blip(ctx: BaseAudioContext, out: AudioNode, t: number, freq: number, dur: number, peak = 0.16): void {
  const g = envelope(ctx, out, t, 0.008, peak, dur);
  tone(ctx, g, t, 'sine', freq, freq * 1.7, dur * 0.8, dur + 0.02);
}

export interface BubblesParams {
  count: number;
  span: number;
  peak: number;
}
export const BUBBLES: BubblesParams = { count: 7, span: 0.45, peak: 0.16 };

/** A burst of bubbles (the creature's "glædeshop"). Returns the total length. */
export function bubbles(ctx: BaseAudioContext, out: AudioNode, t: number, rng: Rng, p: BubblesParams = BUBBLES): number {
  let end = 0;
  for (const b of bubbleSchedule(rng, p.count, p.span)) {
    blip(ctx, out, t + b.at, b.freq, b.dur, p.peak);
    end = Math.max(end, b.at + b.dur + 0.03);
  }
  return end;
}

export interface SwooshParams {
  from: number;
  to: number;
  length: number;
  peak: number;
}
export const SWOOSH: SwooshParams = { from: 280, to: 2200, length: 0.55, peak: 0.34 };

/** "Slip løs": a rising whoosh of water followed by a soft splash. */
export function swoosh(ctx: BaseAudioContext, out: AudioNode, t: number, rng: Rng, p: SwooshParams = SWOOSH): number {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, p.length + 0.4, 'white', rng);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 1.1;
  bp.frequency.setValueAtTime(p.from, t);
  bp.frequency.exponentialRampToValueAtTime(p.to, t + p.length);
  const g = envelope(ctx, out, t, p.length * 0.35, p.peak, p.length * 0.65 + 0.1);
  src.connect(bp).connect(g);
  src.start(t);
  src.stop(t + p.length + 0.4);
  plask(ctx, out, t + p.length * 0.55, rng);
  return p.length + 0.5;
}

/** A soft splash: a low "plop" that drops in pitch, plus a short, muffled burst of noise. */
export function plask(ctx: BaseAudioContext, out: AudioNode, t: number, rng?: Rng): void {
  const g = envelope(ctx, out, t, 0.004, 0.3, 0.2);
  tone(ctx, g, t, 'sine', 330, 75, 0.16, 0.26);
  if (rng) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx, 0.12, 'white', rng);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1400;
    const ng = envelope(ctx, out, t, 0.002, 0.14, 0.09);
    src.connect(lp).connect(ng);
    src.start(t);
    src.stop(t + 0.12);
  }
}

/** A bubble in the picker popping: a tiny click and a quick downward "bloop". */
export function pop(ctx: BaseAudioContext, out: AudioNode, t: number, rng: Rng): number {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, 0.04, 'white', rng);
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 1800;
  const ng = envelope(ctx, out, t, 0.001, 0.18, 0.025);
  src.connect(hp).connect(ng);
  src.start(t);
  src.stop(t + 0.04);
  const g = envelope(ctx, out, t, 0.002, 0.22, 0.11);
  tone(ctx, g, t, 'sine', 950, 280, 0.09, 0.14);
  return 0.16;
}

/** A soft, low "bloop" for a creature being deleted in adult mode. */
export function bloop(ctx: BaseAudioContext, out: AudioNode, t: number): number {
  const g = envelope(ctx, out, t, 0.01, 0.26, 0.28);
  tone(ctx, g, t, 'sine', 330, 130, 0.22, 0.36);
  return 0.4;
}

export interface AmbienceHandle {
  stop(): void;
}

/**
 * The underwater hum: soft brown noise through a low-pass filter whose cut-off drifts slowly, plus a very faint
 * shimmer higher up. Quiet on purpose: it should be felt, not heard.
 */
export function ambience(ctx: BaseAudioContext, out: AudioNode, t: number, rng: Rng, level = 0.07): AmbienceHandle {
  const rumble = ctx.createBufferSource();
  rumble.buffer = noiseBuffer(ctx, 6, 'brown', rng);
  rumble.loop = true;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 380;
  lp.Q.value = 0.7;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.07;
  const depth = ctx.createGain();
  depth.gain.value = 140;
  lfo.connect(depth).connect(lp.frequency);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(level, t + 2.5);
  rumble.connect(lp).connect(g).connect(out);

  const shimmer = ctx.createBufferSource();
  shimmer.buffer = noiseBuffer(ctx, 4, 'pink', rng);
  shimmer.loop = true;
  const hp = ctx.createBiquadFilter();
  hp.type = 'bandpass';
  hp.frequency.value = 2400;
  hp.Q.value = 0.8;
  const sg = ctx.createGain();
  sg.gain.setValueAtTime(0.0001, t);
  sg.gain.linearRampToValueAtTime(level * 0.06, t + 3);
  shimmer.connect(hp).connect(sg).connect(out);

  rumble.start(t);
  shimmer.start(t);
  lfo.start(t);
  return {
    stop() {
      for (const n of [rumble, shimmer, lfo]) {
        try { n.stop(); } catch { /* already stopped */ }
      }
    },
  };
}

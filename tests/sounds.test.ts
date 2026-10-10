import { describe, expect, it } from 'vitest';
import { bubbleSchedule, crayonFrequency, fillNoise, PENTATONIC } from '../src/audio/sounds';
import { createRng } from '../src/util/random';

describe('crayon notes', () => {
  const notes = Array.from({ length: 14 }, (_, i) => crayonFrequency(i));

  it('start at A3 and climb steadily, one note per crayon', () => {
    expect(notes[0]).toBeCloseTo(220, 1);
    for (let i = 1; i < notes.length; i++) expect(notes[i]).toBeGreaterThan(notes[i - 1]);
  });

  it('stay in a gentle range (nothing shrill for small ears)', () => {
    expect(Math.min(...notes)).toBeGreaterThan(200);
    expect(Math.max(...notes)).toBeLessThan(1350);
  });

  it('are all notes of one pentatonic scale: any two neighbours are a whole step or a minor third', () => {
    for (let i = 1; i < notes.length; i++) {
      const semis = Math.round(12 * Math.log2(notes[i] / notes[i - 1]));
      expect([2, 3]).toContain(semis);
    }
    expect(PENTATONIC).toEqual([0, 2, 4, 7, 9]);
  });

  it('every note is exactly on the 12-tone grid (A = 220 Hz)', () => {
    for (const f of notes) {
      const semis = 12 * Math.log2(f / 220);
      expect(Math.abs(semis - Math.round(semis))).toBeLessThan(1e-6);
    }
  });
});

describe('bubbleSchedule', () => {
  it('is deterministic for a seed, sorted in time and inside the span', () => {
    const a = bubbleSchedule(createRng(1), 7, 0.45);
    const b = bubbleSchedule(createRng(1), 7, 0.45);
    expect(a).toEqual(b);
    expect(a).toHaveLength(7);
    for (let i = 1; i < a.length; i++) expect(a[i].at).toBeGreaterThanOrEqual(a[i - 1].at);
    for (const x of a) {
      expect(x.at).toBeGreaterThanOrEqual(0);
      expect(x.at).toBeLessThanOrEqual(0.45);
      expect(x.freq).toBeGreaterThan(400);
      expect(x.freq).toBeLessThan(1400);
      expect(x.dur).toBeLessThan(0.11);
    }
  });
});

describe('fillNoise', () => {
  const stats = (color: 'white' | 'pink' | 'brown') => {
    const d = new Float32Array(20000);
    fillNoise(d, color, createRng(3));
    let peak = 0, sum = 0, sq = 0;
    for (const v of d) { peak = Math.max(peak, Math.abs(v)); sum += v; sq += v * v; }
    return { peak, mean: sum / d.length, rms: Math.sqrt(sq / d.length) };
  };

  it('stays within -1…1, is centred and is audible but not loud', () => {
    for (const c of ['white', 'pink', 'brown'] as const) {
      const s = stats(c);
      expect(s.peak, c).toBeLessThanOrEqual(1);
      expect(Math.abs(s.mean), c).toBeLessThan(0.05);
      expect(s.rms, c).toBeGreaterThan(0.05);
      expect(s.rms, c).toBeLessThan(0.6);
    }
  });

  it('brown noise is smoother (rumbles) than white noise', () => {
    const smooth = (color: 'white' | 'brown') => {
      const d = new Float32Array(5000);
      fillNoise(d, color, createRng(5));
      let diff = 0;
      for (let i = 1; i < d.length; i++) diff += Math.abs(d[i] - d[i - 1]);
      return diff / d.length;
    };
    expect(smooth('brown')).toBeLessThan(smooth('white') * 0.3);
  });
});

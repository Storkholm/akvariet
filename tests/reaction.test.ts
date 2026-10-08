import { describe, expect, it } from 'vitest';
import { pickKind, Reaction, reactionPose, REACTION_SECONDS } from '../src/creature/reaction';

describe('glædeshop (hop and somersault)', () => {
  it('both kinds start and end at exactly "nothing extra", so there is never a jump', () => {
    for (const kind of ['hop', 'salto'] as const) {
      const a = reactionPose(kind, 0);
      expect(a.lift).toBeCloseTo(0, 9);
      expect(a.pitch).toBeCloseTo(0, 9);
      const b = reactionPose(kind, 1);
      expect(b.lift).toBeCloseTo(0, 9);
      // A full somersault ends a whole turn round, which looks identical to the start.
      expect(Math.abs(b.pitch) % (2 * Math.PI) < 1e-9 || Math.abs(b.pitch) % (2 * Math.PI) > 2 * Math.PI - 1e-9).toBe(true);
    }
  });

  it('the hop goes up and comes down, about a body length of 1 unit, with a small nose-up tilt', () => {
    let top = 0;
    for (let u = 0; u <= 1; u += 0.01) {
      const p = reactionPose('hop', u);
      expect(p.lift).toBeGreaterThanOrEqual(-1e-9);
      expect(Math.abs(p.pitch)).toBeLessThan(0.3);
      top = Math.max(top, p.lift);
    }
    expect(top).toBeGreaterThan(0.9);
    expect(top).toBeLessThan(1.2);
  });

  it('the somersault turns one whole forward turn, smoothly and in one direction', () => {
    let prev = reactionPose('salto', 0).pitch;
    for (let u = 0.01; u <= 1.0001; u += 0.01) {
      const p = reactionPose('salto', u).pitch;
      expect(p).toBeLessThanOrEqual(prev + 1e-12); // only ever forward (negative)
      expect(prev - p).toBeLessThan(0.2); // no sudden jumps
      prev = p;
    }
    expect(prev).toBeCloseTo(-2 * Math.PI, 6);
  });

  it('clamps outside 0…1', () => {
    expect(reactionPose('hop', -3).lift).toBeCloseTo(0, 9);
    expect(reactionPose('salto', 9).pitch).toBeCloseTo(-2 * Math.PI, 6);
  });

  it('Reaction runs for its length and then is done', () => {
    const r = new Reaction('hop');
    let t = 0;
    while (!r.done) { r.step(1 / 60); t += 1 / 60; expect(t).toBeLessThan(5); }
    expect(t).toBeGreaterThanOrEqual(REACTION_SECONDS.hop - 1e-9);
    expect(t).toBeLessThan(REACTION_SECONDS.hop + 0.05);
  });

  it('mostly hops, sometimes somersaults', () => {
    const kinds = Array.from({ length: 100 }, (_, i) => pickKind(i / 100));
    const hops = kinds.filter((k) => k === 'hop').length;
    expect(hops).toBeGreaterThan(50);
    expect(hops).toBeLessThan(100);
  });
});

import { describe, expect, it } from 'vitest';
import { clampPixelRatio } from '../src/util/render';

describe('clampPixelRatio', () => {
  it('caps high ratios at 2', () => expect(clampPixelRatio(3)).toBe(2));
  it('keeps low ratios', () => expect(clampPixelRatio(1.5)).toBe(1.5));
  it('falls back to 1 for nonsense', () => {
    expect(clampPixelRatio(0)).toBe(1);
    expect(clampPixelRatio(NaN)).toBe(1);
  });
});

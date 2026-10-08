import { describe, expect, it } from 'vitest';
import { MAX_CREATURES, oldestFirst, planFarewells, splitForCap } from '../src/creature/limits';

const make = (n: number, startAt = 1000): Array<{ id: string; createdAt: number }> =>
  Array.from({ length: n }, (_, i) => ({ id: `c${String(i).padStart(2, '0')}`, createdAt: startAt + i }));

describe('loft på 30 med afsked', () => {
  it('the cap is 30 (DESIGN 4.3)', () => expect(MAX_CREATURES).toBe(30));

  it('nobody leaves while there is room', () => {
    expect(planFarewells(make(0))).toEqual([]);
    expect(planFarewells(make(29))).toEqual([]);
  });

  it('a 31st creature sends the oldest one away', () => {
    const living = make(30);
    expect(planFarewells(living).map((c) => c.id)).toEqual(['c00']);
  });

  it('the oldest goes, whatever order the list is in', () => {
    const living = [...make(30)].reverse();
    expect(planFarewells(living).map((c) => c.id)).toEqual(['c00']);
  });

  it('copes with more than one too many (e.g. a lowered cap or corrupt storage)', () => {
    expect(planFarewells(make(35)).map((c) => c.id)).toEqual(['c00', 'c01', 'c02', 'c03', 'c04', 'c05']);
    expect(planFarewells(make(30), 2).map((c) => c.id)).toEqual(['c00', 'c01']);
    expect(planFarewells(make(10), 1, 10).map((c) => c.id)).toEqual(['c00']);
  });

  it('equal creation times are ordered by id, so the choice is always the same', () => {
    const a = [{ id: 'b', createdAt: 5 }, { id: 'a', createdAt: 5 }, { id: 'c', createdAt: 4 }];
    expect(oldestFirst(a).map((x) => x.id)).toEqual(['c', 'a', 'b']);
  });

  it('after loading, only the newest 30 are kept and the rest are reported for deletion', () => {
    const { keep, drop } = splitForCap(make(33));
    expect(keep).toHaveLength(30);
    expect(drop.map((c) => c.id)).toEqual(['c00', 'c01', 'c02']);
    expect(keep[0].id).toBe('c03');
    expect(splitForCap(make(5))).toEqual({ keep: make(5), drop: [] });
  });
});

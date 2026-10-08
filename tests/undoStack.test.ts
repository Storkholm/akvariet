import { describe, expect, it } from 'vitest';
import { UndoStack } from '../src/drawing/undoStack';

describe('UndoStack', () => {
  it('pops in reverse order', () => {
    const s = new UndoStack<number>();
    s.push(1); s.push(2); s.push(3);
    expect([s.pop(), s.pop(), s.pop(), s.pop()]).toEqual([3, 2, 1, undefined]);
  });

  it('keeps at least 20 steps (default 30) and drops the oldest beyond the limit', () => {
    const s = new UndoStack<number>();
    for (let i = 0; i < 50; i++) s.push(i);
    expect(s.size).toBe(30);
    expect(s.pop()).toBe(49);
    const small = new UndoStack<number>(3);
    for (let i = 0; i < 5; i++) small.push(i);
    expect([small.pop(), small.pop(), small.pop(), small.pop()]).toEqual([4, 3, 2, undefined]);
  });

  it('clear empties it', () => {
    const s = new UndoStack<number>();
    s.push(1);
    s.clear();
    expect(s.size).toBe(0);
  });
});

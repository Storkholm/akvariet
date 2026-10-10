import { describe, expect, it } from 'vitest';
import { COUNT_TOTAL_SECONDS, ReleaseCountdown } from '../src/ui/releaseCountdown';

function make() {
  const log: string[] = [];
  const c = new ReleaseCountdown({
    onNumber: (n) => log.push(`n${n}`),
    onCancel: () => log.push('cancel'),
    onDone: () => log.push('done'),
  });
  return { c, log };
}

describe('ReleaseCountdown', () => {
  it('counts 3 – 2 – 1 at 0.5 s each and then is done after 1.5 s', () => {
    const { c, log } = make();
    c.start(1000);
    expect(c.number).toBe(3);
    c.update(1400);
    c.update(1500);
    expect(c.number).toBe(2);
    c.update(1999);
    c.update(2000);
    expect(c.number).toBe(1);
    c.update(2499);
    expect(log).toEqual(['n3', 'n2', 'n1']);
    c.update(2500);
    expect(log).toEqual(['n3', 'n2', 'n1', 'done']);
    expect(c.running).toBe(false);
    expect(COUNT_TOTAL_SECONDS).toBe(1.5);
  });

  it('a short tap releases nothing', () => {
    const { c, log } = make();
    c.start(0);
    c.update(120);
    c.cancel();
    c.update(5000); // late frames after the cancel change nothing
    expect(log).toEqual(['n3', 'cancel']);
    expect(c.number).toBeNull();
  });

  it('can be cancelled on the last number and then started again', () => {
    const { c, log } = make();
    c.start(0);
    c.update(600);
    c.update(1100);
    c.update(1400);
    c.cancel();
    c.start(2000);
    c.update(2600);
    c.update(3100);
    c.update(3500);
    expect(log).toEqual(['n3', 'n2', 'n1', 'cancel', 'n3', 'n2', 'n1', 'done']);
  });

  it('cancel and update do nothing while idle, and a second start does not restart', () => {
    const { c, log } = make();
    c.cancel();
    c.update(10);
    c.start(0);
    c.start(400);
    c.update(600);
    c.update(1100);
    c.update(1500);
    expect(log).toEqual(['n3', 'n2', 'n1', 'done']); // the second start did not restart the clock
  });

  it('reports progress 0–1 for the ring', () => {
    const { c } = make();
    expect(c.progress(0)).toBe(0);
    c.start(1000);
    expect(c.progress(1750)).toBeCloseTo(0.5, 5);
    expect(c.progress(9999)).toBe(1);
  });
});

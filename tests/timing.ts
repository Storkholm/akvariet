/** The fastest of a few runs, in ms: a busy CI machine (30 test files at once) can make one run 2× slower, which says nothing about the code. */
export function fastest(fn: () => unknown, runs = 3): number {
  let best = Infinity;
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now();
    fn();
    best = Math.min(best, performance.now() - t0);
  }
  return best;
}

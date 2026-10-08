/** CONTEXT: Loft – at most this many creatures swim in the aquarium (DESIGN 4.3). */
export const MAX_CREATURES = 30;

export interface Aged {
  id: string;
  createdAt: number;
}

/** Oldest first; equal times fall back to the id so the order is always the same. */
export function oldestFirst<T extends Aged>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => a.createdAt - b.createdAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/**
 * CONTEXT: Afsked. Which creatures must say goodbye so that `incoming` new ones fit under the cap?
 * Returns the oldest ones first. With a full aquarium of 30, a 31st creature sends the oldest away.
 */
export function planFarewells<T extends Aged>(living: readonly T[], incoming = 1, max = MAX_CREATURES): T[] {
  const overflow = living.length + incoming - max;
  return overflow > 0 ? oldestFirst(living).slice(0, overflow) : [];
}

/** When loading from storage: keep the newest `max`, report the rest so they can be deleted. */
export function splitForCap<T extends Aged>(stored: readonly T[], max = MAX_CREATURES): { keep: T[]; drop: T[] } {
  const sorted = oldestFirst(stored);
  const drop = sorted.slice(0, Math.max(0, sorted.length - max));
  return { keep: sorted.slice(drop.length), drop };
}

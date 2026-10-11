import type * as THREE from 'three';
import { Fragment } from './Fragment';

/** No more than this many pieces lie in the aquarium at once: when it is full, swipes only cut living creatures (ADR 0011). */
export const MAX_PIECES = 40;

/** All pieces lying in (or sinking through) the aquarium. */
export class Fragments {
  readonly list: Fragment[] = [];
  /** A piece was eaten up completely (bubbles, sound). */
  onEaten?: (f: Fragment) => void;

  constructor(private readonly scene: THREE.Scene) {}

  add(...pieces: Fragment[]): void {
    for (const f of pieces) {
      this.list.push(f);
      this.scene.add(f.group);
    }
  }

  /** Replaces a piece by the two halves it was cut into (no bubbles, no sound: it was not eaten). */
  replace(old: Fragment, ...pieces: Fragment[]): void {
    const i = this.list.indexOf(old);
    if (i >= 0) this.list.splice(i, 1);
    this.scene.remove(old.group);
    old.dispose();
    this.add(...pieces);
  }

  /** Pieces a shark may still go for. */
  edible(): Fragment[] {
    return this.list.filter((f) => f.edible);
  }

  get count(): number {
    return this.list.length;
  }

  update(dt: number): void {
    for (const f of this.list) f.update(dt);
    for (let i = this.list.length - 1; i >= 0; i--) {
      const f = this.list[i];
      if (f.state !== 'gone') continue;
      this.list.splice(i, 1);
      this.scene.remove(f.group);
      f.dispose();
      this.onEaten?.(f);
    }
  }

  clear(): void {
    for (const f of this.list) {
      this.scene.remove(f.group);
      f.dispose();
    }
    this.list.length = 0;
  }
}

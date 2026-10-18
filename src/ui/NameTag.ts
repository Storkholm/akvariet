import * as THREE from 'three';
import type { Creature } from '../creature/Creature';
import { h } from './dom';

/** How long a name sign stays after a tap on its creature (seconds). */
export const TAG_SECONDS = 3;

interface Tag {
  el: HTMLElement;
  /** Seconds left; `Infinity` while the camera follows the creature. */
  left: number;
}

/** What the sign needs to know about the screen: where a world point is, in CSS px, and whether it is in front of the camera. */
export type Projector = (p: THREE.Vector3) => { x: number; y: number; visible: boolean };

/**
 * CONTEXT: Navneskilt (DESIGN 8.6). A small rounded sign that floats above a named creature: for 3 seconds after a tap on it, and all
 * the time while the camera follows it. Creatures without a name get none. It is plain HTML over the picture (readable, crisp).
 */
export class NameTag {
  readonly element = h('div', { class: 'name-layer', 'aria-hidden': true });
  private readonly tags = new Map<Creature, Tag>();
  private following: Creature | null = null;
  private readonly p = new THREE.Vector3();

  constructor(
    private readonly creatures: () => readonly Creature[],
    private readonly project: Projector,
  ) {}

  /** A tap on `creature`: its sign shows for a few seconds (a new tap starts the time again). */
  flash(creature: Creature): void {
    if (!creature.name) return;
    const tag = this.tagFor(creature);
    tag.left = Math.max(tag.left, TAG_SECONDS);
  }

  /** The camera follows `creature` (or nothing): the sign stays as long as it does. */
  follow(creature: Creature | null): void {
    if (this.following && this.following !== creature) {
      const old = this.tags.get(this.following);
      if (old) old.left = Math.min(old.left, TAG_SECONDS);
    }
    this.following = creature;
    if (creature?.name) this.tagFor(creature).left = Infinity;
  }

  /** The creatures that have a sign on screen right now (for tests). */
  get shown(): Creature[] {
    return [...this.tags.keys()];
  }

  private tagFor(creature: Creature): Tag {
    let tag = this.tags.get(creature);
    if (!tag) {
      const el = h('div', { class: 'name-tag' }, [creature.name ?? '']);
      this.element.append(el);
      tag = { el, left: 0 };
      this.tags.set(creature, tag);
    }
    return tag;
  }

  /** Call once per frame: time passes, and the signs follow their creatures. */
  update(dt: number): void {
    const alive = new Set(this.creatures());
    for (const [creature, tag] of [...this.tags]) {
      if (tag.left !== Infinity) tag.left -= dt;
      if (!alive.has(creature) || tag.left <= -0.4) {
        tag.el.remove();
        this.tags.delete(creature);
        continue;
      }
      this.p.copy(creature.group.position);
      this.p.y += creature.template.size * 0.42 * creature.group.scale.y;
      const s = this.project(this.p);
      const show = tag.left > 0 && s.visible && creature.group.visible;
      tag.el.classList.toggle('on', show);
      tag.el.style.transform = `translate(${Math.round(s.x)}px, ${Math.round(s.y)}px) translate(-50%, -100%)`;
    }
  }
}

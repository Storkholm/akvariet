import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { MAX_NAME_LENGTH, nameOrUndefined, sanitizeName } from '../src/creature/name';
import { NameTag, TAG_SECONDS } from '../src/ui/NameTag';

describe('names (CONTEXT: Navn)', () => {
  it('keep letters (also æ ø å), digits and single spaces, at most 12 characters', () => {
    expect(sanitizeName('Bølle')).toBe('Bølle');
    expect(sanitizeName('Åse Ægir Øl')).toBe('Åse Ægir Øl');
    expect(sanitizeName('  Fisk   Finn  ')).toBe('Fisk Finn');
    expect(sanitizeName('Rokke-Rasmus!')).toBe('RokkeRasmus');
    expect(sanitizeName('Hr. Haj 2000 <b>')).toBe('Hr Haj 2000');
    expect(sanitizeName('abcdefghijklmnopqrst')).toHaveLength(MAX_NAME_LENGTH);
    expect(sanitizeName('abcdefghijk l')).toBe('abcdefghijk');
    expect(sanitizeName('😀🙂')).toBe('');
    expect(sanitizeName('')).toBe('');
  });

  it('no name at all is undefined, so such creatures get no sign', () => {
    expect(nameOrUndefined('')).toBeUndefined();
    expect(nameOrUndefined('   ')).toBeUndefined();
    expect(nameOrUndefined(undefined)).toBeUndefined();
    expect(nameOrUndefined(' Ole ')).toBe('Ole');
  });
});

describe('NameTag (CONTEXT: Navneskilt)', () => {
  // A minimal stand-in for the DOM: the sign only needs a layer to append to and elements to switch on and off.
  type Fake = { name?: string; template: { size: number }; group: { position: THREE.Vector3; scale: THREE.Vector3; visible: boolean } };
  const creature = (name?: string): Fake => ({ name, template: { size: 4 }, group: { position: new THREE.Vector3(1, 5, 0), scale: new THREE.Vector3(1, 1, 1), visible: true } });
  const el = () => {
    const classes = new Set<string>();
    return { classes, classList: { toggle: (c: string, on: boolean) => (on ? classes.add(c) : classes.delete(c)) }, style: {} as Record<string, string>, remove: () => (el.removed = true) };
  };
  el.removed = false;

  function setup(list: Fake[]) {
    const made: Array<ReturnType<typeof el>> = [];
    const doc = globalThis as unknown as { document?: unknown };
    const saved = doc.document;
    doc.document = {
      createElement: () => {
        const e = Object.assign(el(), { append: () => undefined, setAttribute: () => undefined, className: '', textContent: '' });
        made.push(e);
        return e;
      },
    };
    const tag = new NameTag(() => list as never, () => ({ x: 100, y: 80, visible: true }));
    return { tag, made, restore: () => (doc.document = saved) };
  }

  it('is shown for 3 seconds after a tap, and not at all for a creature without a name', () => {
    const named = creature('Bølle');
    const plain = creature();
    const { tag, restore } = setup([named, plain]);
    try {
      tag.flash(plain as never);
      expect(tag.shown).toEqual([]);
      tag.flash(named as never);
      expect(tag.shown).toEqual([named]);
      tag.update(TAG_SECONDS - 0.2);
      expect(tag.shown).toEqual([named]);
      tag.update(0.3);
      tag.update(0.5); // faded out and removed
      expect(tag.shown).toEqual([]);
    } finally {
      restore();
    }
  });

  it('stays while the camera follows the creature, and goes a few seconds after it stops', () => {
    const named = creature('Pil');
    const { tag, restore } = setup([named]);
    try {
      tag.follow(named as never);
      for (let i = 0; i < 100; i++) tag.update(1);
      expect(tag.shown).toEqual([named]);
      tag.follow(null);
      tag.update(TAG_SECONDS + 0.1);
      tag.update(0.5);
      expect(tag.shown).toEqual([]);
    } finally {
      restore();
    }
  });

  it('is dropped when the creature is gone', () => {
    const named = creature('Pil');
    const list = [named];
    const { tag, restore } = setup(list);
    try {
      tag.flash(named as never);
      list.length = 0;
      tag.update(0.1);
      expect(tag.shown).toEqual([]);
    } finally {
      restore();
    }
  });
});

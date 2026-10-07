import { describe, expect, it } from 'vitest';
import { CreatureKeeper } from '../src/creature/keeper';
import { MemoryCreatureStore, type CreatureStore, type StoredCreature } from '../src/creature/store';

const rec = (i: number): StoredCreature => ({ id: `id${String(i).padStart(2, '0')}`, species: 'ray', drawing: new Blob([`png${i}`], { type: 'image/png' }), createdAt: 1000 + i });

describe('CreatureKeeper', () => {
  it('what is added is still there after "reloading" (a new keeper on the same store)', async () => {
    const store = new MemoryCreatureStore();
    const first = new CreatureKeeper(store);
    for (let i = 0; i < 3; i++) await first.add(rec(i));
    const restored = await new CreatureKeeper(store).restore();
    expect(restored.map((c) => c.id)).toEqual(['id00', 'id01', 'id02']);
    expect(await restored[1].drawing.text()).toBe('png1');
    expect(restored[1]).toMatchObject({ species: 'ray', createdAt: 1001 });
  });

  it('deleting removes it for good', async () => {
    const store = new MemoryCreatureStore();
    const keeper = new CreatureKeeper(store);
    await keeper.add(rec(1));
    await keeper.add(rec(2));
    expect(await keeper.delete('id01')).toBe(true);
    expect((await keeper.restore()).map((c) => c.id)).toEqual(['id02']);
  });

  it('restore keeps the newest 30 and cleans the surplus out of storage', async () => {
    const store = new MemoryCreatureStore();
    for (let i = 0; i < 34; i++) await store.put(rec(i));
    const restored = await new CreatureKeeper(store).restore();
    expect(restored).toHaveLength(30);
    expect(restored[0].id).toBe('id04');
    expect(await store.loadAll()).toHaveLength(30);
  });

  it('a broken store never throws: loading gives nothing, saving reports false, and the error is reported', async () => {
    const broken: CreatureStore = {
      loadAll: () => Promise.reject(new Error('blocked')),
      put: () => Promise.reject(new Error('full')),
      remove: () => Promise.reject(new Error('blocked')),
    };
    const errors: string[] = [];
    const keeper = new CreatureKeeper(broken, (what) => errors.push(what));
    expect(await keeper.restore()).toEqual([]);
    expect(await keeper.add(rec(1))).toBe(false);
    expect(await keeper.delete('x')).toBe(false);
    expect(errors).toEqual(['loading the creatures', 'saving a creature', 'deleting a creature']);
  });
});

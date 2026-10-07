import { createStore, del, entries, set } from 'idb-keyval';
import type { Species } from '../species/types';

/** CONTEXT: Dyr as it is kept on the device (DESIGN 4.3): species + the drawing as an image + creation time. */
export interface StoredCreature {
  id: string;
  species: Species;
  drawing: Blob;
  createdAt: number;
}

/** CONTEXT: Dyrelager. Where creatures are kept between visits (ADR 0002: IndexedDB on this device). */
export interface CreatureStore {
  loadAll(): Promise<StoredCreature[]>;
  put(creature: StoredCreature): Promise<void>;
  remove(id: string): Promise<void>;
}

/** The real thing: IndexedDB through idb-keyval (ADR 0004). */
export class IdbCreatureStore implements CreatureStore {
  private readonly db = createStore('akvariet', 'creatures');

  async loadAll(): Promise<StoredCreature[]> {
    return (await entries<string, StoredCreature>(this.db)).map(([, v]) => v);
  }

  async put(creature: StoredCreature): Promise<void> {
    await set(creature.id, creature, this.db);
  }

  async remove(id: string): Promise<void> {
    await del(id, this.db);
  }
}

/** In memory only: used by tests, and as a fallback when IndexedDB is unavailable (e.g. some private modes). */
export class MemoryCreatureStore implements CreatureStore {
  private readonly items = new Map<string, StoredCreature>();

  async loadAll(): Promise<StoredCreature[]> {
    return [...this.items.values()];
  }

  async put(creature: StoredCreature): Promise<void> {
    this.items.set(creature.id, creature);
  }

  async remove(id: string): Promise<void> {
    this.items.delete(id);
  }
}

/** IndexedDB when the browser has it, otherwise memory (the game still works, it just forgets on reload). */
export function createCreatureStore(): CreatureStore {
  try {
    if (typeof indexedDB === 'undefined' || indexedDB === null) return new MemoryCreatureStore();
    return new IdbCreatureStore();
  } catch {
    return new MemoryCreatureStore();
  }
}

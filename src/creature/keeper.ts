import { MAX_CREATURES, splitForCap } from './limits';
import type { CreatureStore, StoredCreature } from './store';

/**
 * Keeps the stored creatures in step with what swims in the aquarium (M4). Storage must never break the game:
 * every call swallows errors and reports them through `onError` (a full or blocked disk just means "not saved").
 */
export class CreatureKeeper {
  constructor(
    private readonly store: CreatureStore,
    private readonly onError: (what: string, error: unknown) => void = (what, e) => console.warn(`[akvariet] ${what} failed`, e),
    private readonly max = MAX_CREATURES,
  ) {}

  /** Everything saved earlier, oldest first. Anything beyond the cap is deleted (oldest first). */
  async restore(): Promise<StoredCreature[]> {
    try {
      const { keep, drop } = splitForCap(await this.store.loadAll(), this.max);
      for (const d of drop) await this.delete(d.id);
      return keep;
    } catch (e) {
      this.onError('loading the creatures', e);
      return [];
    }
  }

  async add(creature: StoredCreature): Promise<boolean> {
    try {
      await this.store.put(creature);
      return true;
    } catch (e) {
      this.onError('saving a creature', e);
      return false;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.store.remove(id);
      return true;
    } catch (e) {
      this.onError('deleting a creature', e);
      return false;
    }
  }
}

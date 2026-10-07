import type { Aquarium } from './aquarium/Aquarium';
import { blobToCanvas, canvasToBlob } from './creature/blob';
import type { Creature } from './creature/Creature';
import { CreatureKeeper } from './creature/keeper';
import { createCreatureStore } from './creature/store';
import type { Drawing } from './drawing/Drawing';
import type { Species } from './species';
import { AudioEngine } from './audio/AudioEngine';
import { AdultMode } from './ui/AdultMode';
import { DrawingPanel } from './ui/DrawingPanel';
import { SoundButton } from './ui/SoundButton';
import { SpeciesPicker } from './ui/SpeciesPicker';

/** Seconds on the transition clock when the drawing layer is removed and the picker returns. */
const PANEL_CLOSES_AT = 1.9;

/** Wires the aquarium (always running) to the HTML layers on top of it (ADR 0003) and to the saved creatures (ADR 0002). */
export class App {
  readonly picker: SpeciesPicker;
  readonly panel = new DrawingPanel();
  readonly adult: AdultMode;
  readonly audio = new AudioEngine();
  readonly soundButton: SoundButton;
  readonly keeper = new CreatureKeeper(createCreatureStore());
  /** The last creature released; also handy for tests. */
  lastRelease: { drawing: Drawing; species: Species; creature: Creature } | null = null;
  /** Resolves when the saved creatures have been put back into the water. */
  readonly restored: Promise<void>;
  private releasing = false;

  constructor(root: HTMLElement, private readonly aquarium: Aquarium) {
    this.picker = new SpeciesPicker(aquarium.pickerBubbles);
    this.adult = new AdultMode(aquarium.renderer.domElement);
    this.soundButton = new SoundButton(this.audio);
    const ui = document.createElement('div');
    ui.className = 'ui';
    ui.append(this.picker.element, this.panel.element, this.adult.element, this.soundButton.element);
    document.documentElement.dataset.view = 'aquarium';
    // Browsers only allow sound after a first tap: any tap or key press wakes the sound up.
    for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, () => this.audio.unlock(), { capture: true });
    root.append(ui);
    this.adult.setAvailable(true);

    this.picker.onPick = (species) => {
      this.picker.hide(species); // the tapped bubble pops, the other one fades away
      this.audio.pop();
      this.adult.setAvailable(false);
      // Let the pop be seen before the drawing panel slides in over it.
      window.setTimeout(() => {
        this.aquarium.setDimmed(true);
        document.documentElement.dataset.view = 'drawing';
        this.panel.open(species);
      }, 220);
    };
    this.panel.onHome = () => this.backToPicker();
    this.panel.onRelease = (drawing, species) => this.release(drawing, species);
    this.panel.onCrayon = (i) => this.audio.crayon(i);

    // Adult mode: the picker steps aside, and tapping a creature offers to delete it.
    this.adult.onChange = (on) => (on ? this.picker.hide() : this.picker.show());
    this.adult.onPick = (x, y) => this.aquarium.creatures.pick(x, y);
    this.adult.onDelete = (creature) => {
      this.aquarium.creatures.remove(creature);
      this.audio.deleted();
      void this.keeper.delete(creature.id);
    };

    // A tap on a creature in the water: it hops or somersaults for joy (not in adult mode, not while drawing).
    this.aquarium.onReact = () => this.audio.react();
    const canvas = aquarium.renderer.domElement;
    let down: { x: number; y: number; t: number } | null = null;
    canvas.addEventListener('pointerdown', (e) => (down = { x: e.clientX, y: e.clientY, t: performance.now() }));
    canvas.addEventListener('pointerup', (e) => {
      const d = down;
      down = null;
      // A real tap, not a swipe or a long press.
      if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 14 || performance.now() - d.t > 700) return;
      if (this.adult.active || this.panel.isOpen || this.releasing) return;
      const r = canvas.getBoundingClientRect();
      this.aquarium.tapAt(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1));
    });

    this.restored = this.restore();
  }

  /** Puts the saved creatures back into the aquarium (oldest first). */
  private async restore(): Promise<void> {
    const all = await this.keeper.restore();
    for (const [i, saved] of all.entries()) {
      try {
        const canvas = await blobToCanvas(saved.drawing);
        const creature = this.aquarium.creatures.spawn(canvas, saved.species, undefined, undefined, { id: saved.id, createdAt: saved.createdAt });
        // They grow into view one after another (the whole row takes at most ~2.5 s).
        creature.appearAfter(Math.min(0.15 * i, 2.5));
      } catch (e) {
        console.warn('[akvariet] a saved creature could not be shown', saved.id, e);
      }
    }
  }

  /**
   * "Slip løs" (DESIGN 3.3): the 3D body replaces the flat drawing at the same place and size, the drawing layer
   * fades out while the aquarium turns sharp, the body unfolds and swims away, then the picker returns.
   * The creature is saved, and with a full aquarium (30) the oldest one says goodbye (CONTEXT: Afsked).
   */
  private release(drawing: Drawing, species: Species): void {
    if (this.releasing) return;
    this.releasing = true;
    this.audio.release();
    for (const goodbye of this.aquarium.creatures.makeRoom(1)) void this.keeper.delete(goodbye.id);
    const creature = this.aquarium.creatures.release(drawing.canvas, species, this.panel.getTemplateRect(), this.aquarium.viewport);
    this.lastRelease = { drawing, species, creature };
    // Saving (PNG encoding) is not urgent: do it right after this click, so the transition starts without delay.
    window.setTimeout(() => {
      void canvasToBlob(creature.drawing).then((blob) => this.keeper.add({ id: creature.id, species, drawing: blob, createdAt: creature.createdAt }));
    }, 0);
    this.panel.beginRelease();
    this.aquarium.setDimmed(false);
    creature.transition?.when(PANEL_CLOSES_AT, () => {
      this.backToPicker();
      this.releasing = false;
    });
  }

  private backToPicker(): void {
    document.documentElement.dataset.view = 'aquarium';
    this.panel.close();
    this.aquarium.setDimmed(false);
    this.picker.show();
    this.adult.setAvailable(true);
  }
}

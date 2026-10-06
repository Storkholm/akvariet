import type { Aquarium } from './aquarium/Aquarium';
import type { Creature } from './creature/Creature';
import type { Drawing } from './drawing/Drawing';
import type { Species } from './species';
import { DrawingPanel } from './ui/DrawingPanel';
import { SpeciesPicker } from './ui/SpeciesPicker';

/** Seconds on the transition clock when the drawing layer is removed and the picker returns. */
const PANEL_CLOSES_AT = 1.9;

/** Wires the aquarium (always running) to the HTML layers on top of it (ADR 0003). */
export class App {
  readonly picker = new SpeciesPicker();
  readonly panel = new DrawingPanel();
  /** The last creature released (M4 stores it); also handy for tests. */
  lastRelease: { drawing: Drawing; species: Species; creature: Creature } | null = null;
  private releasing = false;

  constructor(root: HTMLElement, private readonly aquarium: Aquarium) {
    const ui = document.createElement('div');
    ui.className = 'ui';
    ui.append(this.picker.element, this.panel.element);
    root.append(ui);

    this.picker.onPick = (species) => {
      this.picker.hide();
      this.aquarium.setDimmed(true);
      this.panel.open(species);
    };
    this.panel.onHome = () => this.backToPicker();
    this.panel.onRelease = (drawing, species) => this.release(drawing, species);
  }

  /**
   * "Slip løs" (DESIGN 3.3): the 3D body replaces the flat drawing at the same place and size, the drawing layer
   * fades out while the aquarium turns sharp, the body unfolds and swims away, then the picker returns.
   */
  private release(drawing: Drawing, species: Species): void {
    if (this.releasing) return;
    this.releasing = true;
    const creature = this.aquarium.creatures.release(drawing.canvas, species, this.panel.getTemplateRect(), this.aquarium.viewport);
    this.lastRelease = { drawing, species, creature };
    this.panel.beginRelease();
    this.aquarium.setDimmed(false);
    creature.transition?.when(PANEL_CLOSES_AT, () => {
      this.backToPicker();
      this.releasing = false;
    });
  }

  private backToPicker(): void {
    this.panel.close();
    this.aquarium.setDimmed(false);
    this.picker.show();
  }
}

import type { Aquarium } from './aquarium/Aquarium';
import type { Drawing } from './drawing/Drawing';
import type { Species } from './species';
import { DrawingPanel } from './ui/DrawingPanel';
import { SpeciesPicker } from './ui/SpeciesPicker';

/** Wires the aquarium (always running) to the HTML layers on top of it (ADR 0003). */
export class App {
  readonly picker = new SpeciesPicker();
  readonly panel = new DrawingPanel();
  /** M2 only: the last drawing handed to "Slip løs" (M3 turns it into a Creature). */
  lastRelease: { drawing: Drawing; species: Species } | null = null;

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
    this.panel.onRelease = (drawing, species) => {
      // M3 builds the body and lets it swim away; for now the drawing is only kept.
      this.lastRelease = { drawing, species };
      this.backToPicker();
    };
  }

  private backToPicker(): void {
    this.panel.close();
    this.aquarium.setDimmed(false);
    this.picker.show();
  }
}

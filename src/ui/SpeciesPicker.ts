import type { PickerBubbles } from '../aquarium/PickerBubbles';
import { SPECIES, type Species } from '../species';
import { h } from './dom';

const LABELS: Record<Species, string> = { ray: 'Rokke', turtle: 'Skildpadde' };

/**
 * CONTEXT: Artsvælger. The bubbles themselves are 3D (see PickerBubbles); this is the HTML layer over them:
 * one transparent round button per bubble, so a tap, the keyboard and screen readers all work.
 */
export class SpeciesPicker {
  readonly element: HTMLElement;
  onPick?: (species: Species) => void;
  private readonly buttons = new Map<Species, HTMLButtonElement>();

  constructor(private readonly bubbles: PickerBubbles) {
    this.element = h('div', { class: 'picker' });
    for (const species of SPECIES) {
      const b = h('button', { class: 'bubble-hit', type: 'button', 'aria-label': LABELS[species] });
      b.addEventListener('click', () => this.onPick?.(species));
      this.buttons.set(species, b);
      this.element.append(b);
    }
    bubbles.onLayout = () => this.layout();
    this.layout();
  }

  /** Puts each button exactly over its bubble. */
  layout(): void {
    for (const { species, x, y, r } of this.bubbles.hitAreas()) {
      const b = this.buttons.get(species);
      if (!b) continue;
      b.style.left = `${x - r}px`;
      b.style.top = `${y - r}px`;
      b.style.width = b.style.height = `${2 * r}px`;
    }
  }

  show(): void {
    this.element.hidden = false;
    this.layout();
    this.bubbles.show();
  }

  /** `popped`: the bubble that was tapped (it pops, the others fade away). */
  hide(popped?: Species): void {
    this.element.hidden = true;
    this.bubbles.hide(popped);
  }
}

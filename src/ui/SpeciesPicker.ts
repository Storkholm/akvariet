import { TEMPLATES, type Species } from '../species';
import { h } from './dom';
import { templateThumbnail } from './thumbnail';

/**
 * CONTEXT: Artsvælger. M2 stand-in: one floating bubble per species that has a template.
 * M5 turns this into the real picker with 3D animals in bubbles.
 */
export class SpeciesPicker {
  readonly element: HTMLElement;
  onPick?: (species: Species) => void;

  constructor() {
    this.element = h('div', { class: 'picker' });
    for (const [species, template] of Object.entries(TEMPLATES)) {
      if (!template) continue;
      const bubble = h('button', { class: 'bubble', type: 'button', 'aria-label': species === 'ray' ? 'Rokke' : 'Skildpadde' }, [
        templateThumbnail(template, 120),
      ]);
      bubble.addEventListener('click', () => this.onPick?.(species as Species));
      this.element.append(bubble);
    }
  }

  show(): void {
    this.element.hidden = false;
  }

  hide(): void {
    this.element.hidden = true;
  }
}

import { h, svg } from './dom';
import { ICONS } from './icons';

/**
 * CONTEXT: Kigge-knap / tegne-knap (DESIGN 8.3). One button, always in the same place (bottom right): as an eye it folds
 * the carousel away so the aquarium can be seen freely; as a pencil it folds the carousel back.
 */
export class ViewToggle {
  readonly element: HTMLButtonElement;
  /** True while the carousel is folded away (the button is then a pencil). */
  folded = false;
  onChange?: (folded: boolean) => void;

  constructor() {
    this.element = h('button', { class: 'view-toggle', type: 'button' });
    this.element.addEventListener('click', () => this.set(!this.folded));
    this.render();
  }

  set(folded: boolean, notify = true): void {
    if (folded === this.folded) return;
    this.folded = folded;
    this.render();
    if (notify) this.onChange?.(folded);
  }

  /** Shown only where the carousel is (not while drawing, not in adult mode). */
  setAvailable(on: boolean): void {
    this.element.hidden = !on;
  }

  private render(): void {
    this.element.setAttribute('aria-label', this.folded ? 'Tegn' : 'Kig');
    this.element.dataset.mode = this.folded ? 'draw' : 'look';
    this.element.replaceChildren(svg(this.folded ? ICONS.pencil : ICONS.eye));
  }
}

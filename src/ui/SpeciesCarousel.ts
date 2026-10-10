import type { PickerBubbles } from '../aquarium/PickerBubbles';
import type { Species } from '../species';
import { h } from './dom';

const LABELS: Record<Species, string> = { ray: 'Rokke', turtle: 'Skildpadde', starfish: 'Søstjerne', seaUrchin: 'Søpindsvin', seaCucumber: 'Søpølse' };

/** A swipe only counts after this many pixels, so a tap on a bubble is never taken for a swipe (ADR 0006). */
const SWIPE_THRESHOLD_PX = 10;

/**
 * CONTEXT: Karrusel (DESIGN 8.3). The bubbles themselves are 3D (see PickerBubbles); this is the HTML layer over them:
 * a band across the screen that scrolls the row with a swipe (with speed, and a snap to a bubble), and one transparent
 * round button per bubble, so a tap, the keyboard and screen readers all work. Swipes outside the band are not caught
 * here, so they move the camera instead.
 */
export class SpeciesCarousel {
  readonly element: HTMLElement;
  onPick?: (species: Species, index: number) => void;
  private readonly buttons: HTMLButtonElement[] = [];
  private pointer: { id: number; startX: number; lastX: number; t: number; vx: number; swiping: boolean } | null = null;
  private justSwiped = false;

  constructor(private readonly bubbles: PickerBubbles, slots: readonly Species[]) {
    this.element = h('div', { class: 'picker carousel' });
    slots.forEach((species, i) => {
      const b = h('button', { class: 'bubble-hit', type: 'button', 'aria-label': LABELS[species] });
      b.addEventListener('click', () => {
        if (this.justSwiped) return; // the end of a swipe is not a tap
        if (bubbles.folded) return;
        this.onPick?.(species, i);
      });
      b.addEventListener('focus', () => bubbles.scroll.scrollTo(i)); // keyboard: bring the bubble into view
      this.buttons.push(b);
      this.element.append(b);
    });
    this.element.addEventListener('pointerdown', this.onDown);
    this.element.addEventListener('pointermove', this.onMove);
    this.element.addEventListener('pointerup', this.onUp);
    this.element.addEventListener('pointercancel', this.onUp);
    bubbles.onLayout = () => this.layout();
    this.layout();
  }

  /** Puts the band over the row and each button exactly over its bubble. */
  layout(): void {
    const g = this.bubbles.geometry;
    const el = this.element.style;
    el.top = `${g.bandTop}px`;
    el.height = `${g.bandHeight}px`;
    const folded = this.bubbles.folded;
    for (const { index, x, y, r } of this.bubbles.hitAreas()) {
      const b = this.buttons[index];
      if (!b) continue;
      b.style.left = `${x - r}px`;
      b.style.top = `${y - r - g.bandTop}px`;
      b.style.width = b.style.height = `${2 * r}px`;
      b.disabled = folded;
      b.tabIndex = folded ? -1 : 0;
    }
    // While the row is folded away the band must not swallow swipes meant for the camera.
    this.element.classList.toggle('inert', folded);
  }

  private readonly onDown = (e: PointerEvent): void => {
    if (this.pointer || this.bubbles.folded) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    this.justSwiped = false;
    this.pointer = { id: e.pointerId, startX: e.clientX, lastX: e.clientX, t: e.timeStamp, vx: 0, swiping: false };
  };

  private readonly onMove = (e: PointerEvent): void => {
    const p = this.pointer;
    if (!p || e.pointerId !== p.id) return;
    if (!p.swiping) {
      if (Math.abs(e.clientX - p.startX) < SWIPE_THRESHOLD_PX) return;
      p.swiping = true;
      this.element.setPointerCapture?.(e.pointerId);
      this.bubbles.scroll.startDrag();
      // What was moved before the threshold counts too.
      this.bubbles.scroll.dragBy(e.clientX - p.startX);
      p.lastX = e.clientX;
      p.t = e.timeStamp;
      return;
    }
    const dt = Math.max(1, e.timeStamp - p.t) / 1000;
    const dx = e.clientX - p.lastX;
    p.vx = p.vx * 0.6 + (dx / dt) * 0.4;
    p.lastX = e.clientX;
    p.t = e.timeStamp;
    this.bubbles.scroll.dragBy(dx);
    this.layout();
  };

  private readonly onUp = (e: PointerEvent): void => {
    const p = this.pointer;
    if (!p || e.pointerId !== p.id) return;
    this.pointer = null;
    if (!p.swiping) return;
    // A finger that rested before it lifted does not fling.
    const fresh = e.timeStamp - p.t < 90;
    this.bubbles.scroll.release(fresh ? p.vx : 0);
    this.justSwiped = true;
    window.setTimeout(() => (this.justSwiped = false), 50);
  };

  show(): void {
    this.element.hidden = false;
    this.bubbles.show();
    this.layout();
  }

  /** `popped`: the bubble that was tapped (it pops, the others fade away); its index, or its species. */
  hide(popped?: Species | number): void {
    this.element.hidden = true;
    this.bubbles.hide(popped);
  }

  /** CONTEXT: Kigge-knap – fold the row away / bring it back. */
  setFolded(on: boolean): void {
    this.bubbles.setFolded(on);
    this.layout();
  }
}

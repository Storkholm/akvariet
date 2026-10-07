import type { Creature } from '../creature/Creature';
import { h, svg } from './dom';
import { ICONS } from './icons';

/** Seconds the lock must be held (DESIGN 3.5) – long enough that a child will not do it by accident. */
export const HOLD_SECONDS = 3;

/**
 * CONTEXT: Voksentilstand. A small, discreet lock in a corner: hold it for 3 seconds and a visible frame appears.
 * While it is on, tapping a creature asks "Slet dette dyr?". Tapping the lock again leaves the mode.
 */
export class AdultMode {
  readonly element: HTMLElement;
  active = false;
  onChange?: (active: boolean) => void;
  /** Which creature is under this point (normalised device coordinates)? Set by App. */
  onPick?: (ndcX: number, ndcY: number) => Creature | null;
  onDelete?: (creature: Creature) => void;

  private readonly lock: HTMLButtonElement;
  private readonly frame: HTMLElement;
  private readonly dialog: HTMLElement;
  private readonly thumb: HTMLCanvasElement;
  private holdTimer: number | undefined;
  private pending: Creature | null = null;
  private justActivated = false;

  constructor(private readonly aquariumCanvas: HTMLElement) {
    const ring = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    ring.setAttribute('viewBox', '0 0 48 48');
    ring.classList.add('lock-ring');
    ring.innerHTML = '<circle cx="24" cy="24" r="21" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" pathLength="100" />';
    this.lock = h('button', { class: 'adult-lock', type: 'button', 'aria-label': 'Voksentilstand (hold nede)' }, [ring, svg(ICONS.lock)]);
    this.frame = h('div', { class: 'adult-frame', hidden: true });
    this.thumb = h('canvas', { class: 'adult-thumb', width: 160, height: 160 });
    const no = h('button', { class: 'confirm-btn no', type: 'button', 'aria-label': 'Nej' }, [svg(ICONS.no)]);
    const yes = h('button', { class: 'confirm-btn yes', type: 'button', 'aria-label': 'Ja' }, [svg(ICONS.yes)]);
    this.dialog = h('div', { class: 'confirm adult-confirm', hidden: true }, [
      h('div', { class: 'confirm-box', role: 'dialog' }, [this.thumb, h('p', {}, ['Slet dette dyr?']), h('div', { class: 'confirm-actions' }, [no, yes])]),
    ]);
    this.element = h('div', { class: 'adult' }, [this.frame, this.lock, this.dialog]);

    this.lock.addEventListener('pointerdown', this.onLockDown);
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) this.lock.addEventListener(ev, this.cancelHold);
    this.lock.addEventListener('contextmenu', (e) => e.preventDefault());
    this.lock.addEventListener('click', () => {
      // A normal tap leaves the mode; the click that ends the long press must not leave it again at once.
      if (this.justActivated) this.justActivated = false;
      else if (this.active) this.set(false);
    });
    no.addEventListener('click', () => this.closeDialog());
    yes.addEventListener('click', () => {
      const c = this.pending;
      this.closeDialog();
      if (c) this.onDelete?.(c);
    });
    this.aquariumCanvas.addEventListener('pointerup', this.onCanvasTap);
  }

  /** The lock only shows where it makes sense (not while drawing or while a creature is being released). */
  setAvailable(on: boolean): void {
    this.lock.hidden = !on;
    if (!on && this.active) this.set(false);
  }

  set(active: boolean): void {
    this.active = active;
    this.frame.hidden = !active;
    this.lock.classList.toggle('on', active);
    this.lock.replaceChildren(this.lock.querySelector('.lock-ring') as Node, svg(active ? ICONS.unlock : ICONS.lock));
    this.closeDialog();
    this.onChange?.(active);
  }

  private readonly onLockDown = (e: PointerEvent): void => {
    this.justActivated = false; // a stale flag from an earlier long press must not swallow this tap
    if (this.active) return; // leaving is a plain tap (see the click handler)
    e.preventDefault();
    this.lock.classList.add('holding');
    window.clearTimeout(this.holdTimer);
    this.holdTimer = window.setTimeout(() => {
      this.lock.classList.remove('holding');
      this.justActivated = true;
      this.set(true);
    }, HOLD_SECONDS * 1000);
  };

  private readonly cancelHold = (): void => {
    window.clearTimeout(this.holdTimer);
    this.lock.classList.remove('holding');
  };

  private readonly onCanvasTap = (e: PointerEvent): void => {
    if (!this.active || this.pending) return;
    const r = this.aquariumCanvas.getBoundingClientRect();
    const creature = this.onPick?.(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1));
    if (!creature) return;
    this.pending = creature;
    const ctx = this.thumb.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, 160, 160);
      ctx.drawImage(creature.drawing, 0, 0, 160, 160);
    }
    this.dialog.hidden = false;
  };

  private closeDialog(): void {
    this.pending = null;
    this.dialog.hidden = true;
  }
}

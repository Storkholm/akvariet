import { h, svg } from '../ui/dom';
import { ICONS } from '../ui/icons';
import type { P2 } from './slashGeometry';
import { HOLD_SECONDS, SamuraiSession } from './session';

/** The slash trail fades away in this many seconds (ADR 0008). */
export const TRAIL_SECONDS = 0.3;
/** The swipe's direction is taken from a point at least this far back along the trail (px), so a jittery finger gives a steady line. */
const LINE_BASELINE_PX = 36;

interface TrailPoint {
  x: number;
  y: number;
  t: number;
}

/**
 * CONTEXT: Samurai-mode (DESIGN 8.7, ADR 0008). A sword button in the top left corner: hold it for 2 seconds (a ring fills) and
 * the mode begins – a thin red-and-gold frame, and a swipe on the water is a sword cut instead of moving the camera. A tap
 * on the sword leaves the mode, and so does a minute without a cut. This class is the screen part (button, frame, trail,
 * swipe); the rules are in `SamuraiSession` and what a cut does is decided by whoever listens to `onSlash`.
 */
export class SamuraiMode {
  readonly element: HTMLElement;
  readonly session = new SamuraiSession();
  /** The mode began or ended. */
  onChange?: (active: boolean) => void;
  /** A swipe segment a→b (pixels on the canvas); `from` is a point further back that gives the line its direction. Returns how many creatures were cut. */
  /** A finger went down on the water: a new swipe begins. */
  onSwipeStart?: () => void;
  onSlash?: (a: P2, b: P2, from: P2) => number;
  /** The count of cut creatures just went up. */
  onCounted?: () => void;

  private readonly button: HTMLButtonElement;
  private readonly frame: HTMLElement;
  private readonly trail: HTMLCanvasElement;
  private holdTimer: number | undefined;
  private justActivated = false;
  private tickTimer: number | undefined;
  private lastTick = 0;
  private points: TrailPoint[] = [];
  /** The most points the trail has had at once since the mode began (for tests: the trail itself fades in 0.3 s). */
  trailPeak = 0;
  private pointer: number | null = null;
  private raf = 0;

  constructor(private readonly canvas: HTMLElement) {
    const ring = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    ring.setAttribute('viewBox', '0 0 48 48');
    ring.classList.add('sword-ring');
    ring.innerHTML = '<circle cx="24" cy="24" r="21" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" pathLength="100" />';
    this.button = h('button', { class: 'samurai-btn', type: 'button', 'aria-label': 'Sværd (hold nede)' }, [ring, svg(ICONS.sword)]);
    this.frame = h('div', { class: 'samurai-frame', hidden: true });
    this.trail = h('canvas', { class: 'slash-trail' });
    this.element = h('div', { class: 'samurai' }, [this.frame, this.trail, this.button]);

    this.button.addEventListener('pointerdown', this.onButtonDown);
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) this.button.addEventListener(ev, this.cancelHold);
    this.button.addEventListener('contextmenu', (e) => e.preventDefault());
    this.button.addEventListener('click', () => {
      // A tap on the sword leaves the mode; the click that ends the long press must not leave it again at once.
      if (this.justActivated) this.justActivated = false;
      else if (this.session.active) this.set(false);
    });
    canvas.addEventListener('pointerdown', this.onDown);
    canvas.addEventListener('pointermove', this.onMove);
    canvas.addEventListener('pointerup', this.onUp);
    canvas.addEventListener('pointercancel', this.onUp);
  }

  get active(): boolean {
    return this.session.active;
  }

  /** The sword only shows where it makes sense (not while drawing, and not in adult mode). */
  setAvailable(on: boolean): void {
    this.button.hidden = !on;
    if (!on && this.session.active) this.set(false);
  }

  set(active: boolean): void {
    if (active === this.session.active) return;
    if (active) this.session.start();
    else this.session.end();
    this.frame.hidden = !active;
    this.button.classList.toggle('on', active);
    this.points = [];
    this.trailPeak = 0;
    this.pointer = null;
    this.clearTrail();
    window.clearInterval(this.tickTimer);
    if (active) {
      this.lastTick = performance.now();
      this.tickTimer = window.setInterval(() => {
        const now = performance.now();
        const ended = this.session.tick((now - this.lastTick) / 1000);
        this.lastTick = now;
        if (ended) this.set(false);
      }, 250);
    }
    this.onChange?.(active);
  }

  private readonly onButtonDown = (e: PointerEvent): void => {
    this.justActivated = false;
    if (this.session.active) return; // leaving is a plain tap (see the click handler)
    e.preventDefault();
    this.button.classList.add('holding');
    window.clearTimeout(this.holdTimer);
    this.holdTimer = window.setTimeout(() => {
      this.button.classList.remove('holding');
      this.justActivated = true;
      this.set(true);
    }, HOLD_SECONDS * 1000);
  };

  private readonly cancelHold = (): void => {
    window.clearTimeout(this.holdTimer);
    this.button.classList.remove('holding');
  };

  // --- the swipe ---

  private local(e: PointerEvent): P2 {
    const r = this.canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  private readonly onDown = (e: PointerEvent): void => {
    if (!this.session.active) return;
    if (this.pointer !== null) {
      // A second finger is a pinch (the camera's), not a sword cut.
      this.pointer = null;
      this.points = [];
      return;
    }
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    this.pointer = e.pointerId;
    const [x, y] = this.local(e);
    this.points = [{ x, y, t: performance.now() }];
    this.onSwipeStart?.();
  };

  private readonly onMove = (e: PointerEvent): void => {
    if (!this.session.active || e.pointerId !== this.pointer) return;
    if (e.pointerType === 'mouse' && e.buttons === 0) return;
    const events = e.getCoalescedEvents?.() ?? [];
    for (const ev of events.length ? events : [e]) {
      const [x, y] = this.local(ev);
      const prev = this.points[this.points.length - 1];
      if (!prev || (prev.x === x && prev.y === y)) continue;
      this.points.push({ x, y, t: performance.now() });
      this.trailPeak = Math.max(this.trailPeak, this.points.length);
      const cut = this.onSlash?.([prev.x, prev.y], [x, y], this.lineStart(x, y)) ?? 0;
      if (cut > 0) {
        this.session.recordHack(cut);
        this.onCounted?.();
      }
    }
    this.startTrail();
  };

  private readonly onUp = (e: PointerEvent): void => {
    if (e.pointerId === this.pointer) this.pointer = null;
  };

  /** A point on the trail at least LINE_BASELINE_PX behind (x, y): the start of the line a cut follows. */
  private lineStart(x: number, y: number): P2 {
    for (let i = this.points.length - 2; i >= 0; i--) {
      const p = this.points[i];
      if (Math.hypot(p.x - x, p.y - y) >= LINE_BASELINE_PX) return [p.x, p.y];
    }
    const first = this.points[0];
    return [first.x, first.y];
  }

  // --- the glowing trail ---

  private startTrail(): void {
    if (!this.raf) this.raf = requestAnimationFrame(this.drawTrail);
  }

  private readonly drawTrail = (): void => {
    this.raf = 0;
    const now = performance.now();
    this.points = this.points.filter((p, i, all) => now - p.t < TRAIL_SECONDS * 1000 || (i === all.length - 1 && this.pointer !== null));
    const r = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (this.trail.width !== Math.round(r.width * dpr)) {
      this.trail.width = Math.round(r.width * dpr);
      this.trail.height = Math.round(r.height * dpr);
    }
    const ctx = this.trail.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, r.width, r.height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = 1; i < this.points.length; i++) {
      const a = this.points[i - 1];
      const b = this.points[i];
      const life = Math.max(0, 1 - (now - b.t) / (TRAIL_SECONDS * 1000));
      ctx.strokeStyle = `rgba(255, 244, 214, ${0.25 * life})`;
      ctx.lineWidth = 16 * life + 2;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.95 * life})`;
      ctx.lineWidth = 4 * life + 1;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    if (this.points.length > 1) this.raf = requestAnimationFrame(this.drawTrail);
  };

  private clearTrail(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.trail.getContext('2d')?.clearRect(0, 0, this.trail.width, this.trail.height);
  }

  /** The trail's points that are still alive (for tests). */
  get trailLength(): number {
    return this.points.length;
  }
}

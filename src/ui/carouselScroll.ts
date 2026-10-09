const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

export interface CarouselGeometry {
  /** Bubble radius, CSS px. */
  r: number;
  /** Distance between two bubble centres. */
  spacing: number;
  /** Vertical centre of the row. */
  cy: number;
  /** The band the carousel owns on screen (swipes inside it scroll the carousel; outside they move the camera). */
  bandTop: number;
  bandHeight: number;
  /** How many bubbles are seen at once (3 on a tablet, 1½ on a phone held upright). */
  visible: number;
}

/** DESIGN 8.3: about three bubbles at a time in landscape, one and a half on an upright phone. */
export function carouselGeometry(width: number, height: number): CarouselGeometry {
  const portrait = height > width * 1.05;
  const visible = portrait ? 1.5 : 3;
  const spacing = width / visible;
  const r = Math.min(0.42 * spacing, 0.17 * height);
  const cy = 0.5 * height;
  const pad = 0.05 * height;
  return { r, spacing, cy, bandTop: cy - r - pad, bandHeight: 2 * r + 2 * pad, visible };
}

/**
 * CONTEXT: Karrusel – the scrolling model behind the bubble row: drag with the finger, fling with speed, and always
 * come to rest with one bubble in the middle ("snap"). With fewer bubbles than fit on the screen they just sit
 * centred and do not scroll. Pure logic.
 */
export class CarouselScroll {
  /** Scroll offset in px: the content's left edge is at −x on screen. */
  x = 0;
  count = 0;
  spacing = 1;
  viewport = 1;
  private target = 0;
  private dragging = false;

  configure(count: number, spacing: number, viewport: number): void {
    this.count = count;
    this.spacing = spacing;
    this.viewport = viewport;
    this.x = this.clampX(this.x);
    this.target = this.snapTo(this.x);
  }

  get contentWidth(): number {
    return this.count * this.spacing;
  }

  get scrollable(): boolean {
    return this.contentWidth > this.viewport + 0.5;
  }

  private get max(): number {
    return this.scrollable ? this.contentWidth - this.viewport : (this.contentWidth - this.viewport) / 2;
  }

  private get min(): number {
    return this.scrollable ? 0 : this.max;
  }

  private clampX(x: number): number {
    return clamp(x, this.min, this.max);
  }

  /** Screen x of the centre of bubble i. */
  itemX(i: number): number {
    return this.spacing * (i + 0.5) - this.x;
  }

  /** The scroll offset that puts bubble i in the middle (as far as the ends allow). */
  offsetFor(i: number): number {
    return this.clampX(this.spacing * (i + 0.5) - this.viewport / 2);
  }

  /** The index of the bubble nearest the middle of the screen. */
  nearest(): number {
    return clamp(Math.round((this.x + this.viewport / 2) / this.spacing - 0.5), 0, Math.max(0, this.count - 1));
  }

  private snapTo(x: number): number {
    if (!this.scrollable) return this.min;
    let best = this.offsetFor(0);
    for (let i = 1; i < this.count; i++) {
      const o = this.offsetFor(i);
      if (Math.abs(o - x) < Math.abs(best - x)) best = o;
    }
    return best;
  }

  /** A finger is down: the carousel follows it exactly (with a little give past the ends). */
  startDrag(): void {
    this.dragging = true;
  }

  /** The finger moved by dx px (right = positive): the content moves with it. */
  dragBy(dx: number): void {
    if (!this.scrollable) return;
    // The content moves with the finger; past the ends it gives only a third of the way (and springs back on release).
    const delta = -dx;
    const pushingOut = (this.x <= this.min && delta < 0) || (this.x >= this.max && delta > 0);
    const next = this.x + delta * (pushingOut ? 0.33 : 1);
    this.x = next;
    this.target = this.x;
  }

  /** The finger lifted at speed vx px/s (right = positive): glide on, then snap to the nearest bubble. */
  release(vx: number): void {
    this.dragging = false;
    if (!this.scrollable) return;
    // A fling carries about a third of a second of the finger's speed – and always lands on a bubble.
    this.target = this.snapTo(this.clampX(this.x - vx * 0.3));
  }

  /** Scroll to bubble i (keyboard focus, a tap on a half-visible bubble). */
  scrollTo(i: number): void {
    if (!this.scrollable) return;
    this.target = this.offsetFor(clamp(i, 0, this.count - 1));
  }

  get isDragging(): boolean {
    return this.dragging;
  }

  /** Returns true while it is still moving. */
  update(dt: number): boolean {
    if (this.dragging) return true;
    if (!this.scrollable) {
      this.x = this.min;
      return false;
    }
    const before = this.x;
    // Critically damped approach to the target: quick, no overshoot.
    const k = 1 - Math.exp(-11 * dt);
    this.x += (this.target - this.x) * k;
    if (Math.abs(this.target - this.x) < 0.05) this.x = this.target;
    return this.x !== before;
  }
}

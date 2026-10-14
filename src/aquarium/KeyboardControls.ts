import type { CameraRig } from './cameraRig';

/** How fast the keys slide the camera, in screen heights per second (a quarter of the picture per second at zoom 1 and 2.5). */
const PAN_SCREENS_PER_SECOND = 0.55;
/** Zoom keys: this many times per second while held. */
const ZOOM_PER_SECOND = 1.8;

/** Keys that move the camera: arrows and WASD; + / − (and =) zoom; Home puts the camera back. */
const PAN_KEYS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, 1],
  ArrowDown: [0, -1],
  a: [-1, 0],
  d: [1, 0],
  w: [0, 1],
  s: [0, -1],
};

export interface KeyboardHost {
  worldPerPixel(zoom: number): number;
  /** Height of the picture in pixels. */
  height(): number;
  /** True while the keys belong to something else (the drawing panel, a text field, a dialog). */
  blocked(): boolean;
  /** Is the species carousel on screen? Then ← and → scroll it instead of moving the camera (the arrows/WASD up and down still move the camera). */
  carouselShown(): boolean;
  stepCarousel(dir: 1 | -1): void;
  /** The camera was moved by hand: following stops. */
  onMoved(): void;
}

/**
 * CONTEXT: Piletaster (ADR 0013). On a computer the aquarium can be explored with the keyboard: arrows or W A S D slide the camera,
 * + and − zoom, Home brings it back. While the species carousel is shown, ← → (and A D) scroll the carousel; WASD's W and S and
 * ↑ ↓ still move the camera. Time passes through `update`, so the movement is smooth and testable.
 */
export class KeyboardControls {
  private readonly down = new Set<string>();
  private holding = false;

  constructor(
    private readonly rig: CameraRig,
    private readonly host: KeyboardHost,
    target: EventTarget = window,
  ) {
    target.addEventListener('keydown', this.onKeyDown as EventListener);
    target.addEventListener('keyup', this.onKeyUp as EventListener);
    if (typeof window !== 'undefined') window.addEventListener('blur', this.releaseAll);
  }

  private static key(e: KeyboardEvent): string {
    return e.key.length === 1 ? e.key.toLowerCase() : e.key;
  }

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (this.host.blocked()) return;
    const target = e.target as { isContentEditable?: boolean; tagName?: string } | null;
    if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName ?? ''))) return;
    const k = KeyboardControls.key(e);
    const isLR = k === 'ArrowLeft' || k === 'ArrowRight' || k === 'a' || k === 'd';
    if (isLR && this.host.carouselShown()) {
      // (A button with focus keeps its own keys: Space and Enter; the arrows scroll the row.)
      if (!e.repeat) this.host.stepCarousel(k === 'ArrowLeft' || k === 'a' ? -1 : 1);
      e.preventDefault();
      return;
    }
    if (k in PAN_KEYS || k === '+' || k === '=' || k === '-' || k === '_') {
      this.down.add(k);
      e.preventDefault();
      return;
    }
    if (k === 'Home' && !e.repeat) {
      this.host.onMoved();
      this.rig.grab();
      this.rig.reset();
      e.preventDefault();
    }
  };

  private readonly onKeyUp = (e: KeyboardEvent): void => {
    this.down.delete(KeyboardControls.key(e));
  };

  private readonly releaseAll = (): void => {
    this.down.clear();
  };

  /** True while a camera key is held. */
  get active(): boolean {
    return this.down.size > 0;
  }

  update(dt: number): void {
    if (this.down.size === 0) {
      this.holding = false;
      return;
    }
    if (this.host.blocked()) {
      this.down.clear();
      return;
    }
    let dx = 0;
    let dy = 0;
    let zoom = 0;
    for (const k of this.down) {
      const v = PAN_KEYS[k];
      if (v) {
        dx += v[0];
        dy += v[1];
      } else if (k === '+' || k === '=') zoom += 1;
      else zoom -= 1;
    }
    if (dx === 0 && dy === 0 && zoom === 0) return;
    this.host.onMoved();
    // Take hold of the camera when the key goes down, not every frame (that would also cancel the easing each time).
    if (!this.holding) this.rig.grab();
    this.holding = true;
    if (zoom !== 0) this.rig.zoomBy(Math.exp(zoom * Math.log(ZOOM_PER_SECOND) * dt));
    if (dx !== 0 || dy !== 0) {
      const step = PAN_SCREENS_PER_SECOND * this.host.height() * this.host.worldPerPixel(this.rig.zoom) * dt;
      const len = Math.hypot(dx, dy);
      this.rig.panBy((dx / len) * step, (dy / len) * step);
    }
  }

  dispose(target: EventTarget = window): void {
    target.removeEventListener('keydown', this.onKeyDown as EventListener);
    target.removeEventListener('keyup', this.onKeyUp as EventListener);
    if (typeof window !== 'undefined') window.removeEventListener('blur', this.releaseAll);
  }
}

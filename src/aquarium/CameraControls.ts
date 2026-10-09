import type { CameraRig } from './cameraRig';

/** A touch counts as a drag only after this many pixels (ADR 0006), so a tap and a drag are never mixed up. */
export const DRAG_THRESHOLD_PX = 10;
/** A tap is a short touch that stays put. */
export const TAP_MAX_MS = 700;
/** Two taps this close in time (from the first finger lifting to the second landing) and in space are a double tap. */
export const DOUBLE_TAP_MS = 450;
export const DOUBLE_TAP_PX = 44;

interface Pointer {
  startX: number;
  startY: number;
  x: number;
  y: number;
  t0: number;
}

export type GestureResult = 'tap' | 'drag' | 'other';

/** The state machine behind the gestures: no DOM, so the tap/drag/pinch rules can be tested directly. */
export class GestureTracker {
  private readonly pointers = new Map<number, Pointer>();
  /** A second finger has been down since the first one landed: this is no tap and no single-finger drag any more. */
  private multi = false;
  private dragging = false;
  private lastTap: { x: number; y: number; t: number } | null = null;
  private pinchDistance = 0;

  onDragStart?: () => void;
  /** dx, dy in pixels since the last move; `fingers` is 1 for a swipe, 2 for a pinch (then also `scale` and the midpoint move). */
  onMove?: (dx: number, dy: number, scale: number, fingers: number) => void;
  onDragEnd?: (vx: number, vy: number) => void;
  onTap?: (x: number, y: number) => void;
  onDoubleTap?: (x: number, y: number) => void;
  onDown?: () => void;

  private vx = 0;
  private vy = 0;
  private lastMoveT = 0;

  get active(): boolean {
    return this.pointers.size > 0;
  }

  down(id: number, x: number, y: number, t: number): void {
    if (this.pointers.size === 0) {
      this.multi = false;
      this.dragging = false;
      this.vx = this.vy = 0;
    } else {
      this.multi = true;
    }
    this.pointers.set(id, { startX: x, startY: y, x, y, t0: t });
    this.onDown?.();
    if (this.pointers.size === 2) {
      this.vx = this.vy = 0;
      this.pinchDistance = this.distance();
      if (!this.dragging) {
        this.dragging = true;
        this.onDragStart?.();
      }
    }
  }

  move(id: number, x: number, y: number, t: number): void {
    const p = this.pointers.get(id);
    if (!p) return;
    const dx = x - p.x;
    const dy = y - p.y;
    p.x = x;
    p.y = y;
    if (this.pointers.size >= 2) {
      const d = this.distance();
      const scale = this.pinchDistance > 0 ? d / this.pinchDistance : 1;
      this.pinchDistance = d;
      // The middle between the fingers moves the picture too (each finger contributes half of its own move).
      this.onMove?.(dx / 2, dy / 2, scale, 2);
      return;
    }
    if (!this.dragging) {
      if (Math.hypot(x - p.startX, y - p.startY) < DRAG_THRESHOLD_PX) return;
      this.dragging = true;
      this.onDragStart?.();
      // The movement before the threshold counts too, so the picture does not jump behind the finger.
      this.onMove?.(x - p.startX, y - p.startY, 1, 1);
      this.lastMoveT = t;
      return;
    }
    // (At least 8 ms: several moves handled in the same frame must not look infinitely fast.)
    const dt = Math.max(8, t - this.lastMoveT) / 1000;
    this.lastMoveT = t;
    this.vx = this.vx * 0.6 + (dx / dt) * 0.4;
    this.vy = this.vy * 0.6 + (dy / dt) * 0.4;
    this.onMove?.(dx, dy, 1, 1);
  }

  up(id: number, t: number): GestureResult {
    const p = this.pointers.get(id);
    if (!p) return 'other';
    this.pointers.delete(id);
    if (this.pointers.size > 0) {
      // One finger of a pinch lifted: the other carries on as a swipe from here without a jump.
      return 'other';
    }
    if (this.dragging) {
      this.dragging = false;
      // A finger that rested before lifting does not fling.
      const fresh = t - this.lastMoveT < 90;
      this.onDragEnd?.(fresh ? this.vx : 0, fresh ? this.vy : 0);
      return 'drag';
    }
    if (this.multi || t - p.t0 > TAP_MAX_MS || Math.hypot(p.x - p.startX, p.y - p.startY) >= DRAG_THRESHOLD_PX) return 'other';
    this.onTap?.(p.x, p.y);
    const prev = this.lastTap;
    if (prev && p.t0 - prev.t <= DOUBLE_TAP_MS && Math.hypot(p.x - prev.x, p.y - prev.y) <= DOUBLE_TAP_PX) {
      this.lastTap = null;
      this.onDoubleTap?.(p.x, p.y);
    } else {
      this.lastTap = { x: p.x, y: p.y, t };
    }
    return 'tap';
  }

  cancel(id: number): void {
    const was = this.pointers.delete(id);
    if (was && this.pointers.size === 0 && this.dragging) {
      this.dragging = false;
      this.onDragEnd?.(0, 0);
    }
  }

  private distance(): number {
    const [a, b] = [...this.pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }
}

export interface ControlsHost {
  /** World units per screen pixel at the middle of the aquarium at zoom 1 (changes with the screen and the zoom). */
  worldPerPixel(zoom: number): number;
}

/**
 * Touch, pen and mouse on the aquarium (ADR 0006): one finger (or the mouse) slides the camera, two fingers (or the
 * wheel) zoom, a short tap is a tap, two taps in a row are a double tap. Everything is Pointer Events, so the three
 * kinds of input behave alike.
 */
export class CameraControls {
  readonly tracker = new GestureTracker();
  /** Off while something else owns the aquarium (e.g. samurai mode later). Pinch/wheel zoom can still be allowed. */
  dragEnabled = true;
  onTap?: (x: number, y: number) => void;
  onDoubleTap?: (x: number, y: number) => void;
  /** The camera was moved by hand (a swipe, not a tap): following stops. */
  onSwipe?: () => void;

  constructor(
    private readonly canvas: HTMLElement,
    private readonly rig: CameraRig,
    private readonly host: ControlsHost,
  ) {
    const t = this.tracker;
    t.onDown = () => {
      this.rig.grab();
    };
    t.onDragStart = () => {
      this.rig.dragging = true;
      this.onSwipe?.();
      this.rig.grab();
    };
    t.onMove = (dx, dy, scale, fingers) => {
      if (fingers === 1 && !this.dragEnabled) return;
      const upp = this.host.worldPerPixel(this.rig.zoom);
      if (fingers === 2 && scale !== 1) this.rig.zoomBy(scale);
      this.rig.panBy(-dx * upp, dy * upp);
    };
    t.onDragEnd = (vx, vy) => {
      this.rig.dragging = false;
      const upp = this.host.worldPerPixel(this.rig.zoom);
      if (Math.hypot(vx, vy) > 120) this.rig.fling(-vx * upp * 0.6, vy * upp * 0.6);
    };
    t.onTap = (x, y) => this.onTap?.(x, y);
    t.onDoubleTap = (x, y) => this.onDoubleTap?.(x, y);

    canvas.addEventListener('pointerdown', this.onDown);
    canvas.addEventListener('pointermove', this.onMove);
    canvas.addEventListener('pointerup', this.onUp);
    canvas.addEventListener('pointercancel', this.onCancel);
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
  }

  private readonly onDown = (e: PointerEvent): void => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    this.canvas.setPointerCapture?.(e.pointerId);
    // Times are taken when the events are handled, not when the screen was touched: a game that is busy for a moment
    // (a heavy frame) gets a touch and its release back to back, and that is still a quick tap.
    this.tracker.down(e.pointerId, e.clientX, e.clientY, performance.now());
  };

  private readonly onMove = (e: PointerEvent): void => {
    // Only a mouse with a button held (or a finger/pen that is down) moves anything.
    if (e.pointerType === 'mouse' && e.buttons === 0) return;
    const events = e.getCoalescedEvents?.() ?? [];
    for (const ev of events.length ? events : [e]) this.tracker.move(e.pointerId, ev.clientX, ev.clientY, performance.now());
  };

  private readonly onUp = (e: PointerEvent): void => {
    this.tracker.up(e.pointerId, performance.now());
  };

  private readonly onCancel = (e: PointerEvent): void => {
    this.tracker.cancel(e.pointerId);
  };

  private readonly onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    this.rig.grab();
    // Two-finger trackpad pinch arrives as ctrl+wheel with small deltas; a mouse wheel as larger steps.
    const k = e.ctrlKey ? 0.01 : 0.0015;
    this.rig.zoomBy(Math.exp(-e.deltaY * k));
  };
}

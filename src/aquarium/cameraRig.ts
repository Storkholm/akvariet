const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export interface CameraFit {
  fov: number;
  distance: number;
  height: number;
  lookY: number;
}

/**
 * Landscape shows the wide reef; portrait must still work (DESIGN 2), so it
 * uses a wider fov, a narrower slice of the reef and a higher, steeper view.
 */
export function fitCamera(aspect: number): CameraFit {
  const portrait = 1 - clamp01((aspect - 0.6) / 0.7); // 0 = landscape, 1 = portrait
  const fov = lerp(45, 55, portrait);
  const visibleWidth = lerp(25, 10, portrait);
  const distance = visibleWidth / 2 / (Math.tan((fov * Math.PI) / 360) * aspect);
  return { fov, distance, height: lerp(3.8, 3.2, portrait), lookY: lerp(3.3, 1.9, portrait) };
}

export const ZOOM_MIN = 1;
export const ZOOM_MAX = 2.5;
/** ADR 0006: after this many seconds without touch the camera glides back to the middle. */
export const IDLE_RETURN_SECONDS = 30;
/** While following a creature the camera lets go after this long without touch (then it returns to the middle). */
export const FOLLOW_TIMEOUT_SECONDS = 120;
/** How far the camera may move up/down from its resting height (world units): never under the sand, never far above. */
export const Y_RANGE: readonly [number, number] = [-1.8, 3];
/** The zoom a followed creature is shown at (a creature fills a good part of the screen). */
export const FOLLOW_ZOOM = 2;

export interface FollowPoint {
  x: number;
  y: number;
}

/**
 * CONTEXT: Kamera (ADR 0006). The pose of the camera that the child can move: slide along the aquarium (and a little
 * up/down), zoom 1×–2.5×, follow a creature, and glide back to the middle after 30 s without touch. Pure logic: the
 * `current` pose eases towards a `target`; the target is always kept inside the aquarium, so the camera brakes softly
 * at the edges and can never leave it.
 */
export class CameraRig {
  /** The pose the camera actually has (eased towards the target). x/y are offsets from the resting pose. */
  x = 0;
  y = 0;
  zoom = ZOOM_MIN;
  /** True while a finger is on the screen moving the camera: the camera then follows the finger closely. */
  dragging = false;
  /** While frozen (drawing, release transition) nothing moves it on its own: no idle return, no follow timeout. */
  frozen = false;

  private tx = 0;
  private ty = 0;
  private tz = ZOOM_MIN;
  private vx = 0;
  private vy = 0;
  private idle = 0;
  private followFn: (() => FollowPoint) | null = null;
  private followZoom = FOLLOW_ZOOM;
  private halfWidthAtZoom1 = 12.5;
  private baseLookY = 3.3;

  constructor(private worldHalf = 37.5) {}

  /** Tells the rig how much of the aquarium one screen shows at zoom 1 (from the lens and the screen shape). */
  configure(fit: CameraFit, aspect: number, worldHalf = this.worldHalf): void {
    this.worldHalf = worldHalf;
    this.halfWidthAtZoom1 = fit.distance * Math.tan((fit.fov * Math.PI) / 360) * aspect;
    this.baseLookY = fit.lookY;
    this.clamp();
  }

  /** The furthest the camera may slide sideways at this zoom (the picture's edge stays inside the aquarium). */
  limitX(zoom = this.zoom): number {
    return Math.max(0, this.worldHalf - this.halfWidthAtZoom1 / zoom);
  }

  /** How far the picture reaches to each side of the camera at the middle of the aquarium, at the current zoom. */
  get viewHalfWidth(): number {
    return this.halfWidthAtZoom1 / this.zoom;
  }

  get following(): boolean {
    return this.followFn !== null;
  }

  /** True while the camera is gliding back to the middle on its own. */
  get returning(): boolean {
    return !this.frozen && !this.followFn && this.idle > IDLE_RETURN_SECONDS && (Math.abs(this.x) + Math.abs(this.y) > 0.01 || Math.abs(this.zoom - ZOOM_MIN) > 0.001);
  }

  /** Any touch on the screen: the 30 seconds start again. */
  touch(): void {
    this.idle = 0;
  }

  /** A finger lands: stop easing and flinging, and take hold of the camera where it is now. */
  grab(): void {
    this.tx = this.x;
    this.ty = this.y;
    this.tz = this.zoom;
    this.vx = this.vy = 0;
    this.touch();
  }

  /** Slide by (dx, dy) world units (finger moved the other way). */
  panBy(dx: number, dy: number): void {
    if (this.frozen) return;
    this.tx += dx;
    this.ty += dy;
    this.vx = this.vy = 0;
    this.touch();
    this.clamp();
  }

  /** The finger was lifted while moving: the camera keeps gliding a little (world units per second). */
  fling(vx: number, vy: number): void {
    if (this.frozen) return;
    this.vx = vx;
    this.vy = vy;
    this.touch();
  }

  zoomBy(factor: number): void {
    if (this.frozen) return;
    this.tz = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, this.tz * factor));
    this.touch();
    this.clamp();
  }

  /** Follow something that moves: its world position is asked for every frame. */
  follow(point: () => FollowPoint, zoom = FOLLOW_ZOOM): void {
    this.followFn = point;
    this.followZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom));
    this.vx = this.vy = 0;
    this.touch();
  }

  /** Stops following; the camera stays where it is (and glides home after 30 s as usual). */
  stopFollow(): void {
    if (!this.followFn) return;
    this.followFn = null;
    this.tx = this.x;
    this.ty = this.y;
    this.tz = this.zoom;
  }

  /** Straight back to the middle at zoom 1 with no easing (start of the game, tests). */
  reset(): void {
    this.followFn = null;
    this.x = this.tx = this.y = this.ty = this.vx = this.vy = 0;
    this.zoom = this.tz = ZOOM_MIN;
    this.idle = 0;
  }

  update(dt: number): void {
    if (!this.frozen) this.idle += dt;
    let rate = this.dragging ? 16 : 9;
    if (this.followFn) {
      if (!this.frozen && this.idle > FOLLOW_TIMEOUT_SECONDS) this.stopFollow();
    }
    if (this.followFn) {
      const p = this.followFn();
      this.tx = p.x;
      this.ty = p.y - this.baseLookY;
      this.tz = this.followZoom;
      rate = 3;
    } else if (!this.frozen && this.idle > IDLE_RETURN_SECONDS) {
      this.tx = this.ty = 0;
      this.tz = ZOOM_MIN;
      this.vx = this.vy = 0;
      rate = 1.2;
    } else if (this.vx !== 0 || this.vy !== 0) {
      this.tx += this.vx * dt;
      this.ty += this.vy * dt;
      const decay = Math.exp(-3.5 * dt);
      this.vx *= decay;
      this.vy *= decay;
      if (Math.hypot(this.vx, this.vy) < 0.05) this.vx = this.vy = 0;
    }
    this.clamp();
    const a = 1 - Math.exp(-rate * dt);
    this.x += (this.tx - this.x) * a;
    this.y += (this.ty - this.y) * a;
    this.zoom += (this.tz - this.zoom) * a;
    this.clamp(true);
  }

  private clamp(includeCurrent = false): void {
    const lim = this.limitX(this.tz);
    this.tx = Math.min(lim, Math.max(-lim, this.tx));
    this.ty = Math.min(Y_RANGE[1], Math.max(Y_RANGE[0], this.ty));
    this.tz = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, this.tz));
    // The picture's edge stays inside the aquarium at the zoom the camera really has right now.
    const cur = this.limitX(this.zoom);
    if (includeCurrent || Math.abs(this.x) > cur) this.x = Math.min(cur, Math.max(-cur, this.x));
    this.y = Math.min(Y_RANGE[1], Math.max(Y_RANGE[0], this.y));
    this.zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, this.zoom));
  }
}

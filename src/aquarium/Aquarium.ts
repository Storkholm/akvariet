import * as THREE from 'three';
import { clampPixelRatio } from '../util/render';
import { CreatureManager } from '../creature/CreatureManager';
import { SPECIES, type Species } from '../species';
import { CameraRig, fitCamera, FOLLOW_ZOOM, type CameraFit } from './cameraRig';
import { CameraControls } from './CameraControls';
import { WORLD_HALF_WIDTH } from './terrain';

import type { Creature } from '../creature/Creature';
import { BubbleBursts, LightRays, Particles } from './effects';
import { FishSchool, SCHOOLS } from './fishSchool';
import { PixelRatioGovernor } from './governor';
import { timeUniform } from './materials';
import { PickerBubbles } from './PickerBubbles';
import { CleanupSharks, type Living } from '../samurai/CleanupSharks';
import type { Fragment } from '../samurai/Fragment';
import { Fragments } from '../samurai/Fragments';
import { cutPlane, type P2 } from '../samurai/slashGeometry';
import { buildReef, type Reef } from './reef';

/** Fog colour; roughly the water colour at the horizon of the background gradient. */
export const FOG_COLOR = 0x1b88cc;

function gradientBackground(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 256;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2d context unavailable');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#46c6ea');
  g.addColorStop(0.25, '#2aa2de');
  g.addColorStop(0.45, '#1b88cc');
  g.addColorStop(0.7, '#1470b4');
  g.addColorStop(1, '#0c4f90');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** The 3D scene that is always running (CONTEXT: Akvariet). */
export class Aquarium {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(45, 1, 0.1, 400);
  private readonly clock = new THREE.Clock();
  private elapsed = 0;
  private dimmed = false;
  private paused = false;
  /** Lowers the render resolution if frames are slow (DESIGN 4.4); never raises it again. */
  private readonly governor = new PixelRatioGovernor(2);
  private maxRatio = 2;
  private lookY = 3.4;
  private camHeight = 4.4;
  private camDistance = 24;
  private fit: CameraFit = fitCamera(1.4);
  private appliedZoom = 1;
  /** CONTEXT: Kamera – the pose the child can move (ADR 0006). */
  readonly rig = new CameraRig(WORLD_HALF_WIDTH);
  readonly controls: CameraControls;
  private followed: Creature | null = null;
  private readonly rays = new LightRays();
  private readonly particles = new Particles();
  private readonly schools: FishSchool[] = SCHOOLS.map((s) => new FishSchool(s));
  readonly creatures: CreatureManager;
  readonly pickerBubbles: PickerBubbles;
  readonly bursts = new BubbleBursts();
  /** CONTEXT: Stykker and Rensehajer (ADR 0008). */
  readonly fragments: Fragments;
  readonly sharks: CleanupSharks;
  private readonly reef: Reef;
  /** A shark bit a piece (App plays the sound). */
  onBite?: (piece: Fragment) => void;
  /** A creature was tapped and is now hopping (App plays the sound). */
  onReact?: (creature: Creature) => void;

  /** `slots`: which bubbles the carousel holds (default: every species; the e2e tests repeat them to get a long row). */
  constructor(private readonly host: HTMLElement, options: { slots?: readonly Species[] } = {}) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.domElement.classList.add('aquarium-canvas');
    host.appendChild(this.renderer.domElement);

    this.scene.background = gradientBackground();
    this.scene.fog = new THREE.FogExp2(FOG_COLOR, 0.021);

    this.scene.add(new THREE.HemisphereLight(0xcdefff, 0x2a6a8c, 1.55));
    const sun = new THREE.DirectionalLight(0xfff4e0, 1.5);
    sun.position.set(-6, 14, 8);
    this.scene.add(sun);

    this.creatures = new CreatureManager(this.scene, this.camera, this.renderer.capabilities.getMaxAnisotropy());
    this.reef = buildReef();
    const reef = this.reef;
    this.scene.add(reef.sand, reef.group, this.rays.group, this.particles.group);
    this.creatures.warmUp(this.renderer);
    this.pickerBubbles = new PickerBubbles(this.camera, (sp) => this.creatures.display(sp), options.slots ?? SPECIES);
    this.scene.add(this.pickerBubbles.group, this.bursts.points);
    this.renderer.localClippingEnabled = true; // the pieces of a cut creature are clipped by their own planes
    this.fragments = new Fragments(this.scene);
    this.sharks = new CleanupSharks(this.scene);
    this.sharks.onBite = (f) => {
      this.bursts.emit(f.position, 26, 0.9);
      this.onBite?.(f);
    };
    for (const s of this.schools) this.scene.add(s.mesh);

    this.controls = new CameraControls(this.renderer.domElement, this.rig, { worldPerPixel: (zoom) => this.worldPerPixel(zoom) });
    this.resize();
    window.addEventListener('resize', this.resize);
  }

  readonly resize = (): void => {
    const w = Math.max(1, this.host.clientWidth);
    const h = Math.max(1, this.host.clientHeight);
    this.renderer.setPixelRatio(clampPixelRatio(window.devicePixelRatio, this.dimmed ? 1 : this.maxRatio));
    this.renderer.setSize(w, h, false);
    const fit = fitCamera(w / h);
    this.fit = fit;
    this.camera.aspect = w / h;
    this.camera.fov = fit.fov;
    this.applyZoom(this.rig.zoom);
    this.rig.configure(fit, w / h);
    // Creatures swim in the whole aquarium, not just the part on screen (ADR 0006).
    const margin = 1.5;
    this.creatures.bounds.min[0] = -(WORLD_HALF_WIDTH - margin);
    this.creatures.bounds.max[0] = WORLD_HALF_WIDTH - margin;
    this.camDistance = fit.distance;
    this.camHeight = fit.height;
    this.lookY = fit.lookY;
    this.placeCamera();
    this.pickerBubbles.layout({ width: w, height: h });
  };

  /** Behind the drawing panel the aquarium is blurred anyway, so it renders at lower resolution. */
  setDimmed(on: boolean): void {
    this.dimmed = on;
    this.resize();
  }

  /** Debug/test only: stops simulating and rendering (software GL in CI is too slow to run alongside UI tests). */
  setPaused(on: boolean): void {
    this.paused = on;
  }

  /** Applies a zoom to the lens (and to what depends on the lens: the pixel size of bubbles). */
  private applyZoom(zoom: number): void {
    this.appliedZoom = zoom;
    this.camera.zoom = zoom;
    this.camera.updateProjectionMatrix();
    const h = Math.max(1, this.host.clientHeight);
    this.bursts.setPixelScale((h * this.renderer.getPixelRatio() * zoom) / (2 * Math.tan((this.fit.fov * Math.PI) / 360)));
  }

  /** World units per screen pixel at the middle of the aquarium (for turning a swipe into a camera move). */
  worldPerPixel(zoom = this.rig.zoom): number {
    return (2 * this.camDistance * Math.tan((this.fit.fov * Math.PI) / 360)) / zoom / Math.max(1, this.host.clientHeight);
  }

  private placeCamera(): void {
    // The child moves the camera (CameraRig); on top of that a very slow drift keeps the picture alive.
    if (Math.abs(this.rig.zoom - this.appliedZoom) > 1e-4) this.applyZoom(this.rig.zoom);
    const t = this.elapsed;
    this.camera.position.set(this.rig.x + Math.sin(t * 0.05) * 0.9, this.camHeight + this.rig.y + Math.sin(t * 0.07) * 0.2, this.camDistance);
    this.camera.lookAt(this.rig.x + Math.sin(t * 0.05) * 0.3, this.lookY + this.rig.y, 0);
  }

  /** CONTEXT: Følg – the camera follows this creature (double tap), or stops following with null. */
  follow(creature: Creature | null): void {
    if (this.followed && this.followed !== creature) this.followed.setFullDetail(false);
    this.followed = creature;
    creature?.setFullDetail(true);
    if (!creature) {
      this.rig.stopFollow();
      return;
    }
    const size = creature.template.size;
    // A creature fills about the same part of the picture whatever its size: bigger ones are met from further away.
    const zoom = Math.min(2.5, Math.max(1.4, FOLLOW_ZOOM * (4.2 / size) ** 0.5));
    this.rig.follow(() => ({ x: creature.group.position.x, y: creature.group.position.y }), zoom);
  }

  get following(): Creature | null {
    return this.followed;
  }

  start(): void {
    this.clock.start();
    this.renderer.setAnimationLoop(() => {
      const raw = this.clock.getDelta();
      const dt = Math.min(raw, 0.1);
      if (this.paused) return;
      // Slow frames for a couple of seconds → a lower resolution (not while dimmed: that already renders at 1×).
      const lower = this.dimmed ? null : this.governor.sample(raw);
      if (lower !== null) {
        this.maxRatio = lower;
        this.resize();
      }
      this.update(dt);
      this.renderer.render(this.scene, this.camera);
    });
  }

  /**
   * CONTEXT: Hug (ADR 0008). A swipe from `a` to `b` (pixels); `from` is an earlier point on the swipe that gives the line its
   * direction. Every creature the swipe crosses is cut in two along that line: it leaves the water and its two pieces take its place.
   * Returns the creatures that were cut.
   */
  slash(a: P2, b: P2, from: P2 = a): Creature[] {
    const viewport = this.viewport;
    const hit = this.creatures.crossed(a, b, viewport);
    if (hit.length === 0) return [];
    const line = from[0] === b[0] && from[1] === b[1] ? a : from;
    const plane = cutPlane(this.camera, line, b, viewport) ?? cutPlane(this.camera, a, [b[0] + 1, b[1] + 1], viewport);
    if (!plane) return [];
    for (const c of hit) {
      this.bursts.emit(c.group.position, 22, c.template.size * 0.3);
      this.fragments.add(...this.creatures.cut(c, plane));
    }
    return hit;
  }

  /** What the cleanup sharks have to steer around. */
  private livingForSharks(): Living[] {
    return this.creatures.living().map((c) => ({ position: c.group.position, radius: c.template.size * 0.5 }));
  }

  /** A tap on the water: a creature under the finger hops or somersaults in a cloud of bubbles (CONTEXT: Glædeshop). */
  tapAt(ndcX: number, ndcY: number): Creature | null {
    const c = this.creatures.reactAt(ndcX, ndcY);
    if (c) {
      this.bursts.emit(c.group.position, 28, c.template.size * 0.3);
      this.onReact?.(c);
    }
    return c;
  }

  /** Test hook: simulate `seconds` in fixed steps and render the result once (works while paused). */
  advance(seconds: number, step = 1 / 30): void {
    for (let t = 0; t < seconds - 1e-9; t += step) this.update(Math.min(step, seconds - t));
    this.renderOnce();
  }

  renderOnce(): void {
    this.renderer.render(this.scene, this.camera);
  }

  get viewport(): { width: number; height: number } {
    return { width: this.host.clientWidth, height: this.host.clientHeight };
  }

  update(dt: number): void {
    this.elapsed += dt;
    // A followed creature that is gone (deleted, saying goodbye) is let go; the rig itself lets go after two minutes.
    if (this.followed && (this.followed.leaving || !this.creatures.creatures.includes(this.followed) || !this.rig.following)) this.follow(null);
    timeUniform.value = this.elapsed;
    for (const s of this.schools) s.update(dt);
    this.creatures.update(dt);
    this.rig.update(dt);
    this.fragments.update(dt);
    this.sharks.update(dt, this.fragments, this.livingForSharks(), this.rig.x, this.rig.viewHalfWidth * 1.3);
    this.rays.update(this.elapsed);
    this.particles.update(dt, this.elapsed);
    this.placeCamera();
    this.pickerBubbles.update(dt, this.elapsed);
    this.bursts.update(dt, this.elapsed);
    // ADR 0006: what is outside the picture is not drawn.
    this.camera.updateMatrixWorld();
    this.reef.cull(this.camera);
    for (const s of this.schools) s.cull(this.camera);
  }

  /** The highest pixel ratio the game currently renders with (it only ever goes down on slow devices). */
  get pixelRatioCap(): number {
    return this.maxRatio;
  }

  get time(): number {
    return this.elapsed;
  }
}

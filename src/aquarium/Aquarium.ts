import * as THREE from 'three';
import { clampPixelRatio } from '../util/render';
import { fitCamera } from './cameraRig';
import { LightRays, Particles } from './effects';
import { FishSchool, SCHOOLS } from './fishSchool';
import { timeUniform } from './materials';
import { buildReef } from './reef';

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
  private lookY = 3.4;
  private camHeight = 4.4;
  private camDistance = 24;
  private readonly rays = new LightRays();
  private readonly particles = new Particles();
  private readonly schools: FishSchool[] = SCHOOLS.map((s) => new FishSchool(s));

  constructor(private readonly host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.domElement.classList.add('aquarium-canvas');
    host.appendChild(this.renderer.domElement);

    this.scene.background = gradientBackground();
    this.scene.fog = new THREE.FogExp2(FOG_COLOR, 0.021);

    this.scene.add(new THREE.HemisphereLight(0xcdefff, 0x2a6a8c, 1.55));
    const sun = new THREE.DirectionalLight(0xfff4e0, 1.5);
    sun.position.set(-6, 14, 8);
    this.scene.add(sun);

    const reef = buildReef();
    this.scene.add(reef.sand, reef.group, this.rays.group, this.particles.group);
    for (const s of this.schools) this.scene.add(s.mesh);

    this.resize();
    window.addEventListener('resize', this.resize);
  }

  readonly resize = (): void => {
    const w = Math.max(1, this.host.clientWidth);
    const h = Math.max(1, this.host.clientHeight);
    this.renderer.setPixelRatio(clampPixelRatio(window.devicePixelRatio, this.dimmed ? 1 : 2));
    this.renderer.setSize(w, h, false);
    const fit = fitCamera(w / h);
    this.camera.aspect = w / h;
    this.camera.fov = fit.fov;
    this.camera.updateProjectionMatrix();
    this.camDistance = fit.distance;
    this.camHeight = fit.height;
    this.lookY = fit.lookY;
    this.placeCamera();
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

  private placeCamera(): void {
    // Slow drift; no camera control for the child in v1 (DESIGN 3.4).
    const t = this.elapsed;
    this.camera.position.set(Math.sin(t * 0.05) * 1.8, this.camHeight + Math.sin(t * 0.07) * 0.25, this.camDistance);
    this.camera.lookAt(Math.sin(t * 0.05) * 0.6, this.lookY, 0);
  }

  start(): void {
    this.clock.start();
    this.renderer.setAnimationLoop(() => {
      const dt = Math.min(this.clock.getDelta(), 0.1);
      if (this.paused) return;
      this.update(dt);
      this.renderer.render(this.scene, this.camera);
    });
  }

  update(dt: number): void {
    this.elapsed += dt;
    timeUniform.value = this.elapsed;
    for (const s of this.schools) s.update(dt);
    this.rays.update(this.elapsed);
    this.particles.update(dt, this.elapsed);
    this.placeCamera();
  }

  get time(): number {
    return this.elapsed;
  }
}

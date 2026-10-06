import * as THREE from 'three';
import { clampPixelRatio } from '../util/render';

/** Deep-water blue used for background and fog. */
export const WATER_COLOR = 0x0a6cb4;

/** The 3D scene that is always running (CONTEXT: Akvariet). */
export class Aquarium {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
  private readonly clock = new THREE.Clock();
  private elapsed = 0;

  constructor(private readonly host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.domElement.classList.add('aquarium-canvas');
    host.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color(WATER_COLOR);
    this.scene.fog = new THREE.FogExp2(WATER_COLOR, 0.02);
    this.camera.position.set(0, 0, 10);

    this.resize();
    window.addEventListener('resize', this.resize);
  }

  readonly resize = (): void => {
    const w = Math.max(1, this.host.clientWidth);
    const h = Math.max(1, this.host.clientHeight);
    this.renderer.setPixelRatio(clampPixelRatio(window.devicePixelRatio));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };

  start(): void {
    this.clock.start();
    this.renderer.setAnimationLoop(() => {
      const dt = Math.min(this.clock.getDelta(), 0.1);
      this.update(dt);
      this.renderer.render(this.scene, this.camera);
    });
  }

  update(dt: number): void {
    this.elapsed += dt;
  }

  get time(): number {
    return this.elapsed;
  }
}

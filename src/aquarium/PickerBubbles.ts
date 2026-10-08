import * as THREE from 'three';
import type { Creature } from '../creature/Creature';
import { polygonBounds } from '../drawing/geometry';
import { TEMPLATES, type Species } from '../species';

type State = 'shown' | 'popping' | 'hiding' | 'hidden' | 'inflating';

interface Item {
  species: Species;
  root: THREE.Group;
  sway: THREE.Group;
  shell: THREE.Mesh;
  shine: THREE.Mesh[];
  animal: Creature;
  /** Scale (in bubble units) that makes the whole animal fit inside the bubble. */
  fit: number;
  /** Where the animal's visual centre is, relative to its template centre (local x, z, world units). */
  centreOffset: [number, number];
  state: State;
  t: number;
  phase: number;
  /** Centre and radius on screen (CSS px). */
  cx: number;
  cy: number;
  r: number;
  alpha: number;
  scale: number;
  burst: THREE.Points | null;
  burstVel: Float32Array;
}

const BUBBLE_VERT = `
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal);
    vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }`;
const BUBBLE_FRAG = `
  uniform float uAlpha;
  uniform float uTime;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
    float rim = pow(f, 2.2);
    vec3 col = mix(vec3(0.62, 0.86, 1.0), vec3(1.0), rim);
    col += 0.07 * vec3(sin(f * 9.0 + uTime), sin(f * 9.0 + uTime + 2.1), sin(f * 9.0 + uTime + 4.2));
    gl_FragColor = vec4(col, (0.05 + 0.7 * rim) * uAlpha);
    #include <colorspace_fragment>
  }`;

const easeOut = (t: number): number => 1 - (1 - t) * (1 - t);
const easeOutBack = (t: number): number => 1 + 2.4 * Math.pow(t - 1, 3) + 1.4 * Math.pow(t - 1, 2);
const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

function dotTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.4)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * CONTEXT: Artsvælger, the 3D part: each species floats in its own transparent bubble over the aquarium
 * (reference photos 01/04). The animals inside are uncoloured (the template's base colour), swim on the spot and rock
 * gently; tapping a bubble pops it. Bubbles are anchored to screen positions, so camera drift never moves them.
 */
export class PickerBubbles {
  readonly group = new THREE.Group();
  /** Called after the bubbles were laid out again (resize), so the HTML hit areas can follow. */
  onLayout?: () => void;

  private readonly items: Item[] = [];
  private readonly dot = dotTexture();
  private readonly shineGeo = new THREE.PlaneGeometry(1, 1);
  private readonly sphere = new THREE.SphereGeometry(1, 48, 32);
  private viewport = { width: 1, height: 1 };
  private time = 0;
  /** Distance from the camera: nearer than anything in the aquarium, so nothing can cut into a bubble. */
  private readonly distance = 8;

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    makeAnimal: (species: Species) => Creature,
    species: readonly Species[],
  ) {
    species.forEach((sp, i) => this.items.push(this.makeItem(sp, makeAnimal(sp), i)));
    for (const it of this.items) this.group.add(it.root);
  }

  private makeItem(species: Species, animal: Creature, index: number): Item {
    const template = TEMPLATES[species];
    const root = new THREE.Group();
    const sway = new THREE.Group();
    const holder = new THREE.Group();
    holder.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2); // back towards the viewer, head up
    // Centre the animal's visual centre in the bubble and find how far its outline reaches from there.
    const b = polygonBounds(template.parts.flatMap((p) => p.outline));
    const vc: [number, number] = [(b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2];
    const centreOffset: [number, number] = [(vc[0] - template.center[0]) * template.size, (vc[1] - template.center[1]) * template.size];
    let reach = 0;
    for (const [x, y] of template.parts.flatMap((p) => p.outline)) reach = Math.max(reach, Math.hypot((x - vc[0]) * template.size, (y - vc[1]) * template.size));
    animal.setUnfold(1);
    // Uncoloured animals get a little self-light so they read as pale/white inside the bubble, not as grey.
    (animal.mesh.material as THREE.MeshLambertMaterial).emissive.set(0x4a525c);
    holder.add(animal.group);
    sway.add(holder);

    const shellMat = new THREE.ShaderMaterial({
      vertexShader: BUBBLE_VERT,
      fragmentShader: BUBBLE_FRAG,
      uniforms: { uAlpha: { value: 1 }, uTime: { value: 0 } },
      transparent: true,
      depthWrite: false,
      fog: false,
    });
    const shell = new THREE.Mesh(this.sphere, shellMat);
    shell.renderOrder = 20;

    const shine = [0, 1].map((k) => {
      const m = new THREE.Mesh(
        this.shineGeo,
        new THREE.MeshBasicMaterial({ map: this.dot, transparent: true, opacity: k ? 0.25 : 0.6, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }),
      );
      m.renderOrder = 21;
      return m;
    });
    root.add(sway, shell, ...shine);
    return {
      species, root, sway, shell, shine, animal, fit: 0.8 / reach, centreOffset, state: 'shown', t: 0, phase: index * 2.1,
      cx: 0, cy: 0, r: 1, alpha: 1, scale: 1, burst: null, burstVel: new Float32Array(0),
    };
  }

  /** Lays the bubbles out for this screen: side by side in landscape, one above the other in portrait. */
  layout(viewport: { width: number; height: number }): void {
    this.viewport = viewport;
    const { width: w, height: h } = viewport;
    const r = Math.min(0.22 * w, 0.17 * h);
    const portrait = h > w * 1.05;
    this.items.forEach((it, i) => {
      it.r = r;
      if (portrait) {
        it.cx = 0.5 * w;
        it.cy = 0.3 * h + i * (2 * r + 0.07 * h);
      } else {
        it.cx = (i === 0 ? 0.36 : 0.64) * w;
        it.cy = (i === 0 ? 0.4 : 0.56) * h;
      }
    });
    this.sync();
    this.onLayout?.();
  }

  /** Where to put the (invisible) HTML buttons: centre and radius in CSS px. */
  hitAreas(): Array<{ species: Species; x: number; y: number; r: number }> {
    return this.items.map((it) => ({ species: it.species, x: it.cx, y: it.cy, r: it.r }));
  }

  /** Is anything of the bubbles still visible (or animating)? */
  get visible(): boolean {
    return this.items.some((it) => it.state !== 'hidden');
  }

  stateOf(species: Species): State {
    return (this.items.find((i) => i.species === species) as Item).state;
  }

  /** Bubbles come (back) with a little bounce. */
  show(): void {
    this.items.forEach((it, i) => {
      this.clearBurst(it);
      it.state = 'inflating';
      it.t = -0.12 * i;
      it.animal.group.visible = true;
      it.root.visible = true;
    });
  }

  /** The tapped bubble pops; the others fade away. With no argument all of them fade away (adult mode, drawing). */
  hide(popped?: Species): void {
    for (const it of this.items) {
      if (it.state === 'hidden') continue;
      it.t = 0;
      if (it.species === popped) {
        it.state = 'popping';
        this.startBurst(it);
      } else it.state = 'hiding';
    }
  }

  update(dt: number, time: number): void {
    this.time = time;
    for (const it of this.items) {
      if (it.state === 'hidden') continue; // nothing to animate or draw
      it.t += dt;
      it.phase += dt;
      switch (it.state) {
        case 'inflating': {
          const k = clamp01(it.t / 0.7);
          it.scale = it.t <= 0 ? 0.001 : Math.max(0.001, easeOutBack(k));
          it.alpha = clamp01(it.t / 0.4);
          if (k >= 1) it.state = 'shown';
          break;
        }
        case 'popping': {
          const k = clamp01(it.t / 0.45);
          it.scale = 1 + 0.4 * easeOut(k);
          it.alpha = clamp01(1 - it.t / 0.3);
          if (it.t > 0.12) it.animal.group.visible = false;
          this.stepBurst(it, dt, k);
          if (k >= 1) { it.state = 'hidden'; it.root.visible = false; this.clearBurst(it); }
          break;
        }
        case 'hiding': {
          const k = clamp01(it.t / 0.3);
          it.scale = 1 - 0.18 * easeOut(k);
          it.alpha = 1 - k;
          if (k >= 1) { it.state = 'hidden'; it.root.visible = false; }
          break;
        }
        default:
          it.scale = 1;
          it.alpha = 1;
      }
      it.animal.update(dt, [], { min: [0, 0, 0], max: [0, 0, 0], floorMargin: 0 });
    }
    this.sync();
  }

  /** Puts every bubble at its screen position in front of the camera and applies the idle floating. */
  private sync(): void {
    const cam = this.camera;
    cam.updateMatrixWorld();
    const { width: w, height: h } = this.viewport;
    const tanHalf = Math.tan((cam.fov * Math.PI) / 360);
    const upp = (2 * this.distance * tanHalf) / h; // world units per CSS px at the bubbles' distance
    const ndc = new THREE.Vector3();
    for (const it of this.items) {
      ndc.set((it.cx / w) * 2 - 1, -((it.cy / h) * 2 - 1), 0.5).unproject(cam).sub(cam.position).normalize();
      const rWorld = it.r * upp;
      const bob = Math.sin(it.phase * 0.9) * 0.035 * rWorld;
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion);
      it.root.position.copy(cam.position).addScaledVector(ndc, this.distance).addScaledVector(up, bob);
      it.root.quaternion.copy(cam.quaternion);
      const s = rWorld * it.scale;
      it.shell.scale.setScalar(s);
      (it.shell.material as THREE.ShaderMaterial).uniforms.uAlpha.value = it.alpha;
      (it.shell.material as THREE.ShaderMaterial).uniforms.uTime.value = this.time * 0.6;
      const animalScale = it.fit * rWorld * it.scale;
      it.animal.group.scale.setScalar(animalScale);
      // The offset that centres the animal is in its own (unscaled) units, so it scales with it.
      it.animal.group.position.set(-it.centreOffset[0] * animalScale, 0, -it.centreOffset[1] * animalScale);
      // The animal rocks gently, as if floating in the bubble: a tilt that shows its thickness, and a slow roll.
      it.sway.rotation.set(Math.sin(it.phase * 0.7) * 0.28, Math.sin(it.phase * 0.5 + 1) * 0.22, Math.sin(it.phase * 0.6 + 2) * 0.12);
      it.shine[0].position.set(-0.42 * s, 0.46 * s, 1.0 * s);
      it.shine[0].scale.set(0.62 * s, 0.34 * s, 1);
      it.shine[0].rotation.z = 0.6;
      it.shine[1].position.set(0.45 * s, -0.5 * s, 1.0 * s);
      it.shine[1].scale.set(0.34 * s, 0.2 * s, 1);
      it.shine[1].rotation.z = 0.6;
      for (const m of it.shine) (m.material as THREE.MeshBasicMaterial).opacity = (m === it.shine[0] ? 0.6 : 0.25) * it.alpha;
      // Billboards must not be sorted behind the world: they are drawn after everything else.
      it.animal.mesh.renderOrder = 10;
    }
  }

  private startBurst(it: Item): void {
    const n = 30;
    const pos = new Float32Array(n * 3);
    it.burstVel = new Float32Array(n * 3);
    const rWorld = it.r * ((2 * this.distance * Math.tan((this.camera.fov * Math.PI) / 360)) / this.viewport.height);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
      const z = (Math.random() - 0.5) * 0.8;
      const rr = Math.sqrt(1 - z * z);
      pos.set([Math.cos(a) * rr * rWorld, Math.sin(a) * rr * rWorld, z * rWorld], i * 3);
      const sp = (1.2 + Math.random() * 1.6) * rWorld;
      it.burstVel.set([Math.cos(a) * rr * sp, Math.sin(a) * rr * sp, z * sp], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    it.burst = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ map: this.dot, size: 0.26 * rWorld, color: 0xeaf8ff, transparent: true, opacity: 0.9, depthWrite: false, fog: false }),
    );
    it.burst.frustumCulled = false;
    it.burst.renderOrder = 22;
    it.root.add(it.burst);
  }

  private stepBurst(it: Item, dt: number, k: number): void {
    if (!it.burst) return;
    const pos = it.burst.geometry.getAttribute('position');
    const drag = Math.exp(-3 * dt);
    for (let i = 0; i < pos.count; i++) {
      for (let a = 0; a < 3; a++) {
        it.burstVel[i * 3 + a] *= drag;
        pos.setComponent(i, a, pos.getComponent(i, a) + it.burstVel[i * 3 + a] * dt);
      }
    }
    pos.needsUpdate = true;
    (it.burst.material as THREE.PointsMaterial).opacity = 0.9 * (1 - k);
  }

  private clearBurst(it: Item): void {
    if (!it.burst) return;
    it.root.remove(it.burst);
    it.burst.geometry.dispose();
    (it.burst.material as THREE.Material).dispose();
    it.burst = null;
  }
}

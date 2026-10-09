import * as THREE from 'three';
import type { Creature } from '../creature/Creature';
import { polygonBounds } from '../drawing/geometry';
import { TEMPLATES, type Species } from '../species';
import { carouselGeometry, CarouselScroll } from '../ui/carouselScroll';

type State = 'shown' | 'popping' | 'hiding' | 'hidden' | 'inflating';

interface Item {
  species: Species;
  /** Position in the carousel (the same species can appear twice in the test setup with ?bubbles). */
  index: number;
  root: THREE.Group;
  sway: THREE.Group;
  shell: THREE.Mesh;
  /** The two highlights on the bubble: two quads in one mesh (one draw call), moved and faded through their vertices. */
  shine: THREE.Mesh;
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
  /** 0 = in the row, 1 = folded away below the screen (CONTEXT: Kigge-knap). */
  fold: number;
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

/** Seconds between one bubble starting to fold away and the next. */
const FOLD_STAGGER = 0.07;

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
  private readonly sphere = new THREE.SphereGeometry(1, 36, 22);
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

    const shineGeo = new THREE.BufferGeometry();
    shineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(8 * 3), 3).setUsage(THREE.DynamicDrawUsage));
    shineGeo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1]), 2));
    shineGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(8 * 4).fill(1), 4).setUsage(THREE.DynamicDrawUsage));
    shineGeo.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);
    const shine = new THREE.Mesh(
      shineGeo,
      new THREE.MeshBasicMaterial({ map: this.dot, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }),
    );
    shine.renderOrder = 21;
    shine.frustumCulled = false;
    root.add(sway, shell, shine);
    return {
      species, index, root, sway, shell, shine, animal, fit: 0.8 / reach, centreOffset, state: 'shown', t: 0, phase: index * 2.1,
      cx: 0, cy: 0, r: 1, alpha: 1, scale: 1, fold: 0, burst: null, burstVel: new Float32Array(0),
    };
  }

  /** The scrolling model of the row (the HTML carousel drives it with swipes). */
  readonly scroll = new CarouselScroll();
  private folding = false;
  private foldClock = 0;

  /** Lays the row out for this screen: ~3 bubbles on a tablet, 1½ on an upright phone (DESIGN 8.3). */
  layout(viewport: { width: number; height: number }): void {
    this.viewport = viewport;
    const g = carouselGeometry(viewport.width, viewport.height);
    this.geometry = g;
    this.scroll.configure(this.items.length, g.spacing, viewport.width);
    for (const it of this.items) {
      it.r = g.r;
      it.cy = g.cy;
    }
    this.place();
    this.sync();
    this.onLayout?.();
  }

  geometry = carouselGeometry(1180, 820);

  /** Bubbles follow the scroll position and the fold. */
  private place(): void {
    for (const it of this.items) {
      it.cx = this.scroll.itemX(it.index);
    }
  }

  /** Where to put the (invisible) HTML buttons: centre and radius in CSS px. */
  hitAreas(): Array<{ species: Species; index: number; x: number; y: number; r: number }> {
    return this.items.map((it) => ({ species: it.species, index: it.index, x: it.cx, y: it.cy + this.foldOffset(it), r: it.r }));
  }

  /** CONTEXT: Kigge-knap – the row floats down and out so the aquarium can be seen freely; or back again. */
  setFolded(on: boolean): void {
    this.folding = on;
  }

  get folded(): boolean {
    return this.folding;
  }

  /** True once the row has floated away completely (nothing left to tap). */
  get foldedAway(): boolean {
    return this.items.every((it) => it.fold >= 1);
  }

  private foldOffset(it: Item): number {
    const e = it.fold * it.fold;
    return e * (this.viewport.height - it.cy + 2.4 * it.r);
  }

  /** Is anything of the bubbles still visible (or animating)? */
  get visible(): boolean {
    return this.items.some((it) => it.state !== 'hidden') && !this.foldedAway;
  }

  stateOf(species: Species): State {
    return (this.items.find((i) => i.species === species) as Item).state;
  }

  /** Index of the bubble nearest the middle of the screen. */
  get centred(): number {
    return this.scroll.nearest();
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
  hide(popped?: Species | number): void {
    // The tapped bubble is named by its place in the row (the same species can appear twice in the test setup).
    const poppedIndex = typeof popped === 'number' ? popped : this.items.find((i) => i.species === popped)?.index;
    for (const it of this.items) {
      if (it.state === 'hidden') continue;
      it.t = 0;
      if (it.index === poppedIndex) {
        it.state = 'popping';
        this.startBurst(it);
      } else it.state = 'hiding';
    }
  }

  update(dt: number, time: number): void {
    this.time = time;
    const moved = this.scroll.update(dt);
    if (moved) this.place();
    // The row folds away (or comes back): each bubble a little after the one before.
    const foldTotal = 0.6 + FOLD_STAGGER * Math.max(0, this.items.length - 1);
    const foldBefore = this.foldClock;
    this.foldClock = clamp01(this.foldClock + (this.folding ? dt : -dt) / foldTotal);
    for (const it of this.items) {
      const t = this.foldClock * foldTotal - it.index * FOLD_STAGGER;
      it.fold = clamp01(t / 0.6);
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
      if (it.root.visible) it.animal.update(dt, [], { min: [0, 0, 0], max: [0, 0, 0], floorMargin: 0 });
    }
    this.sync();
    // The HTML buttons follow the bubbles while the row scrolls and while it folds away or comes back.
    if (moved || this.foldClock !== foldBefore) this.onLayout?.();
  }

  /** Puts every bubble at its screen position in front of the camera and applies the idle floating. */
  private sync(): void {
    const cam = this.camera;
    cam.updateMatrixWorld();
    const { width: w, height: h } = this.viewport;
    const tanHalf = Math.tan((cam.fov * Math.PI) / 360) / cam.zoom;
    const upp = (2 * this.distance * tanHalf) / h; // world units per CSS px at the bubbles' distance
    const ndc = new THREE.Vector3();
    for (const it of this.items) {
      if (it.state === 'hidden') continue;
      // Bubbles off the side of the screen (or floated away) are not drawn at all.
      const cyEff = it.cy + this.foldOffset(it);
      it.root.visible = it.fold < 1 && it.cx + it.r * 1.5 > 0 && it.cx - it.r * 1.5 < w;
      if (!it.root.visible) continue;
      const foldScale = 1 - 0.12 * it.fold;
      ndc.set((it.cx / w) * 2 - 1, -((cyEff / h) * 2 - 1), 0.5).unproject(cam).sub(cam.position).normalize();
      const rWorld = it.r * upp;
      const bob = Math.sin(it.phase * 0.9) * 0.035 * rWorld;
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion);
      it.root.position.copy(cam.position).addScaledVector(ndc, this.distance).addScaledVector(up, bob);
      it.root.quaternion.copy(cam.quaternion);
      const s = rWorld * it.scale * foldScale;
      it.shell.scale.setScalar(s);
      (it.shell.material as THREE.ShaderMaterial).uniforms.uAlpha.value = it.alpha;
      (it.shell.material as THREE.ShaderMaterial).uniforms.uTime.value = this.time * 0.6;
      const animalScale = it.fit * rWorld * it.scale * foldScale;
      it.animal.group.scale.setScalar(animalScale);
      // The offset that centres the animal is in its own (unscaled) units, so it scales with it.
      it.animal.group.position.set(-it.centreOffset[0] * animalScale, 0, -it.centreOffset[1] * animalScale);
      // The animal rocks gently, as if floating in the bubble: a tilt that shows its thickness, and a slow roll.
      it.sway.rotation.set(Math.sin(it.phase * 0.7) * 0.28, Math.sin(it.phase * 0.5 + 1) * 0.22, Math.sin(it.phase * 0.6 + 2) * 0.12);
      this.writeShine(it, s);
      // Billboards must not be sorted behind the world: they are drawn after everything else.
      it.animal.mesh.renderOrder = 10;
    }
  }

  /** Writes the two highlights (centre, size, tilt of 0.6 rad, brightness × the bubble's alpha) into the shared quad mesh. */
  private writeShine(it: Item, s: number): void {
    const pos = it.shine.geometry.getAttribute('position') as THREE.BufferAttribute;
    const col = it.shine.geometry.getAttribute('color') as THREE.BufferAttribute;
    const quads: Array<[number, number, number, number, number]> = [
      [-0.42 * s, 0.46 * s, 0.62 * s, 0.34 * s, 0.6],
      [0.45 * s, -0.5 * s, 0.34 * s, 0.2 * s, 0.25],
    ];
    const cos = Math.cos(0.6);
    const sin = Math.sin(0.6);
    quads.forEach(([cx, cy, w, h, brightness], q) => {
      [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]].forEach(([u, v], k) => {
        const x = u * w;
        const y = v * h;
        pos.setXYZ(q * 4 + k, cx + x * cos - y * sin, cy + x * sin + y * cos, 1.0 * s);
        col.setXYZW(q * 4 + k, 1, 1, 1, brightness * it.alpha);
      });
    });
    pos.needsUpdate = true;
    col.needsUpdate = true;
  }

  private startBurst(it: Item): void {
    const n = 30;
    const pos = new Float32Array(n * 3);
    it.burstVel = new Float32Array(n * 3);
    const rWorld = it.r * ((2 * this.distance * Math.tan((this.camera.fov * Math.PI) / 360)) / this.camera.zoom / this.viewport.height);
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

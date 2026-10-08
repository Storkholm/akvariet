import * as THREE from 'three';
import { createRng } from '../util/random';
import { TANK, terrainHeight } from './terrain';

function softDot(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2d context unavailable');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Soft slanted shafts of sunlight from the surface. */
export class LightRays {
  readonly group = new THREE.Group();
  private readonly rays: Array<{ mesh: THREE.Mesh; base: number; speed: number; phase: number }> = [];

  constructor(seed = 5) {
    const rng = createRng(seed);
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 256;
    const ctx = c.getContext('2d');
    if (!ctx) throw new Error('2d context unavailable');
    const img = ctx.createImageData(64, 256);
    for (let y = 0; y < 256; y++) {
      for (let x = 0; x < 64; x++) {
        const u = 1 - Math.abs((x / 63) * 2 - 1);
        const v = y / 255; // 0 = top (bright) … 1 = bottom (faded)
        const a = Math.pow(u, 1.6) * Math.pow(1 - v, 1.3);
        const i = (y * 64 + x) * 4;
        img.data.set([255, 255, 255, Math.round(a * 255)], i);
      }
    }
    ctx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;

    for (let i = 0; i < 9; i++) {
      const mat = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
        opacity: 0.1,
      });
      const w = rng.range(2.5, 6);
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, 24), mat);
      mesh.position.set(rng.range(-22, 22), 11 - 12, rng.range(-18, -3));
      mesh.rotation.z = rng.range(0.12, 0.3);
      mesh.rotation.y = rng.range(-0.3, 0.3);
      this.group.add(mesh);
      this.rays.push({ mesh, base: rng.range(0.07, 0.15), speed: rng.range(0.15, 0.4), phase: rng.range(0, 6.28) });
    }
  }

  update(time: number): void {
    for (const r of this.rays) {
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = r.base * (0.65 + 0.35 * Math.sin(time * r.speed + r.phase));
      r.mesh.position.x += Math.sin(time * 0.05 + r.phase) * 0.0015;
    }
  }
}

/** Drifting specks ("marine snow") and a few columns of rising bubbles. */
export class Particles {
  readonly group = new THREE.Group();
  private readonly snow: THREE.Points;
  private readonly snowBase: Float32Array;
  private readonly bubbles: THREE.Points;
  private readonly bubbleState: Array<{ sx: number; sz: number; sy: number; speed: number; wob: number; phase: number }> = [];
  private readonly rng = createRng(21);

  constructor() {
    const tex = softDot();

    const n = 260;
    this.snowBase = new Float32Array(n * 3);
    const r = createRng(22);
    for (let i = 0; i < n; i++) {
      this.snowBase.set([r.range(-24, 24), r.range(0.5, TANK.surfaceY - 1), r.range(-16, 9)], i * 3);
    }
    const snowGeo = new THREE.BufferGeometry();
    snowGeo.setAttribute('position', new THREE.BufferAttribute(this.snowBase.slice(), 3));
    this.snow = new THREE.Points(
      snowGeo,
      new THREE.PointsMaterial({ map: tex, size: 0.14, color: 0xd6f0ff, transparent: true, opacity: 0.5, depthWrite: false }),
    );
    this.snow.frustumCulled = false;

    const sources: Array<[number, number]> = [[-7, 2], [10, 0.5], [3, -8], [-16, -4]];
    const per = 22;
    const bGeo = new THREE.BufferGeometry();
    bGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(sources.length * per * 3), 3));
    for (const [sx, sz] of sources) {
      for (let i = 0; i < per; i++) {
        this.bubbleState.push({
          sx, sz,
          sy: terrainHeight(sx, sz) + 0.3 + (i / per) * (TANK.surfaceY - 1),
          speed: this.rng.range(0.9, 1.6),
          wob: this.rng.range(0.1, 0.35),
          phase: this.rng.range(0, 6.28),
        });
      }
    }
    this.bubbles = new THREE.Points(
      bGeo,
      new THREE.PointsMaterial({ map: tex, size: 0.3, color: 0xeaf8ff, transparent: true, opacity: 0.75, depthWrite: false }),
    );
    this.bubbles.frustumCulled = false;
    this.group.add(this.snow, this.bubbles);
  }

  update(dt: number, time: number): void {
    const sp = this.snow.geometry.getAttribute('position');
    for (let i = 0; i < sp.count; i++) {
      sp.setXYZ(
        i,
        this.snowBase[i * 3] + Math.sin(time * 0.15 + i) * 0.6,
        this.snowBase[i * 3 + 1] + Math.sin(time * 0.2 + i * 1.3) * 0.5,
        this.snowBase[i * 3 + 2] + Math.cos(time * 0.12 + i * 0.7) * 0.5,
      );
    }
    sp.needsUpdate = true;

    const bp = this.bubbles.geometry.getAttribute('position');
    this.bubbleState.forEach((b, i) => {
      b.sy += b.speed * dt;
      if (b.sy > TANK.surfaceY - 0.5) b.sy = terrainHeight(b.sx, b.sz) + 0.3;
      bp.setXYZ(i, b.sx + Math.sin(time * 1.8 + b.phase) * b.wob, b.sy, b.sz + Math.cos(time * 1.4 + b.phase) * b.wob);
    });
    bp.needsUpdate = true;
  }
}

const BURST_VERT = `
  attribute float aSize;
  attribute float aAlpha;
  uniform float uPx;
  varying float vA;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = max(1.0, aSize * uPx / -mv.z);
    vA = aAlpha;
  }`;
const BURST_FRAG = `
  varying float vA;
  void main() {
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float d = length(p);
    if (d > 1.0) discard;
    float ring = smoothstep(0.55, 0.95, d);
    float spec = smoothstep(0.38, 0.0, length(p - vec2(-0.35, 0.35)));
    vec3 col = mix(vec3(0.75, 0.92, 1.0), vec3(1.0), ring) + spec * 0.5;
    gl_FragColor = vec4(col, clamp((0.12 + 0.7 * ring + spec * 0.6) * vA, 0.0, 1.0));
    #include <colorspace_fragment>
  }`;

/** Small bubble clouds that rise and fade (CONTEXT: Glædeshop). One pool, one draw call; sizes are in world units. */
export class BubbleBursts {
  readonly points: THREE.Points;
  private readonly pos: Float32Array;
  private readonly vel: Float32Array;
  private readonly age: Float32Array;
  private readonly life: Float32Array;
  private readonly size: Float32Array;
  private readonly alpha: Float32Array;
  private readonly wobble: Float32Array;
  private next = 0;
  private readonly rng = createRng(77);
  private readonly material: THREE.ShaderMaterial;

  constructor(private readonly capacity = 240) {
    this.pos = new Float32Array(capacity * 3);
    this.vel = new Float32Array(capacity * 3);
    this.age = new Float32Array(capacity).fill(1);
    this.life = new Float32Array(capacity).fill(1);
    this.size = new Float32Array(capacity);
    this.alpha = new Float32Array(capacity);
    this.wobble = new Float32Array(capacity);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    this.material = new THREE.ShaderMaterial({
      vertexShader: BURST_VERT,
      fragmentShader: BURST_FRAG,
      uniforms: { uPx: { value: 600 } },
      transparent: true,
      depthWrite: false,
      fog: false,
    });
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 15;
  }

  /** Pixels per world unit at distance 1 (viewport height / 2·tan(fov/2), in device pixels). */
  setPixelScale(px: number): void {
    this.material.uniforms.uPx.value = px;
  }

  /** How many bubbles are alive right now. */
  get active(): number {
    let n = 0;
    for (let i = 0; i < this.capacity; i++) if (this.age[i] < this.life[i]) n++;
    return n;
  }

  emit(center: THREE.Vector3, count: number, radius: number): void {
    for (let k = 0; k < count; k++) {
      const i = this.next;
      this.next = (this.next + 1) % this.capacity;
      const r = this.rng;
      const a = r.range(0, Math.PI * 2);
      const rr = radius * Math.sqrt(r.next());
      this.pos.set([center.x + Math.cos(a) * rr, center.y + r.range(-0.3, 0.3) * radius, center.z + Math.sin(a) * rr], i * 3);
      this.vel.set([r.range(-0.15, 0.15), r.range(0.7, 1.5), r.range(-0.15, 0.15)], i * 3);
      this.age[i] = 0;
      this.life[i] = r.range(1.4, 2.4);
      this.size[i] = r.range(0.1, 0.3);
      this.wobble[i] = r.range(0, 6.28);
      this.alpha[i] = 1;
    }
    this.flag();
  }

  update(dt: number, time: number): void {
    for (let i = 0; i < this.capacity; i++) {
      if (this.age[i] >= this.life[i]) { this.alpha[i] = 0; continue; }
      this.age[i] += dt;
      const u = this.age[i] / this.life[i];
      this.pos[i * 3] += (this.vel[i * 3] + Math.sin(time * 4 + this.wobble[i]) * 0.12) * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += (this.vel[i * 3 + 2] + Math.cos(time * 3.4 + this.wobble[i]) * 0.1) * dt;
      // Quick fade in, long fade out.
      this.alpha[i] = Math.min(1, u * 8) * (1 - u * u);
    }
    this.flag();
  }

  private flag(): void {
    const g = this.points.geometry;
    g.getAttribute('position').needsUpdate = true;
    g.getAttribute('aAlpha').needsUpdate = true;
    g.getAttribute('aSize').needsUpdate = true;
  }
}

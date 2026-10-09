import * as THREE from 'three';
import { Flock, type Vec3 } from './boids';
import { patchWater } from './materials';
import { createRng } from '../util/random';

type Pattern = 'plain' | 'tang' | 'banner' | 'sardine' | 'shark';

export interface SchoolSpec {
  count: number;
  length: number;
  heightRatio: number;
  pattern: Pattern;
  /** Instance colors (used by plain/sardine patterns). */
  colors: number[];
  min: Vec3;
  max: Vec3;
  minSpeed: number;
  maxSpeed: number;
  seed: number;
}

const col = (hex: number): THREE.Color => new THREE.Color(hex);

/** Fish pointing along +x; width along z. `tail` = 0 at head … 1 at tail tip drives the wiggle. */
export function fishGeometry(length: number, heightRatio: number, pattern: Pattern): THREE.BufferGeometry {
  const h = length * heightRatio;
  const w = h * 0.45;
  const tl = length * 0.35;
  const pos: number[] = [];
  const color: number[] = [];
  const tail: number[] = [];
  const index: number[] = [];

  const tailW = (x: number): number => Math.min(1, Math.max(0, (-x - length * 0.1) / (length * 0.4 + tl)));
  const colorAt = (xn: number, yn: number, part: 'body' | 'tail' | 'fin'): THREE.Color => {
    switch (pattern) {
      case 'tang':
        return part === 'body' ? col(0x1e5fe6).lerp(col(0x0a2a8a), yn < 0 ? 0 : 0.3) : col(part === 'tail' ? 0xffd21e : 0x1030a0);
      case 'banner': {
        if (part === 'fin') return col(0xfff0c0);
        const stripe = Math.floor((xn + 0.5) * 6);
        return col(stripe % 2 === 0 ? 0xf8f8f0 : stripe === 1 ? 0xffd21e : 0x15151a);
      }
      case 'sardine':
        return col(yn > 0.1 ? 0xb8c8d8 : 0xffffff);
      case 'shark':
        // Cleanup sharks (CONTEXT: Rensehajer): plain grey above, pale below, darker fins – a friendly cartoon shark.
        return part === 'body' ? col(yn > -0.12 ? 0x7e8a98 : 0xe6ebf0) : col(0x5f6b78);
      default:
        return part === 'body' ? col(0xffffff).lerp(col(0xffe0d0), yn < 0 ? 0.5 : 0) : col(0xffd0b0);
    }
  };

  const addVertex = (x: number, y: number, z: number, part: 'body' | 'tail' | 'fin'): void => {
    pos.push(x, y, z);
    const c = colorAt(x / length, y / h, part);
    color.push(c.r, c.g, c.b);
    tail.push(part === 'tail' ? Math.max(0.6, tailW(x)) : tailW(x));
  };

  // Body: tapered ellipsoid.
  const seg = 10;
  const rings = 8;
  for (let r = 0; r <= rings; r++) {
    const v = (r / rings) * Math.PI;
    for (let s = 0; s <= seg; s++) {
      const u = (s / seg) * Math.PI * 2;
      let x = Math.cos(v) * 0.5 * length;
      const taper = x < 0 ? 1 - 0.65 * Math.pow(-x / (0.5 * length), 1.5) : 1;
      x *= 1;
      addVertex(x, Math.sin(v) * Math.cos(u) * 0.5 * h * taper, Math.sin(v) * Math.sin(u) * 0.5 * w * taper, 'body');
    }
  }
  for (let r = 0; r < rings; r++) {
    for (let s = 0; s < seg; s++) {
      const a = r * (seg + 1) + s;
      index.push(a, a + seg + 1, a + 1, a + 1, a + seg + 1, a + seg + 2);
    }
  }
  const base = pos.length / 3;
  // Forked tail.
  addVertex(-length * 0.42, 0, 0, 'tail');
  addVertex(-length * 0.5 - tl, h * 0.55, 0, 'tail');
  addVertex(-length * 0.5 - tl * 0.62, 0, 0, 'tail');
  addVertex(-length * 0.5 - tl, -h * 0.55, 0, 'tail');
  index.push(base, base + 1, base + 2, base, base + 2, base + 3);
  // Dorsal fin.
  const f = base + 4;
  addVertex(length * 0.15, h * 0.4, 0, 'fin');
  addVertex(-length * 0.25, h * 0.4, 0, 'fin');
  addVertex(-length * 0.2, h * 0.85, 0, 'fin');
  index.push(f, f + 1, f + 2);

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(color, 3));
  g.setAttribute('tail', new THREE.Float32BufferAttribute(tail, 1));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

/** One school of background fish (CONTEXT: Baggrundsliv) drawn with a single instanced mesh. */
export class FishSchool {
  readonly mesh: THREE.InstancedMesh;
  private readonly box: THREE.Box3;
  private readonly flock: Flock;
  private readonly spec: SchoolSpec;
  private readonly phase: number;
  private readonly m = new THREE.Matrix4();
  private readonly fwd = new THREE.Vector3();
  private readonly side = new THREE.Vector3();
  private readonly up = new THREE.Vector3();
  private readonly worldUp = new THREE.Vector3(0, 1, 0);
  private time = 0;

  constructor(spec: SchoolSpec) {
    this.spec = spec;
    const rng = createRng(spec.seed);
    this.phase = rng.range(0, 100);
    this.flock = new Flock(spec, rng);

    const geometry = fishGeometry(spec.length, spec.heightRatio, spec.pattern);
    const phases = new Float32Array(spec.count);
    for (let i = 0; i < spec.count; i++) phases[i] = rng.range(0, 6.28);
    geometry.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phases, 1));

    const material = patchWater(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), { fish: true });
    this.mesh = new THREE.InstancedMesh(geometry, material, spec.count);
    // ADR 0006: with a wide aquarium a school that is out of the picture is not drawn. The school wanders inside its box,
    // so a fixed box around it does for culling (computing it from the instances every frame would cost more).
    const pad = spec.length * 2;
    this.box = new THREE.Box3(
      new THREE.Vector3(spec.min[0] - pad, spec.min[1] - pad, spec.min[2] - pad),
      new THREE.Vector3(spec.max[0] + pad, spec.max[1] + pad, spec.max[2] + pad),
    );
    this.mesh.frustumCulled = false;
    const tint = new THREE.Color();
    for (let i = 0; i < spec.count; i++) {
      tint.set(spec.pattern === 'tang' || spec.pattern === 'banner' ? 0xffffff : rng.pick(spec.colors));
      this.mesh.setColorAt(i, tint);
    }
    this.writeMatrices();
  }

  private static readonly frustum = new THREE.Frustum();
  private static readonly projection = new THREE.Matrix4();

  /** Shows the school only while its box is in the picture. */
  cull(camera: THREE.Camera): void {
    FishSchool.projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    FishSchool.frustum.setFromProjectionMatrix(FishSchool.projection);
    this.mesh.visible = FishSchool.frustum.intersectsBox(this.box);
  }

  update(dt: number): void {
    this.time += dt;
    const { min, max } = this.spec;
    const t = this.time * 0.12 + this.phase;
    const target: Vec3 = [
      (min[0] + max[0]) / 2 + Math.sin(t) * (max[0] - min[0]) * 0.32,
      (min[1] + max[1]) / 2 + Math.sin(t * 1.7) * (max[1] - min[1]) * 0.25,
      (min[2] + max[2]) / 2 + Math.cos(t * 0.8) * (max[2] - min[2]) * 0.32,
    ];
    this.flock.step(dt, target);
    this.writeMatrices();
  }

  private writeMatrices(): void {
    const { pos, vel } = this.flock;
    for (let i = 0; i < this.flock.count; i++) {
      const i3 = i * 3;
      this.fwd.set(vel[i3], vel[i3 + 1], vel[i3 + 2]).normalize();
      this.side.crossVectors(this.fwd, this.worldUp);
      if (this.side.lengthSq() < 1e-6) this.side.set(0, 0, 1);
      this.side.normalize();
      this.up.crossVectors(this.side, this.fwd);
      this.m.makeBasis(this.fwd, this.up, this.side);
      this.m.setPosition(pos[i3], pos[i3 + 1], pos[i3 + 2]);
      this.mesh.setMatrixAt(i, this.m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

/** The first version's four schools (the middle of the aquarium) … */
const MIDDLE_SCHOOLS: SchoolSpec[] = [
  { count: 70, length: 0.62, heightRatio: 0.42, pattern: 'plain', colors: [0xff8a1f, 0xff9e3a, 0xff7a2a, 0xffb347], min: [-11, 1, -8], max: [7, 5.5, 3], minSpeed: 0.9, maxSpeed: 1.8, seed: 11 },
  { count: 90, length: 0.5, heightRatio: 0.3, pattern: 'sardine', colors: [0xcfe3f0, 0xaecbe0, 0xdcecf6], min: [-19, 4.5, -12], max: [19, 9.5, 2], minSpeed: 2, maxSpeed: 3.2, seed: 12 },
  { count: 12, length: 1.0, heightRatio: 0.6, pattern: 'tang', colors: [], min: [1, 1.5, -6], max: [17, 5.5, 3], minSpeed: 1, maxSpeed: 1.8, seed: 13 },
  { count: 8, length: 0.95, heightRatio: 0.85, pattern: 'banner', colors: [], min: [-15, 2, -8], max: [1, 6.5, 2], minSpeed: 0.8, maxSpeed: 1.4, seed: 14 },
];

/** … and the same kinds of schools further out, so the background life fills the whole width (ADR 0006). */
const WIDE_SCHOOLS: SchoolSpec[] = [
  { count: 30, length: 0.62, heightRatio: 0.42, pattern: 'plain', colors: [0xff8a1f, 0xff9e3a, 0xff7a2a, 0xffb347], min: [-44, 1, -8], max: [-29, 5.5, 3], minSpeed: 0.9, maxSpeed: 1.8, seed: 21 },
  { count: 30, length: 0.62, heightRatio: 0.42, pattern: 'plain', colors: [0xff8a1f, 0xff9e3a, 0xff7a2a, 0xffb347], min: [28, 1, -8], max: [43, 5.5, 3], minSpeed: 0.9, maxSpeed: 1.8, seed: 31 },
  { count: 24, length: 0.5, heightRatio: 0.3, pattern: 'sardine', colors: [0xcfe3f0, 0xaecbe0, 0xdcecf6], min: [-48, 4.5, -12], max: [-27, 9.5, 2], minSpeed: 2, maxSpeed: 3.2, seed: 22 },
  { count: 24, length: 0.5, heightRatio: 0.3, pattern: 'sardine', colors: [0xcfe3f0, 0xaecbe0, 0xdcecf6], min: [27, 4.5, -12], max: [48, 9.5, 2], minSpeed: 2, maxSpeed: 3.2, seed: 32 },
  { count: 6, length: 1.0, heightRatio: 0.6, pattern: 'tang', colors: [], min: [-39, 1.5, -6], max: [-24, 5.5, 3], minSpeed: 1, maxSpeed: 1.8, seed: 23 },
  { count: 6, length: 1.0, heightRatio: 0.6, pattern: 'tang', colors: [], min: [23, 1.5, -6], max: [38, 5.5, 3], minSpeed: 1, maxSpeed: 1.8, seed: 33 },
  { count: 5, length: 0.95, heightRatio: 0.85, pattern: 'banner', colors: [], min: [-46, 2, -8], max: [-31, 6.5, 2], minSpeed: 0.8, maxSpeed: 1.4, seed: 24 },
  { count: 5, length: 0.95, heightRatio: 0.85, pattern: 'banner', colors: [], min: [30, 2, -8], max: [45, 6.5, 2], minSpeed: 0.8, maxSpeed: 1.4, seed: 34 },
];

export const SCHOOLS: SchoolSpec[] = [...MIDDLE_SCHOOLS, ...WIDE_SCHOOLS];

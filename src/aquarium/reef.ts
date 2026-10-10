import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createRng, type Rng } from '../util/random';
import { patchWater } from './materials';
import { REEF_HALF_WIDTH, terrainHeight } from './terrain';

type ColorFn = (x: number, y: number, z: number) => THREE.Color;
type SwayFn = (x: number, y: number, z: number) => number;

const UP = new THREE.Vector3(0, 1, 0);
const ONE = new THREE.Vector3(1, 1, 1);

/** Cheap smooth-ish 3D noise in [-1, 1]. */
export function noise3(x: number, y: number, z: number): number {
  return (
    Math.sin(x * 2.1 + y * 1.3 + 1.1) * Math.sin(y * 2.7 - z * 1.9 + 2.3) * Math.sin(z * 2.3 + x * 1.7 + 0.4)
  );
}

/** Welds vertices (smooth normals) and strips attributes so parts can be merged. */
function prep(g: THREE.BufferGeometry): THREE.BufferGeometry {
  g.deleteAttribute('uv');
  g.deleteAttribute('normal');
  return mergeVertices(g.index ? g.toNonIndexed() : g);
}

/** Collects many small parts (with baked vertex colors + sway weights) into one mesh. */
class Batch {
  private readonly geos: THREE.BufferGeometry[] = [];

  add(source: THREE.BufferGeometry, matrix: THREE.Matrix4, color: ColorFn, sway: SwayFn = () => 0): void {
    const g = prep(source);
    const pos = g.getAttribute('position');
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const c = color(pos.getX(i), pos.getY(i), pos.getZ(i));
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    g.applyMatrix4(matrix);
    const swayArr = new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i++) swayArr[i] = sway(pos.getX(i), pos.getY(i), pos.getZ(i));
    g.setAttribute('sway', new THREE.BufferAttribute(swayArr, 1));
    g.deleteAttribute('normal');
    g.computeVertexNormals();
    this.geos.push(g);
  }

  /** For geometry that already is in world space with all attributes set. */
  addRaw(g: THREE.BufferGeometry): void {
    this.geos.push(g);
  }

  build(material: THREE.Material): THREE.Mesh | null {
    if (this.geos.length === 0) return null;
    const merged = mergeGeometries(this.geos, false);
    this.geos.forEach((g) => g.dispose());
    const mesh = new THREE.Mesh(merged, material);
    mesh.frustumCulled = false;
    return mesh;
  }
}

const c = (hex: number): THREE.Color => new THREE.Color(hex);
const lerpC = (a: THREE.Color, b: THREE.Color, t: number): THREE.Color => a.clone().lerp(b, Math.min(1, Math.max(0, t)));
const place = (x: number, z: number, sink = 0.08): THREE.Vector3 => new THREE.Vector3(x, terrainHeight(x, z) - sink, z);

const BRANCH_PALETTES: Array<[number, number]> = [
  [0xff5fa8, 0xffc4dc],
  [0xd23fa0, 0xff9bd0],
  [0xff7a45, 0xffc79a],
  [0x8f78ee, 0xe2d6ff],
  [0xff8fa8, 0xffe6ec],
];
const DOME_COLORS = [0x8e5cc4, 0xe9779f, 0xf0a050, 0x3fa39b, 0xd060c8, 0x4e7fd8, 0xf2c45c];
const TABLE_COLORS = [0x2fb8a0, 0x4ec4d8, 0x62cf9f, 0x3d9bd0];

function addBranching(batch: Batch, base: THREE.Vector3, rng: Rng, scale: number): void {
  const [lo, hi] = rng.pick(BRANCH_PALETTES);
  const cLo = c(lo);
  const cHi = c(hi);
  // Distant corals are hazy anyway (the fog hides their twigs): fewer twigs keep the triangle count down. So are the corals far out to the sides
  // (ADR 0006: the visible number of triangles must not grow compared with the first version).
  const maxDepth = base.z < -9 ? 3 : Math.abs(base.x) > 19 ? 4 : 5;
  // Square twigs for what is far away or far out to the side: the haze and the distance hide it.
  const thin = base.z < -9 || Math.abs(base.x) > 19;
  const totalH = 2.2 * scale;
  const swayFn: SwayFn = (_x, y) => Math.pow(Math.min(1, Math.max(0, (y - base.y) / totalH)), 2) * 0.55;

  const grow = (origin: THREE.Vector3, dir: THREE.Vector3, len: number, rad: number, depth: number): void => {
    const tStart = 1 - (depth + 1) / (maxDepth + 1);
    const tEnd = 1 - depth / (maxDepth + 1);
    const geo = new THREE.CylinderGeometry(rad * 0.72, rad, len, thin ? 4 : 5, 1);
    geo.translate(0, len / 2, 0);
    const m = new THREE.Matrix4().compose(origin, new THREE.Quaternion().setFromUnitVectors(UP, dir), ONE);
    batch.add(geo, m, (_x, y) => lerpC(cLo, cHi, tStart + (tEnd - tStart) * (y / len)), swayFn);
    const end = origin.clone().addScaledVector(dir, len);
    if (depth === 0) {
      const tip = new THREE.SphereGeometry(rad * 0.9, 4, 3);
      batch.add(tip, new THREE.Matrix4().makeTranslation(end.x, end.y, end.z), () => cHi, swayFn);
      return;
    }
    const n = rng.next() < 0.35 ? 3 : 2;
    for (let i = 0; i < n; i++) {
      const axis = new THREE.Vector3(rng.range(-1, 1), 0, rng.range(-1, 1)).normalize();
      const child = dir.clone().applyAxisAngle(axis, rng.range(0.35, 0.75));
      child.y += 0.35;
      child.normalize();
      grow(end, child, len * 0.78, rad * 0.72, depth - 1);
    }
  };
  grow(base, new THREE.Vector3(rng.range(-0.15, 0.15), 1, rng.range(-0.15, 0.15)).normalize(), 0.45 * scale, 0.1 * scale, maxDepth);
}

function addDome(batch: Batch, base: THREE.Vector3, rng: Rng, scale: number): void {
  const col = c(rng.pick(DOME_COLORS));
  const dark = col.clone().multiplyScalar(0.62);
  const g = prep(new THREE.IcosahedronGeometry(1, 3));
  const pos = g.getAttribute('position');
  const seed = rng.range(0, 50);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    let y = pos.getY(i);
    const z = pos.getZ(i);
    const bump = noise3(x * 2 + seed, y * 2, z * 2) * 0.1 + noise3(x * 5, y * 5 + seed, z * 5) * 0.04;
    if (y < 0) y *= 0.15;
    const r = 1 + bump;
    pos.setXYZ(i, x * r, y * r, z * r);
  }
  const m = new THREE.Matrix4().compose(
    base,
    new THREE.Quaternion().setFromAxisAngle(UP, rng.range(0, 6.28)),
    new THREE.Vector3(scale * rng.range(0.9, 1.4), scale * rng.range(0.55, 0.9), scale * rng.range(0.9, 1.4)),
  );
  batch.add(g, m, (x, y, z) => {
    const ridge = 1 - Math.abs(noise3(x * 4 + seed, y * 4, z * 4)); // bright ridges, dark grooves
    return lerpC(dark, col, Math.pow(ridge, 2.2) + 0.15);
  });
}

function addTable(batch: Batch, base: THREE.Vector3, rng: Rng, scale: number): void {
  const col = c(rng.pick(TABLE_COLORS));
  const stalkH = rng.range(0.5, 1.1) * scale;
  const stalk = new THREE.CylinderGeometry(0.22 * scale, 0.32 * scale, stalkH, 6, 1);
  stalk.translate(0, stalkH / 2, 0);
  batch.add(stalk, new THREE.Matrix4().makeTranslation(base.x, base.y, base.z), () => col.clone().multiplyScalar(0.55));

  const plate = prep(new THREE.CylinderGeometry(1.7 * scale, 0.9 * scale, 0.22 * scale, 18, 1));
  const pos = plate.getAttribute('position');
  const seed = rng.range(0, 50);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const ang = Math.atan2(z, x);
    const wob = 1 + 0.12 * Math.sin(ang * 5 + seed) + 0.06 * Math.sin(ang * 9 + seed * 2);
    pos.setXYZ(i, x * wob, pos.getY(i) + 0.08 * scale * Math.sin(x * 1.5 + seed), z * wob);
  }
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rng.range(-0.12, 0.12), rng.range(0, 6.28), rng.range(-0.12, 0.12)));
  batch.add(
    plate,
    new THREE.Matrix4().compose(new THREE.Vector3(base.x, base.y + stalkH, base.z), q, ONE),
    (x, _y, z) => lerpC(col, c(0xd8fff0), Math.min(1, Math.hypot(x, z) / (2 * scale)) * 0.45),
  );
}

function addAnemone(batch: Batch, base: THREE.Vector3, rng: Rng, scale: number): void {
  const col = c(rng.pick([0xffd23a, 0xffb02e, 0xffe66a, 0xff8a3a]));
  const tipCol = col.clone().lerp(c(0xffffff), 0.35);
  const spikes = 16;
  for (let i = 0; i < spikes; i++) {
    const a = (i / spikes) * Math.PI * 2 + rng.range(-0.2, 0.2);
    const tilt = rng.range(0.35, 1.0);
    const dir = new THREE.Vector3(Math.sin(tilt) * Math.cos(a), Math.cos(tilt), Math.sin(tilt) * Math.sin(a));
    const len = rng.range(0.45, 0.8) * scale;
    const g = new THREE.ConeGeometry(0.06 * scale, len, 4, 1);
    g.translate(0, len / 2, 0);
    const m = new THREE.Matrix4().compose(base, new THREE.Quaternion().setFromUnitVectors(UP, dir), ONE);
    batch.add(g, m, (_x, y) => lerpC(col, tipCol, y / len), (_x, y) => Math.max(0, (y - base.y) / scale) * 0.5);
  }
  const core = new THREE.SphereGeometry(0.14 * scale, 6, 4);
  batch.add(core, new THREE.Matrix4().makeTranslation(base.x, base.y + 0.05, base.z), () => col.clone().multiplyScalar(0.8));
}

function addRock(batch: Batch, base: THREE.Vector3, rng: Rng, scale: number, colorHex: number): void {
  const col = c(colorHex);
  const g = prep(new THREE.IcosahedronGeometry(1, 2));
  const pos = g.getAttribute('position');
  const seed = rng.range(0, 50);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const r = 1 + noise3(x * 1.5 + seed, y * 1.5, z * 1.5) * 0.3;
    pos.setXYZ(i, x * r, y < 0 ? y * 0.3 : y * r, z * r);
  }
  const m = new THREE.Matrix4().compose(
    base,
    new THREE.Quaternion().setFromAxisAngle(UP, rng.range(0, 6.28)),
    new THREE.Vector3(scale * rng.range(0.9, 1.5), scale * rng.range(0.5, 0.9), scale * rng.range(0.9, 1.3)),
  );
  batch.add(g, m, (x, y, z) => lerpC(col.clone().multiplyScalar(0.7), col, 0.5 + 0.5 * noise3(x * 3, y * 3, z * 3)));
}

/** The big blue coral mass at the right edge of the reference photos. */
function addFormation(batch: Batch, center: THREE.Vector3, size: THREE.Vector3, rng: Rng): void {
  const g = prep(new THREE.IcosahedronGeometry(1, 4));
  const pos = g.getAttribute('position');
  const seed = rng.range(0, 50);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const r = 1 + noise3(x * 1.3 + seed, y * 1.3, z * 1.3) * 0.28 + noise3(x * 4, y * 4 + seed, z * 4) * 0.07;
    pos.setXYZ(i, x * r, y < -0.2 ? -0.2 * r : y * r, z * r);
  }
  const deep = c(0x1f4fa6);
  const light = c(0x5fa6f2);
  batch.add(g, new THREE.Matrix4().compose(center, new THREE.Quaternion(), size), (x, y, z) => {
    const t = 0.5 + 0.5 * noise3(x * 6, y * 6, z * 6);
    return lerpC(deep, light, Math.pow(t, 1.6) * 0.8 + Math.max(0, y) * 0.1);
  });
}

/** Ribbon blade, already in world space. `strength` scales how far the tip sways. */
function makeBlade(
  origin: THREE.Vector3,
  height: number,
  width: number,
  yaw: number,
  bend: number,
  baseCol: THREE.Color,
  tipCol: THREE.Color,
  strength: number,
): THREE.BufferGeometry {
  const rings = 6;
  const positions: number[] = [];
  const colors: number[] = [];
  const sway: number[] = [];
  const index: number[] = [];
  const dirX = Math.cos(yaw);
  const dirZ = Math.sin(yaw);
  for (let i = 0; i <= rings; i++) {
    const t = i / rings;
    const cx = origin.x + dirX * bend * height * t * t;
    const cy = origin.y + height * t;
    const cz = origin.z + dirZ * bend * height * t * t;
    const half = (width * (1 - t * 0.9)) / 2;
    // Blade width runs perpendicular to the bend direction.
    for (const side of [-1, 1]) {
      positions.push(cx - dirZ * half * side, cy, cz + dirX * half * side);
      const col = lerpC(baseCol, tipCol, t);
      colors.push(col.r, col.g, col.b);
      sway.push(Math.pow(t, 1.6) * strength);
    }
    if (i < rings) {
      const a = i * 2;
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.setAttribute('sway', new THREE.Float32BufferAttribute(sway, 1));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

function addGrassTuft(batch: Batch, base: THREE.Vector3, rng: Rng, scale: number, tall: boolean): void {
  const palette = tall
    ? [[0x2c7a4b, 0x9ad66a]]
    : [
        [0x1f9d8e, 0xa8f0d8],
        [0x2bb39a, 0xc4fae6],
        [0x3aa86e, 0xb6f0a0],
      ];
  const [lo, hi] = rng.pick(palette);
  const blades = tall ? rng.int(4, 6) : rng.int(14, 22);
  for (let i = 0; i < blades; i++) {
    const r = rng.range(0, 0.7) * scale;
    const a = rng.range(0, 6.28);
    const origin = new THREE.Vector3(base.x + Math.cos(a) * r, base.y, base.z + Math.sin(a) * r);
    const h = tall ? rng.range(4, 7.5) : rng.range(0.9, 1.9) * scale;
    batch.addRaw(
      makeBlade(origin, h, tall ? rng.range(0.45, 0.7) : rng.range(0.16, 0.26), rng.range(0, 6.28), rng.range(0.1, 0.4), c(lo), c(hi), tall ? 2.6 : 1.5),
    );
  }
}

interface Patch {
  x: number;
  z: number;
  rx: number;
  rz: number;
  branching?: number;
  domes?: number;
  tables?: number;
  anemones?: number;
  rocks?: number;
  grass?: number;
  kelp?: number;
  scale?: number;
}

const PATCHES: Patch[] = [
  // foreground reefs fill the lower corners, leaving a sandy path in the middle
  { x: -9, z: 4, rx: 6, rz: 3, branching: 9, domes: 7, anemones: 7, rocks: 3, scale: 1.2 },
  { x: 9, z: 3.5, rx: 6.5, rz: 3, branching: 10, domes: 8, anemones: 8, tables: 2, rocks: 2, scale: 1.2 },
  { x: -15, z: 6, rx: 3, rz: 2, domes: 3, branching: 4, anemones: 3, scale: 1.4 },
  { x: 15, z: 6.5, rx: 3, rz: 2, domes: 3, branching: 4, anemones: 3, scale: 1.4 },
  // close to the camera, so the bottom of the screen is never just bare sand
  { x: -4, z: 10, rx: 7, rz: 1.5, domes: 3, branching: 4, anemones: 4, grass: 4, scale: 0.9 },
  { x: 6, z: 11, rx: 6, rz: 1.5, domes: 2, branching: 3, anemones: 4, grass: 3, scale: 0.9 },
  // mid-distance reef
  { x: -1, z: -5, rx: 14, rz: 4, branching: 9, domes: 12, tables: 6, rocks: 4, anemones: 4, scale: 1.3 },
  // far reefs (faded by fog)
  { x: -17, z: -13, rx: 8, rz: 4, domes: 7, tables: 7, branching: 5, scale: 1.6 },
  { x: 14, z: -14, rx: 10, rz: 4, domes: 8, tables: 7, branching: 5, scale: 1.6 },
  // grass in the sand
  { x: 0, z: 6.5, rx: 5, rz: 1.2, grass: 8, scale: 1.2 },
  { x: -4, z: 0, rx: 3, rz: 2, grass: 5 },
  { x: 4, z: -1, rx: 3, rz: 2, grass: 4 },
  { x: -3, z: -5, rx: 3, rz: 2, kelp: 4 },
  { x: -15, z: -9, rx: 3, rz: 2, kelp: 3 },
  { x: 11, z: -10, rx: 3, rz: 2, kelp: 3 },
];

/** ADR 0006: the reef is built in chunks along the width, so what is outside the picture is not drawn (frustum culling). */
export const CHUNK_WIDTH = 7;
export const COLUMN_COUNT = Math.ceil((2 * REEF_HALF_WIDTH) / CHUNK_WIDTH);
/** Depth bands: near the glass, the middle and far back. A chunk that spanned the whole depth could never be culled well. */
export const BAND_COUNT = 3;
export const CHUNK_COUNT = COLUMN_COUNT * BAND_COUNT;

/** Which chunk (column × depth band) a point at (x, z) belongs to. */
export function chunkIndex(x: number, z = 0): number {
  const column = Math.min(COLUMN_COUNT - 1, Math.max(0, Math.floor((x + REEF_HALF_WIDTH) / CHUNK_WIDTH)));
  const band = z > 3 ? 0 : z > -7 ? 1 : 2;
  return column * BAND_COUNT + band;
}

/** The reef outside the middle ±24 that the first version had: the wider aquarium (ADR 0006), in the same style. */
const EXTRA_PATCHES: Patch[] = [
  // joining the middle to the sides
  { x: 21.5, z: 4.5, rx: 3, rz: 2.5, branching: 2, domes: 3, anemones: 2, scale: 1.2 },
  { x: -22, z: 4, rx: 3, rz: 2.5, branching: 2, domes: 3, anemones: 2, scale: 1.2 },
  // right
  { x: 28, z: 3.5, rx: 5, rz: 3, branching: 4, domes: 4, anemones: 3, rocks: 2, scale: 1.2 },
  { x: 36, z: 5, rx: 5, rz: 3, branching: 4, domes: 4, anemones: 3, tables: 1, scale: 1.2 },
  { x: 44, z: 5, rx: 3.5, rz: 3, domes: 3, branching: 2, anemones: 2, scale: 1.3 },
  { x: 30, z: 10.5, rx: 5, rz: 1.5, domes: 2, branching: 2, anemones: 2, grass: 3, scale: 0.9 },
  { x: 41, z: 11, rx: 5, rz: 1.5, domes: 2, branching: 2, anemones: 2, grass: 3, scale: 0.9 },
  { x: 33, z: -5, rx: 12, rz: 4, branching: 4, domes: 7, tables: 4, rocks: 3, anemones: 2, scale: 1.3 },
  { x: 36, z: -14, rx: 10, rz: 4, domes: 5, tables: 4, branching: 2, scale: 1.6 },
  { x: 29, z: 1, rx: 3, rz: 2, grass: 4 },
  { x: 38, z: 0, rx: 3, rz: 2, grass: 4, kelp: 3 },
  { x: 27, z: -9, rx: 3, rz: 2, kelp: 3 },
  // left
  { x: -28, z: 3, rx: 5, rz: 3, branching: 4, domes: 4, anemones: 3, rocks: 2, scale: 1.2 },
  { x: -36, z: 4.5, rx: 5, rz: 3, branching: 4, domes: 4, anemones: 3, tables: 1, scale: 1.2 },
  { x: -44, z: 5, rx: 3.5, rz: 3, domes: 3, branching: 2, anemones: 2, scale: 1.3 },
  { x: -31, z: 10.5, rx: 5, rz: 1.5, domes: 2, branching: 2, anemones: 2, grass: 3, scale: 0.9 },
  { x: -41, z: 11, rx: 5, rz: 1.5, domes: 2, branching: 2, anemones: 2, grass: 3, scale: 0.9 },
  { x: -33, z: -5, rx: 12, rz: 4, branching: 4, domes: 7, tables: 4, rocks: 3, anemones: 2, scale: 1.3 },
  { x: -37, z: -14, rx: 10, rz: 4, domes: 5, tables: 4, branching: 2, scale: 1.6 },
  { x: -30, z: 0, rx: 3, rz: 2, grass: 4 },
  { x: -39, z: -1, rx: 3, rz: 2, grass: 4, kelp: 3 },
  { x: -26, z: -9, rx: 3, rz: 2, kelp: 3 },
];

export interface Reef {
  group: THREE.Group;
  sand: THREE.Mesh;
  /** One mesh per chunk (index = chunkIndex; null where nothing grows), for counting and tests. */
  chunks: Array<THREE.Mesh | null>;
  /** Shows only the chunks whose box is in the picture (call once per frame, after the camera has moved). */
  cull(camera: THREE.Camera): void;
}

export function buildSand(): THREE.Mesh {
  const w = 220;
  const d = 170;
  // 4-unit cells: the dunes are gentle, and nothing here needs more (ADR 0006: keep the triangle count down).
  const g = new THREE.PlaneGeometry(w, d, 55, 43);
  g.rotateX(-Math.PI / 2);
  g.translate(0, 0, -(d / 2) + 25);
  const pos = g.getAttribute('position');
  const colors = new Float32Array(pos.count * 3);
  const sandA = c(0xf4ecd4);
  const sandB = c(0xc9d8cf);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = terrainHeight(x, z);
    pos.setY(i, h);
    const col = lerpC(sandB, sandA, 0.55 + h * 0.5 + 0.12 * Math.sin(x * 1.3 + z * 0.7));
    colors.set([col.r, col.g, col.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.computeVertexNormals();
  const mat = patchWater(new THREE.MeshLambertMaterial({ vertexColors: true }), { caustics: 0.2 });
  const mesh = new THREE.Mesh(g, mat);
  mesh.frustumCulled = false;
  return mesh;
}

export function buildReef(seed = 7): Reef {
  const rng = createRng(seed);
  // One batch (and so one draw call) per chunk: the hard corals and rocks have a sway weight of 0, so they do not move.
  const batches = Array.from({ length: CHUNK_COUNT }, () => new Batch());
  const solid = batches;
  const soft = batches;

  const fill = (patches: Patch[]): void => {
    for (const p of patches) {
      const pt = (): THREE.Vector3 => {
        const a = rng.range(0, 6.28);
        const r = Math.sqrt(rng.next());
        return place(p.x + Math.cos(a) * r * p.rx, p.z + Math.sin(a) * r * p.rz);
      };
      const s = p.scale ?? 1;
      for (let i = 0; i < (p.branching ?? 0); i++) {
        const at = pt();
        addBranching(soft[chunkIndex(at.x, at.z)], at, rng, rng.range(1.0, 1.6) * s);
      }
      for (let i = 0; i < (p.domes ?? 0); i++) {
        const at = pt();
        addDome(solid[chunkIndex(at.x, at.z)], at, rng, rng.range(0.7, 1.3) * s);
      }
      for (let i = 0; i < (p.tables ?? 0); i++) {
        const at = pt();
        addTable(solid[chunkIndex(at.x, at.z)], at, rng, rng.range(0.8, 1.3) * s);
      }
      for (let i = 0; i < (p.anemones ?? 0); i++) {
        const at = pt();
        addAnemone(soft[chunkIndex(at.x, at.z)], at, rng, rng.range(0.8, 1.3) * s);
      }
      for (let i = 0; i < (p.rocks ?? 0); i++) {
        const at = pt();
        addRock(solid[chunkIndex(at.x, at.z)], at, rng, rng.range(0.7, 1.5) * s, rng.pick([0x2f6f7a, 0x3b5a8a, 0x4a6f7a]));
      }
      for (let i = 0; i < (p.grass ?? 0); i++) {
        const at = pt();
        addGrassTuft(soft[chunkIndex(at.x, at.z)], at, rng, rng.range(0.9, 1.4) * s, false);
      }
      for (let i = 0; i < (p.kelp ?? 0); i++) {
        const at = pt();
        addGrassTuft(soft[chunkIndex(at.x, at.z)], at, rng, 1, true);
      }
    }
  };
  fill(PATCHES); // the middle: exactly the first version's reef
  fill(EXTRA_PATCHES);

  // The big blue coral masses: the photos' one on the right, one on the left, and one at each end of the aquarium.
  for (const [x, y, z, sx, sy, sz] of [
    [21, 3.2, -6, 5.5, 9.5, 5],
    [-27, 2.5, -12, 6, 7, 5],
    [43, 3, -4, 6.5, 9, 5.5],
    [-45, 3, -6, 6.5, 9, 5.5],
  ] as const) {
    addFormation(solid[chunkIndex(x, z)], new THREE.Vector3(x, y, z), new THREE.Vector3(sx, sy, sz), rng);
  }

  const group = new THREE.Group();
  const material = patchWater(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), { sway: true, caustics: 0.12 });
  const chunks: Reef['chunks'] = [];
  const boxes = new Map<THREE.Mesh, THREE.Box3>();
  for (let i = 0; i < CHUNK_COUNT; i++) {
    const mesh = batches[i].build(material);
    chunks.push(mesh);
    if (!mesh) continue;
    // We cull by each chunk's box (tighter than the sphere three.js would use, which is huge for a long chunk).
    mesh.frustumCulled = false;
    mesh.geometry.computeBoundingBox();
    // The sway moves vertices a little, so the box is a little roomy: a chunk never pops out at the picture's edge.
    boxes.set(mesh, (mesh.geometry.boundingBox as THREE.Box3).clone().expandByScalar(2.5));
    group.add(mesh);
  }
  const frustum = new THREE.Frustum();
  const projection = new THREE.Matrix4();
  const cull = (camera: THREE.Camera): void => {
    camera.updateMatrixWorld();
    projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(projection);
    for (const [mesh, box] of boxes) mesh.visible = frustum.intersectsBox(box);
  };
  return { group, sand: buildSand(), chunks, cull };
}

/** Where corals and rocks grow (ellipses on the sand, a little smaller than the patches): the bottom dwellers walk around these; they do walk through grass. */
export function reefObstacles(): Array<{ x: number; z: number; rx: number; rz: number }> {
  return [...PATCHES, ...EXTRA_PATCHES]
    .filter((p) => (p.branching ?? 0) + (p.domes ?? 0) + (p.tables ?? 0) + (p.rocks ?? 0) > 0)
    .map((p) => ({ x: p.x, z: p.z, rx: p.rx * 0.72, rz: p.rz * 0.72 }));
}

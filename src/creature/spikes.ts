import * as THREE from 'three';

/** CONTEXT: Pigge – the sea urchin's 3D spikes (instanced), coloured by the drawing where each one is rooted. */
export const SPIKE_COUNT = 120;

/** Shared by all urchins: a thin cone with its root at the origin, pointing up (+y). */
let spikeGeometry: THREE.BufferGeometry | null = null;
function geometry(): THREE.BufferGeometry {
  if (!spikeGeometry) {
    spikeGeometry = new THREE.ConeGeometry(0.035, 1, 5, 1, true);
    spikeGeometry.translate(0, 0.5, 0);
  }
  return spikeGeometry;
}

/** Picks `count` roots spread over the upper side of the body: vertices that face up, at least `minGap` apart. */
export function spikeRoots(body: THREE.BufferGeometry, count: number, minGap: number, random: () => number): Array<{ pos: THREE.Vector3; normal: THREE.Vector3; uv: [number, number] }> {
  const pos = body.getAttribute('position');
  const nor = body.getAttribute('normal');
  const uv = body.getAttribute('uv');
  const side = body.getAttribute('side');
  const ids: number[] = [];
  for (let i = 0; i < pos.count; i++) if (side.getX(i) < 0.5 && nor.getY(i) > 0.15) ids.push(i);
  // Deterministic shuffle by the creature's own random numbers.
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  const out: Array<{ pos: THREE.Vector3; normal: THREE.Vector3; uv: [number, number] }> = [];
  for (const i of ids) {
    const p = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
    if (out.some((o) => o.pos.distanceToSquared(p) < minGap * minGap)) continue;
    out.push({ pos: p, normal: new THREE.Vector3(nor.getX(i), nor.getY(i), nor.getZ(i)).normalize(), uv: [uv.getX(i), uv.getY(i)] });
    if (out.length >= count) break;
  }
  return out;
}

/** The spikes of one sea urchin: a single instanced mesh that sways a little. */
export class UrchinSpikes {
  readonly mesh: THREE.InstancedMesh;
  private readonly material: THREE.MeshLambertMaterial;
  private readonly roots: ReturnType<typeof spikeRoots>;
  private readonly phases: number[];
  private readonly length: number;
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly tilt = new THREE.Quaternion();
  private readonly e = new THREE.Euler();
  private readonly up = new THREE.Vector3(0, 1, 0);
  private readonly s = new THREE.Vector3();
  private readonly dir = new THREE.Vector3();

  constructor(body: THREE.BufferGeometry, drawing: HTMLCanvasElement, bodySize: number, random: () => number) {
    this.length = bodySize * 0.3;
    this.roots = spikeRoots(body, SPIKE_COUNT, bodySize * 0.075, random);
    this.phases = this.roots.map(() => random() * Math.PI * 2);
    this.material = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide });
    this.mesh = new THREE.InstancedMesh(geometry(), this.material, this.roots.length);
    this.mesh.frustumCulled = false;
    let pixels: Uint8ClampedArray | null = null;
    try {
      pixels = drawing.getContext('2d')?.getImageData(0, 0, drawing.width, drawing.height).data ?? null;
    } catch {
      pixels = null;
    }
    const c = new THREE.Color();
    this.roots.forEach((r, i) => {
      if (pixels) {
        const x = Math.min(drawing.width - 1, Math.max(0, Math.floor(r.uv[0] * drawing.width)));
        const y = Math.min(drawing.height - 1, Math.max(0, Math.floor((1 - r.uv[1]) * drawing.height)));
        const k = (y * drawing.width + x) * 4;
        c.setRGB(pixels[k] / 255, pixels[k + 1] / 255, pixels[k + 2] / 255, THREE.SRGBColorSpace);
      } else {
        c.set('#f1f4f6');
      }
      this.mesh.setColorAt(i, c);
    });
    this.update(0);
  }

  get count(): number {
    return this.roots.length;
  }

  /** The spikes sway (each with its own phase); `time` in seconds, `amount` 0…1 (0 = still, as on the flat drawing). */
  update(time: number, amount = 1): void {
    this.roots.forEach((r, i) => {
      const ph = this.phases[i];
      this.dir.copy(r.normal);
      // Tilt the direction a little about a sideways axis.
      this.e.set(Math.sin(time * 1.3 + ph) * 0.1 * amount, 0, Math.cos(time * 1.1 + ph * 1.7) * 0.1 * amount);
      this.q.setFromUnitVectors(this.up, this.dir);
      this.q.multiply(this.tilt.setFromEuler(this.e));
      this.s.set(1, this.length * (0.85 + 0.3 * ((i * 37) % 10) / 10), 1);
      this.m.compose(r.pos, this.q, this.s);
      this.mesh.setMatrixAt(i, this.m);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.material.dispose();
    this.mesh.dispose();
  }
}

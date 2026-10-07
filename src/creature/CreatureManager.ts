import * as THREE from 'three';
import { buildBody } from '../body/buildBody';
import { getTemplate, type Species } from '../species';
import { createRng } from '../util/random';
import { Creature } from './Creature';
import { MAX_CREATURES, planFarewells } from './limits';
import type { SwimBounds } from './swimmer';
import { Transition, type ViewRect } from './Transition';

/** Everything that swims in the aquarium (CONTEXT: Dyr) and the shared 3D bodies per species. */
export class CreatureManager {
  readonly creatures: Creature[] = [];
  bounds: SwimBounds = { min: [-12, 2, -9], max: [12, 8.8, 6], floorMargin: 3 };
  private readonly bodies = new Map<Species, THREE.BufferGeometry>();
  private readonly raycaster = new THREE.Raycaster();
  private readonly ndc = new THREE.Vector3();
  /** Called when a creature has swum out of the picture (or been deleted) and is gone for good. */
  onGone?: (creature: Creature) => void;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.PerspectiveCamera,
    private readonly maxAnisotropy = 4,
  ) {}

  /** Body geometry is generated once per species and shared by all its creatures (DESIGN 4.2: < 100 ms). */
  body(species: Species): THREE.BufferGeometry {
    let g = this.bodies.get(species);
    if (!g) {
      g = buildBody(getTemplate(species));
      this.bodies.set(species, g);
    }
    return g;
  }

  /**
   * An uncoloured creature in the template's base colour that is NOT part of the aquarium (not counted, not saved,
   * not updated here) – the animals shown in the species bubbles.
   */
  display(species: Species): Creature {
    const template = getTemplate(species);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 512;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    ctx.fillStyle = template.baseColor;
    ctx.fillRect(0, 0, 512, 512);
    return new Creature(template, this.body(species), canvas, undefined, this.maxAnisotropy);
  }

  /**
   * Builds the shared body and compiles the creature shader before the first "Slip løs", so the transition
   * does not hitch on shader compilation (a visible stutter on tablets).
   */
  warmUp(renderer: THREE.WebGLRenderer, species: Species = 'ray'): void {
    const probe = document.createElement('canvas');
    probe.width = probe.height = 8;
    const creature = this.spawn(probe, species, [0, 5, 0], 0);
    renderer.compile(this.scene, this.camera);
    this.remove(creature);
  }

  /**
   * "Slip løs": the new creature appears flat exactly over `rect` (the drawing's place on screen) and then
   * unfolds and swims into the aquarium (CONTEXT: Overgang).
   */
  release(
    drawing: HTMLCanvasElement,
    species: Species,
    rect: ViewRect,
    viewport: { width: number; height: number },
  ): Creature {
    const template = getTemplate(species);
    const creature = new Creature(template, this.body(species), drawing, undefined, this.maxAnisotropy);
    creature.transition = new Transition(template, this.camera, viewport, rect, this.bounds, createRng((Math.random() * 2 ** 32) >>> 0));
    creature.transition.update(0, creature.group); // pose it before the first rendered frame
    this.add(creature);
    return creature;
  }

  /** Puts an already swimming creature into the water (used for saved creatures in M4 and by tests). */
  spawn(drawing: HTMLCanvasElement, species: Species, pos?: [number, number, number], yaw?: number, meta?: { id?: string; createdAt?: number }): Creature {
    const template = getTemplate(species);
    const creature = new Creature(template, this.body(species), drawing, undefined, this.maxAnisotropy, meta);
    const r = creature.rng;
    const { min, max } = this.bounds;
    creature.startSwimming(
      pos ?? [r.range(min[0] + 2, max[0] - 2), r.range(5, max[1] - 1), r.range(min[2] + 2, max[2] - 2)],
      yaw ?? r.range(0, Math.PI * 2),
      0,
      creature.template.swim.cruiseSpeed[0],
    );
    this.add(creature);
    return creature;
  }

  add(creature: Creature): void {
    this.creatures.push(creature);
    this.scene.add(creature.group);
  }

  remove(creature: Creature): void {
    const i = this.creatures.indexOf(creature);
    if (i >= 0) this.creatures.splice(i, 1);
    this.scene.remove(creature.group);
    creature.dispose();
  }

  /** Creatures that count towards the cap (everyone except those already saying goodbye). */
  living(): Creature[] {
    return this.creatures.filter((c) => !c.leaving);
  }

  /** Makes room for `incoming` new creatures: the oldest ones swim away (CONTEXT: Afsked). Returns who is leaving. */
  makeRoom(incoming = 1, max = MAX_CREATURES): Creature[] {
    const leaving = planFarewells(this.living(), incoming, max);
    for (const c of leaving) c.beginFarewell();
    return leaving;
  }

  /** The creature under a screen point (normalised device coordinates −1…1), or null. Creatures leaving are ignored. */
  pick(ndcX: number, ndcY: number): Creature | null {
    this.camera.updateMatrixWorld();
    this.raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);
    const candidates = this.living();
    for (const c of candidates) c.group.updateMatrixWorld(true);
    const hit = this.raycaster.intersectObjects(candidates.map((c) => c.mesh), false)[0];
    return hit ? candidates.find((c) => c.mesh === hit.object) ?? null : null;
  }

  /**
   * A tap at a screen point: the creature there (if any, and free to react) hops or somersaults. Small fingers rarely
   * hit a small creature exactly, so a near miss counts too: the nearest creature centre within `slack` (NDC units, 2 = the screen
   * height, so 0.07 ≈ 30 px on a phone) is taken when the ray itself hits nothing.
   */
  reactAt(ndcX: number, ndcY: number, slack = 0.07): Creature | null {
    const c = this.pick(ndcX, ndcY) ?? this.nearest(ndcX, ndcY, slack);
    return c && c.react() ? c : null;
  }

  private nearest(ndcX: number, ndcY: number, slack: number): Creature | null {
    this.camera.updateMatrixWorld();
    const aspect = (this.camera as THREE.PerspectiveCamera).aspect || 1;
    let best: Creature | null = null;
    let bestD = slack;
    for (const c of this.living()) {
      const p = c.group.position.clone().project(this.camera);
      if (p.z > 1) continue;
      const d = Math.hypot((p.x - ndcX) * aspect, p.y - ndcY);
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  }

  update(dt: number): void {
    const swimmers = this.creatures.flatMap((c) => (c.swimmer ? [c.swimmer] : []));
    for (const c of this.creatures) c.update(dt, swimmers, this.bounds);
    // A creature that has said goodbye is removed once it is out of the picture.
    for (const c of [...this.creatures]) {
      if (!c.leaving) continue;
      this.ndc.copy(c.group.position).project(this.camera);
      if (Math.abs(this.ndc.x) > 1.4 || Math.abs(this.ndc.y) > 1.4 || c.leaving.t > 25) {
        this.remove(c);
        this.onGone?.(c);
      }
    }
  }
}

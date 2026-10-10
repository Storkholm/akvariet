import * as THREE from 'three';
import { buildBody } from '../body/buildBody';
import { getTemplate, type Species } from '../species';
import { createRng } from '../util/random';
import { Creature } from './Creature';
import { MAX_CREATURES, planFarewells } from './limits';
import type { SwimBounds } from './swimmer';
import { Transition, type ViewRect } from './Transition';
import { terrainHeight } from '../aquarium/terrain';
import { splitBody, type Fragment } from '../samurai/Fragment';
import { segmentHitsPolygon, type P2 } from '../samurai/slashGeometry';

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
    creature.transition = new Transition(template, this.camera, viewport, rect, this.bounds, createRng((Math.random() * 2 ** 32) >>> 0), !!template.swim.crawl);
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
    const crawl = !!template.swim.crawl;
    const x = r.range(min[0] + 2, max[0] - 2);
    const z = crawl ? r.range(Math.max(min[2] + 2, -4), Math.min(max[2] - 2, 8)) : r.range(min[2] + 2, max[2] - 2);
    creature.startSwimming(
      pos ?? [x, crawl ? terrainHeight(x, z) + 0.1 : r.range(5, max[1] - 1), z],
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
    // With a wide aquarium the nearest edge is the nearest edge of the *picture*, not of the aquarium.
    for (const c of leaving) c.beginFarewell(c.group.position.x >= this.camera.position.x ? 1 : -1);
    return leaving;
  }

  /** CONTEXT: Ruden – called once the camera is in place for this frame: starfish on the glass are laid in front of the lens. */
  updateGlass(dt: number, followed: Creature | null): void {
    for (const c of this.creatures) if (c.glass) c.stepGlass(dt, this.camera, c !== followed);
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
    const c = this.creatureAt(ndcX, ndcY, slack);
    return c && c.react() ? c : null;
  }

  /** The creature at a screen point, a near miss included (CONTEXT: Følg uses this for the double tap). */
  creatureAt(ndcX: number, ndcY: number, slack = 0.07): Creature | null {
    return this.pick(ndcX, ndcY) ?? this.nearest(ndcX, ndcY, slack);
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

  /**
   * CONTEXT: Hug (ADR 0008). The creatures whose body the swipe a→b crosses on the screen (pixels in a canvas of `viewport`).
   * Only creatures that swim freely can be cut: not one that is being released, saying goodbye or growing in.
   */
  crossed(a: P2, b: P2, viewport: { width: number; height: number }): Creature[] {
    this.camera.updateMatrixWorld();
    const tanHalf = Math.tan((this.camera.fov * Math.PI) / 360) / this.camera.zoom;
    const hits: Creature[] = [];
    const v = new THREE.Vector3();
    for (const c of this.living()) {
      if (c.mode !== 'swim' || !c.group.visible) continue;
      // Cheap first test: is the swipe anywhere near the creature at all?
      const centre = v.copy(c.group.position).project(this.camera);
      if (centre.z > 1) continue;
      const cx = (centre.x * 0.5 + 0.5) * viewport.width;
      const cy = (-centre.y * 0.5 + 0.5) * viewport.height;
      const dist = c.group.position.distanceTo(this.camera.position);
      const pxPerUnit = viewport.height / (2 * dist * tanHalf);
      const reach = c.template.size * 0.75 * pxPerUnit;
      if (distanceToSegment([cx, cy], a, b) > reach) continue;
      c.group.updateMatrixWorld(true);
      const { size, center } = c.template;
      const hit = c.template.parts.some((part) => {
        const poly: P2[] = part.outline.map(([u, w]) => {
          const p = v.set((u - center[0]) * size, 0, (w - center[1]) * size).applyMatrix4(c.mesh.matrixWorld).project(this.camera);
          return [(p.x * 0.5 + 0.5) * viewport.width, (-p.y * 0.5 + 0.5) * viewport.height] as P2;
        });
        return segmentHitsPolygon(a, b, poly);
      });
      if (hit) hits.push(c);
    }
    return hits;
  }

  /** Cuts a creature in two along a world plane: it is taken out of the water and its two pieces take its place. */
  cut(creature: Creature, plane: THREE.Plane): [Fragment, Fragment] {
    creature.group.updateMatrixWorld(true);
    const body = creature.takeBodyForCut();
    const pieces = splitBody(body, { group: creature.group, mesh: creature.mesh }, plane, () => creature.rng.next());
    this.remove(creature);
    return pieces;
  }

  update(dt: number): void {
    // Swimmers dodge swimmers, bottom dwellers (CONTEXT: Bunddyr) dodge each other.
    const swimmers = this.creatures.flatMap((c) => (c.swimmer && !c.template.swim.crawl ? [c.swimmer] : []));
    const crawlers = this.creatures.flatMap((c) => (c.swimmer && c.template.swim.crawl ? [c.swimmer] : []));
    for (const c of this.creatures) c.update(dt, c.template.swim.crawl ? crawlers : swimmers, this.bounds);
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

function distanceToSegment(p: P2, a: P2, b: P2): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

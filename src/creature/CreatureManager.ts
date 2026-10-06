import * as THREE from 'three';
import { buildBody } from '../body/buildBody';
import { getTemplate, type Species } from '../species';
import { createRng } from '../util/random';
import { Creature } from './Creature';
import type { SwimBounds } from './swimmer';
import { Transition, type ViewRect } from './Transition';

/** Everything that swims in the aquarium (CONTEXT: Dyr) and the shared 3D bodies per species. */
export class CreatureManager {
  readonly creatures: Creature[] = [];
  bounds: SwimBounds = { min: [-12, 2, -9], max: [12, 8.8, 6], floorMargin: 3 };
  private readonly bodies = new Map<Species, THREE.BufferGeometry>();

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

  update(dt: number): void {
    const swimmers = this.creatures.flatMap((c) => (c.swimmer ? [c.swimmer] : []));
    for (const c of this.creatures) c.update(dt, swimmers, this.bounds);
  }
}

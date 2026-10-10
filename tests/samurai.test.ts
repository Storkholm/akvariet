import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { pickSample } from '../src/audio/AudioEngine';
import { buildBody } from '../src/body/buildBody';
import { CleanupSharks, KEEP_AWAY, SHARK_COUNT, type Living } from '../src/samurai/CleanupSharks';
import { EAT_SECONDS, Fragment, splitBody } from '../src/samurai/Fragment';
import { Fragments } from '../src/samurai/Fragments';
import { HACKS_FOR_SHARKS, HOLD_SECONDS, IDLE_END_SECONDS, SamuraiSession } from '../src/samurai/session';
import { cutPlane, pointInPolygon, segmentHitsPolygon, segmentsCross, sideOfLine, type P2 } from '../src/samurai/slashGeometry';
import { terrainHeight } from '../src/aquarium/terrain';
import { rayTemplate } from '../src/species/ray';
import { createRng } from '../src/util/random';

describe('slash geometry', () => {
  it('finds crossing segments, also at the ends and for parallel lines', () => {
    expect(segmentsCross([0, 0], [10, 10], [0, 10], [10, 0])).toBe(true);
    expect(segmentsCross([0, 0], [10, 0], [0, 5], [10, 5])).toBe(false);
    expect(segmentsCross([0, 0], [10, 0], [10, 0], [10, 10])).toBe(true); // touching
    expect(segmentsCross([0, 0], [4, 0], [6, 0], [10, 0])).toBe(false); // collinear, apart
    expect(segmentsCross([0, 0], [4, 4], [3, 3], [8, 8])).toBe(true); // collinear, overlapping
  });

  const square: P2[] = [[10, 10], [30, 10], [30, 30], [10, 30]];
  it('knows what is inside a polygon', () => {
    expect(pointInPolygon([20, 20], square)).toBe(true);
    expect(pointInPolygon([5, 20], square)).toBe(false);
    expect(pointInPolygon([20, 35], square)).toBe(false);
  });

  it('a swipe hits a body when it crosses its edge or lies inside it, not when it passes by', () => {
    expect(segmentHitsPolygon([0, 20], [40, 20], square)).toBe(true); // straight through
    expect(segmentHitsPolygon([15, 15], [25, 25], square)).toBe(true); // entirely inside
    expect(segmentHitsPolygon([0, 20], [12, 20], square)).toBe(true); // ends inside
    expect(segmentHitsPolygon([0, 0], [40, 5], square)).toBe(false); // passes above
    expect(segmentHitsPolygon([0, 40], [40, 45], square)).toBe(false);
    expect(segmentHitsPolygon([0, 0], [1, 1], [[0, 0], [1, 1]])).toBe(false); // not a polygon
  });

  function camera(): THREE.PerspectiveCamera {
    const cam = new THREE.PerspectiveCamera(45, 1180 / 820, 0.1, 400);
    cam.position.set(2, 4, 24);
    cam.lookAt(0, 3.3, 0);
    cam.updateMatrixWorld();
    return cam;
  }
  const viewport = { width: 1180, height: 820 };

  it('the cut plane contains the camera and every world point that lies on the swipe line on the screen', () => {
    const cam = camera();
    const a: P2 = [300, 200];
    const b: P2 = [900, 600];
    const plane = cutPlane(cam, a, b, viewport);
    expect(plane).not.toBeNull();
    expect((plane as THREE.Plane).distanceToPoint(cam.position)).toBeCloseTo(0, 6);
    for (const t of [0, 0.3, 0.7, 1, 1.4]) {
      const px = a[0] + (b[0] - a[0]) * t;
      const py = a[1] + (b[1] - a[1]) * t;
      for (const depth of [0.9, 0.97, 0.99]) {
        const w = new THREE.Vector3((px / viewport.width) * 2 - 1, -((py / viewport.height) * 2 - 1), depth).unproject(cam);
        expect(Math.abs((plane as THREE.Plane).distanceToPoint(w))).toBeLessThan(1e-3);
      }
    }
  });

  it('points on one side of the swipe line on the screen are on one side of the plane, and the other side on the other', () => {
    const cam = camera();
    const a: P2 = [200, 500];
    const b: P2 = [1000, 250];
    const plane = cutPlane(cam, a, b, viewport) as THREE.Plane;
    const rng = createRng(3);
    let same = 0;
    let opposite = 0;
    for (let i = 0; i < 400; i++) {
      const world = new THREE.Vector3(rng.range(-8, 8), rng.range(1, 9), rng.range(-6, 8));
      const p = world.clone().project(cam);
      const screen: P2 = [(p.x * 0.5 + 0.5) * viewport.width, (-p.y * 0.5 + 0.5) * viewport.height];
      const s = sideOfLine(a, b, screen);
      if (s === 0) continue;
      if (Math.sign(plane.distanceToPoint(world)) === s) same++;
      else opposite++;
    }
    // Always the same relation (the sign convention), never a mix.
    expect(Math.min(same, opposite)).toBe(0);
    expect(same + opposite).toBeGreaterThan(300);
  });

  it('a swipe that is only a point gives no plane', () => {
    expect(cutPlane(camera(), [100, 100], [100, 100], viewport)).toBeNull();
  });
});

describe('SamuraiSession', () => {
  it('numbers from the design: hold 2 s, 3 cuts call the sharks, 60 s without a cut ends it', () => {
    expect(HOLD_SECONDS).toBe(2);
    expect(HACKS_FOR_SHARKS).toBe(3);
    expect(IDLE_END_SECONDS).toBe(60);
  });

  it('calls the sharks at the third cut – not before, and not while they are there', () => {
    const s = new SamuraiSession();
    s.start();
    s.recordHack(1);
    s.recordHack(1);
    expect(s.sharksDue(false)).toBe(false);
    s.recordHack(1);
    expect(s.sharksDue(false)).toBe(true);
    expect(s.sharksDue(true)).toBe(false);
    s.sharksGone();
    expect(s.hacked).toBe(0);
    expect(s.sharksDue(false)).toBe(false);
  });

  it('one swipe can cut several creatures, and they all count', () => {
    const s = new SamuraiSession();
    s.start();
    s.recordHack(3);
    expect(s.sharksDue(false)).toBe(true);
  });

  it('ends by itself after 60 s without a cut; a cut starts the minute again', () => {
    const s = new SamuraiSession();
    s.start();
    expect(s.tick(59)).toBe(false);
    s.recordHack(1);
    expect(s.tick(59)).toBe(false);
    expect(s.tick(2)).toBe(true);
    s.end();
    expect(s.tick(500)).toBe(false);
  });

  it('when the mode ends with pieces lying about the sharks come, even after fewer than three cuts', () => {
    const s = new SamuraiSession();
    expect(s.sharksDueAtEnd(false, 2)).toBe(true);
    expect(s.sharksDueAtEnd(false, 0)).toBe(false);
    expect(s.sharksDueAtEnd(true, 2)).toBe(false);
  });
});

describe('Fragment', () => {
  const geometry = buildBody(rayTemplate);
  function pieces(at = new THREE.Vector3(0, 6, 0)): { pair: [Fragment, Fragment]; texture: THREE.Texture } {
    const group = new THREE.Group();
    group.position.copy(at);
    const mesh = new THREE.Object3D();
    group.add(mesh);
    group.updateMatrixWorld(true);
    const texture = new THREE.Texture();
    const plane = new THREE.Plane(new THREE.Vector3(1, 0, 0), -at.x);
    const rng = createRng(5);
    const pair = splitBody({ texture: texture as THREE.CanvasTexture, geometry, template: rayTemplate, phase: 1, flap: 1, turn: 0 }, { group, mesh }, plane, () => rng.next());
    return { pair, texture };
  }
  const step = (f: Fragment, seconds: number): void => {
    for (let t = 0; t < seconds; t += 1 / 30) f.update(1 / 30);
  };

  it('two pieces, on opposite sides of the same cut, are pushed apart', () => {
    const { pair } = pieces();
    const [a, b] = pair;
    expect(a.side).toBe(1);
    expect(b.side).toBe(-1);
    const gap0 = a.position.distanceTo(b.position);
    step(a, 1);
    step(b, 1);
    expect(a.position.distanceTo(b.position)).toBeGreaterThan(gap0 + 0.5);
    expect(a.position.x).toBeGreaterThan(b.position.x);
  });

  it('their clip planes face opposite ways', () => {
    const { pair } = pieces();
    const [a, b] = pair;
    expect(a.clipPlane.normal.dot(b.clipPlane.normal)).toBeCloseTo(-1, 5);
  });

  it('a piece can be cut again: the halves keep every earlier cut, and the texture lives until the last one is gone', () => {
    const { pair, texture } = pieces();
    const spy = vi.spyOn(texture, 'dispose');
    const [a, b] = pair;
    const rng = createRng(9);
    const [c, d] = a.splitAlong(new THREE.Plane(new THREE.Vector3(0, 0, 1), -6), () => rng.next());
    a.dispose();
    expect(spy).not.toHaveBeenCalled();
    expect(c.side).toBe(1);
    expect(d.side).toBe(-1);
    expect(c.clipPlane.normal.dot(d.clipPlane.normal)).toBeCloseTo(-1, 5);
    const [e, f] = c.splitAlong(new THREE.Plane(new THREE.Vector3(0, 1, 0), -6), () => rng.next());
    c.dispose();
    for (const p of [b, d, e, f]) p.dispose();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('the clip plane moves with the piece: a point that was on the cut stays on it', () => {
    const { pair } = pieces();
    const [a] = pair;
    const onCut = new THREE.Vector3(0, 6, 3); // (x = 0 plane) at the start
    const local = a.mesh.worldToLocal(onCut.clone());
    step(a, 2.5);
    a.group.updateMatrixWorld(true);
    const nowWorld = a.mesh.localToWorld(local.clone());
    expect(Math.abs(a.clipPlane.distanceToPoint(nowWorld))).toBeLessThan(1e-4);
  });

  it('sinks to the sand, lies still and flat, and stays there', () => {
    const { pair } = pieces(new THREE.Vector3(3, 7, -2));
    const [a] = pair;
    step(a, 30);
    expect(a.state).toBe('resting');
    const floor = terrainHeight(a.position.x, a.position.z);
    expect(a.position.y).toBeGreaterThan(floor);
    expect(a.position.y - floor).toBeLessThan(0.3);
    const rest = a.position.clone();
    const q = a.group.quaternion.clone();
    step(a, 10);
    expect(a.position.distanceTo(rest)).toBeLessThan(1e-9);
    expect(a.group.quaternion.angleTo(q)).toBeLessThan(1e-5);
    // Back up: the body's "up" (+y) points up.
    expect(new THREE.Vector3(0, 1, 0).applyQuaternion(a.group.quaternion).y).toBeGreaterThan(0.9);
  });

  it('is eaten in a bit over half a second, then gone; the texture is freed once both are gone', () => {
    const { pair, texture } = pieces();
    let disposed = 0;
    texture.addEventListener('dispose', () => disposed++);
    const [a, b] = pair;
    step(a, 20);
    step(b, 20);
    a.eat();
    expect(a.edible).toBe(false);
    step(a, EAT_SECONDS / 2);
    expect(a.state).toBe('eaten');
    expect(a.group.scale.x).toBeLessThan(1);
    step(a, EAT_SECONDS);
    expect(a.state).toBe('gone');
    a.dispose();
    expect(disposed).toBe(0); // the other half still needs it
    b.dispose();
    expect(disposed).toBe(1);
  });
});

describe('CleanupSharks (ADR 0008)', () => {
  const geometry = buildBody(rayTemplate);

  function world(piecesAt: Array<[number, number]>) {
    const scene = new THREE.Scene();
    const fragments = new Fragments(scene);
    const sharks = new CleanupSharks(scene);
    const rng = createRng(11);
    for (const [x, z] of piecesAt) {
      const group = new THREE.Group();
      group.position.set(x, 0.5, z);
      const mesh = new THREE.Object3D();
      group.add(mesh);
      group.updateMatrixWorld(true);
      const [a, b] = splitBody({ texture: new THREE.Texture() as THREE.CanvasTexture, geometry, template: rayTemplate, phase: 0, flap: 1, turn: 0 }, { group, mesh }, new THREE.Plane(new THREE.Vector3(1, 0, 0), -x), () => rng.next());
      fragments.add(a, b);
    }
    return { scene, fragments, sharks };
  }

  const run = (w: ReturnType<typeof world>, living: Living[], seconds: number, onTick?: () => void): void => {
    for (let t = 0; t < seconds && (w.sharks.active || w.fragments.count > 0); t += 1 / 30) {
      w.fragments.update(1 / 30);
      w.sharks.update(1 / 30, w.fragments, living, 0, 14);
      onTick?.();
    }
  };

  it('4–5 sharks come in from the sides, eat every piece and swim out again', () => {
    const w = world([[-6, 0], [5, 2], [1, -3]]);
    let bites = 0;
    w.sharks.onBite = () => bites++;
    let gone = false;
    w.sharks.onGone = () => (gone = true);
    expect(SHARK_COUNT).toBeGreaterThanOrEqual(4);
    expect(SHARK_COUNT).toBeLessThanOrEqual(5);
    w.sharks.summon(0, 14);
    expect(w.sharks.active).toBe(true);
    expect(w.sharks.mesh.visible).toBe(true);
    // They start outside the picture, on both sides.
    const xs = w.sharks.positions.map((p) => p.x);
    expect(xs.every((x) => Math.abs(x) > 14)).toBe(true);
    expect(xs.some((x) => x < 0) && xs.some((x) => x > 0)).toBe(true);
    run(w, [], 180);
    expect(w.fragments.count).toBe(0);
    expect(bites).toBe(6);
    expect(gone).toBe(true);
    expect(w.sharks.active).toBe(false);
    expect(w.sharks.mesh.visible).toBe(false);
  });

  it('never touch a living creature, and steer around it – even one sitting right on top of a piece', () => {
    const w = world([[0, 0], [8, 0]]);
    const rng = createRng(8);
    const living: Living[] = [
      { position: new THREE.Vector3(0.4, 1.4, 0.2), radius: 2.1 }, // right above the first piece
      { position: new THREE.Vector3(-4, 3, 1), radius: 2.1 },
      { position: new THREE.Vector3(4, 2, -2), radius: 2.1 },
    ];
    // The creatures swim around too.
    const swim = living.map((c) => ({ c, phase: rng.range(0, 6) }));
    let closest = Infinity;
    w.sharks.summon(0, 14);
    let t = 0;
    run(w, living, 240, () => {
      t += 1 / 30;
      for (const s of swim) {
        s.c.position.x += Math.sin(t * 0.4 + s.phase) * 0.012;
        s.c.position.y = 2.2 + Math.sin(t * 0.3 + s.phase) * 0.8;
      }
      for (const p of w.sharks.positions) for (const c of living) closest = Math.min(closest, p.distanceTo(c.position) - c.radius);
    });
    expect(closest).toBeGreaterThan(KEEP_AWAY * 0.7 - 0.05);
  });

  it('with nothing to eat they leave on their own', () => {
    const w = world([]);
    let gone = false;
    w.sharks.onGone = () => (gone = true);
    w.sharks.summon(0, 14);
    run(w, [], 120);
    expect(gone).toBe(true);
  });

  it('pieces that arrive while the sharks are there are eaten too', () => {
    const w = world([[2, 0]]);
    w.sharks.summon(0, 14);
    run(w, [], 4);
    const group = new THREE.Group();
    group.position.set(-3, 0.5, 1);
    const mesh = new THREE.Object3D();
    group.add(mesh);
    group.updateMatrixWorld(true);
    const rng = createRng(2);
    w.fragments.add(...splitBody({ texture: new THREE.Texture() as THREE.CanvasTexture, geometry, template: rayTemplate, phase: 0, flap: 1, turn: 0 }, { group, mesh }, new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), () => rng.next()));
    run(w, [], 200);
    expect(w.fragments.count).toBe(0);
  });
});

describe('pickSample (ADR 0007)', () => {
  it('never gives the same recording twice in a row, and uses them all', () => {
    const rng = createRng(1);
    for (const count of [2, 3, 4]) {
      let last = -1;
      const seen = new Set<number>();
      for (let i = 0; i < 500; i++) {
        const k = pickSample(count, last, () => rng.next());
        expect(k).toBeGreaterThanOrEqual(0);
        expect(k).toBeLessThan(count);
        if (last >= 0) expect(k).not.toBe(last);
        seen.add(k);
        last = k;
      }
      expect(seen.size).toBe(count);
    }
  });

  it('with one or no recordings there is nothing to choose', () => {
    expect(pickSample(1, 0, () => 0.9)).toBe(0);
    expect(pickSample(0, -1, () => 0.9)).toBe(0);
  });
});

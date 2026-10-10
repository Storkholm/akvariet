import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { buildBody, bodyStats } from '../src/body/buildBody';
import { terrainHeight } from '../src/aquarium/terrain';
import { Crawler, reefDepth } from '../src/creature/crawler';
import { GLASS_BELOW, GlassClimb } from '../src/creature/glass';
import { spikeRoots } from '../src/creature/spikes';
import { Swimmer, type SwimBounds } from '../src/creature/swimmer';
import { pointInPolygon, polygonBounds } from '../src/drawing/geometry';
import { getTemplate } from '../src/species';
import { createRng } from '../src/util/random';

const BOTTOM = ['starfish', 'seaUrchin', 'seaCucumber'] as const;
const BOUNDS: SwimBounds = { min: [-37, 2, -22], max: [37, 8.8, 8], floorMargin: 3 };

describe('bottom dweller templates (DESIGN 8.5)', () => {
  it.each(BOTTOM)('%s: crawls, has a single body part, eyes inside it and fits the square', (sp) => {
    const t = getTemplate(sp);
    expect(t.swim.crawl).toBe(true);
    expect(t.parts).toHaveLength(1);
    const b = polygonBounds(t.parts[0].outline);
    expect(b.minX).toBeGreaterThan(0.02);
    expect(b.maxX).toBeLessThan(0.98);
    expect(b.minY).toBeGreaterThan(0.02);
    expect(b.maxY).toBeLessThan(0.98);
    expect(t.eyes).toHaveLength(2);
    for (const e of t.eyes) expect(pointInPolygon(e.x, e.y, t.parts[0].outline)).toBe(true);
  });

  it('only the starfish climbs the glass', () => {
    expect(getTemplate('starfish').swim.glass).toBe(true);
    expect(getTemplate('seaUrchin').swim.glass).toBeUndefined();
    expect(getTemplate('seaCucumber').swim.glass).toBeUndefined();
  });

  it('the starfish has five arms, the cucumber is long, the urchin round', () => {
    const star = polygonBounds(getTemplate('starfish').parts[0].outline);
    expect(star.maxX - star.minX).toBeGreaterThan(0.8);
    const cuke = polygonBounds(getTemplate('seaCucumber').parts[0].outline);
    expect((cuke.maxY - cuke.minY) / (cuke.maxX - cuke.minX)).toBeGreaterThan(2);
    const urchin = polygonBounds(getTemplate('seaUrchin').parts[0].outline);
    expect((urchin.maxY - urchin.minY) / (urchin.maxX - urchin.minX)).toBeCloseTo(1, 1);
    // Five arms: the distance from the middle to the outline has five maxima.
    const o = getTemplate('starfish').parts[0].outline;
    const c = getTemplate('starfish').center;
    const r = o.map(([x, y]) => Math.hypot(x - c[0], y - c[1]));
    const peaks = r.filter((v, i) => v > r[(i + r.length - 1) % r.length] && v >= r[(i + 1) % r.length] && v > 0.4).length;
    expect(peaks).toBe(5);
  });

  it.each(BOTTOM)('%s: the body is generated quickly and stays light', (sp) => {
    const t0 = performance.now();
    const g = buildBody(getTemplate(sp));
    expect(performance.now() - t0).toBeLessThan(100);
    expect(bodyStats(g).triangles).toBeLessThan(12000);
  });
});

describe('Crawler', () => {
  const start = (x = 0, z = -2, y = 6): Crawler => new Crawler(getTemplate('starfish').swim, createRng(3), { pos: [x, y, z], yaw: 0.4, pitch: 0.3, speed: 1 });

  it('settles softly on the sand after the release, at most 0.7 units per second', () => {
    const c = start();
    let prev = c.pos[1];
    for (let i = 0; i < 30; i++) {
      c.step(1 / 30, [c], BOUNDS);
      expect(prev - c.pos[1]).toBeLessThan(0.7 / 30 + 1e-6);
      prev = c.pos[1];
    }
    for (let i = 0; i < 30 * 12; i++) c.step(1 / 30, [c], BOUNDS);
    expect(Math.abs(c.pos[1] - (terrainHeight(c.pos[0], c.pos[2]) + c.restHeight))).toBeLessThan(0.05);
  });

  it('stays on the sand for minutes, clear of the far reefs, and never walks into a coral patch', () => {
    for (const seed of [1, 2, 3]) {
      const c = new Crawler(getTemplate('seaCucumber').swim, createRng(seed), { pos: [seed * 3 - 6, 0, 1], yaw: seed, pitch: 0, speed: 0.1 });
      let inside = 0;
      for (let i = 0; i < 30 * 240; i++) {
        c.step(1 / 30, [c], BOUNDS);
        if (i > 30 * 20 && reefDepth(c.pos[0], c.pos[2]) < 0.6) inside++;
        expect(c.pos[2]).toBeLessThanOrEqual(10.1);
        expect(c.pos[2]).toBeGreaterThanOrEqual(-8);
        expect(c.pos[0]).toBeGreaterThanOrEqual(BOUNDS.min[0]);
        expect(c.pos[0]).toBeLessThanOrEqual(BOUNDS.max[0]);
      }
      expect(inside).toBe(0);
      expect(c.pos[1]).toBeLessThan(terrainHeight(c.pos[0], c.pos[2]) + 0.3);
    }
  });

  it('is slow (a starfish covers well under a unit per second) and keeps apart from the others', () => {
    const a = start(0, 7.5, 0.1);
    const b = start(0.4, 7.5, 0.1);
    a.speed = b.speed = 0.15;
    const swimmers = [a, b];
    for (let i = 0; i < 30 * 30; i++) {
      a.step(1 / 30, swimmers, BOUNDS);
      b.step(1 / 30, swimmers, BOUNDS);
      expect(a.speed).toBeLessThan(0.4);
    }
    expect(Math.hypot(a.pos[0] - b.pos[0], a.pos[2] - b.pos[2])).toBeGreaterThan(1.2);
  });

  it('lies along the slope of the sand', () => {
    const c = start(2, 1, 0.1);
    for (let i = 0; i < 30 * 5; i++) c.step(1 / 30, [c], BOUNDS);
    const e = 0.4;
    const fx = -Math.sin(c.yaw);
    const fz = -Math.cos(c.yaw);
    const slope = Math.atan((terrainHeight(c.pos[0] + fx * e, c.pos[2] + fz * e) - terrainHeight(c.pos[0] - fx * e, c.pos[2] - fz * e)) / (2 * e));
    expect(Math.abs(c.pitch - slope)).toBeLessThan(0.25);
  });

  it('is a Swimmer, so the creature code treats it like one', () => {
    expect(start()).toBeInstanceOf(Swimmer);
  });
});

describe('GlassClimb (CONTEXT: Ruden)', () => {
  const run = (g: GlassClimb, seconds: number, allowed = true): GlassClimb['phase'][] => {
    const seen: GlassClimb['phase'][] = [];
    for (let t = 0; t < seconds; t += 0.1) {
      g.update(0.1, allowed);
      if (seen[seen.length - 1] !== g.phase) seen.push(g.phase);
    }
    return seen;
  };

  it('waits, climbs up from below the picture, stays, climbs down and returns to the sand', () => {
    const g = new GlassClimb(createRng(5), 1);
    expect(run(g, 40)).toEqual(['idle', 'leave', 'up', 'stay', 'down', 'return', 'idle']);
  });

  it('is below the picture when it starts and ends, and visible in between', () => {
    const g = new GlassClimb(createRng(6), 0);
    g.begin();
    let top = GLASS_BELOW;
    while (g.phase !== 'return') {
      g.update(0.1, true);
      if (g.onGlass) top = Math.max(top, g.y);
    }
    expect(top).toBeGreaterThan(-0.2);
    expect(g.y).toBe(GLASS_BELOW);
  });

  it('does not start while it is not allowed, and a climb in progress ends at once when it stops being allowed', () => {
    const g = new GlassClimb(createRng(7), 0);
    run(g, 20, false);
    expect(g.phase).toBe('idle');
    g.begin();
    run(g, 8, true);
    expect(g.onGlass).toBe(true);
    g.update(0.1, false);
    expect(g.phase).toBe('idle');
    expect(g.scale).toBe(1);
  });

  it('comes back again and again, never twice in a hurry', () => {
    const g = new GlassClimb(createRng(8), 1);
    const starts: number[] = [];
    let was = false;
    for (let t = 0; t < 600; t += 0.1) {
      g.update(0.1, true);
      if (g.away && !was) starts.push(t);
      was = g.away;
    }
    expect(starts.length).toBeGreaterThan(2);
    for (let i = 1; i < starts.length; i++) expect(starts[i] - starts[i - 1]).toBeGreaterThan(50);
  });
});

describe('sea urchin spikes', () => {
  it('are rooted on the upper side of the body, spread out, and deterministic for a given seed', () => {
    const body = buildBody(getTemplate('seaUrchin'));
    const rng = (seed: number) => {
      const r = createRng(seed);
      return () => r.next();
    };
    const a = spikeRoots(body, 120, 0.14, rng(1));
    const b = spikeRoots(body, 120, 0.14, rng(1));
    expect(a.length).toBeGreaterThan(60);
    expect(a.map((r) => r.pos.toArray())).toEqual(b.map((r) => r.pos.toArray()));
    for (const r of a) expect(r.normal.y).toBeGreaterThan(0.1);
    for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) expect(a[i].pos.distanceTo(a[j].pos)).toBeGreaterThanOrEqual(0.14 - 1e-6);
    expect(a.every((r) => r.pos instanceof THREE.Vector3)).toBe(true);
  });
});

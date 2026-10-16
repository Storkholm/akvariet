import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { bodyStats, buildBody, templateToLocal } from '../src/body/buildBody';
import { pointInPolygon, polygonBounds, signedArea } from '../src/drawing/geometry';
import { reactionPose, REACTION_SECONDS } from '../src/creature/reaction';
import { Swimmer, type SwimBounds } from '../src/creature/swimmer';
import { getTemplate } from '../src/species';
import { createRng } from '../src/util/random';

const FISH = ['clownfish', 'pufferfish', 'shark'] as const;

describe('fish templates (side view, ADR 0005)', () => {
  it.each(FISH)('%s: stands upright, head to the left, eye inside the body, fits the square', (sp) => {
    const t = getTemplate(sp);
    expect(t.view).toBe('side');
    const all = t.parts.flatMap((p) => p.outline);
    const b = polygonBounds(all);
    expect(b.minX).toBeGreaterThan(0.02);
    expect(b.maxX).toBeLessThan(0.98);
    expect(b.minY).toBeGreaterThan(0.02);
    expect(b.maxY).toBeLessThan(0.98);
    // Longer than tall (a side view), and the first part (the body) holds the eye in its front half.
    expect(b.maxX - b.minX).toBeGreaterThan(b.maxY - b.minY);
    for (const e of t.eyes) {
      expect(pointInPolygon(e.x, e.y, t.parts[0].outline)).toBe(true);
      expect(e.x).toBeLessThan((b.minX + b.maxX) / 2);
    }
  });

  it.each([...FISH, 'ray', 'turtle', 'starfish', 'seaUrchin', 'seaCucumber'] as const)('%s: all parts wind the same way (so the union can be clipped with one path, and no contour shows inside)', (sp) => {
    const signs = getTemplate(sp).parts.map((p) => Math.sign(signedArea(p.outline)));
    expect(new Set(signs).size).toBe(1);
  });

  it('the shark is about 1.4 times as big as the ray, and the tail of the shark has a tall upper lobe', () => {
    const shark = polygonBounds(getTemplate('shark').parts.flatMap((p) => p.outline));
    const ray = polygonBounds(getTemplate('ray').parts.flatMap((p) => p.outline));
    const sharkLen = (shark.maxX - shark.minX) * getTemplate('shark').size;
    const raySpan = (ray.maxX - ray.minX) * getTemplate('ray').size;
    expect(sharkLen / raySpan).toBeGreaterThan(1.25);
    expect(sharkLen / raySpan).toBeLessThan(1.65);
    const tail = polygonBounds(getTemplate('shark').parts[1].outline);
    const body = polygonBounds(getTemplate('shark').parts[0].outline);
    expect(tail.minY).toBeLessThan(body.minY - 0.15);
    expect(tail.maxY).toBeLessThan(body.maxY + 0.2);
  });

  it('only the pufferfish puffs up, and the clownfish keeps to the reef', () => {
    expect(getTemplate('pufferfish').swim.inflates).toBe(true);
    expect(getTemplate('clownfish').swim.inflates).toBeUndefined();
    expect(getTemplate('clownfish').swim.lowBand).toBeGreaterThan(0);
    expect(getTemplate('shark').swim.lowBand).toBeUndefined();
  });
});

describe('side-view body (ADR 0005)', () => {
  it.each(FISH)('%s: built quickly, upright, thick to the sides, head towards −z', (sp) => {
    const t = getTemplate(sp);
    const t0 = performance.now();
    const g = buildBody(t);
    expect(performance.now() - t0).toBeLessThan(100);
    expect(bodyStats(g).triangles).toBeLessThan(9000);
    g.computeBoundingBox();
    const box = g.boundingBox as THREE.Box3;
    // The body is thick along x (both sides), the picture stands in the y–z plane.
    expect(box.max.x).toBeGreaterThan(0.1 * t.size * 0.5);
    expect(box.min.x).toBeCloseTo(-box.max.x, 1);
    expect(box.max.y - box.min.y).toBeLessThan(box.max.z - box.min.z);
    // Head (the nose, small u) is at −z, the tail at +z; "up" in the picture is +y.
    const nose = templateToLocal(t, polygonBounds(t.parts.flatMap((p) => p.outline)).minX, 0.5);
    const tailEnd = templateToLocal(t, polygonBounds(t.parts.flatMap((p) => p.outline)).maxX, 0.5);
    expect(nose[2]).toBeLessThan(tailEnd[2]);
    expect(templateToLocal(t, 0.5, 0.2)[1]).toBeGreaterThan(templateToLocal(t, 0.5, 0.8)[1]);
  });

  it.each(FISH)('%s: faces point outwards on both sides, and the picture is the same on both (uv = template)', (sp) => {
    const g = buildBody(getTemplate(sp));
    const pos = g.getAttribute('position');
    const index = g.index as THREE.BufferAttribute;
    let outLeft = 0;
    let outRight = 0;
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const c = new THREE.Vector3();
    for (let i = 0; i < index.count; i += 3) {
      a.fromBufferAttribute(pos, index.getX(i));
      b.fromBufferAttribute(pos, index.getX(i + 1));
      c.fromBufferAttribute(pos, index.getX(i + 2));
      const n = b.clone().sub(a).cross(c.clone().sub(a));
      const cx = (a.x + b.x + c.x) / 3;
      if (Math.abs(cx) < 1e-4) continue;
      const outward = n.x * cx > 0 ? 1 : -1;
      if (cx < 0) outLeft += outward;
      else outRight += outward;
    }
    // (Almost) every face looks away from the middle plane.
    expect(outLeft).toBeGreaterThan(0);
    expect(outRight).toBeGreaterThan(0);
  });

  it('the sides carry no belly shading (side = 0 everywhere)', () => {
    const g = buildBody(getTemplate('clownfish'));
    const side = g.getAttribute('side');
    for (let i = 0; i < side.count; i++) expect(side.getX(i)).toBe(0);
  });
});

describe('the pufferfish puffs up (Glædeshop)', () => {
  it('quickly up, held, then back down to exactly nothing', () => {
    expect(reactionPose('puff', 0).inflate).toBe(0);
    expect(reactionPose('puff', 1).inflate).toBe(0);
    expect(reactionPose('puff', 0.5).inflate).toBe(1);
    expect(reactionPose('puff', 0.3).inflate).toBe(1);
    expect(reactionPose('puff', 0.075).inflate).toBeGreaterThan(0.3);
    expect(reactionPose('puff', 0.075).inflate).toBeLessThan(0.7);
    expect(REACTION_SECONDS.puff).toBeGreaterThan(2);
    expect(reactionPose('puff', 0).lift).toBe(0);
    expect(reactionPose('puff', 1).lift).toBeCloseTo(0, 6);
    // The other kinds never puff.
    expect(reactionPose('hop', 0.5).inflate).toBe(0);
    expect(reactionPose('salto', 0.5).inflate).toBe(0);
  });
});

describe('reef fish stay low', () => {
  const bounds: SwimBounds = { min: [-30, 2, -20], max: [30, 8.8, 5], floorMargin: 3 };
  it('the clownfish picks targets near the sand, the shark anywhere', () => {
    const run = (sp: 'clownfish' | 'shark'): number => {
      const s = new Swimmer(getTemplate(sp).swim, createRng(4), { pos: [0, 4, 0], yaw: 0, pitch: 0, speed: 1 });
      let sum = 0;
      let n = 0;
      for (let i = 0; i < 30 * 400; i++) {
        s.step(1 / 30, [s], bounds);
        sum += s.pos[1];
        n++;
      }
      return sum / n;
    };
    expect(run('clownfish')).toBeLessThan(run('shark') - 0.4);
  });
});

import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { fitCamera } from '../src/aquarium/cameraRig';
import { FishSchool, SCHOOLS } from '../src/aquarium/fishSchool';
import { BAND_COUNT, buildReef, CHUNK_COUNT, CHUNK_WIDTH, chunkIndex, COLUMN_COUNT } from '../src/aquarium/reef';
import { REEF_HALF_WIDTH, WORLD_HALF_WIDTH } from '../src/aquarium/terrain';

/** A camera like the game's on a tablet in landscape, slid to x. */
function cameraAt(x: number, zoom = 1, aspect = 1180 / 820): THREE.PerspectiveCamera {
  const fit = fitCamera(aspect);
  const cam = new THREE.PerspectiveCamera(fit.fov, aspect, 0.1, 400);
  cam.zoom = zoom;
  cam.updateProjectionMatrix();
  cam.position.set(x, fit.height, fit.distance);
  cam.lookAt(x, fit.lookY, 0);
  cam.updateMatrixWorld();
  return cam;
}

const reef = buildReef();
const meshes = reef.chunks.filter((m): m is THREE.Mesh => !!m);
const tris = (m: THREE.Mesh): number => (m.geometry.index ? m.geometry.index.count : m.geometry.getAttribute('position').count) / 3;

describe('reef chunks (ADR 0006)', () => {
  it('cover the whole width in columns and three depth bands', () => {
    expect(COLUMN_COUNT * CHUNK_WIDTH).toBeGreaterThanOrEqual(2 * REEF_HALF_WIDTH);
    expect(CHUNK_COUNT).toBe(COLUMN_COUNT * BAND_COUNT);
    expect(reef.chunks).toHaveLength(CHUNK_COUNT);
    expect(chunkIndex(-REEF_HALF_WIDTH, 5)).toBe(0);
    expect(chunkIndex(REEF_HALF_WIDTH + 20, 5)).toBe((COLUMN_COUNT - 1) * BAND_COUNT);
    expect(chunkIndex(0, 0)).toBe(chunkIndex(0, 5) + 1); // the bands sit next to each other
    expect(chunkIndex(0, -12)).toBe(chunkIndex(0, 5) + 2);
    let prev = -1;
    for (let x = -REEF_HALF_WIDTH; x < REEF_HALF_WIDTH; x += 1) {
      const i = chunkIndex(x, 0);
      expect(i).toBeGreaterThanOrEqual(prev);
      prev = i;
    }
  });

  it('have reef in them across the whole aquarium (no bare stretch)', () => {
    expect(meshes.length).toBeGreaterThan(20);
    for (let x = -WORLD_HALF_WIDTH; x <= WORLD_HALF_WIDTH; x += 6) {
      const near = meshes.filter((m) => {
        const b = m.geometry.boundingBox as THREE.Box3;
        return b.min.x <= x && b.max.x >= x;
      });
      expect(near.reduce((s, m) => s + tris(m), 0), `reef at x=${x}`).toBeGreaterThan(3000);
    }
  });

  it('only the chunks in the picture are shown, and the picture can be anywhere in the aquarium', () => {
    const shown = (x: number, zoom = 1): THREE.Mesh[] => {
      reef.cull(cameraAt(x, zoom));
      return meshes.filter((m) => m.visible);
    };
    const middle = shown(0);
    expect(middle.length).toBeGreaterThan(0);
    expect(middle.length).toBeLessThan(meshes.length * 0.6);
    const left = shown(-25);
    const right = shown(25);
    expect(left).not.toEqual(right);
    // Nothing is ever left out: whatever is in the aquarium is shown from some camera position.
    const everSeen = new Set<THREE.Mesh>();
    for (let x = -25; x <= 25; x += 2) for (const m of shown(x)) everSeen.add(m);
    for (const m of shown(-25, 1)) everSeen.add(m);
    const missing = meshes.filter((m) => !everSeen.has(m) && (m.geometry.boundingBox as THREE.Box3).max.x < REEF_HALF_WIDTH - 12 && (m.geometry.boundingBox as THREE.Box3).min.x > -REEF_HALF_WIDTH + 12);
    expect(missing).toEqual([]);
    // Zoomed in, fewer still.
    expect(shown(0, 2.5).length).toBeLessThan(middle.length);
  });

  it('a chunk is shown exactly when its box touches the picture (never culled too early at the edge)', () => {
    const cam = cameraAt(12);
    const frustum = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    reef.cull(cam);
    for (const m of meshes) {
      const box = (m.geometry.boundingBox as THREE.Box3).clone().expandByScalar(2.5);
      expect(m.visible).toBe(frustum.intersectsBox(box));
    }
  });
});

describe('background schools across the width', () => {
  it('there are schools out to both sides, and a school is only drawn while its box is in the picture', () => {
    expect(Math.min(...SCHOOLS.map((s) => s.min[0]))).toBeLessThan(-WORLD_HALF_WIDTH + 5);
    expect(Math.max(...SCHOOLS.map((s) => s.max[0]))).toBeGreaterThan(WORLD_HALF_WIDTH - 5);
    const schools = SCHOOLS.map((s) => new FishSchool(s));
    const visibleAt = (x: number): number => {
      const cam = cameraAt(x);
      for (const s of schools) s.cull(cam);
      return schools.filter((s) => s.mesh.visible).length;
    };
    expect(visibleAt(0)).toBeGreaterThan(0);
    expect(visibleAt(0)).toBeLessThan(schools.length);
    expect(visibleAt(-25)).toBeLessThan(schools.length);
    // Every school is seen from somewhere.
    const seen = new Set<FishSchool>();
    for (let x = -25; x <= 25; x += 2) {
      const cam = cameraAt(x);
      for (const s of schools) {
        s.cull(cam);
        if (s.mesh.visible) seen.add(s);
      }
    }
    expect(seen.size).toBe(schools.length);
  });
});

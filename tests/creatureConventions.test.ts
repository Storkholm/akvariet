import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

/** Pose conventions shared by Swimmer (yaw/pitch/roll) and the body (forward = local −z, wings along ±x). */
function pose(yaw: number, pitch: number, roll: number): THREE.Object3D {
  const o = new THREE.Object3D();
  o.rotation.set(pitch, yaw, roll, 'YXZ');
  o.updateMatrixWorld(true);
  return o;
}
const world = (o: THREE.Object3D, x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z).applyMatrix4(o.matrixWorld);

describe('creature pose conventions', () => {
  it('yaw 0 heads along −z; a positive yaw turns left (towards −x)', () => {
    expect(world(pose(0, 0, 0), 0, 0, -1).toArray()).toEqual([0, 0, -1].map((v) => expect.closeTo(v, 6)));
    const f = world(pose(0.3, 0, 0), 0, 0, -1);
    expect(f.x).toBeLessThan(0);
    expect(f.z).toBeLessThan(0);
  });

  it('positive pitch raises the nose', () => {
    expect(world(pose(0, 0.4, 0), 0, 0, -1).y).toBeGreaterThan(0.3);
  });

  it('positive roll (left turn) lowers the left wing (−x) and raises the right wing (+x)', () => {
    const o = pose(0, 0, 0.4);
    expect(world(o, -1, 0, 0).y).toBeLessThan(0);
    expect(world(o, 1, 0, 0).y).toBeGreaterThan(0);
  });

  it('the back (+y) stays up for a level pose and the tail (+z) trails behind the head', () => {
    const o = pose(1.2, 0, 0);
    expect(world(o, 0, 1, 0).y).toBeGreaterThan(0.99);
    const head = world(o, 0, 0, -1);
    const tail = world(o, 0, 0, 1);
    expect(head.distanceTo(tail)).toBeCloseTo(2, 5);
    // Swimmer's forward vector for the same yaw points from tail to head.
    const fwd = new THREE.Vector3(-Math.sin(1.2), 0, -Math.cos(1.2));
    expect(head.clone().sub(tail).normalize().dot(fwd)).toBeCloseTo(1, 5);
  });
});

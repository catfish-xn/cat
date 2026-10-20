import { describe, expect, it } from 'vitest';
import { Mesh, PerspectiveCamera, Vector3 } from 'three';
import { ParticleEffect, parseParticleDocument } from '../src/rendering3d/particles';
// @ts-expect-error Offline JS converter.
import { convertParticles } from '../scripts/assets3d/particles.mjs';
// @ts-expect-error Offline aggregate classifier.
import { rayFieldGroups } from '../scripts/assets3d/fixed-plane-rays-audit.mjs';

const c = (constantValue: unknown) => ({ constantValue });
const ray = (fields = {}) => ({ primitive: { __type: 'VfxPrimitiveRay' }, isSingleParticle: true,
  particleLifetime: c(1), birthScale0: c([2, 8, 1]), ...fields });
const convert = (fields = {}, system = {}, options = {}) => convertParticles({ synthetic: {
  __type: 'VfxSystemDefinitionData', complexEmitterDefinitionData: [ray(fields)], ...system,
} }, () => 'synthetic/stripe.png', parseParticleDocument, { particleMode: 'approximate', ...options });
function effect(fields = {}, system = {}) {
  const result = convert(fields, system);
  expect(result.counts).toMatchObject({ approximated: 1, rejected: 0, skipped: 0 });
  return new ParticleEffect(result.systems[0].document, { scale: 1 });
}
const normal = (fx: ParticleEffect) => new Vector3(0, 0, 1).applyQuaternion(fx.object.children[0].quaternion);

describe('fixed plane ray evidence', () => {
  it.each(['isGroundLayer', 'isFollowingTerrain'])('uses %s for XZ, even with an opposing birth pitch', field => {
    const fx = effect({ [field]: 1, birthRotation0: c([0, 35, 70]) });
    const camera = new PerspectiveCamera();
    try {
      for (const angle of [.2, .8]) {
        camera.rotation.set(angle, angle * 2, .4); fx.update(.1, camera); fx.object.updateMatrixWorld(true);
        expect(Math.abs(normal(fx).y)).toBeCloseTo(1);
        const mesh = fx.object.children[0] as Mesh, positions = mesh.geometry.getAttribute('position');
        const points = Array.from({ length: positions.count }, (_, i) => new Vector3().fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld));
        expect(Math.max(...points.map(p => p.y)) - Math.min(...points.map(p => p.y))).toBeLessThan(1e-10);
        expect(mesh.geometry.boundingBox).toBeNull();
      }
    } finally { fx.dispose(); }
  });
  it.each([[30, 50, 70], [90, 35, -15], [-90, 20, 45]])('matches independent reflected YXZ basis for %j', (x, y, z) => {
    const fields = { birthRotation0: c([x, y, z]) }, before = structuredClone(fields);
    const fx = effect(fields);
    try {
      const quaternion = fx.object.children[0].quaternion.clone();
      for (const axis of [[1, 0, 0], [0, 1, 0], [0, 0, 1]]) {
        const reference = new Vector3(-axis[0], axis[1], axis[2])
          .applyAxisAngle(new Vector3(0, 0, 1), z * Math.PI / 180)
          .applyAxisAngle(new Vector3(1, 0, 0), x * Math.PI / 180)
          .applyAxisAngle(new Vector3(0, 1, 0), y * Math.PI / 180);
        reference.x *= -1;
        expect(new Vector3(...axis as [number, number, number]).applyQuaternion(quaternion).distanceTo(reference)).toBeLessThan(1e-10);
      }
      const camera = new PerspectiveCamera(); camera.rotation.set(.8, .2, .4); fx.update(.1, camera);
      expect(fx.object.children[0].quaternion.angleTo(quaternion)).toBeLessThan(1e-7);
      const geometry = (fx.object.children[0] as Mesh).geometry;
      geometry.computeBoundingBox();
      expect(geometry.boundingBox!.min.y).toBe(0); expect(geometry.boundingBox!.max.y).toBe(1);
      expect(fields).toEqual(before);
    } finally { fx.dispose(); }
  });
  it.each(['isLocalOrientation', 'particleIsLocalOrientation'])('follows host attachment with %s', field => {
    const fx = effect({ [field]: true });
    try {
      fx.object.rotation.set(.3, .4, .5); fx.object.position.set(3, 4, 5); fx.update(.1); fx.object.updateMatrixWorld(true);
      const mesh = fx.object.children[0] as Mesh;
      expect(new Vector3(0, 0, 0).applyMatrix4(mesh.matrixWorld).distanceTo(fx.object.position)).toBeLessThan(1e-10);
      expect(new Vector3(0, 0, 1).transformDirection(mesh.matrixWorld).distanceTo(new Vector3(0, 0, 1).applyEuler(fx.object.rotation))).toBeLessThan(1e-10);
    } finally { fx.dispose(); }
  });
  it.each([
    [{ __type: 'VfxShapeBox', Size: [2, 0, 4] }, [0, 1, 0]],
    [{ __type: 'VfxShapeCylinder', radius: 2, height: 0 }, [0, 1, 0]],
  ])('uses a uniquely planar emission shape %j', (SpawnShape, expected) => {
    const fx = effect({ SpawnShape });
    try { expect(normal(fx).distanceTo(new Vector3(...expected as [number, number, number]))).toBeLessThan(1e-7); }
    finally { fx.dispose(); }
  });
  it.each([[0, 0, 0], [0, 90, 0], [180, 30, 0], [360, 0, 90]])('keeps upright birth planes skipped: %j', (x, y, z) => {
    const result = convert({ birthRotation0: c([x, y, z]) });
    expect(result.systems[0].report[0]).toMatchObject({ status: 'skipped', reason: 'unexpressible-emitter:stationary-ray-plane-without-ground-normal' });
    expect(result.systems[0].document).toBeUndefined();
  });
  it('applies the parent affine orientation once and respects ground heading under stretch', () => {
    const system = { transform: [[1, 0, 0, 0], [0, 0, 1, 0], [0, -2, 0, 0], [3, 4, 5, 1]] };
    const fx = effect({}, system);
    try {
      fx.update(.1); fx.object.updateMatrixWorld(true);
      expect(new Vector3(0, 0, 1).transformDirection(fx.object.children[0].matrixWorld).distanceTo(new Vector3(0, -1, 0))).toBeLessThan(1e-10);
    } finally { fx.dispose(); }
    const ground = effect({ isGroundLayer: 1, birthRotation0: c([90, 30, 40]) }, {
      transform: [[2, 0, 0, 0], [0, 1, 0, 0], [0, 0, 3, 0], [0, 0, 0, 1]],
    });
    try {
      ground.update(.1); ground.object.updateMatrixWorld(true);
      const mesh = ground.object.children[0] as Mesh;
      expect(new Vector3(0, 0, 1).transformDirection(mesh.matrixWorld).y).toBeCloseTo(-1);
    } finally { ground.dispose(); }
  });
  it.each([
    {}, { useNavmeshMask: 1 }, { bindWeight: c(1) }, { EmitterPosition: c([0, 4, 0]) },
    { isLocalOrientation: 0, particleIsLocalOrientation: false },
    { SpawnShape: { __type: 'VfxShapeLegacy', emitOffset: [0, 4, 0] } },
    { SpawnShape: { __type: 'VfxShapeSphere', radius: 4 } },
    { SpawnShape: { __type: 'VfxShapeCylinder', radius: 4 } },
    { SpawnShape: { __type: 'VfxShapeBox', Size: [0, 0, 4] } },
    { SpawnShape: { __type: 'VfxShapeCylinder', radius: 4, height: 0, emitRotationAxes: [[1, 0, 0]], emitRotationAngles: [c(20)] } },
    { rotation0: c([90, 0, 0]) },
  ])('keeps missing or ambiguous plane evidence skipped: %j', fields => {
    for (const birthVelocity of [undefined, c([0, 0, 0])]) {
      const result = convert({ ...fields, ...(birthVelocity ? { birthVelocity } : {}) });
      expect(result.counts).toMatchObject({ skipped: 1, rejected: 0, approximated: 0 });
      expect(result.systems[0].document).toBeUndefined();
      expect(result.systems[0].report[0].reason).toBe('unexpressible-emitter:stationary-ray-plane-without-evidence');
    }
  });
  it('does not treat translation/scale as an orientation or hide malformed data and other unsupported fields', () => {
    const transform = [[2, 0, 0, 0], [0, 2, 0, 0], [0, 0, 2, 0], [3, 4, 5, 1]];
    expect(convert({}, { transform }).counts.skipped).toBe(1);
    expect(convert({ birthRotation0: c([90, 0]) }).counts.rejected).toBe(1);
    expect(convert({ birthRotation0: c([90, 0, 0]), mystery: 1 }).counts.rejected).toBe(1);
    expect(convert({ birthVelocity: c([1, 0]) }).counts.rejected).toBe(1);
    expect(convert({ birthRotation0: c([90, 0, 0]) }, {}, { particleMode: 'strict' }).counts.rejected).toBe(1);
  });
  it('checks the composed parent plane rather than only the birth plane', () => {
    const system = { transform: [[1, 0, 0, 0], [0, 0, 1, 0], [0, -1, 0, 0], [0, 0, 0, 1]] };
    for (const fields of [{ birthRotation0: c([90, 0, 0]) }, { isGroundLayer: 1 }]) {
      expect(convert(fields, system).systems[0].report[0]).toMatchObject({
        status: 'skipped', reason: 'unexpressible-emitter:stationary-ray-plane-without-ground-normal',
      });
    }
    const fx = effect({ birthRotation0: c([0, 0, 0]) }, system);
    try {
      fx.update(.1); fx.object.updateMatrixWorld(true);
      expect(new Vector3(0, 0, 1).transformDirection(fx.object.children[0].matrixWorld).y).toBeCloseTo(-1);
    } finally { fx.dispose(); }
  });
  it('preserves size magnitude when mirrored probability signs cancel and annotates static UV rotation', () => {
    const input = { birthRotation0: c([90, 0, 0]), birthVelocity: c([0, 0, 0]), uvRotation: c(30), birthScale0: {
      dynamics: { times: [0], values: [[-4, 8, 1]], probabilityTables: [{ keyValues: [-1, 1] }, {}, {}] },
    } };
    const before = structuredClone(input), result = convert(input), e = result.systems[0].document.emitters[0];
    expect(e.size0).toEqual([4, 8, 1]);
    expect(result.systems[0].report[0].approximations).toContainEqual(expect.objectContaining({ field: 'uvRotation', handling: 'static-UV' }));
    const fx = new ParticleEffect(result.systems[0].document, { scale: 1 });
    try { expect(fx.object.children[0].scale.x).toBe(4); expect(fx.object.children[0].scale.y).toBe(8); }
    finally { fx.dispose(); }
    expect(input).toEqual(before);
  });
  it('classifies availability separately from enabled flags without exposing values', () => {
    expect(rayFieldGroups({ birthRotation0: c([90, 0, 0]), isLocalOrientation: 0, particleIsLocalOrientation: 1,
      useNavmeshMask: 1, bindWeight: c(1), EmitterPosition: c([0, 2, 0]) })).toMatchObject({
      birthRotation0: true, 'isLocalOrientation.present': true, 'isLocalOrientation.enabled': false,
      'particleIsLocalOrientation.enabled': true, 'useNavmeshMask.enabled': true, bindWeight: true,
      EmitterPosition: true, 'SpawnShape.planar': false,
    });
  });
});

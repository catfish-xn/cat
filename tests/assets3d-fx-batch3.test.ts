import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BoxGeometry, PerspectiveCamera, Vector3 } from 'three';
import { assertManifest } from '../src/rendering3d/contracts';
import { parseParticleDocument } from '../src/rendering3d/particles';
import { ParticleEffectV2 } from '../src/rendering3d/particles-v2';
// @ts-expect-error Offline JavaScript tooling.
import { batchActionBindings, loadBindingTables } from '../scripts/assets3d/fx-batch.mjs';
// @ts-expect-error Offline JavaScript binding metadata.
import { batch3Tables } from '../scripts/assets3d/fx-bindings/batch3.mjs';
// @ts-expect-error Offline JavaScript converter.
import { convertParticles, mapEmitter } from '../scripts/assets3d/particles.mjs';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/assets3d-fx-batch3.json', import.meta.url), 'utf8'));
const tables = Object.fromEntries(Object.values(batch3Tables).map((t, i) => [`synthetic-unit-${i}`, t]));
const source = (primitive?: object) => ({
  emitterName: 'synthetic_emitter', isSingleParticle: true,
  particleLifetime: { constantValue: 1 }, texture: 'synthetic/glow.png',
  birthScale0: { constantValue: [100, 400, 1] },
  scale0: { dynamics: { times: [0, 1], values: [[2, 1, 1], [1, 1, 1]] } },
  ...(primitive ? { primitive } : {}),
  ...(primitive && '__type' in primitive && primitive.__type === 'VfxPrimitiveRay' ? { birthRotation0: { constantValue: [90, 0, 0] } } : {}),
});

describe('batch three offline FX', () => {
  it.each(['textureMult', 'alphaErosionDefinition'])('does not drop the only mask of an opaque base: %s', field => {
    const input = { ...source(), [field]: { textureMult: 'synthetic/mask.png' } };
    const before = structuredClone(input);
    const convert = (alpha?: boolean) => mapEmitter(input, (p: string) => p,
      { particleMode: 'approximate', textureAlpha: () => alpha });
    expect(convert(false)).toMatchObject({ status: 'skipped', reason: 'unexpressible-emitter:opaque-base-requires-secondary-mask' });
    expect(convert(true).emitter).toBeDefined();
    expect(convert().emitter).toBeDefined();
    expect(input).toEqual(before);
  });
  it('omits continuous rotated emission instead of stacking an additive slab', () => {
    const input = { ...source(), isSingleParticle: false, rate: { constantValue: 100 }, lifetime: 1,
      birthVelocity: { constantValue: [100, 0, 0] }, blendMode: 4,
      SpawnShape: { __type: 'VfxShapeLegacy', emitRotationAxes: [[0, 1, 0]],
        emitRotationAngles: [{ dynamics: { times: [0], values: [1], probabilityTables: [{ keyValues: [0, 360] }] } }] } };
    const before = structuredClone(input);
    const convert = (v: object) => mapEmitter(v, (p: string) => p, { particleMode: 'approximate' });
    expect(convert(input)).toMatchObject({ status: 'skipped', reason: 'unexpressible-emitter:rotated-directional-emission' });
    const converted = convertParticles({ synthetic: { __type: 'VfxSystemDefinitionData', complexEmitterDefinitionData: [input] } }, (p: string) => p,
      parseParticleDocument, { particleMode: 'approximate' });
    expect(converted.counts.skipped).toBe(1);
    expect(converted.byReason['unexpressible-emitter:rotated-directional-emission']).toBe(1);
    expect(converted.systems[0].document).toBeUndefined();
    expect(input).toEqual(before);
    expect(convert({ ...input, birthVelocity: { constantValue: [0, 0, 0] } }).emitter).toBeDefined();
    expect(convert({ ...input, isSingleParticle: true, rate: { constantValue: 1 } }).emitter).toBeDefined();
    expect(convert({ ...input, SpawnShape: { ...input.SpawnShape, emitRotationAngles: [{ constantValue: 0 }] } }).emitter).toBeDefined();
  });
  it('applies host scale to ray length exactly once', () => {
    const r = mapEmitter(source({ __type: 'VfxPrimitiveRay' }), (p: string) => p, { particleMode: 'approximate' });
    const doc = parseParticleDocument({ schemaVersion: 2, limits: { maxParticles: 10, maxDuration: 2 }, emitters: [r.emitter] });
    if (doc.schemaVersion !== 2) throw new Error('expected-v2');
    const fx = new ParticleEffectV2(doc, { scale: .5 });
    try {
      fx.update(.25); fx.object.updateMatrixWorld(true);
      const mesh = fx.object.children[0];
      const start = new Vector3(0, 0, 0).applyMatrix4(mesh.matrixWorld);
      const end = new Vector3(0, 1, 0).applyMatrix4(mesh.matrixWorld);
      expect(start.distanceTo(end)).toBeCloseTo(200);
    } finally { fx.dispose(); }
  });
  it('discovers all ten tables', async () => {
    const loaded = await loadBindingTables();
    expect(Object.keys(batch3Tables)).toHaveLength(10);
    for (const [unit, table] of Object.entries(batch3Tables)) expect(loaded[unit]).toEqual(table);
  });
  it('validates system/effect IDs, real bones and approximated legal phases', () => {
    const plan = batchActionBindings(fixture.manifest, fixture.rows, fixture.bones, tables);
    assertManifest({ ...fixture.manifest, actionEffects: plan.actionEffects });
    for (const [unit, table] of Object.entries(tables) as [string, any][]) {
      for (const action of ['attack', 'cast']) {
        expect(plan.actionEffects[unit][action].length).toBeGreaterThan(0);
        for (const spec of table[action]) {
          expect(spec.status).toBe('approximated');
          expect(['start', 'travel', 'impact']).toContain(spec.phase);
          expect(['source', 'target', 'projectile']).toContain(spec.anchor);
          if (spec.bone) expect(fixture.bones[unit]).toContain(spec.bone);
          expect(spec.note.length).toBeGreaterThan(0);
          if (spec.system !== '@shared-hit') expect(fixture.rows[unit].some((r: any) =>
            r.sourcePath.endsWith(spec.system.startsWith('TFT13_') ? '/' + spec.system : '_Base_' + spec.system))).toBe(true);
        }
        for (const id of plan.actionEffects[unit][action]) {
          expect(fixture.manifest.effects[id]).toBeDefined();
          expect(plan.playback[id].status).toBe('approximated');
        }
      }
      for (const [, reason] of table.unavailable) expect(reason.length).toBeGreaterThan(0);
    }
    expect(plan.unavailable.filter((r: any) => r.reason === 'no-writable-emitters')).toHaveLength(14);
  });
  it('rejects invalid bones, phases and effect IDs', () => {
    expect(() => batchActionBindings({ ...fixture.manifest, effects: {} }, fixture.rows, fixture.bones, tables)).toThrow('dangling-batch-binding');
    expect(() => batchActionBindings(fixture.manifest, fixture.rows, { ...fixture.bones, 'synthetic-unit-0': [] }, tables)).toThrow('missing-binding-bone');
    const bad = structuredClone(tables) as any; bad['synthetic-unit-0'].cast[0].phase = 'invalid';
    expect(() => batchActionBindings(fixture.manifest, fixture.rows, fixture.bones, bad)).toThrow('invalid-binding-phase');
  });
  it.each([undefined, { __type: 'VfxPrimitiveRay' }, { __type: 'VfxPrimitiveArbitraryQuad' }])('retains Y long edge without X cross-axis inflation: %j', primitive => {
    const input = source(primitive), before = structuredClone(input);
    const r = mapEmitter(input, (p: string) => p, { particleMode: 'approximate' });
    expect(r.emitter.size.every((k: any) => k.value === 1)).toBe(true);
    const doc = parseParticleDocument({ schemaVersion: 2, limits: { maxParticles: 10, maxDuration: 2 }, emitters: [r.emitter] });
    if (doc.schemaVersion !== 2) throw new Error('expected-v2');
    const fx = new ParticleEffectV2(doc, { scale: 1 });
    try {
      fx.update(.25, new PerspectiveCamera());
      expect(Math.max(...fx.object.children[0].scale.toArray().slice(0, 2))).toBeCloseTo(400);
    } finally { fx.dispose(); }
    expect(input).toEqual(before);
  });
  it('uses all three mesh geometry axes and inserts dominance crossings', () => {
    const input = { ...source({ __type: 'VfxPrimitiveMesh', mMesh: { mSimpleMeshName: 'synthetic/mesh.scb' } }),
      birthScale0: { constantValue: [1, 2, 1] },
      scale0: { dynamics: { times: [0, 1], values: [[3, 0, 0], [0, 0, 2]] } } };
    const before = structuredClone(input);
    const r = mapEmitter(input, (p: string) => p, { particleMode: 'approximate',
      meshPath: () => 'synthetic/mesh.glb', meshBounds: () => [200, 50, 300] });
    expect(r.emitter.size).toContainEqual({ time: .5, value: 1 });
    const doc = parseParticleDocument({ schemaVersion: 2, limits: { maxParticles: 10, maxDuration: 2 }, emitters: [r.emitter] });
    if (doc.schemaVersion !== 2) throw new Error('expected-v2');
    const geometry = new BoxGeometry(200, 50, 300), fx = new ParticleEffectV2(doc, { mesh: () => geometry });
    try {
      fx.update(.5); geometry.computeBoundingBox();
      const size = geometry.boundingBox!.getSize(new Vector3()).multiply(fx.object.children[0].scale);
      expect(Math.max(...size.toArray())).toBeCloseTo(300);
    } finally { fx.dispose(); geometry.dispose(); }
    expect(input).toEqual(before);
  });
});

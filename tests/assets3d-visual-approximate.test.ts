import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { Mesh, PerspectiveCamera, Vector3 } from 'three';
import { ParticleEffect, parseParticleDocument } from '../src/rendering3d/particles';
import type { ParticleDocumentV2 } from '../src/rendering3d/contracts';
// @ts-expect-error Node conversion module.
import { convertParticles, mapEmitter } from '../scripts/assets3d/particles.mjs';
// @ts-expect-error Node policy module.
import { OMIT_PREVIEW_FIELDS, particleMode } from '../scripts/assets3d/particle-approximate.mjs';
// @ts-expect-error Node output module.
import { writeParticleEffects } from '../scripts/assets3d/build.mjs';
// @ts-expect-error Node trial module.
import { trialActionBindings } from '../scripts/assets3d/fx-trial.mjs';

const c = (constantValue: unknown) => ({ constantValue });
const emitter = (fields = {}) => ({ isSingleParticle: true, particleLifetime: c(1), ...fields });
const source = (fields = {}, system = {}) => ({ toy: { __type: 'VfxSystemDefinitionData', complexEmitterDefinitionData: [emitter(fields)], ...system } });
const convert = (fields = {}, system = {}, options = {}) => convertParticles(source(fields, system), () => 'texture.png', parseParticleDocument,
  { particleMode: 'approximate', ...options });
const mapped = (fields = {}, system = {}) => {
  const r = convert(fields, system); expect(r.counts.rejected).toBe(0); expect(r.systems[0].document).toBeDefined();
  return { e: r.systems[0].document.emitters[0], row: r.systems[0].report[0], doc: r.systems[0].document };
};

describe('explicit visual preview adapter', () => {
  it('matches full round-one results, including rejection order, without the switch and in strict mode', async () => {
    const fixture = JSON.parse(await readFile(new URL('./fixtures/assets3d-round1-strict.json', import.meta.url), 'utf8'));
    expect(fixture.head).toBe('52688b3'); expect(fixture.rows).toHaveLength(30);
    for (const row of fixture.rows) for (const options of [row.options, { ...row.options, particleMode: 'strict' }]) {
      const result = convertParticles(row.source, () => undefined, parseParticleDocument, options);
      expect(JSON.parse(JSON.stringify(result))).toEqual(row.expected);
    }
    expect(() => particleMode('typo')).toThrow('invalid-particle-mode');
    expect(() => convert({}, {}, { particleMode: 'typo' })).toThrow('invalid-particle-mode');
  });
  it('maps ArbitraryQuad to an actually camera-facing quad, retaining only birth Z roll', () => {
    const { e, row, doc } = mapped({ primitive: { __type: 'VfxPrimitiveArbitraryQuad' }, birthRotation0: c([90, 45, 0]) });
    expect(e.kind).toBe('quad'); expect(e.rotation0).toEqual([0, -0, -0]);
    expect(row).toMatchObject({ status: 'approximated', mapped: false, approximations: [
      expect.objectContaining({ handling: 'arbitrary-quad-as-camera-facing-quad' }),
      expect.objectContaining({ handling: 'camera-facing-quads-keep-only-Z-roll' }),
    ] });
    const camera = new PerspectiveCamera(); camera.rotation.set(.2, .4, .1);
    const fx = new ParticleEffect(doc, { scale: 1 }); fx.update(0, camera);
    expect(fx.object.children[0].quaternion.angleTo(camera.quaternion)).toBeLessThan(1e-6); fx.dispose();
  });
  it('orients ray geometry along velocity and uses local Y for stationary rays', () => {
    const { e, doc, row } = mapped({ primitive: { __type: 'VfxPrimitiveRay' }, birthVelocity: c([3, 0, 0]), birthScale0: c([2, 8, 1]), birthRotation0: c([90, 90, 90]) });
    expect(e.direction).toEqual([-3, 0, 0]);
    expect(row.approximations).toContainEqual(expect.objectContaining({ handling: 'ray-or-beam-direction-overrides-birth-rotation' }));
    const fx = new ParticleEffect(doc, { scale: 1 }); fx.update(.1);
    const mesh = fx.object.children[0] as Mesh;
    expect(new Vector3(0, 1, 0).applyQuaternion(mesh.quaternion).x).toBeCloseTo(-1);
    expect(mesh.scale.y).toBe(8); fx.dispose();
    expect(mapped({ primitive: { __type: 'VfxPrimitiveRay' } }).e.direction).toEqual([0, 1, 0]);
  });
  it('uses beam endpoints and skips missing or coincident endpoints without emitting a fake beam', () => {
    const p = { __type: 'VfxPrimitiveBeam', start: [1, 2, 3], end: [1, 8, 3] };
    const { e } = mapped({ primitive: p, birthScale0: c([4, 9, 1]) });
    expect(e).toMatchObject({ kind: 'ray', position: [-1, 2, 3], direction: [-0, 6, 0], size0: [4, 6, 1] });
    for (const primitive of [{ __type: p.__type }, { ...p, end: p.start }]) {
      expect(convert({ primitive }).systems[0].report[0]).toMatchObject({ status: 'skipped', reason: 'beam-endpoints-unavailable' });
    }
  });
  it.each([[1, 'normal'], [3, 'normal'], [4, 'additive'], [991, 'normal']])('annotates numeric blend %s as %s', (value, blend) => {
    const { e, row } = mapped({ blendMode: value }); expect(e.blend).toBe(blend);
    expect(row.status).toBe('approximated'); expect(row.approximations[0].field).toBe('blendMode');
  });
  it.each(Object.entries(OMIT_PREVIEW_FIELDS))('records omitted field %s separately', (field, handling) => {
    const value = field === 'isUniformScale' ? 1 : 0;
    const { row } = mapped({ [field]: value });
    expect(row.originalFields[field]).toBe(value);
    expect(row.approximations).toContainEqual({ field, value, handling });
  });
  it('ignores and annotates system flags/metadata and preserves original evidence', () => {
    const { row } = mapped({ pass: -9999, alphaRef: 15, miscRenderFlags: 1, depthBiasFactors: [0, -50] },
      { flags: 2244, soundOnCreateDefault: 'sound', soundPersistentDefault: 'loop', visibilityRadius: 100, buildUpTime: 1 });
    for (const field of ['system.flags', 'system.soundOnCreateDefault', 'system.soundPersistentDefault', 'system.visibilityRadius', 'system.buildUpTime']) {
      expect(row.approximations).toContainEqual(expect.objectContaining({ field }));
    }
    expect(convert({}, { mystery: 1 }).counts.rejected).toBe(1);
  });
  it.each([
    [{ __type: 'VfxShapeBox', Size: [2, 4, 6] }, { kind: 'box', halfExtents: [1, 2, 3] }],
    [{ __type: 'VfxShapeCylinder', radius: 2, height: 8 }, { kind: 'cylinder', radius: 2, height: 8 }],
    [{ __type: 'VfxShapeSphere', radius: 5 }, { kind: 'sphere', radius: 5 }],
    [{ __type: 'VfxShapeLegacy' }, { kind: 'point' }], [{ __type: '{unknown}' }, { kind: 'point' }],
  ])('maps volume or point shape %j', (SpawnShape, shape) => {
    const { e, row } = mapped({ SpawnShape }); expect(e.shape).toEqual(shape);
    expect(row.approximations[0].field).toBe('SpawnShape');
  });
  it('samples Cylinder volume with sqrt radial density and handles degenerate/missing dimensions', () => {
    const { doc } = mapped({ SpawnShape: { __type: 'VfxShapeCylinder', radius: 4, height: 8 } });
    doc.emitters[0].emission = { mode: 'burst', count: 1000 };
    const fx = new ParticleEffect(doc, { scale: 1 });
    const points = fx.object.children.map(c => c.position);
    expect(points.every(p => p.x ** 2 + p.z ** 2 <= 16 && Math.abs(p.y) <= 4)).toBe(true);
    expect(points.reduce((s, p) => s + p.x ** 2 + p.z ** 2, 0) / points.length).toBeCloseTo(8, 0);
    fx.dispose();
    expect(mapped({ SpawnShape: { __type: 'VfxShapeCylinder' } }).e.shape).toEqual({ kind: 'cylinder', radius: 0, height: 0 });
    expect(convert({ SpawnShape: { __type: 'VfxShapeSphere', radius: -1 } }).counts.rejected).toBe(1);
  });
  it('adds raw and sampled shape offsets before reflecting X', () => {
    for (const emitOffset of [[2, 3, 4], c([2, 3, 4])]) {
      expect(mapped({ SpawnShape: { __type: 'VfxShapeLegacy', emitOffset }, EmitterPosition: c([1, 1, 1]) }).e.position).toEqual([-3, 4, 5]);
    }
  });
  it('bindWeight is constant one, uniform scale uses X, scalar size curve uses absolute X', () => {
    const { e, row } = mapped({ bindWeight: { dynamics: { times: [0, 1], values: [1, 0] } }, isUniformScale: 1,
      birthScale0: c([8, 0, 0]), scale0: { dynamics: { times: [0, 1], values: [[-2, 3, 4], [1, 0, 9]] } } });
    expect(e.size0).toEqual([8, 8, 8]); expect(e.size).toEqual([{ time: 0, value: 2 }, { time: 1, value: 1 }]);
    expect(row.approximations).toContainEqual(expect.objectContaining({ field: 'bindWeight', handling: 'constant-one-attached-to-host' }));
  });
  it('applies row-major translation and rotation to sampled positions and orientation at runtime', () => {
    const matrix = [[0, 1, 0, 0], [-1, 0, 0, 0], [0, 0, 1, 0], [10, 20, 30, 1]];
    const { e, doc, row } = mapped({ EmitterPosition: c([2, 0, 0]), birthVelocity: c([1, 0, 0]) }, { transform: matrix });
    expect(row.approximations).toContainEqual(expect.objectContaining({ field: 'system.transform' }));
    expect(e.localTransform.slice(12)).toEqual([-10, 20, 30, 1]);
    const fx = new ParticleEffect(doc, { scale: 1 }); fx.update(.5);
    const mesh = fx.object.children[0] as Mesh;
    expect(mesh.position.toArray()).toEqual([-10, 22.5, 30]);
    expect(new Vector3(1, 0, 0).transformDirection(mesh.matrix).toArray()).toEqual([0, -1, 0]);
    fx.update(.1); expect(mesh.position.y).toBeCloseTo(22.6); fx.dispose();
    expect(convert({}, { transform: [[1]] }).counts.rejected).toBe(1);
  });
  it.each(['VfxPrimitiveCameraTrail', 'VfxPrimitiveArbitraryTrail'])('maps %s using X width with an independent trace', type => {
    const { e, row } = mapped({ primitive: { __type: type, mTrail: { mBirthTilingSize: [400, 0, 0], mMode: 1 } }, birthScale0: c([99, 99, 99]) });
    expect(e).toMatchObject({ kind: 'trail', trail: { width: [{ time: 0, value: 400 }], lifetime: .3, segments: 32 }, size0: [1, 1, 1] });
    expect(row.approximations[0].handling).toContain('v2-trail-width');
  });
  it('multiplies constants and curves, samples birth parameters, and replaces probability distributions with mean multipliers', () => {
    const { e, row } = mapped({ color: { constantValue: [.5, .5, .5, .5], dynamics: { times: [0, 1], values: [[1, .5, 0, 1], [0, 0, 0, 0]] } },
      birthVelocity: { constantValue: [2, 2, 2], dynamics: { times: [0], values: [[3, 3, 3]], probabilityTables: [{ keyValues: [0, 2] }, {}, {}] } } });
    expect(e.color[0].value).toEqual([.5, .25, 0]); expect(e.opacity[0].value).toBe(.5); expect(e.velocity).toEqual([-6, 6, 6]);
    expect(row.approximations.map((r: { handling: string }) => r.handling)).toContain('constant-times-curve');
    expect(row.approximations.map((r: { handling: string }) => r.handling)).toContain('deterministic-mean-keyValue-multiplier-empty-table-one');
  });
  it('bounds preview timing, atlas and integration and traces each fallback', () => {
    const { e, row } = mapped({ isSingleParticle: false, lifetime: -1, particleLifetime: c(-1), rate: c(5), texDiv: [2, 2], numFrames: 3,
      worldAcceleration: { __type: 'IntegratedValueVector3', constantValue: [0, -10, 0] }, birthAcceleration: c([0, 2, 0]),
      birthDrag: c([2, 3, 4]), rotationOverride: [0, 0, 45], modulationFactor: [1, 1, 1, 1], Filtering: {}, isDirectionOriented: true });
    expect(e).toMatchObject({ lifetime: 1, emission: { duration: 1, rate: 5 }, frames: { fps: 0, rows: 2, columns: 2 }, gravity: [-0, -8, 0], drag: 2 });
    for (const field of ['lifetime', 'particleLifetime', 'texDiv/numFrames', 'frameRate', 'worldAcceleration.__type', 'birthAcceleration',
      'birthDrag', 'rotationOverride', 'modulationFactor', 'Filtering', 'isDirectionOriented']) {
      expect(row.approximations).toContainEqual(expect.objectContaining({ field }));
    }
    expect(mapped({ scale0: { dynamics: { times: [-.1, .5, 1.1], values: [[1, 1, 1], [2, 2, 2], [3, 3, 3]] } } }).e.size.map((k: { time: number }) => k.time)).toEqual([0, .5, 1]);
  });
  it('starts a short low-rate continuous effect with one explicit preview burst', () => {
    const { doc, row } = mapped({ isSingleParticle: false, rate: c(1), lifetime: .1 });
    expect(row.approximations).toContainEqual(expect.objectContaining({ handling: 'continuous-preview-initial-burst-one' }));
    const fx = new ParticleEffect(doc); expect(fx.particleCount).toBe(1); fx.dispose();
    const strict = convertParticles(source({ isSingleParticle: false, rate: c(1), lifetime: .1 }), () => undefined, parseParticleDocument, { particleMode: 'strict' });
    const original = new ParticleEffect(strict.systems[0].document); original.update(.2); expect(original.particleCount).toBe(0); original.dispose();
  });
  it.each(['childParticleSetDefinition', 'fieldCollectionDefinition', 'fieldCollection'])('skips all of emitter with %s', field => {
    const r = convert({ [field]: {}, blendMode: 4 });
    expect(r.systems[0].report[0]).toMatchObject({ status: 'skipped', reason: `unexpressible-emitter:${field}` });
    expect(r.systems[0].document).toBeUndefined();
  });
  it('keeps unknown fields and invalid values rejected, including after approximate transformations', () => {
    expect(convert({ mystery: 1 }).counts.rejected).toBe(1);
    expect(convert({ blendMode: 4, particleLinger: null }).counts.rejected).toBe(1);
    const { doc } = mapped({ SpawnShape: { __type: 'VfxShapeCylinder', radius: 2 } });
    const bad = structuredClone(doc) as ParticleDocumentV2; (bad.emitters[0].localTransform as number[] | undefined) = [1];
    expect(() => parseParticleDocument(bad)).toThrow('localTransform');
    const sparse = Array(16); sparse[3] = sparse[7] = sparse[11] = 0; sparse[15] = 1;
    bad.emitters[0].localTransform = sparse;
    expect(() => parseParticleDocument(bad)).toThrow('localTransform');
  });
  it('writes no payload when per-emitter or combined v2 validation fails', async () => {
    for (const combined of [false, true]) {
      const s = { toy: { __type: 'VfxSystemDefinitionData', flags: 2244, complexEmitterDefinitionData: [emitter({ blendMode: 4 }), emitter({ blendMode: 1 })] } };
      const result = convertParticles(s, () => undefined, (doc: ParticleDocumentV2) => {
        parseParticleDocument(doc); if (doc.emitters.length > (combined ? 1 : 0)) throw new Error('synthetic-contract-failure');
      }, { particleMode: 'approximate' });
      const files: string[] = [];
      const written = await writeParticleEffects('toy', result, {}, { write: async (p: string) => files.push(p), remove: async () => {} });
      expect(result.counts).toMatchObject({ approximated: 0, rejected: 2 });
      expect(files).toEqual(['effects/toy/toy.report.json']); expect(written.effects).toEqual({});
    }
  });
  it('selects exactly one Medium muzzle and stages W/E/R/Q without guessing shared attack VFX', () => {
    const names = { jinx: ['BA_Minigun_Cas_Medium', 'BA_Minigun_Mis', 'W_Cas', 'W_Mis', 'W_Beam', 'W_Tar', 'E_Mis', 'E_Mine_Explosion',
      'R_MuzzleFlash', 'R_Cast_Mouth', 'R_Rocket_Child', 'R_Tar'], vi: ['Q_activate_hands_R', 'Q_Jumping_Dust', 'Q_Landing_Mis', 'Q_Landing_AoE', 'Q_Landing_AoE_Child', 'Q_Tar'] };
    const rows = Object.fromEntries(Object.entries(names).map(([unit, names]) => [unit, names.map(s => ({ sourcePath: `_Base_${s}`, effectId: `${unit}_${s}`, path: `${s}.json` }))]));
    const manifest = { effects: Object.fromEntries(Object.values(rows).flat().map(r => [r.effectId, { path: r.path }])) };
    const plan = trialActionBindings(manifest, rows);
    expect(plan.actionEffects.jinx.attack).toEqual(['jinx_BA_Minigun_Cas_Medium', 'jinx_BA_Minigun_Mis']);
    expect(plan.actionEffects.jinx.cast).toEqual(plan.variants.R.jinx.cast);
    expect(plan.actionEffects.vi.attack).toEqual([]); expect(plan.variants.crit.vi.attack).toEqual([]);
    expect(plan.playback.jinx_W_Tar).toMatchObject({ status: 'approximated', phase: 'impact', anchor: 'target', delay: .5 });
    expect(plan.unavailable).toContainEqual(expect.objectContaining({ system: 'Q_activate_hands_L' }));
  });
});

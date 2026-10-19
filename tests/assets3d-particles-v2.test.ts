import { describe, expect, it } from 'vitest';
import { parseParticleDocument } from '../src/rendering3d/particles';
// @ts-expect-error Pure Node utility.
import { convertParticles, mapEmitter } from '../scripts/assets3d/particles.mjs';
// @ts-expect-error Pure Node utility.
import { particleSourcesFromBins, compareParticleSources, loadParticleBins } from '../scripts/assets3d/particle-bin.mjs';
// @ts-expect-error Pure Node utility.
import { fnv1a, parseBin } from '../scripts/assets3d/bin.mjs';
// @ts-expect-error Pure Node utility.
import { convertParticleMesh } from '../scripts/assets3d/particle-mesh.mjs';
// @ts-expect-error Pure Node utility.
import { readGlb } from '../scripts/assets3d/glb.mjs';
// @ts-expect-error Pure Node utility.
import { writeParticleEffects } from '../scripts/assets3d/build.mjs';

const c = (constantValue: unknown) => ({ constantValue });
const e = (extra = {}) => ({ __type: 'VfxEmitterDefinitionData', isSingleParticle: true, particleLifetime: c(2), ...extra });
const source = (emitters: unknown[], fields = {}) => ({ test: { __type: 'VfxSystemDefinitionData', complexEmitterDefinitionData: emitters, ...fields } });
const texture = () => 'textures/test.png';
const convert = (emitters: unknown[], options = {}, fields = {}) => convertParticles(source(emitters, fields), texture, parseParticleDocument, options);
const mapped = (extra = {}, options = {}) => {
  const result = convert([e(extra)], options);
  expect(result.counts).toEqual({ mapped: 1, skipped: 0, rejected: 0 });
  expect(parseParticleDocument(result.systems[0].document)).toEqual(result.systems[0].document);
  return result.systems[0].document.emitters[0];
};
const u16 = (n: number) => { const b = Buffer.alloc(2); b.writeUInt16LE(n); return b; };
const u32 = (n: number) => { const b = Buffer.alloc(4); b.writeUInt32LE(n); return b; };
const f32 = (...v: number[]) => { const b = Buffer.alloc(v.length * 4); v.forEach((n, i) => b.writeFloatLE(n, i * 4)); return b; };
const text = (s: string) => Buffer.concat([u16(Buffer.byteLength(s)), Buffer.from(s)]);
const block = (b: Buffer) => Buffer.concat([u32(b.length), b]);
const field = (name: string, type: number, bytes: Buffer) => Buffer.concat([u32(/^\{/.test(name) ? parseInt(name.slice(1, -1), 16) : fnv1a(name)), Buffer.from([type]), bytes]);
const fields = (...v: Buffer[]) => Buffer.concat([u16(v.length), ...v]);
const embed = (type: string, ...v: Buffer[]) => Buffer.concat([u32(fnv1a(type)), block(fields(...v))]);
const list = (type: number, ...v: Buffer[]) => Buffer.concat([Buffer.from([type]), block(Buffer.concat([u32(v.length), ...v]))]);
const prop = (...v: Buffer[]) => Buffer.concat([Buffer.from('PROP'), u32(3), u32(0), u32(1), u32(fnv1a('VfxSystemDefinitionData')),
  block(Buffer.concat([u32(fnv1a('test')), fields(...v)]))]);

describe('particle BIN source uses the shared bounded parser', () => {
  const sample = () => prop(field('particlePath', 16, text('test')), field('complexEmitterDefinitionData', 0x80, list(0x82,
    embed('VfxEmitterDefinitionData', field('rate', 0x83, embed('ValueFloat', field('constantValue', 10, f32(5)))),
      field('lifetime', 10, f32(3)), field('particleLifetime', 0x83, embed('ValueFloat', field('constantValue', 10, f32(2)))),
      field('birthScale0', 0x83, embed('ValueVector3', field('constantValue', 12, f32(1, 2, 0)))),
      field('birthRotation0', 0x83, embed('ValueVector3', field('constantValue', 12, f32(10, 20, 30)))),
      field('EmitterPosition', 0x83, embed('ValueVector3', field('constantValue', 12, f32(4, 5, 6)))),
      field('primitive', 0x82, embed('VfxPrimitiveArbitraryQuad')), field('texture', 16, text('ASSETS/a.tex')),
      field('color', 0x83, embed('ValueColor', field('constantValue', 13, f32(1, 0, 0, 0.5)))),
      field('blendMode', 3, Buffer.from([1])), field('isSingleParticle', 0x87, Buffer.from([1])),
      field('{12345678}', 10, f32(7))))),
    field('simpleEmitterDefinitionData', 0x80, list(0x82, embed('VfxEmitterDefinitionData', field('emitterName', 16, text('simple'))))));
  it('names nested particle fields/types, lists, flag counts and unknown hashes without dropping fields', () => {
    const src = particleSourcesFromBins([parseBin(sample())]);
    expect(src.test.complexEmitterDefinitionData[0]).toEqual({ __type: 'VfxEmitterDefinitionData', rate: { __type: 'ValueFloat', constantValue: 5 },
      lifetime: 3, particleLifetime: { __type: 'ValueFloat', constantValue: 2 }, birthScale0: { __type: 'ValueVector3', constantValue: [1, 2, 0] },
      birthRotation0: { __type: 'ValueVector3', constantValue: [10, 20, 30] }, EmitterPosition: { __type: 'ValueVector3', constantValue: [4, 5, 6] },
      primitive: { __type: 'VfxPrimitiveArbitraryQuad' }, texture: 'ASSETS/a.tex', color: { __type: 'ValueColor', constantValue: [1, 0, 0, 0.5] },
      blendMode: 1, isSingleParticle: 1, '{12345678}': 7 });
    expect(src.test.simpleEmitterDefinitionData[0].emitterName).toBe('simple');
    expect(compareParticleSources(src, structuredClone(src)).matched).toBe(true);
    const changed = structuredClone(src); changed.test.complexEmitterDefinitionData[0].rate.constantValue = 4;
    expect(compareParticleSources(src, changed)).toMatchObject({ matched: false, differences: ['$.test.complexEmitterDefinitionData[0].rate.constantValue'] });
  });
  it('normalizes the matrix representation while preserving every numeric entry', () => {
    const bytes = prop(field('particlePath', 16, text('test')), field('transform', 14, f32(...Array.from({ length: 16 }, (_, i) => i))));
    expect(particleSourcesFromBins([parseBin(bytes)]).test.transform).toEqual([[0, 1, 2, 3], [4, 5, 6, 7], [8, 9, 10, 11], [12, 13, 14, 15]]);
  });
  it('compares all fields including named links, numeric flags and unknown hashes', () => {
    const a = { test: { __type: 'VfxSystemDefinitionData', flag: true, effectKey: { kind: 'link', hash: fnv1a('Child') }, '{12345678}': 4 } };
    const b = { test: { __type: 'VfxSystemDefinitionData', FLAG: 1, effectKey: 'Child', '{12345678}': 4 } };
    expect(compareParticleSources(a, b).matched).toBe(true);
    expect(compareParticleSources(a, { test: { ...b.test, extra: 1 } }).matched).toBe(false);
    expect(compareParticleSources(a, {})).toMatchObject({ matched: false, referenceSystems: 0 });
  });
  it('rejects conflicting systems and unapplied patches; deduplicates identical roots', () => {
    const doc = parseBin(sample());
    expect(Object.keys(particleSourcesFromBins([doc, doc]))).toEqual(['test']);
    const bad = structuredClone(doc); bad.entries[0].fields.push({ hash: fnv1a('extra'), type: 7, value: 3 });
    expect(() => particleSourcesFromBins([doc, bad])).toThrow('conflicting-particle-system');
    expect(() => particleSourcesFromBins([{ ...doc, patches: [{}] }])).toThrow('unsupported-particle-bin-patches');
  });
  it('follows extensionless linked PROP and embedded VFX BIN references with cycle and missing-link evidence', async () => {
    const root = Buffer.concat([Buffer.from('PROP'), u32(3), u32(2), text('Characters/Toy'), text('missing.bin'), u32(0)]);
    const files = new Map([['skin.bin', root], ['characters/toy', sample()]]);
    const loaded = await loadParticleBins(['skin.bin', 'skin.bin'], (p: string) => files.has(p.toLowerCase()) ? p.toLowerCase() : undefined,
      async (p: string) => files.get(p));
    expect(loaded.paths).toEqual(['skin.bin', 'characters/toy']);
    expect(loaded.unresolved).toEqual([{ path: 'missing.bin', reason: 'missing-linked-particle-bin' }]);
    expect(particleSourcesFromBins(loaded.documents).test).toBeDefined();
    const budget = await loadParticleBins(['skin.bin'], (p: string) => p.toLowerCase(), async (p: string) => files.get(p), { maxDocuments: 1 });
    expect(budget.unresolved.every((r: { reason: string }) => r.reason === 'particle-bin-document-budget')).toBe(true);
    const byteBudget = await loadParticleBins(['skin.bin'], (p: string) => p, async () => root, { maxBytes: 1 });
    expect(byteBudget.unresolved[0].reason).toBe('particle-bin-byte-budget');
  });
});

describe('exact v2 conversion and fail-closed reports', () => {
  it('maps finite continuous rate, emitter duration and particle lifetime separately', () => {
    expect(mapped({ isSingleParticle: false, rate: c(2.5), lifetime: 3, timeBeforeFirstEmission: 0.2 })).toMatchObject({
      kind: 'quad', emission: { mode: 'continuous', rate: 2.5, duration: 3 }, lifetime: 2, delay: 0.2 });
  });
  it('folds proven flat curves without treating time-varying values as constants', () => {
    expect(mapped({ isSingleParticle: false, lifetime: 2, rate: { dynamics: { times: [0, 1], values: [3, 3] } },
      EmitterPosition: { constantValue: [1, 2, 3], dynamics: { times: [0, 1], values: [[1, 2, 3], [1, 2, 3]] } } }))
      .toMatchObject({ emission: { rate: 3 }, position: [-1, 2, 3] });
    expect(convert([e({ particleLifetime: { constantValue: 2, dynamics: { times: [0, 1], values: [2, 3] } } })]).counts.rejected).toBe(1);
  });
  it('requires independent evidence for both loop and infinite particle lifetime', () => {
    const extra = { isSingleParticle: false, rate: c(1), lifetime: -1, particleLifetime: c(-1) };
    expect(convert([e(extra)]).counts.rejected).toBe(1);
    expect(mapped(extra, { emitterLoopEvidence: 'synthetic source loop definition', infiniteParticleEvidence: 'synthetic source infinite definition' }))
      .toMatchObject({ emission: { mode: 'continuous', rate: 1, loop: true }, lifetime: 'infinite' });
  });
  it('maps position and constant vector size with zero axes', () => {
    expect(mapped({ EmitterPosition: c([3, 4, 5]), birthScale0: c([10, 20, 0]) })).toMatchObject({ position: [-3, 4, 5], size0: [10, 20, 0] });
  });
  it.each([2, [2, 3, 4], { min: 1, max: 2 }, { min: [0, 1, 2], max: [3, 4, 5] }])('maps explicit uniform size %j', value => {
    expect(mapped({ birthScale0: typeof value === 'object' && !Array.isArray(value) ? value : c(value) }).size0).toEqual(value);
  });
  it.each([[c(30), -30], [c([10, 20, 30]), [10, -20, -30]], [{ min: [0, 10, 20], max: [10, 20, 30] }, { min: [0, -20, -30], max: [10, -10, -20] }]])('reflects XYZ/scalar rotation and reorders ranges', (input, expected) => {
    expect(mapped({ birthRotation0: input }).rotation0).toEqual(expected);
  });
  it('multiplies constant birth RGBA with age color/alpha and preserves linear key times', () => {
    const out = mapped({ birthColor: c([0.5, 1, 0.5, 0.5]), color: { dynamics: { times: [0, 1], values: [[1, 0.5, 0, 1], [0, 1, 1, 0]] } },
      scale0: { dynamics: { times: [0, 1], values: [[1, 1, 1], [2, 2, 2]] } }, blendMode: 'additive' });
    expect(out.color).toEqual([{ time: 0, value: [0.5, 0.5, 0] }, { time: 1, value: [0, 1, 0.5] }]);
    expect(out.opacity).toEqual([{ time: 0, value: 0.5 }, { time: 1, value: 0 }]);
    expect(out.size).toEqual([{ time: 0, value: 1 }, { time: 1, value: 2 }]);
  });
  it('uses explicit atlas timing and refuses an unverified multi-frame default', () => {
    expect(mapped({ texture: 'x.tex', texDiv: [2, 2], numFrames: 4, frameRate: c(8) }).frames)
      .toEqual({ columns: 2, rows: 2, fps: 8, loop: false });
    expect(convert([e({ texDiv: [2, 2], numFrames: 4 })]).byReason['unverified-atlas-frame-rate']).toBe(1);
    expect(convert([e({ texDiv: [2, 2], numFrames: 3 })]).byReason['partial-atlas']).toBe(1);
  });
  it('maps mesh references only when the converted resource exists', () => {
    expect(mapped({ primitive: { __type: 'VfxPrimitiveMesh', mMesh: { __type: 'VfxMeshDefinitionData', mSimpleMeshName: 'test.scb' } } },
      { meshPath: () => 'meshes/test.glb' })).toMatchObject({ kind: 'mesh', mesh: 'meshes/test.glb' });
  });
  it('maps reviewed arbitraryQuad, ray and trail conventions; production type tags alone remain rejected', () => {
    const arbitrary = { __type: 'VfxPrimitiveArbitraryQuad' }, ray = { __type: 'VfxPrimitiveRay' };
    const trail = { __type: 'VfxPrimitiveCameraTrail', mTrail: { mMode: 0 } };
    const options = { primitiveConventions: {
      VfxPrimitiveArbitraryQuad: { evidence: 'synthetic XY plane definition', plane: 'XY' },
      VfxPrimitiveRay: { evidence: 'synthetic +Y ray without camera constraints', direction: [0, 1, 0] },
      VfxPrimitiveCameraTrail: { evidence: 'synthetic linear trail definition', matches: trail.mTrail,
        trail: { width: [{ time: 0, value: 2 }], lifetime: 1, segments: 16, uvMode: 'repeat', tileLength: 4 } },
    } };
    expect(mapped({ primitive: arbitrary }, options).kind).toBe('arbitraryQuad');
    expect(mapped({ primitive: ray }, options).direction).toEqual([-0, 1, 0]);
    expect(mapped({ primitive: trail }, options).trail).toEqual(options.primitiveConventions.VfxPrimitiveCameraTrail.trail);
    expect(convert([e({ primitive: arbitrary }), e({ primitive: ray }), e({ primitive: trail })]).counts.rejected).toBe(3);
    expect(convert([e({ primitive: { ...trail, mTrail: { mMode: 3 } } })], options).counts.rejected).toBe(1);
  });
  it.each(['particleLinger', 'emitterLinger', 'bindWeight', 'rotation0', 'alphaErosionDefinition', 'childParticleSetDefinition', 'unknown'])('keeps the entire unsupported %s emitter out of JSON', field => {
    const original = e({ [field]: c(1) }), result = convert([original]);
    expect(result.systems[0].document).toBeUndefined();
    expect(result.systems[0].report[0]).toMatchObject({ mapped: false, originalFields: original });
    expect(result.byReason[`unmapped-source-field:${field}`]).toBe(1);
  });
  it.each([
    { birthScale0: { constantValue: [1, 1, 1], dynamics: { probabilityTables: [] } } },
    { birthVelocity: { constantValue: [1, 1, 1], dynamics: { times: [0, 1], values: [[0, 0, 0], [1, 1, 1]] } } },
    { rate: { dynamics: { times: [0, 1], values: [1, 2] } } },
    { scale0: { dynamics: { times: [0, 1], values: [[1, 1, 1], [2, 3, 4]] } } },
    { blendMode: 1 }, { birthDrag: c([1, 2, 3]) }, { rate: c(3) },
    { birthRotation0: { min: 20, max: 10 } },
  ])('does not approximate probabilities, dynamics, enums, anisotropy or burst counts: %j', extra => {
    expect(convert([e(extra)]).counts.rejected).toBe(1);
  });
  it('retains system-level transform/timing/flag semantics instead of dropping them', () => {
    const result = convert([e()], {}, { transform: [[1, 0, 0, 0]], flags: 197 });
    expect(result.systems[0]).toMatchObject({ document: undefined, systemGaps: ['transform', 'flags'] });
    expect(result.systems[0].report[0].reason).toBe('unmapped-system-field:transform');
  });
  it.each([{ birthScale0: c([-1, 1, 1]) }, { timeBeforeFirstEmission: c(-1) }, { birthScale0: { min: 4, max: 3 } }])('rejects invalid v2 candidates without writing them', async extra => {
    const result = convert([e(extra)]), written: string[] = [];
    await writeParticleEffects('toy', result, {}, { write: async (path: string) => written.push(path), remove: async () => {} });
    expect(written).toEqual(['effects/toy/test.report.json']);
    expect(result.counts.rejected).toBe(1);
  });
  it('reclassifies all candidate emitters on whole-document validation failure and writes only a sidecar', async () => {
    const result = convertParticles(source([e(), e()]), texture, (doc: { emitters: unknown[] }) => {
      parseParticleDocument(doc); if (doc.emitters.length > 1) throw new Error('synthetic-document-budget');
    });
    expect(result.counts).toEqual({ mapped: 0, skipped: 0, rejected: 2 });
    expect(result.byReason['contract-rejected:synthetic-document-budget']).toBe(2);
    const paths: string[] = [];
    const out = await writeParticleEffects('toy', result, { cast: ['test'] }, { write: async (p: string) => paths.push(p), remove: async () => {} });
    expect(paths).toEqual(['effects/toy/test.report.json']); expect(out.effects).toEqual({}); expect(out.actionEffects.cast).toEqual([]);
  });
  it('bounds v2 documents explicitly and rejects invalid budgets through the actual validator', () => {
    expect(convert([e()], { limits: { maxParticles: 0 } }).systems[0].report[0].reason).toContain('contract-rejected:invalid-particle-v2');
    expect(convert([e()], { limits: { maxDuration: 3601 } }).counts.rejected).toBe(1);
    expect(convert([e()], { limits: { maxDuration: '60' } }).counts.rejected).toBe(1);
    expect(convert([e()]).systems[0].document.limits).toEqual({ maxParticles: 10000, maxDuration: 30 });
  });
  it('includes finite emission, particle, delay and tail duration instead of silently clipping at 30 seconds', () => {
    const emitter = e({ isSingleParticle: false, rate: c(1), lifetime: 40, timeBeforeFirstEmission: 5 });
    expect(convert([emitter]).systems[0].document.limits.maxDuration).toBe(47);
    expect(convert([emitter], { limits: { maxDuration: 30 } }).counts.rejected).toBe(1);
    expect(convert([e({ particleLifetime: c(3600), timeBeforeFirstEmission: 1 })]).counts.rejected).toBe(1);
  });
});

describe('zero-dependency static particle meshes', () => {
  const scb = (major = 3) => {
    const name = Buffer.alloc(128), material = Buffer.alloc(64);
    return Buffer.concat([Buffer.from('r3d2Mesh'), u16(major), u16(2), name, u32(3), u32(1), u32(2),
      f32(0, 0, 0, 1, 1, 0), ...(major === 3 ? [u32(0)] : []), f32(0, 0, 0, 1, 0, 0, 0, 1, 0),
      f32(0, 0, 0), u32(0), u32(1), u32(2), material, f32(0, 1, 0, 0, 0, 1)]);
  };
  const sco = () => Buffer.from('[ObjectBegin]\nName=synthetic\nCentralPoint=0 0 0\nVerts=3\n0 0 0\n1 0 0\n0 1 0\nFaces=1\n3 0 1 2 material 0 0 1 0 0 1\n[ObjectEnd]\n');
  const readFloats = (b: Buffer) => Array.from({ length: b.length / 4 }, (_, i) => b.readFloatLE(i * 4));
  it.each([2, 3])('converts SCB %i.2 with reflected winding and UV seams into a self-contained GLB', major => {
    const output = convertParticleMesh(scb(major), '.scb'), { document, binary } = readGlb(output.glb);
    expect(output.report).toMatchObject({ vertices: 3, triangles: 1, sourceVertices: 3 });
    expect(document.meshes[0].primitives[0].attributes).toEqual({ POSITION: 0, TEXCOORD_0: 1 });
    expect(readFloats(binary.subarray(0, 36))).toEqual([-0, 0, 0, -0, 1, 0, -1, 0, 0]);
    expect(readFloats(binary.subarray(36))).toEqual([0, 0, 0, 1, 1, 0]);
  });
  it('converts SCO to byte-identical geometry, including independent per-face UVs', () => {
    expect(readGlb(convertParticleMesh(sco(), '.sco').glb)).toEqual(readGlb(convertParticleMesh(scb(), '.scb').glb));
  });
  it.each([{ maxBytes: 8 }, { maxVertices: 2 }, { maxFaces: 0 }, { maxOutputBytes: 16 }])('rejects budget %j before large allocation', limits => {
    expect(() => convertParticleMesh(scb(), '.scb', limits)).toThrow(/budget/);
    expect(() => convertParticleMesh(sco(), '.sco', limits)).toThrow(/budget/);
  });
  it('rejects unsupported flags, nonzero pivots, invalid indices, NaN and trailing/truncated bytes', () => {
    const flags = scb(); flags.writeUInt32LE(1, 148);
    const pivot = scb(); pivot.writeFloatLE(1, 216);
    const index = scb(); index.writeUInt32LE(9, 228);
    const nan = scb(); nan.writeFloatLE(NaN, 180);
    for (const b of [flags, pivot, index, nan, scb().subarray(0, -1), Buffer.concat([scb(), u32(0)])]) expect(() => convertParticleMesh(b, '.scb')).toThrow();
    expect(() => convertParticleMesh(Buffer.from(sco().toString().replace('3 0 1 2 material', '4 0 1 2 material')), '.sco')).toThrow();
    expect(() => convertParticleMesh(scb(), '.skn')).toThrow('unsupported-mesh-extension');
  });
});

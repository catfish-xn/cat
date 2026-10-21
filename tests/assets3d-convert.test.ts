import { describe, expect, it } from 'vitest';
import { assertManifest, assetUrl } from '../src/rendering3d/contracts';
import { parseParticleDocument } from '../src/rendering3d/particles';
// @ts-expect-error Pure Node build utility.
import { convertParticles, mapEmitter } from '../scripts/assets3d/particles.mjs';
// @ts-expect-error Pure Node build utility.
import { makeManifest, build, writeParticleEffects } from '../scripts/assets3d/build.mjs';
// @ts-expect-error Pure Node build utility.
import { contracts, unitDefinitions } from '../scripts/assets3d/runtime.mjs';
// @ts-expect-error Pure Node build utility.
import { argumentsFor, summarizeRanges } from '../scripts/assets3d/plan-fetch.mjs';
// @ts-expect-error Pure Node build utility.
import { chunksForRange, readRman } from '../scripts/assets3d/rman.mjs';
const constant = (constantValue: unknown) => ({ constantValue });
const sprite = () => ({ __type: 'VfxEmitterDefinitionData', isSingleParticle: true, particleLifetime: constant(2), texture: 'ASSETS/spark.tex', birthVelocity: constant([1, 2, 3]), color: constant([0.25, 0.5, 1, 0.75]) });
const source = (emitters: unknown[]) => ({ system: { __type: 'VfxSystemDefinitionData', complexEmitterDefinitionData: emitters } });
describe('strict particle conversion and public contract integration', () => {
    it('maps the exact finite subset, mirrors vectors and uses root-relative PNGs', () => {
        const result = convertParticles(source([sprite()]), () => 'textures/spark.png', parseParticleDocument);
        expect(result.counts).toEqual({ mapped: 1, skipped: 0, rejected: 0 });
        expect(result.systems[0].document).toEqual({ schemaVersion: 2, limits: { maxParticles: 10000, maxDuration: 30 }, emitters: [{ kind: 'quad', emission: { mode: 'burst', count: 1 }, lifetime: 2, texture: 'textures/spark.png', velocity: [-1, 2, 3], color: [{ time: 0, value: [0.25, 0.5, 1] }], opacity: [{ time: 0, value: 0.75 }] }] });
        expect(parseParticleDocument(result.systems[0].document)).toEqual(result.systems[0].document);
    });
    it('rejects continuous emission without an established emitter duration', () => {
        const result = convertParticles(source([{ ...sprite(), isSingleParticle: false, rate: constant(10) }]), () => 'textures/spark.png', parseParticleDocument);
        expect(result.systems[0].document).toBeUndefined();
        expect(result.systems[0].reason).toBe('no-writable-emitters');
        expect(result.counts.rejected).toBe(1);
        expect(result.systems[0].report[0]).toMatchObject({ mapped: false, reason: 'unverified-emitter-lifetime', originalFields: { rate: { constantValue: 10 } } });
    });
    it.each(['EmitterPosition', 'birthScale0', 'scale0', 'birthRotation0', 'lifetime', 'particleLinger'])('rejects the complete emitter when %s cannot be represented', field => {
        const result = mapEmitter({ ...sprite(), [field]: { dynamics: { probabilityTables: [] } } }, () => 'textures/spark.png');
        expect(result.status).toBe('rejected');
        expect(result.emitter).toBeUndefined();
    });
    it('retains probability tables, infinite lifetime and unknown fields only in reports', () => {
        const emitters = [{ ...sprite(), birthVelocity: { constantValue: [1, 2, 3], dynamics: { probabilityTables: [] } } }, { ...sprite(), particleLifetime: constant(-1) }, { ...sprite(), unknownSemantic: 3 }];
        const result = convertParticles(source(emitters), () => 'textures/spark.png', parseParticleDocument);
        expect(result.counts.rejected).toBe(3);
        expect(result.systems[0].report.map((e: {
            reason: string;
        }) => e.reason)).toEqual(['unmapped-birthVelocity:dynamics', 'special-or-dynamic-lifetime', 'unmapped-source-field:unknownSemantic']);
        expect(result.systems[0].document).toBeUndefined();
    });
    it('keeps unsupported emitters exclusively in sidecars and omits a system with no writable emitters', () => {
        const e: object[] = ['VfxPrimitiveMesh', 'VfxPrimitiveCameraTrail', 'VfxPrimitiveArbitraryQuad', 'VfxPrimitiveRay'].map(__type => ({ ...sprite(), primitive: { __type } }));
        e.push({ ...sprite(), distortionDefinition: { __type: 'VfxDistortionDefinitionData', distortion: 0.1 } });
        const r = convertParticles(source(e), () => 'textures/spark.png', parseParticleDocument);
        expect(r.counts).toEqual({ mapped: 0, skipped: 2, rejected: 3 });
        expect(r.systems[0].document).toBeUndefined();
        expect(r.systems[0].reason).toBe('no-writable-emitters');
        expect(r.systems[0].report.map((entry: { mapped: boolean; originalFields: unknown }) => entry.mapped)).toEqual([false, false, false, false, false]);
        expect(r.systems[0].report.map((entry: { originalFields: unknown }) => entry.originalFields)).toEqual(e);
        expect(r.systems[0].report.map((entry: { reason: string }) => entry.reason)).toEqual(['mesh-resource-unavailable', 'unverified-primitive-semantics:VfxPrimitiveCameraTrail', 'unverified-primitive-semantics:VfxPrimitiveArbitraryQuad', 'unverified-primitive-semantics:VfxPrimitiveRay', 'screen-distortion-requires-scene-color']);
    });
    it('writes only mapped emitters in a mixed system and registers only written effects', async () => {
        const unsupported = [{ ...sprite(), primitive: { __type: 'VfxPrimitiveMesh' } }, { ...sprite(), primitive: { __type: 'VfxPrimitiveCameraTrail' } }, { ...sprite(), distortionDefinition: { __type: 'VfxDistortionDefinitionData' } }];
        const converted = convertParticles({
            ...source([sprite(), ...unsupported]),
            empty: { __type: 'VfxSystemDefinitionData', complexEmitterDefinitionData: unsupported },
        }, () => 'textures/spark.png', parseParticleDocument);
        const files = new Map<string, string>([['effects/jinx/empty.json', 'old opaque payload']]), removed: string[] = [];
        const output = await writeParticleEffects('jinx', converted, { cast: ['system', 'empty'] }, {
            write: async (path: string, bytes: string) => { files.set(path, bytes); },
            remove: async (path: string) => { removed.push(path); files.delete(path); },
        });
        expect([...files.keys()].sort()).toEqual(['effects/jinx/empty.report.json', 'effects/jinx/system.json', 'effects/jinx/system.report.json']);
        expect(removed).toEqual(['effects/jinx/empty.json']);
        const document = JSON.parse(files.get('effects/jinx/system.json')!);
        expect(document.emitters.map((e: { kind: string }) => e.kind)).toEqual(['quad']);
        expect(parseParticleDocument(document)).toEqual(document);
        expect(output.effects).toEqual({ jinx_system: { path: 'effects/jinx/system.json' } });
        expect(makeManifest({}, output.effects, assertManifest).effects).toEqual(output.effects);
        expect(output.actionEffects.cast).toEqual(['jinx_system']);
        expect(output.systems.find((s: { effectId: string }) => s.effectId === 'jinx_empty')).toMatchObject({ reason: 'no-writable-emitters', counts: { mapped: 0, skipped: 2, rejected: 1 } });
        expect(output.systems.find((s: { effectId: string }) => s.effectId === 'jinx_empty').path).toBeUndefined();
        const sidecar = JSON.parse(files.get('effects/jinx/empty.report.json')!);
        expect(sidecar.reason).toBe('no-writable-emitters');
        expect(sidecar.emitters.map((e: { originalFields: unknown }) => e.originalFields)).toEqual(unsupported);
    });
    it('leaves an all-unsupported build with no particle payload or manifest effect', async () => {
        const converted = convertParticles(source([{ primitive: { __type: 'VfxPrimitiveMesh' } }]), () => undefined, parseParticleDocument);
        const written: string[] = [];
        const result = await writeParticleEffects('vi', converted, { cast: ['system'] }, {
            write: async (path: string) => { written.push(path); }, remove: async () => {},
        });
        expect(written).toEqual(['effects/vi/system.report.json']);
        expect(makeManifest({}, result.effects, assertManifest).effects).toEqual({});
        expect(result.actionEffects).toEqual({ cast: [] });
    });
    it('rejects a missing texture and records contract-invalid candidates per emitter', () => {
        expect(mapEmitter(sprite(), () => undefined).reason).toBe('missing-or-unsupported-texture');
        const r = convertParticles(source([{ ...sprite(), timeBeforeFirstEmission: constant(-1) }]), () => 'textures/spark.png', parseParticleDocument);
        expect(r.counts.rejected).toBe(1);
        expect(r.systems[0].report[0].reason).toContain('contract-rejected:invalid-emitter-timing');
    });
    it('loads repository TS validators directly and agrees on the same accepted/rejected corpus', async () => {
        const runtime = await contracts();
        const docs = [{ schemaVersion: 1, emitters: [] }, { schemaVersion: 1, emitters: [{ kind: 'mesh', opaque: true }] }, { schemaVersion: 1, emitters: [{ kind: 'sprite', count: 1, lifetime: 1, unsupported: true }] }, { schemaVersion: 1, emitters: [{ kind: 'sprite', count: 1, lifetime: -1 }] }, { schemaVersion: 1, emitters: [{ kind: 'ArbitraryQuad' }] }, { schemaVersion: 1, emitters: [{ kind: 'sprite', count: 1, lifetime: 1, size: [{ time: 0, value: [1, 1, 1] }] }] }];
        for (const doc of docs) {
            let expected;
            try {
                expected = { value: parseParticleDocument(doc) };
            }
            catch (e) {
                expected = { error: (e as Error).message };
            }
            let actual;
            try {
                actual = { value: runtime.parseParticleDocument(doc) };
            }
            catch (e) {
                actual = { error: (e as Error).message };
            }
            expect(actual).toEqual(expected);
        }
        for (const m of [{ schemaVersion: 1, models: {} }, { schemaVersion: 1, models: { jinx: { path: '../x.glb' } } }, { schemaVersion: 1, models: { jinx: { path: 'models/jinx.glb', animations: { hit: 'hit', wrong: 'idle' } } } }]) {
            let a = '', b = '';
            try {
                assertManifest(m);
            }
            catch (e) {
                a = (e as Error).message;
            }
            try {
                runtime.assertManifest(m);
            }
            catch (e) {
                b = (e as Error).message;
            }
            expect(a).toBe(b);
        }
    });
    it('generates only contract fields and omits an unavailable hit clip', () => {
        const m = makeManifest({ jinx: { path: 'models/jinx/model.glb', animations: { idle: 'tft13_jinx_idle1' } } }, { spark: { path: 'effects/jinx/spark.json' } }, assertManifest);
        expect(Object.keys(m)).toEqual(['schemaVersion', 'models', 'effects']);
        expect(m.models.jinx.animations.hit).toBeUndefined();
    });
    it.each(['/a.glb', 'a\\b.glb', 'https://x/a.glb', '../a.glb', 'a%2Fb.glb', 'a.glb?q', 'a.glb#x'])('rejects manifest path %s with the authoritative path rule', path => {
        expect(() => makeManifest({ jinx: { path } }, {}, assertManifest)).toThrow();
        expect(() => assetUrl('', path)).toThrow();
    });
    it('retains the sixty original definitions and adds the three six-cost assets', async () => {
        const d = await unitDefinitions();
        expect(Object.keys(d)).toHaveLength(63);
        expect(Object.keys(d).filter(id => d[id].cost === 6).sort()).toEqual(['mel', 'viktor', 'warwick']);
        expect(Object.keys(d).some(id => id.includes('-ranged'))).toBe(false);
        expect([1, 2, 3, 4, 5].map(cost => Object.values(d).filter((v) => (v as {
            cost: number;
        }).cost === cost).length)).toEqual([14, 13, 13, 12, 8]);
    });
    it('rejects bad CLI switches, duplicate options and unsupported build units before writing', async () => {
        expect(() => argumentsFor(['--url', 'x'], ['--source'])).toThrow('invalid-argument');
        expect(() => argumentsFor(['--source', 'a', '--source', 'b'], ['--source'])).toThrow('duplicate-argument');
        expect(() => argumentsFor(['--source'], ['--source'])).toThrow('invalid-argument');
        await expect(build({ units: 'jinx,jinx', out: 'assets3d-local/test-no-write' })).rejects.toThrow('unsupported-build-units');
        await expect(build({ units: 'gangplank-ranged', out: 'assets3d-local/test-no-write' })).rejects.toThrow('unsupported-build-units');
        await expect(build({ out: '../bad' })).rejects.toThrow('unsafe-output-path');
    });
    it('deduplicates download chunks across adjacent entry ranges and honors exact end boundaries', () => {
        const file = { size: 30, chunks: [{ id: 'a', fileOffset: 0, targetSize: 10, size: 6 }, { id: 'b', fileOffset: 10, targetSize: 10, size: 7 }, { id: 'c', fileOffset: 20, targetSize: 10, size: 8 }] };
        expect(chunksForRange(file, 0, 10).map((c: {
            id: string;
        }) => c.id)).toEqual(['a']);
        expect(chunksForRange(file, 10, 0)).toEqual([]);
        expect(summarizeRanges(file, [{ offset: 5, compressedSize: 10, size: 20 }, { offset: 10, compressedSize: 5, size: 10 }])).toMatchObject({ entries: 2, chunks: 2, downloadBytes: 13, chunkIds: ['a', 'b'] });
        expect(() => chunksForRange(file, 25, 10)).toThrow('invalid-rman-range');
    });
    it('rejects truncated or foreign RMAN headers before decompression', () => {
        expect(() => readRman(Buffer.alloc(12))).toThrow('truncated-asset');
        expect(() => readRman(Buffer.alloc(28))).toThrow('unsupported-rman');
    });
});

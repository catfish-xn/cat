import { describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { assertManifest } from '../src/rendering3d/contracts';
// @ts-expect-error Offline Node entry.
import { PET_CONFIG, PET_ACTION_RULES, EXTRA_EFFECTS, SPECIAL_ORB_EFFECTS, extrasBindings, composeStaticChildren, extrasExtractPath, sustainPrismaticIdle } from '../scripts/assets3d/tft-extras.mjs';
// @ts-expect-error Offline Node entry.
import { specialOrbClosure } from '../scripts/assets3d/special-orbs.mjs';
// @ts-expect-error Offline Node entry.
import { convertParticleMesh } from '../scripts/assets3d/particle-mesh.mjs';
// @ts-expect-error Offline Node entry.
import { readGlb } from '../scripts/assets3d/glb.mjs';
import { parseParticleDocument } from '../src/rendering3d/particle-validation';
// @ts-expect-error Offline Node entry.
import { selectAnimations } from '../scripts/assets3d/bin-bindings.mjs';
// @ts-expect-error Offline Node entry.
import { fnv1a } from '../scripts/assets3d/bin.mjs';
// @ts-expect-error Offline Node entry.
import { mergeManifests } from '../scripts/assets3d/merge-manifests.mjs';

const emitter = { kind: 'quad', lifetime: 1, position: [1, 2, 3], emission: { mode: 'burst', count: 1 } };
const document = { schemaVersion: 2, limits: { maxParticles: 10, maxDuration: 2 }, emitters: [emitter] };
const field = (name: string, value: unknown) => ({ hash: fnv1a(name), value });
describe('offline TFT extras', () => {
  it('stores long archive names under stable bounded components and preserves other outputs', () => {
    const source = 'extracted/data/' + 'shared_'.repeat(150) + '.bin';
    expect(extrasExtractPath(source)).toMatch(/^extracted\/by-path\/[a-f0-9]{64}\.bin$/);
    expect(extrasExtractPath(source)).toBe(extrasExtractPath(source));
    expect(extrasExtractPath(source + '2')).not.toBe(extrasExtractPath(source));
    expect(extrasExtractPath('manifest.json')).toBe('manifest.json');
  });
  it('holds accepted infinite idle particles, loops unbounded emission and leaves rejects absent', () => {
    const doc = { schemaVersion: 2, limits: { maxParticles: 10, maxDuration: 30 }, emitters: [
      structuredClone(emitter), { ...structuredClone(emitter), emission: { mode: 'continuous', rate: 1, duration: 1 } },
      structuredClone(emitter),
    ] };
    const system = { document: doc, report: [
      { status: 'rejected', originalFields: { particleLifetime: { constantValue: -1 } } },
      { status: 'approximated', originalFields: { isSingleParticle: 1, particleLifetime: { constantValue: -1 } } },
      { status: 'approximated', originalFields: {} },
      { status: 'mapped', originalFields: { isSingleParticle: 1, particleLifetime: { constantValue: 1 } } },
    ] };
    sustainPrismaticIdle(system);
    expect(doc.emitters).toHaveLength(3);
    expect(doc.emitters[0].lifetime).toBe(3600);
    expect(doc.emitters[1].emission).toEqual({ mode: 'continuous', rate: 1, loop: true });
    expect(doc.emitters[2].lifetime).toBe(1);
    expect(() => parseParticleDocument(doc)).not.toThrow();
  });
  it('configures a separate non-champion key and maps available actions without substitutes', () => {
    expect(PET_CONFIG.ids).toEqual(['little-legend-default']);
    const clips = ['idle', 'cast', 'hurt', 'death', 'emote_01'].map(name => ({ hash: fnv1a(name), atomic: true, flags: 0, path: `assets/sample/${name}.anm` }));
    const selected = selectAnimations(clips, PET_ACTION_RULES);
    expect(selected.mapped).toMatchObject({ idle: 'idle', cast: 'cast', hit: 'hurt', death: 'death' });
    expect(selected.mapped.move).toBeUndefined(); expect(selected.mapped.attack).toBeUndefined();
    expect(selected.decisions.move.sourceStatus).toBe('no-source-action');
  });
  it('exports the requested stable manifest keys with valid phase and anchor bindings', () => {
    const ids = ['orb-gray', 'orb-blue', 'orb-gold'].flatMap(id => [id, `${id}-child`, `${id}-open`]);
    ids.push('orb-prismatic', 'orb-prismatic-idle', ...SPECIAL_ORB_EFFECTS.map((s: { id: string }) => s.id), 'player-damage-mis', 'player-damage-mis1', 'player-damage-tar', 'player-damage-child');
    expect(EXTRA_EFFECTS.map((s: { id: string }) => s.id)).toEqual(ids);
    const manifest = { schemaVersion: 1, models: {}, effects: Object.fromEntries(ids.map(id => [id, { path: `effects/${id}.json` }])) };
    assertManifest(manifest);
    const bindings = extrasBindings(manifest);
    expect(bindings.playback['player-damage-mis']).toMatchObject({ phase: 'travel', anchor: 'projectile' });
    expect(bindings.playback['player-damage-tar']).toMatchObject({ phase: 'impact', anchor: 'target' });
    expect(() => extrasBindings({ effects: {} })).toThrow('missing-extra-effect');
    const spec = { id: ids[0], phase: 'invalid', anchor: 'source' };
    expect(() => extrasBindings(manifest, [spec])).toThrow('invalid-extra-phase');
    expect(() => extrasBindings(manifest, [{ ...spec, phase: 'travel', anchor: 'bad' }])).toThrow('invalid-extra-anchor');
  });
  it('keeps dedicated idle keys and explicit generic-open approximations, with bounded playback', () => {
    const manifest = { schemaVersion: 1, models: {}, effects: Object.fromEntries(SPECIAL_ORB_EFFECTS.map((s: { id: string }) => [s.id, { path: `effects/${s.id}.json` }])) };
    assertManifest(manifest);
    const bindings = extrasBindings(manifest, SPECIAL_ORB_EFFECTS).playback;
    for (const name of ['warband', 'crime']) {
      expect(manifest.effects[`orb-${name}`]).toBeDefined();
      expect(manifest.effects[`orb-${name}-open`]).toBeDefined();
      expect(bindings[`orb-${name}`]).toMatchObject({ phase: 'start', anchor: 'source', maxDuration: 3600 });
      expect(bindings[`orb-${name}-open`]).toMatchObject({ phase: 'impact', anchor: 'target', approximation: expect.stringContaining('no-dedicated-source-system') });
    }
    expect(bindings['orb-warband-reward-queued']).toMatchObject({ phase: 'travel', anchor: 'projectile' });
    for (const b of Object.values(bindings) as { phase: string; maxDuration: number }[]) {
      expect(['start', 'travel', 'impact']).toContain(b.phase);
      expect(b.maxDuration).toBeGreaterThan(0);
    }
  });
  it('discovers transitive child dependencies once and reports missing or ambiguous children', () => {
    const system = (hash: number, name: string, key?: number) => ({ hash, type: fnv1a('VfxSystemDefinitionData'), fields: [
      field('particlePath', `test/${name}`), field('particleName', name),
      field('complexEmitterDefinitionData', key === undefined ? [] : [{ effectKey: { hash: key }, texture: 'synthetic.tex' }]),
    ] });
    const resolver = (target: number) => ({ type: fnv1a('ResourceResolver'), fields: [field('resourceMap', { entries: [[{ hash: 42 }, { hash: target }]] })] });
    const root = system(1, 'root', 42), child = system(2, 'child', fnv1a('root'));
    const spec = [{ system: 'root' }];
    const closure = specialOrbClosure([{ entries: [root, child, resolver(2)], patches: [] }], spec);
    expect(Object.keys(closure.systems)).toEqual(['test/root', 'test/child']);
    expect(closure.edges).toHaveLength(2); expect(closure.unresolved).toEqual([]);
    expect(closure.references).toEqual(['synthetic.tex']);
    expect(specialOrbClosure([{ entries: [root], patches: [] }], spec).unresolved[0].reason).toBe('missing-child');
    expect(specialOrbClosure([{ entries: [root, child, resolver(2), resolver(3)], patches: [] }], spec).unresolved[0].reason).toBe('ambiguous-child');
    expect(() => specialOrbClosure([{ entries: [], patches: [] }], spec)).toThrow('missing-or-ambiguous-special-system');
  });
  it('converts SCB BGRA vertex colors to normalized RGBA, preserving reflected winding and alpha', () => {
    const b = Buffer.alloc(340); b.write('r3d2Mesh'); b.writeUInt16LE(3, 8); b.writeUInt16LE(2, 10);
    b.writeUInt32LE(3, 140); b.writeUInt32LE(1, 144); b.writeUInt32LE(2, 148); b.writeUInt32LE(1, 176);
    b.writeFloatLE(1, 192); b.writeFloatLE(1, 208);
    Buffer.from([10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120]).copy(b, 216);
    b.writeUInt32LE(0, 240); b.writeUInt32LE(1, 244); b.writeUInt32LE(2, 248);
    const { document: gltf, binary } = readGlb(convertParticleMesh(b, '.scb').glb);
    expect(gltf.meshes[0].primitives[0].attributes.COLOR_0).toBe(2);
    expect(gltf.accessors[2]).toMatchObject({ normalized: true, componentType: 5121, type: 'VEC4', count: 3 });
    expect([...binary.subarray(60, 72)]).toEqual([30, 20, 10, 40, 110, 100, 90, 120, 70, 60, 50, 80]);
    expect(() => convertParticleMesh(b.subarray(0, -1), '.scb')).toThrow('invalid-scb-length');
    b.writeUInt32LE(2, 176);
    expect(() => convertParticleMesh(b, '.scb')).toThrow('unsupported-scb-vertex-colors');
  });
  it('preserves face RGB separately from vertex RGBA and treats mesh locators as metadata', () => {
    const b = Buffer.alloc(349); b.write('r3d2Mesh'); b.writeUInt16LE(3, 8); b.writeUInt16LE(2, 10);
    b.writeUInt32LE(3, 140); b.writeUInt32LE(1, 144); b.writeUInt32LE(3, 148); b.writeUInt32LE(1, 176);
    b.writeFloatLE(1, 192); b.writeFloatLE(1, 208);
    Buffer.from([10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120]).copy(b, 216);
    b.writeFloatLE(2, 228); // CentralPoint, not a position offset
    b.writeUInt32LE(0, 240); b.writeUInt32LE(1, 244); b.writeUInt32LE(2, 248);
    Buffer.from([1, 2, 3, 4, 5, 6, 7, 8, 9]).copy(b, 340);
    const result = convertParticleMesh(b, '.scb'), { document: gltf, binary } = readGlb(result.glb);
    expect(result.report).toMatchObject({ centralPoint: [2, 0, 0], faceColors: expect.stringContaining('shading-not-reproduced') });
    expect(gltf.meshes[0].primitives[0].attributes).toMatchObject({ COLOR_0: 2, _FACE_COLOR_0: 3 });
    expect([...binary.subarray(60, 72)]).toEqual([30, 20, 10, 40, 110, 100, 90, 120, 70, 60, 50, 80]);
    expect([...binary.subarray(72, 84)]).toEqual([1, 2, 3, 255, 7, 8, 9, 255, 4, 5, 6, 255]);
    expect(binary.readFloatLE(24)).toBe(-1);
    expect(() => convertParticleMesh(b.subarray(0, -1), '.scb')).toThrow('invalid-scb-length');
    const sco = Buffer.from('[ObjectBegin]\nName=test\nCentralPoint=1 2 3\nPivotPoint=4 5 6\nVerts=3\n0 0 0\n1 0 0\n0 1 0\nFaces=1\n3 0 1 2 mat 0 0 1 0 0 1\n[ObjectEnd]\n');
    const ascii = convertParticleMesh(sco, '.sco');
    expect(ascii.report).toMatchObject({ centralPoint: [1, 2, 3], pivotPoint: [4, 5, 6] });
    expect(readGlb(ascii.glb).binary.subarray(0, 36)).toEqual(binary.subarray(0, 36));
  });
  it('composes only resolved static children, mirrors offsets once and rejects ambiguous resolvers', () => {
    const parent = { sourcePath: 'sample/parent', originalFields: { complexEmitterDefinitionData: [{ isSingleParticle: 1, EmitterPosition: { constantValue: [4, 5, 6] }, childParticleSetDefinition: { childrenIdentifiers: [{ effectKey: { hash: 42 } }] } }] } };
    const child = { sourcePath: 'sample/child', document: structuredClone(document) };
    const entry = { hash: 73, type: fnv1a('VfxSystemDefinitionData'), fields: [field('particlePath', child.sourcePath), field('particleName', 'sample-child')] };
    const resolver = (target: number) => ({ type: fnv1a('ResourceResolver'), fields: [field('resourceMap', { entries: [[{ hash: 42 }, { hash: target }]] })] });
    const rows = [structuredClone(parent), child];
    expect(composeStaticChildren(rows, { entries: [entry, resolver(73)] })).toHaveLength(1);
    expect((rows[0] as unknown as { document: typeof document }).document.emitters[0].position).toEqual([-3, 7, 9]);
    expect(child.document.emitters[0].position).toEqual([1, 2, 3]);
    expect(() => composeStaticChildren([parent, child], { entries: [entry, resolver(73), resolver(74)] })).toThrow('ambiguous-extra-child');
    expect(() => composeStaticChildren([parent], { entries: [] })).toThrow('unresolved-extra-child');
    const dynamic = structuredClone(parent); dynamic.originalFields.complexEmitterDefinitionData[0].isSingleParticle = 0;
    expect(composeStaticChildren([dynamic, child], { entries: [entry, resolver(73)] })).toEqual([]);
  });
  it('merges a synthetic effects-only payload into a verified precache', async () => {
    // A clean checkout has no local asset directory; create it so the test does not rely on extracted assets.
    await mkdir(resolve('assets3d-local/tft-extras'), { recursive: true });
    const root = await mkdtemp(resolve('assets3d-local/tft-extras/test-'));
    try {
      const source = join(root, 'source'), out = join(root, 'runtime'); await mkdir(source);
      const effects: Record<string, { path: string }> = {};
      for (const { id } of SPECIAL_ORB_EFFECTS) {
        effects[id] = { path: `${id}.json` };
        await writeFile(join(source, `${id}.json`), JSON.stringify(document));
      }
      await writeFile(join(source, 'manifest.json'), JSON.stringify({ schemaVersion: 1, models: {}, effects }));
      expect(await mergeManifests({ from: [source], out })).toMatchObject({ ready: true, models: 0, effects: SPECIAL_ORB_EFFECTS.length, missing: [] });
      const manifest = JSON.parse(await readFile(join(out, 'manifest.json'), 'utf8'));
      assertManifest(manifest);
      const mergedEffects = manifest.effects;
      if (!mergedEffects) throw new Error('missing-merged-effects');
      for (const id of ['orb-warband', 'orb-warband-open', 'orb-crime', 'orb-crime-open']) {
        expect(mergedEffects[id]).toBeDefined();
        parseParticleDocument(JSON.parse(await readFile(join(out, mergedEffects[id].path), 'utf8')));
      }
      const playback = extrasBindings(manifest, SPECIAL_ORB_EFFECTS).playback;
      expect(playback['orb-warband-open'].phase).toBe('impact');
      expect(playback['orb-crime'].phase).toBe('start');
      const precache = JSON.parse(await readFile(join(out, 'precache.json'), 'utf8'));
      expect(precache.files).toHaveLength(SPECIAL_ORB_EFFECTS.length);
      for (const file of precache.files) expect(file.sha256).toMatch(/^[a-f0-9]{64}$/);
    } finally {
      if (!root.startsWith(resolve('assets3d-local/tft-extras') + '\\') && !root.startsWith(resolve('assets3d-local/tft-extras') + '/')) throw new Error('unsafe-test-cleanup');
      await rm(root, { recursive: true, force: true });
    }
  });
});

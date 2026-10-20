import { describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { assertManifest } from '../src/rendering3d/contracts';
// @ts-expect-error Offline Node entry.
import { PET_CONFIG, PET_ACTION_RULES, EXTRA_EFFECTS, extrasBindings, composeStaticChildren, extrasExtractPath, sustainPrismaticIdle } from '../scripts/assets3d/tft-extras.mjs';
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
    ids.push('orb-prismatic', 'orb-prismatic-idle', 'orb-warband', 'orb-crime', 'player-damage-mis', 'player-damage-mis1', 'player-damage-tar', 'player-damage-child');
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
    const root = await mkdtemp(resolve('assets3d-local/tft-extras/test-'));
    try {
      const source = join(root, 'source'), out = join(root, 'runtime'); await mkdir(source);
      await writeFile(join(source, 'sample.json'), JSON.stringify(document));
      await writeFile(join(source, 'manifest.json'), JSON.stringify({ schemaVersion: 1, models: {}, effects: { sample: { path: 'sample.json' } } }));
      expect(await mergeManifests({ from: [source], out })).toMatchObject({ ready: true, models: 0, effects: 1, missing: [] });
      const precache = JSON.parse(await readFile(join(out, 'precache.json'), 'utf8'));
      expect(precache.files).toHaveLength(1); expect(precache.files[0].path).toBe('sample.json');
      expect(precache.files[0].sha256).toMatch(/^[a-f0-9]{64}$/);
    } finally {
      if (!root.startsWith(resolve('assets3d-local/tft-extras') + '\\') && !root.startsWith(resolve('assets3d-local/tft-extras') + '/')) throw new Error('unsafe-test-cleanup');
      await rm(root, { recursive: true, force: true });
    }
  });
});

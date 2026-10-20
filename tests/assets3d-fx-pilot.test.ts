import { describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { assertManifest } from '../src/rendering3d/contracts';
import { parseParticleDocument } from '../src/rendering3d/particles';
// @ts-expect-error Offline converter.
import { batchActionBindings, batchOutputRoot, loadBindingTables } from '../scripts/assets3d/fx-batch.mjs';
// @ts-expect-error Offline converter.
import { convertParticles } from '../scripts/assets3d/particles.mjs';
// @ts-expect-error Explicit per-unit metadata.
import jinx from '../scripts/assets3d/fx-bindings/jinx.mjs';
// @ts-expect-error Explicit per-unit metadata.
import vi from '../scripts/assets3d/fx-bindings/vi.mjs';
// @ts-expect-error Offline shell-root merger.
import { mergeFxManifestEntries, mergeFxRoots } from '../scripts/assets3d/merge-fx-roots.mjs';
// @ts-expect-error Offline GLB utility.
import { writeGlb } from '../scripts/assets3d/glb.mjs';

// Invented names, resources and round values; never snapshots of local assets.
function syntheticPilot() {
  const tables: Record<string, any> = {}, rows: Record<string, any[]> = { global: [] }, bones: Record<string, string[]> = {};
  const manifest: any = { schemaVersion: 1, models: {}, effects: {} };
  let index = 0;
  for (const [i, original] of [jinx, vi].entries()) {
    const unit = `synthetic-unit-${i}`, names = new Map<string, string>();
    manifest.models[unit] = { path: `synthetic/model-${i}.glb` };
    rows[unit] = []; bones[unit] = ['synthetic-joint'];
    tables[unit] = structuredClone(original);
    const rename = (spec: any) => {
      const key = spec.system;
      if (!names.has(key)) {
        const name = `synthetic-system-${index++}`;
        names.set(key, name);
        const id = `synthetic-effect-${index}`;
        const row = { effectId: id, path: `synthetic/effect-${index}.json`, sourcePath: key === '@shared-hit' ? 'synthetic/TFT_Global_BA_Hit' : `synthetic/_Base_${name}` };
        (key === '@shared-hit' ? rows.global : rows[unit]).push(row);
        manifest.effects[id] = { path: row.path };
      }
      spec.system = key === '@shared-hit' ? key : names.get(key);
      if (spec.bone) spec.bone = 'synthetic-joint';
      spec.delay = 0; spec.maxDuration = 1; spec.note = 'Synthetic preview.';
    };
    for (const spec of [...tables[unit].attack, ...tables[unit].cast]) rename(spec);
    for (const actions of Object.values(tables[unit].variants) as any[]) for (const spec of actions.cast) rename(spec);
  }
  return { manifest, rows, bones, tables };
}

describe('latest approximate pilot', () => {
  it('discovers object tables and preserves default R/Q plus separate alternatives', async () => {
    const loaded = await loadBindingTables();
    expect(loaded.jinx).toEqual(jinx); expect(loaded.vi).toEqual(vi);
    expect(Object.keys(jinx.variants)).toEqual(['W', 'E', 'R']);
    expect(Object.keys(vi.variants)).toEqual(['Q']);
    expect(jinx.cast).toEqual(jinx.variants.R.cast);
    expect(vi.cast).toEqual(vi.variants.Q.cast);
    expect(jinx.attack).toHaveLength(2);
    expect(vi.attack[0].system).toBe('@shared-hit');
  });
  it('binds every alternative while keeping W/E out of the default cast', () => {
    const f = syntheticPilot(), plan = batchActionBindings(f.manifest, f.rows, f.bones, f.tables);
    assertManifest({ ...f.manifest, actionEffects: plan.actionEffects });
    expect(plan.actionEffects['synthetic-unit-0'].cast).toEqual(plan.variants.R['synthetic-unit-0'].cast);
    expect(plan.actionEffects['synthetic-unit-1'].cast).toEqual(plan.variants.Q['synthetic-unit-1'].cast);
    for (const variant of ['W', 'E']) {
      expect(plan.variants[variant]['synthetic-unit-0'].cast.length).toBeGreaterThan(0);
      for (const id of plan.variants[variant]['synthetic-unit-0'].cast) {
        expect(plan.actionEffects['synthetic-unit-0'].cast).not.toContain(id);
        expect(plan.playback[id]).toMatchObject({ status: 'approximated', delay: 0, maxDuration: 1 });
      }
    }
    expect(plan.unavailable).toEqual([]);
  });
  it('deduplicates unavailable defaults/variants without substituting another effect', () => {
    const f = syntheticPilot(); f.rows['synthetic-unit-1'] = [];
    const plan = batchActionBindings(f.manifest, f.rows, f.bones, f.tables);
    expect(plan.actionEffects['synthetic-unit-1'].cast).toEqual([]);
    expect(plan.variants.Q['synthetic-unit-1'].cast).toEqual([]);
    expect(plan.unavailable).toHaveLength(7);
  });
  it('validates variant bones and prevents conflicting placement for one effect ID', () => {
    const f = syntheticPilot();
    f.tables['synthetic-unit-0'].variants.W.cast[0].bone = 'synthetic-missing';
    expect(() => batchActionBindings(f.manifest, f.rows, f.bones, f.tables)).toThrow('missing-binding-bone');
    const g = syntheticPilot(); g.tables['synthetic-unit-0'].variants.R.cast[0].delay = 1;
    expect(() => batchActionBindings(g.manifest, g.rows, g.bones, g.tables)).toThrow('conflicting-effect-playback');
  });
  it('allows only the new real pilot root and existing batch names', async () => {
    expect(await batchOutputRoot('assets3d-local/fx-pilot')).toMatch(/fx-pilot$/);
    for (const out of ['assets3d-local/fx-trial', 'assets3d-local/fx-all', 'assets3d-local/fx-pilot/child', 'public/fx-pilot'])
      await expect(batchOutputRoot(out)).rejects.toThrow('batch-output-only');
  });
  it('rebuilds synthetic approximate documents without changing strict results or input', () => {
    const c = (constantValue: unknown) => ({ constantValue });
    const source = { 'synthetic/system': { __type: 'VfxSystemDefinitionData', complexEmitterDefinitionData: [{
      emitterName: 'synthetic-plane', isSingleParticle: true, particleLifetime: c(1), texture: 'synthetic/glow.png',
      primitive: { __type: 'VfxPrimitiveArbitraryQuad' }, birthRotation0: c([90, 0, 0]),
      birthScale0: c([100, 200, 0]), blendMode: 4,
    }] } };
    const before = structuredClone(source), path = () => 'synthetic/glow.png';
    const strict = convertParticles(source, path, parseParticleDocument, { particleMode: 'strict' });
    const preview = convertParticles(source, path, parseParticleDocument, { particleMode: 'approximate' });
    expect(preview.counts.approximated).toBe(1);
    const doc = parseParticleDocument(preview.systems[0].document);
    expect(doc.schemaVersion).toBe(2);
    expect(doc.emitters[0]).toMatchObject({ kind: 'arbitraryQuad', blend: 'additive', texture: 'synthetic/glow.png' });
    expect(convertParticles(source, path, parseParticleDocument)).toEqual(strict);
    expect(source).toEqual(before);
  });
  it('merges roots with later pilot paths, stages and alternatives winning together', () => {
    const f = syntheticPilot(), plan = batchActionBindings(f.manifest, f.rows, f.bones, f.tables);
    const before = { manifest: { ...f.manifest, actionEffects: plan.actionEffects }, bindings: plan };
    const after = structuredClone(before);
    const unit = 'synthetic-unit-0', id = plan.actionEffects[unit].cast[0];
    after.manifest.models[unit].path = 'synthetic/replacement.glb';
    after.manifest.effects[id].path = 'synthetic/replacement.json';
    after.bindings.playback[id].delay = 1;
    delete after.bindings.variants.W;
    const merged = mergeFxManifestEntries([before, after]);
    assertManifest(merged.manifest);
    expect(merged.manifest.models[unit].path).toBe('roots/1/synthetic/replacement.glb');
    expect(merged.manifest.effects[id].path).toBe('roots/1/synthetic/replacement.json');
    expect(merged.bindings.playback[id].delay).toBe(1);
    expect(merged.bindings.variants.W).toBeUndefined();
    expect(before.manifest.models[unit].path).toBe('synthetic/model-0.glb');
  });
  it('indexes every synthetic merged payload and refreshes sizes/hashes on a forced merge', async () => {
    const pilot = resolve('assets3d-local/fx-pilot');
    await mkdir(pilot, { recursive: true });
    const root = await mkdtemp(join(pilot, 'merge-test-'));
    try {
      const put = async (dir: string, path: string, data: string | Buffer) => {
        await mkdir(join(dir, path, '..'), { recursive: true });
        await writeFile(join(dir, path), data);
      };
      const glb = writeGlb({ asset: { version: '2.0' }, buffers: [{ byteLength: 0 }] }, Buffer.alloc(0));
      const effect = { schemaVersion: 2, limits: { maxParticles: 10, maxDuration: 2 }, emitters: [
        { kind: 'mesh', mesh: 'meshes/shape.glb', texture: 'textures/glow.png', emission: { mode: 'burst', count: 1 }, lifetime: 1 },
        { kind: 'screenDistortion', distortion: { normalMap: 'textures/normal.png', strength: 1 }, emission: { mode: 'burst', count: 1 }, lifetime: 1 },
      ] };
      const inputs = [join(root, 'a'), join(root, 'b')];
      for (const [i, dir] of inputs.entries()) {
        await put(dir, 'manifest.json', JSON.stringify({ schemaVersion: 1,
          models: { [`synthetic-${i}`]: { path: 'models/model.glb' } },
          effects: { [`synthetic-fx-${i}`]: { path: 'effects/spark.json' } } }));
        await put(dir, 'action-bindings.json', '{}');
        await put(dir, 'merge-report.json', '{}');
        await put(dir, 'models/model.glb', glb);
        await put(dir, 'effects/spark.json', JSON.stringify(effect));
        await put(dir, 'meshes/shape.glb', glb);
        await put(dir, 'textures/glow.png', 'synthetic-texture');
        await put(dir, 'textures/normal.png', 'synthetic-normal');
      }
      const args = { roots: inputs.join(','), out: join(root, 'merged') };
      const verify = async () => {
        const index = JSON.parse(await readFile(join(args.out, 'precache.json'), 'utf8'));
        const paths = (await readdir(args.out, { recursive: true, withFileTypes: true }))
          .filter(entry => entry.isFile())
          .map(entry => join(entry.parentPath, entry.name).slice(args.out.length + 1).replaceAll('\\', '/'))
          .filter(path => !['manifest.json', 'action-bindings.json', 'merge-report.json', 'precache.json'].includes(path)).sort();
        expect(index.schemaVersion).toBe(1);
        expect(index.files.map((file: { path: string }) => file.path)).toEqual(paths);
        expect(paths).toHaveLength(10);
        for (const file of index.files) {
          const data = await readFile(join(args.out, file.path));
          expect(file).toEqual({ path: file.path, bytes: data.length,
            sha256: createHash('sha256').update(data).digest('hex') });
        }
        return index;
      };
      await mergeFxRoots(args);
      const before = await verify();
      await put(inputs[1], 'textures/glow.png', 'synthetic-texture-updated');
      effect.emitters[0].lifetime = 2;
      await put(inputs[1], 'effects/spark.json', JSON.stringify(effect));
      await mergeFxRoots({ ...args, force: true });
      const after = await verify();
      for (const path of ['roots/1/textures/glow.png', 'roots/1/effects/spark.json']) {
        expect(after.files.find((f: { path: string }) => f.path === path))
          .not.toEqual(before.files.find((f: { path: string }) => f.path === path));
      }
    } finally {
      if (root.startsWith(pilot + '\\') || root.startsWith(pilot + '/')) await rm(root, { recursive: true, force: true });
    }
  });
  it('rejects merging into read-only asset roots before reading or writing', async () => {
    for (const out of ['assets3d-local/fx-trial', 'assets3d-local/fx-all', 'assets3d-local/fx-pilot'])
      await expect(mergeFxRoots({ out })).rejects.toThrow('pilot-merge-output-only');
  });
});

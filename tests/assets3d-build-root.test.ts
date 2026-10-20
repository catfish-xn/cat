import { afterEach, expect, it } from 'vitest';
import { mkdtemp, mkdir, readFile, writeFile, rm, readdir, symlink, stat, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
// @ts-expect-error Offline Node script.
import { buildAssetRoot, buildArguments } from '../scripts/assets3d/build-asset-root.mjs';
// @ts-expect-error Shared payload index.
import { createPrecache } from '../scripts/assets3d/merge-manifests.mjs';
// @ts-expect-error Synthetic GLB writer.
import { writeGlb } from '../scripts/assets3d/glb.mjs';

const temporary: string[] = [];
afterEach(async () => {
  for (const root of temporary.splice(0)) {
    expect(root.startsWith(join(tmpdir(), 'asset-root-'))).toBe(true);
    await rm(root, { recursive: true, force: true });
  }
});
const workspace = async () => { const root = await mkdtemp(join(tmpdir(), 'asset-root-')); temporary.push(root); return realpath(root); };
const json = async (root: string, path: string) => JSON.parse(await readFile(join(root, path), 'utf8'));
async function put(root: string, path: string, data: string | Buffer | object) {
  await mkdir(join(root, path, '..'), { recursive: true });
  await writeFile(join(root, path), typeof data === 'string' || Buffer.isBuffer(data) ? data : JSON.stringify(data));
}
async function fixture(root: string, newer = false) {
  const manifest = { schemaVersion: 1, models: { unit: { path: 'arbitrary/hero.glb' } },
    effects: { spark: { path: 'effects/spark.json' } }, actionEffects: { unit: { cast: ['spark'] } } };
  const bindings: any = { schemaVersion: 1, actionEffects: manifest.actionEffects,
    playback: { spark: { delay: newer ? 1 : 0 } }, variants: { Q: { unit: { cast: ['spark'] } } }, notes: { unit: 'synthetic' } };
  if (newer) delete bindings.variants.Q;
  await put(root, 'manifest.json', manifest); await put(root, 'action-bindings.json', bindings);
  await put(root, 'arbitrary/hero.glb', writeGlb({ asset: { version: '2.0', generator: newer ? 'new' : 'old' }, buffers: [{ byteLength: 0 }] }, Buffer.alloc(0)));
  await put(root, 'effects/spark.json', { schemaVersion: 2, limits: { maxParticles: 10, maxDuration: 2 }, emitters: [
    { kind: 'mesh', mesh: 'meshes/shape.glb', texture: 'textures/glow.png', emission: { mode: 'burst', count: 1 }, lifetime: 1 },
    { kind: 'screenDistortion', distortion: { normalMap: 'textures/normal.png', strength: 1 }, emission: { mode: 'burst', count: 1 }, lifetime: 1 },
  ] });
  for (const path of ['meshes/shape.glb', 'textures/glow.png', 'textures/normal.png']) await put(root, path, newer ? 'new synthetic' : 'old synthetic');
  return { manifest, bindings };
}
async function snapshot(root: string) {
  const files = (await readdir(root, { recursive: true, withFileTypes: true })).filter(e => e.isFile());
  const result: Record<string, string> = {};
  for (const e of files) result[join(e.parentPath, e.name).slice(root.length + 1).replaceAll('\\', '/')] = createHash('sha256').update(await readFile(join(e.parentPath, e.name))).digest('hex');
  return result;
}

it('accepts space/comma separated roots and repeated flags', () => {
  expect(buildArguments(['--roots', 'a,b', 'c', '--roots', 'd', '--out', 'e', '--force']))
    .toEqual({ roots: ['a', 'b', 'c', 'd'], out: 'e', force: true });
  expect(() => buildArguments(['--roots'])).toThrow();
});
it('allows force for an empty directory and marked output from a previous build', async () => {
  const root = await workspace(), input = join(root, 'input'), out = join(root, 'out');
  await fixture(input); await mkdir(out);
  await buildAssetRoot({ roots: [input], out, force: true });
  expect((await json(out, 'merge-report.json')).generator).toBe('assets3d/build-asset-root');
  const before = await snapshot(out);
  await put(out, 'stale.bin', 'old output');
  await buildAssetRoot({ roots: [input], out, force: true });
  expect(await snapshot(out)).toEqual(before);
});
it.each([undefined, '{}', '{invalid', JSON.stringify({ generator: 'another-tool' })])(
  'refuses force for unrelated nonempty output with report %s without changing files', async report => {
    const root = await workspace(), input = join(root, 'input'), out = join(root, 'out');
    await fixture(input); await put(out, 'unrelated.txt', 'keep this');
    if (report !== undefined) await put(out, 'merge-report.json', report);
    const before = await snapshot(out);
    await expect(buildAssetRoot({ roots: [input], out, force: true })).rejects.toThrow('refuse-force-foreign-output');
    expect(await snapshot(out)).toEqual(before);
    expect((await readdir(root)).sort()).toEqual(['input', 'out']);
  },
);
it('refuses existing nonempty output without force and preserves its contents', async () => {
  const root = await workspace(), input = join(root, 'input'), out = join(root, 'out');
  await fixture(input); await put(out, 'unrelated.txt', 'keep this');
  const before = await snapshot(out);
  await expect(buildAssetRoot({ roots: [input], out })).rejects.toThrow('output-exists-use-force');
  expect(await snapshot(out)).toEqual(before);
});
it('merges an already merged root plus a new root in system temp; later keys win together', async () => {
  const root = await workspace(), a = join(root, 'a'), b = join(root, 'b');
  await fixture(a); await fixture(b, true);
  await buildAssetRoot({ roots: [a], out: join(root, 'first') });
  const out = join(root, 'second');
  const report = await buildAssetRoot({ roots: [join(root, 'first'), b], out });
  expect((await json(out, 'manifest.json')).models.unit.path).toBe('roots/1/arbitrary/hero.glb');
  const bindings = await json(out, 'action-bindings.json');
  expect(bindings.playback.spark.delay).toBe(1); expect(bindings.variants).toEqual({});
  expect(report.sources.models.unit).toBe(b); expect(report.sources.effects.spark).toBe(b);
  expect(report.sources.actionEffects.unit).toBe(b); expect(report.sources.playback.spark).toBe(b);
  // Reversing precedence must also keep nested paths and rewritten particle dependencies valid.
  const reversed = join(root, 'reversed');
  await buildAssetRoot({ roots: [b, join(root, 'first')], out: reversed });
  expect((await json(reversed, 'manifest.json')).models.unit.path).toBe('roots/1/roots/0/arbitrary/hero.glb');
  expect((await json(reversed, 'action-bindings.json')).playback.spark.delay).toBe(0);
  expect((await json(reversed, 'action-bindings.json')).variants.Q.unit.cast).toEqual(['spark']);
  for (const target of [out, reversed]) {
    const index = await json(target, 'precache.json'), plans = new Map();
    for (const f of index.files) {
      const data = await readFile(join(target, f.path));
      plans.set(f.path, { bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') });
    }
    expect(index).toEqual(createPrecache(plans));
    expect(Object.keys(await snapshot(target)).sort()).toEqual([...index.files.map((f: any) => f.path),
      'manifest.json', 'action-bindings.json', 'merge-report.json', 'precache.json'].sort());
    const manifest = await json(target, 'manifest.json');
    const doc = await json(target, manifest.effects.spark.path);
    for (const e of doc.emitters) for (const path of [e.texture, e.mesh, e.distortion?.normalMap].filter(Boolean)) expect(plans.has(path)).toBe(true);
  }
  const before = await snapshot(out);
  await expect(buildAssetRoot({ roots: [join(root, 'first'), b], out })).rejects.toThrow('output-exists-use-force');
  await put(out, 'stale.bin', 'stale');
  await buildAssetRoot({ roots: [join(root, 'first'), b], out, force: true });
  expect(await snapshot(out)).toEqual(before);
  const another = join(root, 'another');
  await buildAssetRoot({ roots: [join(root, 'first'), b], out: another });
  expect(await snapshot(another)).toEqual(before);
});
it('clears old playback, whole-unit actions and variants when the later root omits them', async () => {
  const root = await workspace(), a = join(root, 'a'), b = join(root, 'b'), out = join(root, 'out');
  const first = await fixture(a); await fixture(b, true);
  await put(a, 'manifest.json', { ...first.manifest, actionEffects: { unit: { attack: ['spark'], cast: ['spark'] } } });
  await put(a, 'action-bindings.json', { ...first.bindings, actionEffects: { unit: { attack: ['spark'], cast: ['spark'] } } });
  const second = await json(b, 'action-bindings.json'); delete second.playback;
  await put(b, 'action-bindings.json', second);
  await buildAssetRoot({ roots: [a, b], out });
  const bindings = await json(out, 'action-bindings.json');
  expect(bindings.actionEffects.unit).toEqual({ cast: ['spark'] });
  expect(bindings.playback).toEqual({}); expect(bindings.variants).toEqual({});
  const before = await snapshot(out);
  await rm(join(b, 'textures/glow.png'));
  await expect(buildAssetRoot({ roots: [a, b], out, force: true })).rejects.toMatchObject({ code: 'ENOENT' });
  expect(await snapshot(out)).toEqual(before);
});
it('rejects path content conflicts and case aliases before publishing', async () => {
  const root = await workspace(), input = join(root, 'input'), out = join(root, 'out');
  await fixture(input);
  const doc = await json(input, 'effects/spark.json');
  // The raw JSON is also a texture: rewriting it would give one output path two contents.
  doc.emitters[0].texture = 'effects/spark.json'; await put(input, 'effects/spark.json', doc);
  await expect(buildAssetRoot({ roots: [input], out })).rejects.toThrow('merge-path-conflict');
  await expect(stat(out)).rejects.toMatchObject({ code: 'ENOENT' });
  await fixture(input);
  doc.emitters[0].texture = 'textures/Glow.png'; await put(input, 'textures/Glow.png', 'case alias');
  doc.emitters[1].distortion.normalMap = 'textures/glow.png'; await put(input, 'effects/spark.json', doc);
  await expect(buildAssetRoot({ roots: [input], out })).rejects.toThrow('merge-path-case-conflict');
});
it('rejects inconsistent bindings and case-only IDs', async () => {
  const root = await workspace(), input = join(root, 'input'), out = join(root, 'out');
  const { bindings, manifest } = await fixture(input);
  bindings.actionEffects = { unit: { cast: [] } }; await put(input, 'action-bindings.json', bindings);
  await expect(buildAssetRoot({ roots: [input], out })).rejects.toThrow('conflicting-action-bindings');
  await fixture(input);
  await put(input, 'manifest.json', { ...manifest, models: { ...manifest.models, Unit: manifest.models.unit } });
  await expect(buildAssetRoot({ roots: [input], out })).rejects.toThrow('merge-key-case-conflict');
});
it('accepts read-only input junctions but rejects overlapping and linked outputs, including force', async () => {
  const root = await workspace(), input = join(root, 'input'), alias = join(root, 'alias'); await fixture(input);
  await symlink(input, alias, process.platform === 'win32' ? 'junction' : 'dir');
  for (const source of [input, alias]) for (const out of [join(input, 'inside'), input, root])
    await expect(buildAssetRoot({ roots: [source], out, force: true })).rejects.toThrow('merge-output-overlaps-source');
  await expect(buildAssetRoot({ roots: [input], out: join(alias, 'inside') })).rejects.toThrow('merge-output-link');
  const out = join(root, 'valid'); await buildAssetRoot({ roots: [alias], out });
  await symlink(input, join(out, 'nested-link'), process.platform === 'win32' ? 'junction' : 'dir');
  await expect(buildAssetRoot({ roots: [input], out, force: true })).rejects.toThrow('merge-output-link');
  expect(await readFile(join(input, 'textures/glow.png'), 'utf8')).toBe('old synthetic');
});

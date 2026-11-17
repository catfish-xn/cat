import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
// @ts-expect-error Pure Node utility.
import { snapshotAdd, snapshotAddArguments } from '../scripts/assets3d/snapshot-add.mjs';

// Synthetic roots only: a tiny manifest, a fake model file and a fake vfx-ltk pack. No game data.
const roots: string[] = [];
afterEach(async () => { for (const r of roots.splice(0)) await rm(r, { recursive: true, force: true }); });
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const put = async (root: string, path: string, text: string) => { await mkdir(join(root, path, '..'), { recursive: true }); await writeFile(join(root, path), text); };
const ok = () => undefined;
async function snapshot(local = true) {
  const root = await mkdtemp(join(tmpdir(), 'snap-add-')); roots.push(root);
  await put(root, 'manifest.json', JSON.stringify({ schemaVersion: 1, models: { hero: { path: 'models/hero/model.glb', animations: { idle: 'a' } } }, effects: {} }, null, 2) + '\n');
  await put(root, 'models/hero/model.glb', 'hero-bytes');
  await put(root, 'precache.json', JSON.stringify({ schemaVersion: 1, files: [{ path: 'models/hero/model.glb', bytes: 10, sha256: sha('hero-bytes') }, { path: 'vfx-ltk/pk/textures/0000.png', bytes: 3, sha256: sha('old') }] }));
  await put(root, 'vfx-ltk/pk/index.json', JSON.stringify({ version: 1, systems: { aaaa0001: 'systems/aaaa0001.json' }, assets: { 'tex/old.tex': 'textures/0000.png' }, skills: { hero: [{ system: 'aaaa0001' }] } }, null, 2) + '\n');
  await put(root, 'vfx-ltk/pk/systems/aaaa0001.json', '{"s":1}');
  await put(root, 'vfx-ltk/pk/textures/0000.png', 'old');
  if (local) await put(root, '.local-snapshot', 'snapshot=000000000000\n');
  return root;
}
async function built() {
  const dir = await mkdtemp(join(tmpdir(), 'snap-built-')); roots.push(dir);
  await put(dir, 'manifest.json', JSON.stringify({ schemaVersion: 1, models: { pet: { path: 'models/pet/model.glb', animations: { idle: 'run' } } }, effects: {} }));
  await put(dir, 'models/pet/model.glb', 'pet-bytes');
  return dir;
}
async function exported(systems: Record<string, string>, assets: Record<string, [string, string]>) {
  const dir = await mkdtemp(join(tmpdir(), 'snap-vfx-')); roots.push(dir);
  const index = { version: 1, systems: {} as Record<string, string>, assets: {} as Record<string, string>, skills: { other: [] } };
  for (const [id, text] of Object.entries(systems)) { index.systems[id] = `systems/${id}.json`; await put(dir, `systems/${id}.json`, text); }
  for (const [key, [file, text]] of Object.entries(assets)) { index.assets[key] = file; await put(dir, file, text); }
  await put(dir, 'index.json', JSON.stringify(index));
  return dir;
}

describe('snapshot-add: additions only, to a local snapshot', () => {
  it('adds a new model under roots/add-<tag>, its precache entry, and leaves every existing entry as it was', async () => {
    const root = await snapshot(), models = await built(), before = await readFile(join(root, 'manifest.json'), 'utf8');
    const dry = await snapshotAdd({ root, tag: 't1', models, dry: true, validate: ok });
    expect(dry).toMatchObject({ dry: true, addedModels: ['pet'], files: [{ path: 'roots/add-t1/models/pet/model.glb', bytes: 9 }] });
    expect(await readFile(join(root, 'manifest.json'), 'utf8')).toBe(before);
    const report = await snapshotAdd({ root, tag: 't1', models, validate: ok });
    const after = JSON.parse(await readFile(join(root, 'manifest.json'), 'utf8'));
    expect(after.models.pet).toEqual({ path: 'roots/add-t1/models/pet/model.glb', animations: { idle: 'run' } });
    expect(after.models.hero).toEqual(JSON.parse(before).models.hero);
    expect(await readFile(join(root, 'roots/add-t1/models/pet/model.glb'), 'utf8')).toBe('pet-bytes');
    expect(report.manifest.before).toBe(sha(before));
    expect(JSON.parse(await readFile(join(root, 'precache.json'), 'utf8')).files.at(-1)).toEqual({ path: 'roots/add-t1/models/pet/model.glb', bytes: 9, sha256: sha('pet-bytes') });
  });

  it('adds new systems and assets to an existing pack without touching its skills, reusing identical assets', async () => {
    const root = await snapshot();
    const vfxFrom = await exported({ bbbb0002: '{"s":2}' }, { 'tex/old.tex': ['textures/0007.png', 'old'], 'tex/new.tex': ['textures/0000.png', 'new'] });
    const report = await snapshotAdd({ root, tag: 'x1', vfxPack: 'vfx-ltk/pk', vfxFrom, validate: ok });
    const index = JSON.parse(await readFile(join(root, 'vfx-ltk/pk/index.json'), 'utf8'));
    expect(index.systems).toEqual({ aaaa0001: 'systems/aaaa0001.json', bbbb0002: 'systems/bbbb0002.json' });
    expect(index.assets).toEqual({ 'tex/old.tex': 'textures/0000.png', 'tex/new.tex': 'add-x1/textures/0000.png' });
    expect(index.skills).toEqual({ hero: [{ system: 'aaaa0001' }] });
    expect(await readFile(join(root, 'vfx-ltk/pk/textures/0000.png'), 'utf8')).toBe('old');
    expect(await readFile(join(root, 'vfx-ltk/pk/add-x1/textures/0000.png'), 'utf8')).toBe('new');
    expect(report).toMatchObject({ addedSystems: ['bbbb0002'], addedAssets: 1, precacheAdded: 2 });
    expect(report.manifest.before).toBe(report.manifest.after);
  });

  it('refuses any change to what is there, and roots that are not local snapshots', async () => {
    const root = await snapshot();
    const clash = await exported({ aaaa0001: '{"s":"changed"}' }, {});
    await expect(snapshotAdd({ root, tag: 'x1', vfxPack: 'vfx-ltk/pk', vfxFrom: clash, validate: ok })).rejects.toThrow('already in vfx-ltk/pk with different content');
    const assetClash = await exported({}, { 'tex/old.tex': ['textures/0001.png', 'changed'] });
    await expect(snapshotAdd({ root, tag: 'x1', vfxPack: 'vfx-ltk/pk', vfxFrom: assetClash, validate: ok })).rejects.toThrow('asset tex/old.tex already');
    const models = await built();
    await put(models, 'manifest.json', JSON.stringify({ models: { hero: { path: 'models/pet/model.glb' } } }));
    await expect(snapshotAdd({ root, tag: 't1', models, validate: ok })).rejects.toThrow('model id hero already in the snapshot');
    await expect(snapshotAdd({ root: await snapshot(false), tag: 't1', models: await built(), validate: ok })).rejects.toThrow('not a registered local snapshot');
    const live = await snapshot(); await put(live, '.live-snapshot', 'snapshot=x\n');
    await expect(snapshotAdd({ root: live, tag: 't1', models: await built(), validate: ok })).rejects.toThrow('live copy');
    await expect(snapshotAdd({ root, tag: 't1', models: await built(), validate: ok, refused: [root] })).rejects.toThrow('refusing');
    await expect(snapshotAdd({ root, tag: 'Bad Tag', models: await built(), validate: ok })).rejects.toThrow('--tag');
    // A validator failure stops before anything is written.
    const before = await readFile(join(root, 'manifest.json'), 'utf8');
    await expect(snapshotAdd({ root, tag: 't2', models: await built(), validate: () => { throw new Error('invalid-manifest'); } })).rejects.toThrow('invalid-manifest');
    expect(await readFile(join(root, 'manifest.json'), 'utf8')).toBe(before);
  });

  it('reads its command line strictly', () => {
    expect(snapshotAddArguments(['--root', 'r', '--tag', 't', '--models', 'm', '--dry'])).toEqual({ root: 'r', tag: 't', models: 'm', dry: true });
    expect(() => snapshotAddArguments(['--tag', 't'])).toThrow('--root is required');
    expect(() => snapshotAddArguments(['--root', 'r', '--root', 's'])).toThrow('bad argument');
  });
});

// @ts-expect-error Pure Node utility.
import { replaceEntry } from '../scripts/assets3d/replace-entry.mjs';
describe('replace-entry: one existing model, nothing else', () => {
  it('replaces the whole entry, lists the changed fields, and refuses partial entries, unknown ids and side effects', () => {
    const before = { schemaVersion: 1, models: { a: { path: 'm/a.glb', animations: { idle: 'x' }, clipRanges: { x: [0, 1] } }, b: { path: 'm/b.glb', animations: {} } } };
    const { after, changes } = replaceEntry(before, 'a', { path: 'm/a.glb', animations: { idle: 'y' } });
    expect(after.models.b).toEqual(before.models.b);
    expect(changes).toEqual({ animations: [{ idle: 'x' }, { idle: 'y' }], clipRanges: [{ x: [0, 1] }, null] });
    expect(before.models.a.animations.idle).toBe('x');
    expect(() => replaceEntry(before, 'c', { path: 'p', animations: {} })).toThrow('no models.c');
    expect(() => replaceEntry(before, 'a', { path: 'p' })).toThrow('partial entry');
  });
});

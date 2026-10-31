import { copyFile, lstat, mkdir, mkdtemp, realpath, rm, symlink, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
// @ts-expect-error Offline JavaScript tooling has no declaration file.
import { augmentSpecs, augmentStageDirectory, collectApiNames, downloadCommands, mergeAugmentManifest, stageAugmentIcons } from '../scripts/assets3d/augment-icons.mjs';
import { AUGMENT_DEFINITIONS } from '../src/simulation/content/augments';
import { S13_AUGMENT_ASSETS } from '../src/presentation/s13-augment-asset-manifest';

describe('S13 augment icon source contracts', () => {
  it('resolves every runtime definition through its archived client API name', async () => {
    const specs = await augmentSpecs();
    expect(specs.map((s: { id: string }) => s.id)).toEqual(Object.keys(AUGMENT_DEFINITIONS).sort());
    expect(specs.filter((s: { bundled: boolean }) => s.bundled)).toHaveLength(S13_AUGMENT_ASSETS.length);
    // Internal names differ from player names/slugs; these must never be guessed.
    expect(specs.find((s: { id: string }) => s.id === 'all-out')).toMatchObject({ apiName: 'TFT13_Augment_PrimeCarry', source: 'ASSETS/Maps/TFT/Icons/Augments/Hexcore/Prime-Hero-II.tex' });
    expect(specs.find((s: { id: string }) => s.id === 'prismatic-ticket')).toMatchObject({ apiName: 'TFT6_Augment_GachaAddict', source: 'ASSETS/Maps/TFT/Icons/Augments/Hexcore/GoldenTicket3.tex' });
    expect(new Set(specs.map((s: { path: string }) => s.path)).size).toBe(specs.length);
  });

  it('rejects conflicting exported API-name mappings and ignores non-definition rows', () => {
    expect([...collectApiNames({ a: {} }, [{ api: { a: 'TFT_A', disabled: 'TFT_Disabled' } }])]).toEqual([['a', 'TFT_A']]);
    expect(() => collectApiNames({ a: {} }, [{ api: { a: 'TFT_A' }, rows: { a: { apiName: 'TFT_B' } } }])).toThrow('conflicting-augment-api:a');
  });

  it('preserves live-root batches, unknown metadata and unavailable source accounting', () => {
    const base = { patch: '14.24', marker: { keep: true }, assets: [
      { kind: 'ability', id: 'spell', path: 'existing/spell.png' },
      { kind: 'augment', id: 'a', path: 'previous/a.png' },
      { kind: 'augment', id: 'missing', path: 'previous/missing.png' },
    ], unavailable: [{ kind: 'trait', id: 'trait' }, { kind: 'augment', id: 'a' }] };
    const specs = [{ id: 'a' }, { id: 'missing' }], found = [{ kind: 'augment', id: 'a', path: 'assets/s13/augments/a.png' }];
    const missing = [{ kind: 'augment', id: 'missing', reason: 'missing-local-source' }], before = structuredClone(base);
    const merged = mergeAugmentManifest(base, specs, found, missing);
    expect(base).toEqual(before);
    expect(merged.assets).toEqual([base.assets[0], base.assets[2], found[0]]);
    expect(merged.marker).toEqual(base.marker);
    expect(merged.unavailable).toEqual([base.unavailable[0], missing[0]]);
    expect(mergeAugmentManifest(merged, specs, found, missing)).toEqual(merged);
    expect(() => mergeAugmentManifest(base, specs, found, [])).toThrow('incomplete-augment-results');
    expect(() => mergeAugmentManifest(base, specs, [...found, ...found], missing)).toThrow('invalid-augment-result');
    expect(() => mergeAugmentManifest(base, [{ id: 'a' }], [{ ...found[0], path: '../a.png' }], [])).toThrow('unsafe-augment-path');
  });

  it('downloads the exact source texture filename and refuses output traversal before reading input', async () => {
    const command = downloadCommands([{ id: 'content-id', source: 'ASSETS/Maps/TFT/Icons/Augments/Hexcore/ActualClientName.tex' }], '/tmp/synthetic icons');
    expect(command).toContain('https://raw.communitydragon.org/14.24/game/assets/maps/tft/icons/augments/hexcore/actualclientname.png');
    expect(command).toContain("'/tmp/synthetic icons/content-id.png.part'");
    expect(command.indexOf('curl ')).toBeLessThan(command.indexOf('\nmv '));
    await expect(stageAugmentIcons({ out: '../escape' })).rejects.toThrow('out-must-be-new-local-directory-name');
  });

  it('rejects an assets3d-local symlink into the repository or an ancestor before writing', async () => {
    // The bound is the script's own import.meta.url root. CI shard siblings mkdir the
    // shared assets3d-local before this file runs, so a repo-root lstat is no longer ENOENT.
    const repo = await mkdtemp(join(tmpdir(), 'aug-icons-repo-'));
    const scripts = join(repo, 'scripts/assets3d');
    await mkdir(scripts, { recursive: true });
    await mkdir(join(repo, 'public'), { recursive: true });
    await copyFile(resolve('scripts/assets3d/augment-icons.mjs'), join(scripts, 'augment-icons.mjs'));
    await copyFile(resolve('scripts/assets3d/safe-path.mjs'), join(scripts, 'safe-path.mjs'));
    const isolated = await import(pathToFileURL(join(scripts, 'augment-icons.mjs')).href + `?isolate=${Date.now()}`);
    const stageDir = isolated.augmentStageDirectory as (out: string) => Promise<string>;
    const stageIcons = isolated.stageAugmentIcons as (options: { out: string }) => Promise<unknown>;
    const link = join(repo, 'assets3d-local');
    const external = await mkdtemp(join(tmpdir(), 'aug-icons-'));
    const absent = async (path: string) => expect(lstat(path)).rejects.toMatchObject({ code: 'ENOENT' });
    try {
      await expect(lstat(link)).rejects.toMatchObject({ code: 'ENOENT' });
      await symlink(join(repo, 'public'), link, 'dir');
      try {
        await expect(stageDir('probe')).rejects.toThrow('unsafe-output-path');
        await expect(stageIcons({ out: 'probe' })).rejects.toThrow('unsafe-output-path');
        await absent(join(repo, 'public/probe'));
        await absent(join(repo, 'public/probe/root/ui-assets.json'));
      } finally { await unlink(link); }
      await symlink(dirname(repo), link, 'dir');
      try {
        await expect(stageDir('probe')).rejects.toThrow('unsafe-output-path');
        await expect(stageIcons({ out: 'probe' })).rejects.toThrow('unsafe-output-path');
        await absent(join(dirname(repo), 'probe'));
      } finally { await unlink(link); }
      await symlink(external, link, 'dir');
      try {
        expect(await stageDir('probe')).toBe(join(await realpath(external), 'probe'));
        await absent(join(external, 'probe'));
      } finally { await unlink(link); }
    } finally {
      await rm(external, { recursive: true, force: true });
      await rm(repo, { recursive: true, force: true });
    }
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdir, mkdtemp, readFile, rm, stat, symlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { zstdCompressSync } from 'node:zlib';
// @ts-expect-error Pure Node utility.
import { UiSource, scanLocal, VERSION, cliArguments } from '../scripts/assets3d/ui-source.mjs';
// @ts-expect-error Pure Node utility.
import { planUi, seedPath, fetchUiChunks, referencedPaths } from '../scripts/assets3d/ui-fetch-plan.mjs';
// @ts-expect-error Pure Node utility.
import { extractUi } from '../scripts/assets3d/ui-extract.mjs';
// @ts-expect-error Pure Node utility.
import { riotChunkId } from '../scripts/assets3d/chunk-hash.mjs';
// @ts-expect-error Pure Node utility.
import { readWadIndex } from '../scripts/assets3d/wad.mjs';
// @ts-expect-error Pure Node utility.
import { encodePng } from '../scripts/assets3d/texture.mjs';
// @ts-expect-error Pure Node utility.
import { writeOutputFile, withinRoot } from '../scripts/assets3d/safe-path.mjs';

const roots: string[] = [];
const HUD = 'assets/ux/tft/tfthealthbaratlas.tex';
async function fixture() {
  await mkdir('assets3d-local', { recursive: true });
  const root = await mkdtemp(resolve('assets3d-local/ui-test-')); roots.push(root);
  const tex = Buffer.alloc(20); tex.write('TEX\0'); tex.writeUInt16LE(4, 4); tex.writeUInt16LE(4, 6); tex[8] = 1; tex[9] = 10;
  tex.writeUInt16LE(0xf800, 12); tex.writeUInt16LE(0xf800, 14);
  const paths = new Map<string, string>(), manifest: any = { files: [] }, inventory: any = { chunks: {}, wads: [] }, data = new Map<string, Buffer>();
  let marker = 1, bundleOffset = 0;
  function wad(name: string, assets: { path: string; bytes: Buffer }[]) {
    const bytes = Buffer.alloc(272 + 32 * assets.length + assets.reduce((n, a) => n + a.bytes.length, 0));
    bytes.write('RW'); bytes[2] = 3; bytes[3] = 4; bytes[10] = marker++; bytes.writeUInt32LE(assets.length, 268);
    let at = 272 + assets.length * 32;
    assets.forEach((a, i) => {
      const hash = BigInt(marker * 100 + i), pos = 272 + i * 32;
      bytes.writeBigUInt64LE(hash, pos); bytes.writeUInt32LE(at, pos + 8); bytes.writeUInt32LE(a.bytes.length, pos + 12); bytes.writeUInt32LE(a.bytes.length, pos + 16);
      a.bytes.copy(bytes, at); at += a.bytes.length; paths.set(hash.toString(16).padStart(16, '0'), a.path);
    });
    const cuts = [...new Set([0, 272, 272 + 32 * assets.length, bytes.length])].sort((a, b) => a - b), chunks = [];
    for (let i = 0; i < cuts.length - 1; i++) {
      const raw = bytes.subarray(cuts[i], cuts[i + 1]), packed = zstdCompressSync(raw), id = riotChunkId(raw);
      chunks.push({ id, bundleId: '0000000000000001', offset: bundleOffset, fileOffset: cuts[i], targetSize: raw.length, size: packed.length });
      data.set(id, packed); bundleOffset += packed.length;
    }
    const file = { name, size: bytes.length, chunks }; manifest.files.push(file); return { file, bytes, entries: readWadIndex(bytes) };
  }
  const ui = wad('DATA/FINAL/UI.wad.client', [{ path: HUD, bytes: tex }, { path: 'assets/unrelated.tex', bytes: Buffer.from('DO NOT FETCH') }]);
  wad('DATA/FINAL/UI.zh_CN.wad.client', []); wad('DATA/FINAL/Maps/Shipping/Map22.wad.client', []);
  async function cache(ids = [...data.keys()], dir = 'cache') {
    for (const id of ids) { const path = join(root, dir, `${id}.zst`); await writeOutputFile(path, data.get(id)); (inventory.chunks[id] ??= []).push(path); }
  }
  const source = () => new UiSource(manifest, inventory), sourceManifest = { path: 'synthetic', sha256: 'f'.repeat(64) };
  const plan = () => planUi({ source: source(), paths, sourceManifest });
  return { root, ui, manifest, inventory, data, cache, source, paths, plan, sourceManifest };
}
afterEach(async () => {
  for (const root of roots.splice(0)) { withinRoot(resolve('assets3d-local'), root); expect(root).not.toBe(resolve('assets3d-local')); await rm(root, { recursive: true, force: true }); }
});
describe('UI frozen-stage planning and offline extraction (synthetic bytes only)', () => {
  it('plans only header blocks when the authoritative header is absent', async () => {
    const f = await fixture(); await f.cache(f.manifest.files.slice(1).flatMap((w: any) => w.chunks.map((c: any) => c.id)));
    const plan = await f.plan();
    expect(plan.wads[0]).toMatchObject({ stage: 'header', entries: [] });
    expect(plan.chunks.filter((c: any) => !c.local).map((c: any) => c.id)).toEqual([f.ui.file.chunks[0].id]);
    expect(plan.complete).toBe(false);
  });
  it('adds the exact index range after the header is restored, without selecting payload early', async () => {
    const f = await fixture(); await f.cache([f.ui.file.chunks[0].id, ...f.manifest.files.slice(1).flatMap((w: any) => w.chunks.map((c: any) => c.id))]);
    const plan = await f.plan(); expect(plan.wads[0].stage).toBe('index');
    expect(plan.chunks.filter((c: any) => !c.local).map((c: any) => c.id)).toEqual([f.ui.file.chunks[1].id]);
  });
  it('resolves a pinned-WAD suffix and never selects an unrelated entry', async () => {
    const f = await fixture(); await f.cache(); const [hash] = f.paths.keys();
    f.paths.set(hash, HUD.replace('.tex', '.tft_set12.tex'));
    f.paths.set('ffffffffffffffff', HUD.replace('.tex', '.tft_set17.tex'));
    const plan = await f.plan(); expect(plan.wads[0].entries).toHaveLength(1);
    expect(plan.wads[0].entries[0].path).toBe(HUD.replace('.tex', '.tft_set12.tex'));
    expect(plan.targets).toHaveLength(1); expect(plan.complete).toBe(true);
  });
  it('rejects corrupt local cache and reuses a verified copy from another clone', async () => {
    const f = await fixture(), c = f.ui.file.chunks[0]; await f.cache([c.id], 'bad');
    await writeOutputFile(f.inventory.chunks[c.id][0], Buffer.alloc(c.size), { force: true });
    await f.cache([c.id], 'good'); const source = f.source(), local = await source.locate(c, f.ui.file);
    expect(local.path).toContain('/good/'); expect(source.invalid).toHaveLength(1);
  });
  it('validates touched blocks of a complete WAD, rejecting an equal-size wrong version', async () => {
    const f = await fixture(), path = join(f.root, 'UI.wad.client'); await writeOutputFile(path, f.ui.bytes);
    f.inventory.wads.push(path); expect((await f.source().index(f.ui.file)).entries).toHaveLength(2);
    const broken = Buffer.from(f.ui.bytes); broken[10] ^= 1; await writeOutputFile(path, broken, { force: true });
    await expect(f.source().index(f.ui.file)).rejects.toThrow('missing-local-chunk');
  });
  it('reuses verified ranges in local bundle caches without loading the full bundle', async () => {
    const f = await fixture(), path = join(f.root, '0000000000000001.bundle');
    await writeOutputFile(path, Buffer.concat([...f.data.values()]));
    f.inventory.bundles = { '0000000000000001': [path] };
    const source = f.source(), index = await source.index(f.ui.file);
    expect(index.entries).toHaveLength(2);
    expect(await source.extract(f.ui.file, index.entries[0], index.entries, f.paths)).toEqual(f.ui.bytes.subarray(index.entries[0].offset, index.entries[0].offset + index.entries[0].size));
    expect((await source.locate(f.ui.file.chunks[1], f.ui.file)).kind).toBe('bundle');
    expect((await scanLocal([f.root])).bundles['0000000000000001']).toEqual([path]);
  });
  it('checks new local files before fetching a previously missing frozen block', async () => {
    const f = await fixture(); await f.cache(f.ui.file.chunks.slice(0, 2).map(c => c.id));
    const plan = await f.plan(); await f.cache([...f.data.keys()].filter(id => !f.inventory.chunks[id])); const fetchFn = vi.fn();
    const report = await fetchUiChunks({ plan, source: f.source(), fetchFn, out: join(f.root, 'download') });
    expect(report.requests).toBe(0); expect(report.reused).toHaveLength(plan.chunks.length); expect(fetchFn).not.toHaveBeenCalled();
  });
  it('dry-run has zero network calls and writes no cache or report', async () => {
    const f = await fixture(); await f.cache(f.ui.file.chunks.slice(0, 2).map(c => c.id));
    const plan = await f.plan(), fetchFn = vi.fn(), out = join(f.root, 'dry');
    const report = await fetchUiChunks({ plan, source: f.source(), fetchFn, out, dryRun: true });
    expect(report.summary.bytes).toBe(plan.totals.downloadBytes); expect(fetchFn).not.toHaveBeenCalled();
    await expect(stat(out)).rejects.toMatchObject({ code: 'ENOENT' });
  });
  it('downloads exactly the still-missing frozen blocks through the existing CDN range validator', async () => {
    const f = await fixture(), payload = f.ui.file.chunks.at(-1)!;
    await f.cache([...f.data.keys()].filter(id => id !== payload.id)); const plan = await f.plan();
    const fetchFn = vi.fn(async (_url: string, init: RequestInit) => {
      expect(init.headers).toMatchObject({ Range: `bytes=${payload.offset}-${payload.offset + payload.size - 1}` });
      return new Response(new Uint8Array(f.data.get(payload.id)!), { status: 206, headers: { 'content-range': `bytes ${payload.offset}-${payload.offset + payload.size - 1}/${payload.offset + payload.size}` } });
    });
    const out = join(f.root, 'download');
    const report = await fetchUiChunks({ plan, source: f.source(), fetchFn, out, maxBytes: payload.size });
    expect(report).toMatchObject({ status: 'complete', requests: 1, downloadBytes: payload.size });
    expect(report.downloaded.map((c: any) => c.id)).toEqual([payload.id]);
    expect(await readFile(join(out, 'chunks', `${payload.id}.zst`))).toEqual(f.data.get(payload.id));
  });
  it('reads page and font dependencies only from their source definitions', () => {
    expect(referencedPaths('assets/ux/tft/synthetic.atlas', Buffer.from('page.png\nsize: 16,16\nregion\n'))).toEqual([{ path: 'assets/ux/tft/page.png' }]);
    expect(referencedPaths('data/menu/fontconfig_zh_cn.txt', Buffer.from('font=synthetic.ttf'))).toEqual([{ path: 'assets/ux/fonts/synthetic.ttf', localeEvidence: 'data/menu/fontconfig_zh_cn.txt' }]);
  });
  it('rejects a tampered bundle range before any request', async () => {
    const f = await fixture(); await f.cache(); const plan = await f.plan(); plan.chunks[0].offset++;
    const fetchFn = vi.fn(); await expect(fetchUiChunks({ plan, source: f.source(), fetchFn, out: join(f.root, 'download') })).rejects.toThrow('plan-manifest-mismatch');
    expect(fetchFn).not.toHaveBeenCalled();
  });
  it('extracts and decodes verified art, records provenance, and leaves atlas sprites unverified', async () => {
    const f = await fixture(); await f.cache(); const plan = await f.plan(), out = join(f.root, 'ui');
    const report = await extractUi({ plan, source: f.source(), paths: f.paths, out, reportOut: join(f.root, 'reports') });
    expect(report).toMatchObject({ status: 'partial', visualReady: false, totals: { extracted: 1, textures: 1 } });
    const manifest = JSON.parse(await readFile(join(out, 'manifest.json'), 'utf8')); expect(manifest.sprites).toEqual({});
    expect((await extractUi({ plan, source: f.source(), paths: f.paths, out, reportOut: join(f.root, 'reports') })).files[0].status).toBe('skipped');
    const texture: any = Object.values(manifest.textures)[0]; expect(texture).toMatchObject({ width: 4, height: 4 });
    expect(await readFile(join(out, texture.path))).toEqual(encodePng({ width: 4, height: 4, rgba: Buffer.from(Array.from({ length: 16 }, () => [255, 0, 0, 255]).flat()) }));
  });
  it('does not emit an empty runtime manifest when all selected source payloads are missing', async () => {
    const f = await fixture(); await f.cache(); const plan = await f.plan(); const payload = f.ui.file.chunks.at(-1)!;
    delete f.inventory.chunks[payload.id]; const out = join(f.root, 'empty');
    const report = await extractUi({ plan, source: f.source(), paths: f.paths, out, reportOut: join(f.root, 'reports') });
    expect(report.status).toBe('blocked'); await expect(stat(out)).rejects.toMatchObject({ code: 'ENOENT' });
  });
  it('fails closed on an altered entry or unsafe output before creating files', async () => {
    const f = await fixture(); await f.cache(); const plan = await f.plan(); plan.wads[0].entries[0].offset++;
    await expect(extractUi({ plan, source: f.source(), paths: f.paths, out: join(f.root, 'ui'), reportOut: join(f.root, 'report') })).rejects.toThrow('plan-wad-entry-mismatch');
    await symlink('/tmp', join(f.root, 'escape'));
    await expect(extractUi({ plan, source: f.source(), paths: f.paths, out: join(f.root, 'escape/ui') })).rejects.toThrow('unsafe-output-path');
  });
  it('discovers caches through directory links once and reports stale links', async () => {
    const f = await fixture(); await f.cache(); await symlink(join(f.root, 'cache'), join(f.root, 'alias')); await symlink(join(f.root, 'missing'), join(f.root, 'stale'));
    const inventory = await scanLocal([f.root]); expect(Object.keys(inventory.chunks)).toHaveLength(f.data.size);
    expect(inventory.errors).toContainEqual(expect.objectContaining({ path: join(f.root, 'stale'), reason: 'ENOENT' }));
  });
  it('validates locale/CLI and excludes mobile portraits and unrelated atlases from seeds', () => {
    expect(seedPath('assets/ux/tft/championsplashes/tft13_test_mobile.tex')).toBe(false);
    expect(seedPath('assets/ux/tft/tft_hud_texture_atlas.tft_set12.tex')).toBe(true);
    expect(() => cliArguments(['--locale', 'bad'])).toThrow('unsupported-locale');
    expect(() => cliArguments(['--fetch', '--fetch'])).toThrow('invalid-argument');
    expect(VERSION).toBe('14.24.6442327');
  });
});

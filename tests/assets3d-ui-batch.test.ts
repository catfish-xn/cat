import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve, join } from 'node:path';
// @ts-expect-error Offline Node pipeline.
import { stageUi } from '../scripts/assets3d/ui-stage.mjs';
// @ts-expect-error Offline Node pipeline.
import { writeOutputFileAtomic } from '../scripts/assets3d/safe-path.mjs';
// @ts-expect-error Offline Node pipeline.
import { VERSION, PATCH_SHA } from '../scripts/assets3d/ui-source.mjs';
// @ts-expect-error Offline Node pipeline.
import { mergeUiReviews } from '../scripts/assets3d/ui-extract.mjs';
// @ts-expect-error Offline Node pipeline.
import { fontCoverage } from '../scripts/assets3d/ui-font-coverage.mjs';
// @ts-expect-error Offline Node pipeline.
import { planUi } from '../scripts/assets3d/ui-fetch-plan.mjs';

describe('batch extraction review preservation', () => {
  const texture = { sha256: 'a'.repeat(64), width: 16, height: 16, sourcePath: 'atlas.tex' };
  const fresh = () => ({ sourceVersion: 'pinned', sourceManifestSha256: 'source', textures: { atlas: { ...texture } },
    sprites: {}, fonts: {}, limitations: [], unavailable: [{ id: 'atlas.tex', reason: 'region-unverified' }] });
  it('retains hand-reviewed sprites, states, slices and evidence without claiming unreviewed siblings', () => {
    const previous = { ...fresh(), sprites: { frame: { texture: 'atlas', rect: [1, 1, 8, 8], slice: [1, 1, 1, 1], states: { hover: 'bright' } },
      bright: { texture: 'atlas', rect: [8, 8, 8, 8] } }, regionReviews: { shop: 'shop.local.json' }, ui2Review: { notes: ['checked'] }, batchReview: { regions: 2 } };
    const merged = mergeUiReviews(fresh(), previous);
    expect(merged.sprites).toEqual(previous.sprites); expect(merged.regionReviews).toEqual(previous.regionReviews);
    expect(merged.ui2Review).toEqual(previous.ui2Review); expect(merged.batchReview).toEqual(previous.batchReview);
    expect(merged.unavailable).toEqual([]); expect(merged.sprites.unknown).toBeUndefined();
  });
  it('rejects review reuse across source versions, changed hashes, removed or resized atlases', () => {
    const previous = { ...fresh(), sprites: { frame: { texture: 'atlas', rect: [0, 0, 8, 8] } } };
    expect(() => mergeUiReviews({ ...fresh(), sourceVersion: 'other' }, previous)).toThrow('ui-review-version-mismatch');
    for (const changed of [{ ...texture, sha256: 'b'.repeat(64) }, { ...texture, width: 32 }]) {
      expect(() => mergeUiReviews({ ...fresh(), textures: { atlas: changed } }, previous)).toThrow('ui-reviewed-atlas-changed');
    }
    expect(() => mergeUiReviews({ ...fresh(), textures: {} }, previous)).toThrow('ui-reviewed-atlas-changed');
  });
});

function font(zeroGlyph = false) {
  const bytes = Buffer.alloc(80); bytes.write('OTTO'); bytes.writeUInt16BE(1, 4); bytes.write('cmap', 12);
  bytes.writeUInt32BE(28, 20); bytes.writeUInt32BE(52, 24);
  bytes.writeUInt16BE(1, 30); bytes.writeUInt16BE(3, 32); bytes.writeUInt16BE(1, 34); bytes.writeUInt32BE(12, 36);
  bytes.writeUInt16BE(4, 40); bytes.writeUInt16BE(40, 42); bytes.writeUInt16BE(6, 46);
  [65, 0x4e00, 0xffff].forEach((code, i) => { bytes.writeUInt16BE(code, 54 + i * 2); bytes.writeUInt16BE(code, 62 + i * 2); });
  [2 - 65, (zeroGlyph ? 0 : 3) - 0x4e00, 1].forEach((delta, i) => bytes.writeUInt16BE(delta & 65535, 68 + i * 2));
  return bytes;
}
describe('actual font cmap coverage', () => {
  it('counts actual nonzero Unicode glyphs instead of trusting family names or codepoint ranges', () => {
    expect(fontCoverage(font())).toMatchObject({ formats: [4], latinPrintable: 1, cjkUnifiedGlyphs: 1, chineseProbeCovered: false });
    expect(fontCoverage(font(true)).cjkUnifiedGlyphs).toBe(0);
  });
  it('rejects missing Unicode mappings and out-of-bounds font tables', () => {
    expect(() => fontCoverage(Buffer.alloc(2))).toThrow('font-table-bounds');
    const bad = font(); bad.writeUInt32BE(5000, 20); expect(() => fontCoverage(bad)).toThrow('font-table-bounds');
    const unknown = font(); unknown.writeUInt16BE(9, 32); expect(() => fontCoverage(unknown)).toThrow('font-unicode-cmap-missing');
  });
});

it('finds a target in DATA and unrelated cached WAD indexes, requesting only plausible missing headers', async () => {
  const hud = 'assets/ux/tft/tfthealthbaratlas.tex', ini = 'data/menu/hud/tftdynamicmenutext.ini';
  const names = ['UI', 'UI.zh_CN', 'Maps/Shipping/Map22', 'DATA', 'Global', 'Other'];
  const files = names.map((name, i) => ({ name: `DATA/FINAL/${name}.wad.client`, size: 1024,
    chunks: [{ id: String(i), fileOffset: 0, targetSize: 1024, size: 50, offset: i * 50, bundleId: 'bundle' }] }));
  const source = { manifest: { files }, range: async (f: any) => {
    if (f.name.includes('/Global.')) throw new Error('missing-local-chunk:4');
    return Buffer.alloc(272);
  }, index: async (f: any) => ({ entries: f.name.includes('/DATA.') ? [{ hash: 'ini', offset: 500, compressedSize: 40 }]
    : f.name.includes('/Other.') ? [{ hash: 'hud', offset: 600, compressedSize: 40 }] : [] }),
    locate: async (c: any) => c.id === '4' ? null : { path: 'local' }, extract: async () => Buffer.from('') };
  const plan = await planUi({ source, sourceManifest: {}, paths: new Map([['hud', hud], ['ini', ini]]) });
  expect(plan.targets.find((t: any) => t.path === hud).wad).toBe('DATA/FINAL/Other.wad.client');
  expect(plan.targets.find((t: any) => t.path === ini).wad).toBe('DATA/FINAL/DATA.wad.client');
  expect(plan.chunks.filter((c: any) => !c.local).map((c: any) => c.id)).toEqual(['4']);
});

it('stages every referenced runtime file and rejects stale bytes before touching the delivery', async () => {
  await mkdir('assets3d-local', { recursive: true });
  const root = await mkdtemp(resolve('assets3d-local/ui-stage-test-'));
  try {
    const input = join(root, 'input'), out = join(root, 'delivery'), data = Buffer.from('synthetic-image');
    const texture = { path: 'textures/image.png', width: 8, height: 8, bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') };
    const manifest = { schemaVersion: 1, sourceVersion: VERSION, sourceManifestSha256: PATCH_SHA, textures: { test: texture },
      sprites: { test: { texture: 'test', rect: [0, 0, 8, 8] } }, fonts: {}, shopArt: {}, unavailable: [], limitations: [] };
    await writeOutputFileAtomic(join(input, texture.path), data);
    await writeOutputFileAtomic(join(input, 'manifest.json'), JSON.stringify(manifest));
    const report = await stageUi({ input, out });
    expect(report.files.map((f: any) => f.path)).toEqual(['textures/image.png', 'manifest.json']);
    expect(await readFile(join(out, 'ui', texture.path))).toEqual(data);
    expect(report.upload).not.toContain('--delete');
    expect(report.upload.split(' &&\n')).toEqual([
      expect.stringContaining("--exclude='*.json' --exclude='*.html'"),
      expect.stringContaining("--include='*/' --include='*.json' --include='*.html' --exclude='*'"),
    ]);
    // Exercise shell failure ordering with a local stand-in; no upload or real rsync runs.
    const bin = join(root, 'bin'), log = join(root, 'upload.log');
    await mkdir(bin);
    await writeFile(join(bin, 'rsync'), '#!/bin/sh\nprintf "call\\n" >> "$UI_UPLOAD_LOG"\nexit "${UI_UPLOAD_EXIT:-0}"\n', { mode: 0o755 });
    for (const [code, calls] of [[17, 1], [0, 2]]) {
      await writeFile(log, '');
      const result = spawnSync('sh', ['-c', report.upload], { env: { ...process.env, PATH: `${bin}:${process.env.PATH}`,
        UI_UPLOAD_TARGET: 'unused-local-test-target', UI_UPLOAD_LOG: log, UI_UPLOAD_EXIT: String(code) } });
      expect(result.error).toBeUndefined(); expect(result.status).toBe(code);
      expect((await readFile(log, 'utf8')).trim().split('\n')).toHaveLength(calls);
    }
    await writeOutputFileAtomic(join(input, texture.path), Buffer.from('bad'), { force: true });
    await expect(stageUi({ input, out })).rejects.toThrow('ui-stage-hash');
    expect(await readFile(join(out, 'ui', texture.path))).toEqual(data);
  } finally { await rm(root, { recursive: true, force: true }); }
});

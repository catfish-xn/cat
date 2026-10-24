import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** Cold cache: the WAD indexes need chunks that are not cached. Only the source, its digest and the output root are substituted. */
const dirs: string[] = [];
afterEach(async () => { vi.resetModules(); vi.doUnmock('../scripts/assets3d/safe-path.mjs'); vi.doUnmock('../scripts/assets3d/rman.mjs');
  vi.doUnmock('../scripts/assets3d/global-vfx.mjs'); vi.doUnmock('node:crypto');
  for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true }); });

describe('jayce-forge.mjs on a cold chunk cache', () => {
  it('returns the report it writes when the WAD indexes are missing chunks, and the CLI summary reads it', async () => {
    const out = await mkdtemp(join(tmpdir(), 'forge-out-')), src = await mkdtemp(join(tmpdir(), 'forge-src-'));
    dirs.push(out, src);
    await writeFile(join(src, '14.24.manifest'), 'synthetic');
    vi.doMock('../scripts/assets3d/safe-path.mjs', () => ({
      safeOutputPath: async () => out, safeInputPath: async (_root: string, p: string) => p,
      writeOutputFileAtomic: async (p: string, data: string | Buffer) => { await mkdir(join(p, '..'), { recursive: true }); await writeFile(p, data); },
    }));
    vi.doMock('node:crypto', async importOriginal => {
      const crypto = await importOriginal<typeof import('node:crypto')>();
      // The real 14.24 manifest's digest, so the version check passes on the synthetic bytes.
      return { ...crypto, createHash: () => ({ update() { return this; }, digest: () => 'c080631bd377f60730d979b48807a49f86070517e85b7bafdc32c8666fee7a14' }) };
    });
    vi.doMock('../scripts/assets3d/rman.mjs', () => ({ readRman: () => ({}), chunksForRange: () => [] }));
    vi.doMock('../scripts/assets3d/global-vfx.mjs', () => ({ parseGlobalVfxBin: () => ({}), offlineArchiveReader: () => {
      const missing = new Map([['B', { id: 'B', bundleId: 'b', offset: 0, size: 30, targetSize: 60 }], ['A', { id: 'A', bundleId: 'b', offset: 30, size: 12, targetSize: 20 }]]);
      return { missing, archive: async () => { throw new Error('missing-cached-chunks'); } };
    } }));
    // @ts-expect-error Offline Node tooling.
    const { buildJayceForge, forgeSummary } = await import('../scripts/assets3d/jayce-forge.mjs');
    const report = await buildJayceForge({ source: src });
    expect(report).toEqual(JSON.parse(await readFile(join(out, 'report.json'), 'utf8')));
    expect(forgeSummary(report)).toEqual({ ready: false, phase: 'index', missingChunks: 2, downloadBytes: 42,
      failures: [
        { stage: 'index', path: 'DATA/FINAL/TFTSet13.wad.client', reason: 'missing-cached-chunks' },
        { stage: 'index', path: 'DATA/FINAL/TFTCommon.wad.client', reason: 'missing-cached-chunks' },
      ] });
    expect(JSON.parse(await readFile(join(out, 'plan.json'), 'utf8')).chunks.map((c: { id: string }) => c.id)).toEqual(['A', 'B']);
  });
});

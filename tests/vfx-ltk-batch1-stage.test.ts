import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
// @ts-expect-error Offline staging utility is native ESM JavaScript.
import { stageVfxBatch1 } from '../scripts/assets3d/stage-vfx-batch1.mjs';
import { BATCH1_DIRECTORIES, BATCH1_TIMELINES } from '../src/rendering/three-mode/vfx-ltk/batch1-timelines';
const sha = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
it('stages only declared closures, preserves existing catalogues/manifest/precache, and rejects baseline drift', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'vfxb1-stage-'));
  try {
    const source = join(temp, 'source'), stage = join(temp, 'stage'), baseline = join(stage, 'baseline');
    await mkdir(baseline, { recursive: true });
    const manifest = '{"schemaVersion":1,"models":{"existing":{"path":"model.glb"}}}\n';
    const root = { version: 1, systems: { old: 'jinx/old.json' }, assets: { old: 'jinx/old.png' }, skills: {}, champions: { tristana: 'tft13_tristana/index.json' } };
    const old = { path: 'model.glb', bytes: 3, sha256: sha('old') };
    const before: Record<string, string> = { 'manifest.json': manifest, 'ltk-index.json': JSON.stringify(root), 'precache.json': JSON.stringify({ schemaVersion: 1, files: [old] }) };
    const expected: Record<string, string> = {};
    for (const [name, bytes] of Object.entries(before)) { await writeFile(join(baseline, name), bytes); expected[name] = sha(bytes); }
    for (const [name, dir] of Object.entries(BATCH1_DIRECTORIES)) {
      await mkdir(join(source, dir), { recursive: true });
      const systems = Object.fromEntries(BATCH1_TIMELINES[name as keyof typeof BATCH1_DIRECTORIES].map(c => [c.system, c.system + '.json']));
      for (const path of Object.values(systems)) await writeFile(join(source, dir, path), '{}');
      await writeFile(join(source, dir, 'tex.png'), 'synthetic');
      await writeFile(join(source, dir, 'not-declared.txt'), 'never copy');
      await writeFile(join(source, dir, 'index.json'), JSON.stringify({ version: 1, systems, assets: { tex: 'tex.png' }, skills: {} }));
    }
    const result = await stageVfxBatch1({ source, stage, expected });
    expect(await readFile(join(stage, 'manifest.json'), 'utf8')).toBe(manifest);
    expect(JSON.parse(await readFile(join(stage, 'manifest.delta.json'), 'utf8'))).toEqual({});
    const after = JSON.parse(await readFile(join(stage, 'vfx-ltk/index.json'), 'utf8'));
    expect(after.systems).toEqual(root.systems); expect(after.assets).toEqual(root.assets); expect(after.skills).toEqual(root.skills);
    expect(after.champions.tristana).toBe(root.champions.tristana); expect(Object.keys(after.champions)).toHaveLength(9);
    const precache = JSON.parse(await readFile(join(stage, 'precache.json'), 'utf8'));
    expect(precache.files.find((f: { path: string }) => f.path === 'model.glb')).toEqual(old);
    expect(precache.files.some((f: { path: string }) => f.path.includes('not-declared'))).toBe(false);
    for (const entry of precache.files.filter((f: { path: string }) => f.path !== 'model.glb')) {
      const bytes = await readFile(join(stage, entry.path)); expect(entry.bytes).toBe(bytes.length); expect(entry.sha256).toBe(sha(bytes));
    }
    expect(result.ltkFiles).toBe(result.payloadFiles + 9);
    const uploadPayload = (await readFile(join(stage, 'payload-files.txt'), 'utf8')).trim().split('\n');
    expect(uploadPayload.some(p => p.endsWith('index.json'))).toBe(false);
    expect((await readFile(join(stage, 'child-index-files.txt'), 'utf8')).trim().split('\n')).toHaveLength(8);
    await writeFile(join(baseline, 'manifest.json'), '{}');
    await expect(stageVfxBatch1({ source, stage, expected })).rejects.toThrow('baseline-changed:manifest.json');
  } finally { await rm(temp, { recursive: true, force: true }); }
});

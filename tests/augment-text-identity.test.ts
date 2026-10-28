import { expect, it } from 'vitest';
import { recomputeContentDigest } from '../scripts/content-digest';
import { recomputeLootReplayDigest } from '../scripts/loot-replay-digest';
import { AUGMENT_BATCH1 } from '../src/simulation/content/augment-pool-batch1';
import { AUGMENT_BATCH2 } from '../src/simulation/content/augment-pool-batch2';
import { AUGMENT_BATCH3 } from '../src/simulation/content/augment-pool-batch3';
import { AUGMENT_BATCH3_XP } from '../src/simulation/content/augment-pool-batch3-xp';
import { AUGMENT_BATCH5_H10 } from '../src/simulation/content/augment-pool-batch5-h10';
import { AUGMENT_POOL_TEXT } from '../src/presentation/augment-pool-text';
import { loadAugmentText } from '../src/presentation/augment-text-loader';
import { augmentPlayerDescription } from '../src/presentation/augment-display';
import { CONTENT_DIGEST, LOOT_REPLAY_DIGEST } from '../src/simulation/content/identity-constants';

// Moving prose to the lazy chunk must not change the recorded v23-online-rules identity roots.
it('keeps the recorded content identity roots while descriptions live in the UI chunk', () => {
  expect(recomputeContentDigest()).toBe(CONTENT_DIGEST);
  expect(recomputeLootReplayDigest()).toBe(LOOT_REPLAY_DIGEST);
});
it('shows every batch description after the UI chunk arrives, without putting prose in runtime rows', async () => {
  await loadAugmentText();
  // B5-60 migrated this row out of batch 2; its historical UI text is still retained.
  const migratedBatch2 = { 'snipers-nest': AUGMENT_BATCH5_H10['snipers-nest'] };
  expect(Object.keys(AUGMENT_POOL_TEXT).sort()).toEqual([...Object.keys(AUGMENT_BATCH1), ...Object.keys(AUGMENT_BATCH2), ...Object.keys(AUGMENT_BATCH3), ...Object.keys(AUGMENT_BATCH3_XP), ...Object.keys(migratedBatch2)].sort());
  for (const id of Object.keys(migratedBatch2)) expect(augmentPlayerDescription(id)).toBe(AUGMENT_POOL_TEXT[id].description);
  for (const [id, row] of Object.entries({ ...AUGMENT_BATCH1, ...AUGMENT_BATCH2, ...AUGMENT_BATCH3, ...AUGMENT_BATCH3_XP })) {
    expect(row).not.toHaveProperty('description'); expect(row.source).not.toHaveProperty('description_en_us');
    expect(augmentPlayerDescription(id)).toBe(AUGMENT_POOL_TEXT[id].description.replace(/〔对局动态值〕/g, '未确定'));
  }
});
it.each(['src/server/main.ts', 'src/server-entry/index.ts'])('keeps server bundle %s independent of lazy UI and offline archive data', async entry => {
  const { build } = await import('esbuild');
    const result = await build({ entryPoints: [entry], bundle: true, platform: 'node', format: 'esm',
      packages: 'external', write: false, metafile: true, logLevel: 'silent' });
    expect(Object.keys(result.metafile!.inputs).filter(path =>
      /augment-(?:pool-text|text-(?:data|loader))|tooltip-text-(?:data|loader)|augment-content-archive/.test(path)), entry).toEqual([]);
});

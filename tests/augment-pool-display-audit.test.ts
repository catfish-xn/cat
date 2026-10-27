import { existsSync, readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { augmentApiName } from '../src/simulation/augment-offers';
import { AUGMENT_DEFINITIONS } from '../src/simulation/content/augments';
import { AUGMENT_TIERS } from '../src/simulation/content/augment-policy';
import { augmentDisplayName, augmentPlayerDescription } from '../src/presentation/augment-display';
import { AUGMENT_EXTRA_TEXT } from '../src/presentation/augment-pool-text';
import { loadAugmentText } from '../src/presentation/augment-text-loader';

const RESEARCH_FILE = '/home/aiapps/workspace/augments-research-2026-10-23/data/augments-14.24.json';

it.skipIf(!existsSync(RESEARCH_FILE))('shows the official 14.24 Chinese name for every augment in the pool', async () => {
  const archive = JSON.parse(readFileSync(RESEARCH_FILE, 'utf8')) as { apiName: string; name_zh_cn: string; description_zh_cn: string }[];
  const byApi = new Map(archive.map(row => [row.apiName, row]));
  await loadAugmentText();
  const ids = Object.keys(AUGMENT_DEFINITIONS).filter(id => AUGMENT_TIERS[id]);
  expect(ids.length).toBeGreaterThan(0);
  for (const id of ids) {
    const api = augmentApiName(id), source = byApi.get(api);
    expect(source?.name_zh_cn, `${id}: missing official name for ${api}`).toBeTruthy();
    expect(augmentDisplayName(id), `${id} (${api})`).toBe(source?.name_zh_cn);
    if (Object.hasOwn(AUGMENT_EXTRA_TEXT, id)) {
      expect(augmentPlayerDescription(id), `${id} description`).toBe(source?.description_zh_cn);
    }
  }
});

it('loads the formerly missing batch text and shows the complete team-up names', async () => {
  await loadAugmentText();
  expect(augmentDisplayName('patience-is-a-virtue')).toBe('耐心是一种美德');
  expect(augmentPlayerDescription('patience-is-a-virtue')).toBe('每回合，如果你在上一回合未购买任何弈子，则会获得2次免费刷新。');
  expect(augmentDisplayName('sisters')).toBe('羁绊：姐妹');
  expect(Object.keys(AUGMENT_EXTRA_TEXT)).toHaveLength(19);
});

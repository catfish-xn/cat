import { freezeContent } from './freeze';
import type { ChoiceDefinition } from '../strategy-types';

/** 14.24 archive; execution conventions P-B5-03 and P-B5-04 (2026-10-27). */
export const AUGMENT_BATCH5_S1B = freezeContent({
  'reroll-transfer': {
    apiName: 'TFT_Augment_RerollTransfer', name: '刷新转换',
    description: '每1次未使用的强化符文刷新，可获得3次免费商店刷新。获得3金币。不包含这个强化符文被选择的那个回合。',
    tier: 'silver' as const,
    source: { patch: '14.24', archive: 'augments-research-2026-10-23/data/augments-14.24.json', values: { AugmentRerollTracked: 1, Gold: 3, ShopRerollToGrant: 3 } },
  },
  'at-what-cost': {
    apiName: 'TFT11_Augment_AtWhatCost', name: '不计代价',
    description: '立即升到6级并获得4经验值。你无法选择之后的强化符文。',
    tier: 'prismatic' as const,
    source: { patch: '14.24', archive: 'augments-research-2026-10-23/data/augments-14.24.json', values: { Gold: null, Level: 6, XP: 4 } },
  },
});
export const AUGMENT_BATCH5_S1B_DEFINITIONS: Readonly<Record<string, ChoiceDefinition>> = freezeContent(Object.fromEntries(
  Object.entries(AUGMENT_BATCH5_S1B).map(([id, row]): [string, ChoiceDefinition] => [id, { id, name: row.name, description: row.description, effects: [
    { kind: 'mechanic', mechanic: 'acquisitionBundle', values: { enabled: 1 } },
    ...(id === 'reroll-transfer' ? [{ kind: 'mechanic' as const, mechanic: 'acquisitionGold', values: { amount: AUGMENT_BATCH5_S1B['reroll-transfer'].source.values.Gold } }] : []),
  ] }]),
));
export const AUGMENT_BATCH5_S1B_TIERS = freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH5_S1B).map(([id, row]) => [id, row.tier])));
export const AUGMENT_BATCH5_S1B_API_NAMES = freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH5_S1B).map(([id, row]) => [id, row.apiName])));

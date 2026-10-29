import { freezeContent } from './freeze';
import type { ChoiceDefinition } from '../strategy-types';

/** 14.24 archive; P-B5-76 / P-B5-79, user authorised 2026-10-27. */
export const AUGMENT_BATCH5_H11 = freezeContent({
  sponging: {
    apiName: 'TFT_Augment_Sponging', tier: 'prismatic' as const, name: '白蹭',
    description: '战斗开始时：至多5个仅携带了1件及以下装备的弈子们会从相距最近的那个全装友军处随机获得一件成装的复制品。',
    source: { patch: '14.24', archive: 'augments-research-2026-10-23/data/augments-14.24.json', values: { MaxItemsToBeEligible: 1, MaxUnits: 5 } },
  },
  scavenger: {
    apiName: 'TFT_Augment_Scavenger', tier: 'gold' as const, name: '拾荒者',
    description: '每次对战中被击杀的前5名敌方弈子会为你的队伍中的一个弈子提供一件临时成装。',
    source: { patch: '14.24', archive: 'augments-research-2026-10-23/data/augments-14.24.json', values: { NumDeaths: 5 } },
  },
});
export const H11_FIELDS = freezeContent({ scavenger: ['numDeaths'], sponging: ['maxItems', 'maxUnits'] });
export const AUGMENT_BATCH5_H11_DEFINITIONS: Readonly<Record<string, ChoiceDefinition>> = freezeContent({
  sponging: { id: 'sponging', name: AUGMENT_BATCH5_H11.sponging.name, description: AUGMENT_BATCH5_H11.sponging.description,
    effects: [{ kind: 'mechanic', mechanic: 'sponging', values: { maxItems: AUGMENT_BATCH5_H11.sponging.source.values.MaxItemsToBeEligible, maxUnits: AUGMENT_BATCH5_H11.sponging.source.values.MaxUnits } }] },
  scavenger: { id: 'scavenger', name: AUGMENT_BATCH5_H11.scavenger.name, description: AUGMENT_BATCH5_H11.scavenger.description,
    effects: [{ kind: 'mechanic', mechanic: 'scavenger', values: { numDeaths: AUGMENT_BATCH5_H11.scavenger.source.values.NumDeaths } }] },
});
export const AUGMENT_BATCH5_H11_TIERS = freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH5_H11).map(([id, row]) => [id, row.tier])));
export const AUGMENT_BATCH5_H11_API_NAMES = freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH5_H11).map(([id, row]) => [id, row.apiName])));

import { freezeContent } from './freeze';
import type { ChoiceDefinition } from '../strategy-types';
import type { AugmentGiftSpec } from '../augment-gift-plan';
interface Row {
  readonly apiName: string; readonly name: string; readonly description: string; readonly tier: 'gold';
  readonly source: { readonly patch: string; readonly archive: string; readonly values: Readonly<Record<string, number>> };
  readonly gifts: readonly AugmentGiftSpec[];
}
/** Fixed 14.24 archive numbers; execution convention P-B5-60/61 (2026-10-27). */
export const AUGMENT_BATCH5_H10: Readonly<Record<string, Row>> = freezeContent({
  'trait-tracker': {
    apiName: 'TFT_Augment_TraitTracker', name: '羁绊追踪者', tier: 'gold',
    description: '准备期合法操作结束后，首次激活8个非唯一羁绊时，获得6件不同的随机纹章（仅一次）。',
    source: { patch: '14.24', archive: 'augments-research-2026-10-23/data/augments-14.24.json', values: { NumEmblems: 6, NumTraits: 8 } },
    gifts: [],
  },
  'snipers-nest': {
    apiName: 'TFT13_Augment_Sniper', name: '狙神之巢', tier: 'gold',
    description: '获得1个泽丽。狙神首次在某格开战获得8%伤害增幅，连续相同开战格每战增加8%，最高32%；换开战格或离场后重上重置。',
    source: { patch: '14.24', archive: 'augments-research-2026-10-23/data/augments-14.24.json', values: { DamageAmp: 8, MaxAmp: 32 } },
    gifts: [{ kind: 'unit', definitionId: 'zeri' }],
  },
});
export const AUGMENT_BATCH5_H10_DEFINITIONS: Readonly<Record<string, ChoiceDefinition>> = freezeContent(Object.fromEntries(
  Object.entries(AUGMENT_BATCH5_H10).map(([id, row]) => [id, { id, name: row.name, description: row.description,
    effects: [{ kind: 'mechanic', mechanic: 'acquisitionBundle', values: { enabled: 1 } }] }])));
export const AUGMENT_BATCH5_H10_TIERS = freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH5_H10).map(([id, row]) => [id, row.tier])));
export const AUGMENT_BATCH5_H10_API_NAMES = freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH5_H10).map(([id, row]) => [id, row.apiName])));

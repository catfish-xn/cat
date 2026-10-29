import { freezeContent } from './freeze';
import type { ChoiceDefinition } from '../strategy-types';
import type { AugmentGiftSpec } from '../augment-gift-plan';

interface Row {
  readonly apiName: string;
  readonly name: string;
  readonly description: string;
  readonly tier: 'silver';
  readonly source: { readonly patch: string; readonly archive: string; readonly values: Readonly<Record<string, number>> };
  readonly gifts: readonly AugmentGiftSpec[];
  readonly gold: number;
}
/** 14.24 static numbers; execution conventions P-B5-27-R6 / P-B5-28-R6 (2026-10-27). */
export const AUGMENT_BATCH5_R6: Readonly<Record<string, Row>> = freezeContent({
  'recombobulator': {
    apiName: 'TFT6_Augment_Recombobulator', name: '变形重组器', tier: 'silver',
    description: '你棋盘上的弈子们会永久变形为一个比自身高1费的随机弈子(最大5费)。获得2个【装备拆卸器】。',
    source: { patch: '14.24', archive: 'augments-research-2026-10-23/data/augments-14.24.json', values: { NumRemovers: 2 } },
    gifts: [{ kind: 'consumable', definitionId: 'magnetic-remover', count: 2 }], gold: 0,
  },
  'pandoras-bench': {
    apiName: 'TFT7_Augment_PandorasBench', name: '潘朵拉的备战席', tier: 'silver',
    description: '提供2金币。每个回合开始时，处在备战席最右侧3个栏位的英雄们变为随机的同费用英雄。',
    source: { patch: '14.24', archive: 'augments-research-2026-10-23/data/augments-14.24.json', values: { BenchSlots: 3, Gold: 2 } },
    gifts: [], gold: 2,
  },
});
export const AUGMENT_BATCH5_R6_DEFINITIONS: Readonly<Record<string, ChoiceDefinition>> = freezeContent(Object.fromEntries(
  Object.entries(AUGMENT_BATCH5_R6).map(([id, row]): [string, ChoiceDefinition] => [id, { id, name: row.name, description: row.description,
    effects: [{ kind: 'mechanic', mechanic: 'acquisitionBundle', values: { enabled: 1 } },
      ...(row.gold ? [{ kind: 'mechanic' as const, mechanic: 'acquisitionGold', values: { amount: row.gold } }] : [])],
  }]),
));
export const AUGMENT_BATCH5_R6_TIERS = freezeContent(Object.fromEntries(Object.keys(AUGMENT_BATCH5_R6).map(id => [id, 'silver' as const])));
export const AUGMENT_BATCH5_R6_API_NAMES = freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH5_R6).map(([id, row]) => [id, row.apiName])));

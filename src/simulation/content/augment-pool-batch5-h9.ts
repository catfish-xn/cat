import type { ChoiceDefinition } from '../strategy-types';
import { freezeContent } from './freeze';

/** 14.24 source data; P-B5-56 / P-B5-58, approved 2026-10-27. */
export const AUGMENT_BATCH5_H9 = freezeContent({
  'forbidden-magic': {
    "apiName": "TFT13_Augment_Cabal",
    "name": "禁忌魔法",
    "description": "【黑色玫瑰】弈子或【赛恩】每参与击杀3次，【赛恩】就会永久获得1.5%攻击力和10最大生命值。获得3个【黑色玫瑰】弈子。(层数：〔对局动态值〕)",
    "tier": "gold",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "description_en_us": "Every 3 takedowns by Black Rose champions or Sion grant Sion permanent 1.5% Attack Damage and 10 Max Health. Gain 3 Black Rose champions. (Stacks: 〔对局动态值〕)",
      "values": {
        "NumTakedownsPerStack": 3.0,
        "SionADPercentPerStack": 0.014999999664723873,
        "SionHealthPerStack": 10.0
      }
    }
  },
  'a-golden-find': {
    apiName: 'TFT13_Augment_AGoldenFind',
    name: '金色收获',
    description: '被【异常突变】进化的弈子每完成3次击杀就会掉落2金币。获得10次免费刷新。',
    tier: 'gold',
    source: {
      patch: '14.24',
      archive: 'augments-research-2026-10-23/data/augments-14.24.json',
      description_en_us: 'Champions evolved by the Anomaly drop 2 gold every 3 kills. Gain 10 free rerolls.',
      values: { FreeRerolls: 10, GoldPerRequirement: 2, NumKillsRequirement: 3 },
    },
  },
} as const);

export const AUGMENT_BATCH5_H9_DEFINITIONS: Readonly<Record<string, ChoiceDefinition>> = freezeContent(Object.fromEntries(
  Object.entries(AUGMENT_BATCH5_H9).map(([id, row]) => [id, {id, name: row.name, description: row.description,
    effects: [{kind: 'mechanic', mechanic: 'acquisitionBundle', values: {enabled: 1}}]}]),
));
export const AUGMENT_BATCH5_H9_TIERS = freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH5_H9).map(([id, row]) => [id, row.tier])));
export const AUGMENT_BATCH5_H9_API_NAMES = freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH5_H9).map(([id, row]) => [id, row.apiName])));

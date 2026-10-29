import { freezeContent } from './freeze';
import type { ChoiceDefinition } from '../strategy-types';

/** 14.24 archive values; execution follows P-B5-39/40 (2026-10-27). */
export const AUGMENT_BATCH5_R1 = freezeContent({
  'tomb-raider-1': { apiName: 'TFT_Augment_TombRaider1', name: '盗墓者 I', tier: 'gold', values: { NumDead: 3 },
    description: '从取得后的接下来3名被淘汰玩家的棋盘和备战席英雄所持普通成装中，各选择一件。全部展示，不含纹章、光明、神器、辅助装；没有候选也计入3名。' },
  'tomb-raider-2': { apiName: 'TFT_Augment_TombRaider2', name: '盗墓者 II', tier: 'prismatic', values: { NumDead: 9 },
    description: '每有一位玩家在取得此强化后被淘汰，从其棋盘和备战席英雄所持普通成装中选择一件。全部展示，不含纹章、光明、神器、辅助装。' },
} as const);

const enabled = ['tomb-raider-1', 'tomb-raider-2'] as const;
export const AUGMENT_BATCH5_R1_DEFINITIONS: Readonly<Record<string, ChoiceDefinition>> = freezeContent(Object.fromEntries(enabled.map(id => {
  const row = AUGMENT_BATCH5_R1[id];
  return [id, { id, name: row.name, description: row.description,
    effects: [{ kind: 'mechanic', mechanic: 'acquisitionBundle', values: { enabled: 1 } }] }];
})));
export const AUGMENT_BATCH5_R1_TIERS = freezeContent(Object.fromEntries(enabled.map(id => [id, AUGMENT_BATCH5_R1[id].tier])));
export const AUGMENT_BATCH5_R1_API_NAMES = freezeContent(Object.fromEntries(enabled.map(id => [id, AUGMENT_BATCH5_R1[id].apiName])));

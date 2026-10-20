/**
 * v16 loot descriptions for drop rows: what a tool, an epic forge or the crown does, from the content's own texts
 * (`CONSUMABLE_DEFINITIONS`, item effect descriptions) and the forge policy's choice count. Display only.
 */
import { CONSUMABLE_DEFINITIONS } from '../simulation/content/consumables';
import type { ConsumableDefinitionId } from '../simulation/consumable-types';
import { G24_FORGE_POLICY } from '../simulation/content/g2-4-forges';
import type { LootPayload } from '../simulation/m8/contracts';
import { itemDescriptions } from './item-codex';

const FORGE_TEXT: Readonly<Record<string, string>> = {
  TFT_ArmoryKeyCompleted: `史诗奖励 · 领取后从 ${G24_FORGE_POLICY.choices} 件成装中选择 1 件`,
  TFT_ArmoryKeyOrnn: `史诗奖励 · 领取后从 ${G24_FORGE_POLICY.choices} 件神器装备中选择 1 件`,
};

/** One-line description of a drop's payload; empty for gold and heroes (their name says it all). */
export function lootPayloadDescription(payload: LootPayload): string {
  if (payload.kind === 'consumable') return CONSUMABLE_DEFINITIONS[payload.definitionId as ConsumableDefinitionId]?.description ?? '';
  if (payload.kind === 'forge') return FORGE_TEXT[payload.definitionId] ?? ['史诗奖励', ...itemDescriptions(payload.definitionId)].join(' · ');
  if (payload.kind === 'item') return itemDescriptions(payload.definitionId).join('；');
  return '';
}

/**
 * v16 loot descriptions for drop rows: what a tool, an anvil (v22: a bench unit) or the crown does, from the content's own texts
 * (`CONSUMABLE_DEFINITIONS`, item effect descriptions) and the forge policy's choice count. Display only.
 */
import { CONSUMABLE_DEFINITIONS } from '../simulation/content/consumables';
import type { ConsumableDefinitionId } from '../simulation/consumable-types';
import { G24_FORGE_POLICY } from '../simulation/content/g2-4-forges';
import type { LootPayload } from '../simulation/m8/contracts';
import { itemDescriptions } from './item-codex';
import { anvilDisplay } from '../simulation/content/anvils';

/** v22: an anvil arrives on the bench and opens its armory when sold (the rules' anvilDisplay text). */
const forgeText = (definitionId: string): string | undefined => {
  const anvil = anvilDisplay(definitionId);
  return anvil ? `领取后进入备战席 · 拖到商店打开武器库，${anvil.timeoutMs / 1000} 秒内 ${G24_FORGE_POLICY.choices} 选 1` : undefined;
};

/** One-line description of a drop's payload; empty for gold and heroes (their name says it all). */
export function lootPayloadDescription(payload: LootPayload): string {
  if (payload.kind === 'consumable') return CONSUMABLE_DEFINITIONS[payload.definitionId as ConsumableDefinitionId]?.description ?? '';
  if (payload.kind === 'forge') return forgeText(payload.definitionId) ?? ['史诗奖励', ...itemDescriptions(payload.definitionId)].join(' · ');
  if (payload.kind === 'item') return itemDescriptions(payload.definitionId).join('；');
  return '';
}

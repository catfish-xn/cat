import type { MatchState, MatchEvent } from './match-types';
import { G24_FORGE_POLICY, resolveG24ForgePool } from './content/g2-4-forges';
import { sampleG24Reward } from './g2-3-rewards';
export const EPIC_REWARD_NAMES = Object.freeze({TFT_ArmoryKeyCompleted:'成装锻造器',TFT_ArmoryKeyComponent:'基础装备锻造器',TFT_ArmoryKeySupport:'辅助装锻造器',TFT_ArmoryKeyOrnn:'神器装备锻造器',TFT_Item_ForceOfNature:'金铲铲冠冕'});
export const epicForgeId=(receiptId:string)=>JSON.stringify(['epic-forge',receiptId]);
export function epicForgeOffers(seed:number,receiptId:string,selector:string):readonly string[]{
  return sampleG24Reward(resolveG24ForgePool(selector),`${seed}:${epicForgeId(receiptId)}`,G24_FORGE_POLICY.choices);
}
export { validateAnvils as validateEpicForges } from './anvils';

/** Kept for callers of the old hook; anvils never auto-open or auto-select. */
export function openEpicForge(state:MatchState):{state:MatchState;events:readonly MatchEvent[]}{return {state,events:[]};}
export const settleTerminalEpicForges=openEpicForge;

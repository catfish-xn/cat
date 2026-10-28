
import { G24_FORGE_POOLS } from './content/g2-4-forges';
import { nextRandom } from './rng';

/** P-B5-17: the original craft and a uniformly chosen different sponsor.
 * The receipt identity selects a private deterministic stream; opening order does not change it. */
export function academicResearchOffers(seed: number, receiptId: string, crafted: string, sponsored: readonly string[]): readonly string[] {
  if (!G24_FORGE_POOLS.TFT_ArmoryKeyCompleted.includes(crafted)) throw new RangeError('Invalid academic research craft');
  if (sponsored.length !== 3 || new Set(sponsored).size !== 3 || sponsored.some(id => !G24_FORGE_POOLS.TFT_ArmoryKeyCompleted.includes(id))) {
    throw new RangeError('Invalid academy sponsors');
  }
  const pool = sponsored.filter(id => id !== crafted).sort();
  let hash = (seed ^ 0x61636164) >>> 0;
  for (let i = 0; i < receiptId.length; i++) hash = Math.imul(hash ^ receiptId.charCodeAt(i), 16777619) >>> 0;
  const word = nextRandom(hash).word;
  return [crafted, pool[Math.floor(word * pool.length / 4294967296)]];
}

import type { MatchState } from './match-types';
import type { ItemInstance } from './strategy-types';
import type { ResourceProvenanceEntry } from './resource-provenance';
import type { AugmentGift } from './augment-gift-plan';
import { createG23Progress } from './g2-3-match-progress';

/** The first, mandatory item gift is the acquisition boundary, including crafts
 * made while the augment offer was open. No independently editable counter. */
export function s3bAcquiredBefore(state: Pick<MatchState,'augments'|'resourceProvenance'>, id:string, sequence:number):boolean {
  const a=state.augments.find(a=>a.definitionId===id);
  if(!a)return false;
  const receiptId=JSON.stringify(['augment-pool-batch1',a.choiceId,id,0,0]);
  const anchor=state.resourceProvenance.entries.find(e=>e.kind==='item-acquired'&&e.source.kind==='mechanic'&&e.source.receiptId===receiptId);
  return !!anchor&&anchor.sequence<sequence;
}
export function academicCraft(state:Pick<MatchState,'augments'|'resourceProvenance'>,fact:ResourceProvenanceEntry):boolean {
  return fact.kind==='item-combined'&&G24_FORGE_POOLS.TFT_ArmoryKeyCompleted.includes(fact.event.definitionId)
    &&s3bAcquiredBefore(state,'academic-research',fact.sequence);
}
export function academicGiftPlan(state:MatchState):AugmentGift[] {
  const a=state.augments.find(a=>a.definitionId==='academic-research');
  return a?state.resourceProvenance.entries.flatMap(e=>academicCraft(state,e)?[{
    receiptId:JSON.stringify(['augment-pool-batch1',a.choiceId,a.definitionId,'craft',e.sequence]),
    kind:'unit' as const,definitionId:'TFT_ArmoryKeyCompleted',acquiredRound:a.acquiredRound,
  }]:[]):[];
}
export function academicAnvilOffers(state:MatchState,receiptId:string):readonly string[]|undefined {
  const gift=academicGiftPlan(state).find(g=>g.receiptId===receiptId);
  if(!gift)return undefined;
  const fact=state.resourceProvenance.entries[JSON.parse(receiptId)[4]];
  if(fact.kind!=='item-combined')throw new RangeError('Invalid academic research receipt');
  return academicResearchOffers(state.seed,receiptId,fact.event.definitionId,createG23Progress(state.seed).sponsored);
}
export function academicItems(state:Pick<MatchState,'augments'|'resourceProvenance'>,items:readonly ItemInstance[],fact:ResourceProvenanceEntry):readonly ItemInstance[] {
  return fact.kind==='item-combined'&&academicCraft(state,fact)?items.filter(i=>i.id!==fact.event.itemId):items;
}
export function convertAcademicCraft(state:MatchState):MatchState {
  const fact=state.resourceProvenance.entries.at(-1);
  return fact&&academicCraft(state,fact)?{...state,items:academicItems(state,state.items,fact)}:state;
}



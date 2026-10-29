import type { MatchState } from './match-types';
import type { AugmentGift } from './augment-gift-plan';
import { planAugmentGifts } from './augment-gift-plan';
import { UNIT_DEFINITIONS } from './units';
import { getMultiplayerRoundById } from './multiplayer-round';

/** Research augments-14.24.json[215]: a real 3-star upgrade, not ownership of a
 * 3-star unit, grants one 2-star copy. The ordered selection marker excludes
 * upgrades before acquisition even when both operations occur in the same round.
 * P-AG4 (P, 2026-10-24; research omits exact delivery ordering): pay on the
 * existing unlocked preparation/settlement drain, with solo escrow / online orbs. */
export function formSwapperGiftPlan(state:MatchState):AugmentGift[] {
 const a=state.augments.find(a=>a.definitionId==='why-not-both');if(!a)return [];
 const marker=state.resourceProvenance.entries.find(e=>e.kind==='form-swapper-selected'&&e.choiceId===a.choiceId);
 if(!marker)return [];
 return state.resourceProvenance.entries.flatMap(e=>{
  if(e.sequence<=marker.sequence)return [];
  const upgrades=e.kind==='unit-upgraded'||e.kind==='unit-upgraded-after-combat'?[e.event]
   :e.kind==='carousel-preparation-settled'||e.kind==='carousel-unit-claimed'?e.upgrades:[];
  return upgrades.flatMap((u,index)=>u.toStar===3&&UNIT_DEFINITIONS[u.definitionId]?.formSwap
   ?planAugmentGifts(state,{...a,choiceId:JSON.stringify([a.choiceId,'form-swapper-upgrade',e.sequence,index]),acquiredRound:getMultiplayerRoundById(e.roundId).ordinal},[{kind:'unit',definitionId:u.definitionId,starLevel:2}]):[]);
 });
}


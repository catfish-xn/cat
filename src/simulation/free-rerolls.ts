import { expectedUnexpectednessRerolls } from './augment-pool-batch5-g5';
import { twoMuchValueRerolls } from './augment-pool-batch5-h1-rerolls';
import { rerollTransferCredits } from './augment-pool-batch5-s1b';
import { batch5H9FreeRerolls } from './augment-pool-batch5-h9';
import { shopAugmentFreeRerolls } from './shop-augments';
import { batch5RerollsGranted } from './augment-pool-batch5-progress';
import { batch4RerollsGranted } from './augment-pool-batch4-b4reroll-progress';
import type { MatchState } from './match-types';
import { AUGMENT_BATCH3, batch3Count } from './content/augment-pool-batch3';
import { readSeatMechanic, writeSeatMechanic } from './seat-mechanics/state';
import { batch3XpFreeRerolls } from './augment-xp';
import { outcomeFreeRerolls } from './augment-pool-batch3-progress';
import { appendResourceProvenance } from './resource-provenance';

/** Owner-visible spend counter; credits themselves are always re-derived from owned augments and the round. */
export const FREE_REROLL_KEY='free-shop-rerolls';
export interface FreeRerollRecord {readonly used:number}

/** Credits accumulate and never expire. `perRound` counts every round ordinal from the acquisition round inclusive. */
export function freeRerollsGranted(state:MatchState):number {
 return expectedUnexpectednessRerolls(state)+batch5H9FreeRerolls(state)+twoMuchValueRerolls(state)+rerollTransferCredits(state)+batch5RerollsGranted(state)+shopAugmentFreeRerolls(state)+batch4RerollsGranted(state)+batch3XpFreeRerolls(state)+state.augments.reduce((sum,a)=>{
  const row=AUGMENT_BATCH3[a.definitionId],f=row?.freeRerolls;if(!f)return sum+outcomeFreeRerolls(state,a);
  return sum+(f.now?batch3Count(row,f.now):0)+(f.perRound?f.perRound*Math.max(0,state.round-a.acquiredRound+1):0);
 },0);
}
export function freeRerollsUsed(state:Pick<MatchState,'seatMechanics'>):number {
 return readSeatMechanic<{used:number}>(state,FREE_REROLL_KEY)?.used??0;
}
export function freeRerollsAvailable(state:MatchState):number {
 return freeRerollsGranted(state)-freeRerollsUsed(state);
}
/** Spends one credit when one is available; the caller then skips the gold cost. */
export function spendFreeReroll(state:MatchState):{readonly state:MatchState;readonly free:boolean} {
 if(freeRerollsAvailable(state)<=0)return {state,free:false};
 // Each spend is also a resource-provenance fact, so a save cannot drop or lower the counter (Codex review B3-V1).
 const spent={...state,resourceProvenance:appendResourceProvenance(state.resourceProvenance,state.roundDefinitionId,{kind:'free-reroll',generation:state.shop.generation})};
 return {state:writeSeatMechanic(spent,FREE_REROLL_KEY,{used:freeRerollsUsed(state)+1} satisfies FreeRerollRecord),free:true};
}


/** Stable allocation order for auditing an individual spend. Credits are identified by owner and ordinal;
 * Ticket's next hit is unavailable until AFTER the triggering reroll. */
export function freeRerollGrants(state:MatchState):readonly {choiceId:string;count:number}[] {
 return state.augments.map(a=>({choiceId:a.choiceId,count:freeRerollsGranted({...state,augments:[a]})}));
}

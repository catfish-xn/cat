import type { MatchState } from './match-types';
import { AUGMENT_BATCH3, batch3Count } from './content/augment-pool-batch3';
import { readSeatMechanic, writeSeatMechanic } from './seat-mechanics/state';
import { shopAugmentFreeRerolls } from './shop-augments';

/** Owner-visible spend counter; credits themselves are always re-derived from owned augments and the round. */
export const FREE_REROLL_KEY='free-shop-rerolls';
interface FreeRerollRecord {readonly used:number}

/** Credits accumulate and never expire. `perRound` counts every round ordinal from the acquisition round inclusive. */
export function freeRerollsGranted(state:Pick<MatchState,'augments'|'round'|'seatMechanics'>):number {
 return shopAugmentFreeRerolls(state)+state.augments.reduce((sum,a)=>{
  const row=AUGMENT_BATCH3[a.definitionId],f=row?.freeRerolls;if(!f)return sum;
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
 return {state:writeSeatMechanic(state,FREE_REROLL_KEY,{used:freeRerollsUsed(state)+1} satisfies FreeRerollRecord),free:true};
}
export function validateFreeRerolls(state:MatchState):void {
 const record=state.seatMechanics?.seat[FREE_REROLL_KEY];
 if(record===undefined)return;
 const r=record as unknown as FreeRerollRecord;
 if(!r||typeof r!=='object'||Array.isArray(r)||Object.keys(r).join(',')!=='used'||!Number.isSafeInteger(r.used)||r.used<1||r.used>freeRerollsGranted(state))
  throw new RangeError('Invalid free shop reroll ledger');
}

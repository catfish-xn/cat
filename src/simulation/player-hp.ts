import type { MatchState } from './match-types';
import { batch2Values } from './content/augment-pool-batch2';
import { applyLevelUpHealth } from './augment-xp';
import { batch2HpAfterSettlement } from './augment-pool-batch2-health';

/** HP the rules may add in one transition with no settlement inside it (a seat command, a round entry): Crimson Pact
 * for each new skipped black-market choice receipt (g2-3-runtime), then Upward Mobility for each level gained. The room's
 * HP ledger accepts a change only when it equals this. */
export function explainedHp(before:MatchState,after:MatchState):number {
 let hp=before.playerHp;
 const pact=after.augments.find(a=>a.definitionId==='crimson-pact');
 if(pact)for(const r of (after.seatMechanics?.receipts??[]).slice(before.seatMechanics?.receipts.length??0))
  if(r.kind==='choice'&&r.choiceKind==='blackMarket'&&r.source==='black-market'&&r.skipped&&r.round>=pact.acquiredRound)hp=Math.min(100,hp+batch2Values('crimson-pact').Heal);
 return applyLevelUpHealth(before,{...after,playerHp:hp}).playerHp;
}
/** A seat the rules already settled for `round`: HP after `damageHp` plus the settlement's and every later explained heal. */
export function liveHpAfterSettlement(state:MatchState,round:number,damageHp:number):number {
 const record=state.roundResults.find(r=>r.round===round);if(!record)return damageHp;
 const hp=batch2HpAfterSettlement(state,round,damageHp);
 return applyLevelUpHealth({level:record.levelAfter},{...state,playerHp:hp}).playerHp;
}

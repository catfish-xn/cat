import type { MatchState } from './match-types';
import { readAugmentPlayerHealth, recordAugmentPlayerHealth, requireAugmentFacts } from './augment-history';
import { MATCH_RULES } from './match-rules';
import { DHAMPYR_RULES } from './content/augment-pool-batch5-h8';

const SOURCE = 'augment-batch5-h8-dhampyr';

/** Called after the room has committed both sides' damage and supplied authenticated history. */
export function applyDhampyrSettlement(state:MatchState):MatchState {
 const owner=state.augments.find(a=>a.definitionId==='dhampyr'&&a.acquiredRound<=state.round);
 if(!owner||state.playerHp<=0||state.multiplayer?.status==='eliminated')return state;
 const fact=requireAugmentFacts(state,'player-damage',state.round).at(-1)!;
 if(fact.mirror||fact.actualDamage===null)return state;
 const receiptId=JSON.stringify([SOURCE,owner.choiceId,fact.battleId]);
 const health=readAugmentPlayerHealth(state);
 if(health.some(f=>f.receiptId===receiptId))return state;
 const maxHp=health.at(-1)?.maxHpAfter??MATCH_RULES.initialHp;
 const hpAfter=Math.min(maxHp,state.playerHp+Math.floor(fact.actualDamage*DHAMPYR_RULES.playerHealBps/10000));
 if(hpAfter===state.playerHp)return state;
 return recordAugmentPlayerHealth({...state,playerHp:hpAfter},{kind:'player-health',choiceId:owner.choiceId,receiptId,
   hpBefore:state.playerHp,hpAfter,maxHpBefore:maxHp,maxHpAfter:maxHp});
}
/** The history fact contains the actual capped heal; the authority authenticates its battle and state. */
export function applyRecordedDhampyrHealing(state:MatchState,round:number,hp:number):number {
 const owner=state.augments.find(a=>a.definitionId==='dhampyr'&&a.acquiredRound<=round);
 if(!owner)return hp;
 const health=readAugmentPlayerHealth(state).filter(f=>f.round===round&&f.choiceId===owner.choiceId&&f.receiptId.startsWith(`["${SOURCE}",`));
 if(!health.length)return hp;
 return Math.min(health.at(-1)!.maxHpAfter,hp+health.reduce((sum,f)=>sum+f.hpAfter-f.hpBefore,0));
}

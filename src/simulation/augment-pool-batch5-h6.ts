import type { MatchState } from './match-types';
import { requireAugmentFacts } from './augment-history';
import { UNIT_DEFINITIONS } from './units';
import { grantMechanicGold } from './seat-mechanics/grants';
import { AUGMENT_BATCH5_H6 } from './content/augment-pool-batch5-h6';

export const SOURCE = 'augment-pool-batch5-h6';
/** Count players once, at the actual frozen PvP boundary. */
export function contestedAmount(state:MatchState, round:number):number {
 const rows=requireAugmentFacts(state,'pvp-roster',round);
 if(rows.length!==1)throw new RangeError('Invalid contested roster');
 const fact=rows[0], self=fact.seats.find(s=>s.seatId===fact.seatId);
 if(!self)throw new RangeError('Invalid contested seat');
 const bench=self.units.filter(u=>u.team==='player' && u.location.kind==='bench' && UNIT_DEFINITIONS[u.definitionId] && !UNIT_DEFINITIONS[u.definitionId].summon && UNIT_DEFINITIONS[u.definitionId].unitKind!=='neutral')
  .sort((a,b)=>(a.location.kind==='bench'?a.location.slot:0)-(b.location.kind==='bench'?b.location.slot:0));
 if(!bench.length)return 0;
 const count=fact.seats.filter(s=>s.seatId!==fact.seatId && s.alive && s.units.some(u=>u.team==='player' && u.location.kind==='board' && u.definitionId===bench[0].definitionId)).length;
 return Math.floor(count/AUGMENT_BATCH5_H6.contested.source.values.PlayerPerInstance)*AUGMENT_BATCH5_H6.contested.source.values.GoldPerInstance;
}
export function drainContestedGold(state:MatchState):MatchState {
 const owner=state.augments.find(a=>a.definitionId==='contested');
 if(!owner||!state.roundResults.some(r=>r.round===state.round&&r.roundKind==='pvp'))return state;
 const amount=contestedAmount(state,state.round);if(!amount)return state;
 const receiptId=JSON.stringify([SOURCE,owner.choiceId,state.round]);
 if(state.seatMechanics?.receipts.some(r=>r.receiptId===receiptId))return state;
 const result=grantMechanicGold(state,{receiptId,source:SOURCE,amount});if(!result.ok)throw new RangeError(result.reason);return result.state;
}


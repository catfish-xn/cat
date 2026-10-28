import type { MatchState } from './match-types';
import { grantMechanicGold } from './seat-mechanics/grants';
import { AUGMENT_BATCH5_H4 } from './content/augment-pool-batch5-h4';
export const SOURCE='augment-pool-batch5-h4-survivor';
export function survivorGoldPlan(state:MatchState) {
  const a=state.augments.find(a=>a.definitionId==='survivor');
  if(!a)return [];
  const facts=state.augmentHistory?.facts;
  if(!facts) throw new RangeError('Invalid survivor history');
  const acquisition=facts.find(f=>f.kind==='acquire'&&f.choiceId===a.choiceId);
  if(!acquisition)throw new RangeError('Invalid survivor acquisition');
  const table=facts.find(f=>f.kind==='table'&&f.sequence>acquisition.sequence&&(f.stage==='acquire'||f.stage==='settlement')
    && f.seats.some(s=>s.seatId===f.seatId&&s.alive)
    && f.seats.filter(s=>s.seatId!==f.seatId&&!s.alive).length>=AUGMENT_BATCH5_H4.survivor.values.PlayersDead);
  return table?[{receiptId:JSON.stringify([SOURCE,a.choiceId]),source:SOURCE,round:table.round,amount:AUGMENT_BATCH5_H4.survivor.values.Gold}]:[];
}
export function drainSurvivorGold(state:MatchState):MatchState {
  for(const p of survivorGoldPlan(state)) if(!state.seatMechanics?.receipts.some(r=>r.receiptId===p.receiptId)){
    if(p.round!==state.round)throw new RangeError('Invalid survivor missing payment');
    const result=grantMechanicGold(state,p);if(!result.ok)throw new RangeError(result.reason);state=result.state;
  }
  return state;
}


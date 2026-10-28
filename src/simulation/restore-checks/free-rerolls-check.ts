// 存档恢复专用校验。只随单人 application 动态加载，实时对局命令不引用这里。
import { batch5RerollsGranted } from '../augment-pool-batch5-progress';
import { FREE_REROLL_KEY, type FreeRerollRecord, freeRerollsGranted } from '../free-rerolls';
import type { MatchState } from '../match-types';
import { getMultiplayerRoundById } from '../multiplayer-round';

export function validateFreeRerolls(state:MatchState):void {
 const record=state.seatMechanics?.seat[FREE_REROLL_KEY];
 const spends=state.resourceProvenance.entries.filter(e=>e.kind==='free-reroll');
 if(spends.some(e=>(e as {generation:number}).generation>=state.shop.generation))throw new RangeError('Invalid free shop reroll ledger');
 for(const [index,spend] of spends.entries()){
  const atRound={...state,round:getMultiplayerRoundById(spend.roundId).ordinal};
  const credits=freeRerollsGranted(atRound)-batch5RerollsGranted(atRound)+batch5RerollsGranted({...atRound,resourceProvenance:{...state.resourceProvenance,entries:state.resourceProvenance.entries.slice(0,spend.sequence)}});
  if(index+1>credits)throw new RangeError('Invalid historical free shop reroll credit');
 }
 if(record===undefined){if(spends.length)throw new RangeError('Invalid free shop reroll ledger');return;}
 const r=record as unknown as FreeRerollRecord;
 if(!r||typeof r!=='object'||Array.isArray(r)||Object.keys(r).join(',')!=='used'||!Number.isSafeInteger(r.used)||r.used<1||r.used>freeRerollsGranted(state)||r.used!==spends.length)
  throw new RangeError('Invalid free shop reroll ledger');
}

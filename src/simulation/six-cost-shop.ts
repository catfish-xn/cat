import { OPENING_BATCH_A } from './content/opening-batch-a';
import { openingStage } from './opening-stage';
import { openingWords } from './opening-random';
import { openingEncounterId } from './opening-encounter';
import type { MatchState } from './match-types';

/** Display q, not the probability of the complete shop. */
export function sixCostOddsBps(round:number,level:number,viktor=false):number {
  if(!Number.isSafeInteger(round)||round<1||!Number.isSafeInteger(level)||level<1||level>10)throw new RangeError('Invalid six-cost shop context');
  const {stage,subround}=openingStage(round);
  if(stage<4)return 0;
  const step=subround-1-(subround>=5?1:0);
  const row=stage>=8?20:stage===4?(subround<6?0:1):2+(stage-5)*6+step;
  return OPENING_BATCH_A.sixCostQ[row][(viktor?2:0)+(level===10?1:0)];
}
export function sixCostSlotFromWords(qBps:number,hitWord:number,slotWord:number):number|null {
  const p=Math.min(10000,Math.max(0,5*qBps));
  return hitWord*10000<p*4294967296?Math.floor(slotWord*5/4294967296):null;
}
export interface SixCostShopContext {readonly seed:number;readonly seatId:string;readonly viktor:boolean}
export function sixCostShopContext(state:MatchState):SixCostShopContext {
  return {seed:state.augmentTierSeed,seatId:state.sharedPool?.seatId??(state.openingEncounter.mode==='shared'?state.openingEncounter.seatId:'solo'),viktor:openingEncounterId(state)==='viktors-vision'};
}
export function planSixCostShop(round:number,level:number,generation:number,context:SixCostShopContext):{slot:number|null;memberWord:number} {
  const [hit,slot,memberWord]=openingWords(context.seed,`seat/${context.seatId}/six-cost-shop/${generation}`,3);
  return {slot:sixCostSlotFromWords(sixCostOddsBps(round,level,context.viktor),hit,slot),memberWord};
}

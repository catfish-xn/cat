import { TEAMUP_IDS, V20_TRAITS, type TeamupId } from './content/v20-traits';
/** Exactly-once acquisition gifts: online heroes enqueue reward orbs; offline heroes retain capacity escrow. */
import type { MatchState } from './match-types';
import { drainAllD11Gifts } from './d11-fill';
import type { UnitLootPolicy } from './loot-runtime';
import { grantMechanicItem, grantMechanicUnit } from './seat-mechanics/grants';
import { SHOP_CATALOG_BY_COST } from './match-rules';
import { nextRandom } from './rng';
import { P2_ITEM_GRANTS, p2Values } from './content/s13-augments-p2';
import { UNIT_DEFINITIONS } from './units';
const SOURCE='s13-augments-p2';
interface Gift { readonly receiptId: string; readonly definitionId: string; readonly kind: 'item'|'unit'; readonly acquiredRound: number }
export function p2GiftPlan(state: Pick<MatchState,'seed'|'augments'|'multiplayer'>): Gift[] {
  const gifts: Gift[]=[];
  for(const augment of state.augments){
    if(augment.definitionId==='sisters')for(const [i,id] of ['vi','jinx'].entries())gifts.push({receiptId:JSON.stringify([SOURCE,augment.choiceId,'unit',i]),definitionId:id,kind:'unit',acquiredRound:augment.acquiredRound});
    if(TEAMUP_IDS.includes(augment.definitionId as TeamupId))for(const [i,id] of V20_TRAITS[augment.definitionId as TeamupId].partners.entries())gifts.push({receiptId:JSON.stringify([SOURCE,augment.choiceId,'unit',i]),definitionId:id,kind:'unit',acquiredRound:augment.acquiredRound});
    const item=P2_ITEM_GRANTS[augment.definitionId];
    if(item)for(let i=0;i<item.count;i++)gifts.push({receiptId:JSON.stringify([SOURCE,augment.choiceId,'item',i]),definitionId:item.id,kind:'item',acquiredRound:augment.acquiredRound});
    const id=augment.definitionId,v=p2Values(id);
    const count=id==='all-for-one-ii'?v.NumChampsToGrant:id==='pair-of-fours'?v.NumChampsToGrant:id==='trifecta-ii'?v.NumUnits:0;
    if(!count)continue;
    // Independent, source-bound lcg32 stream. Planning is repeatable even when the bench is full; no live stream is advanced.
    const namespace=`${SOURCE}/${state.multiplayer?.seatId??'solo'}/${augment.choiceId}`;
    let hash=0x811c9dc5;for(let i=0;i<namespace.length;i++)hash=Math.imul(hash^namespace.charCodeAt(i),0x01000193)>>>0;
    let rng=(state.seed^hash)>>>0;const pool=[...SHOP_CATALOG_BY_COST[v.Tier as 1|3|4]].sort();
    for(let i=0;i<count;i++){
      const draw=nextRandom(rng);rng=draw.state;
      gifts.push({receiptId:JSON.stringify([SOURCE,augment.choiceId,'unit',i]),definitionId:pool[Math.floor(draw.word*pool.length/4294967296)],kind:'unit',acquiredRound:augment.acquiredRound});
    }
  }
  return gifts;
}
export function drainP2Gifts(initial: MatchState, policy?: UnitLootPolicy): MatchState {
  let state=initial;
  const gifts=p2GiftPlan(state);
  // Each successful pass adds a receipt; later merges can unblock an earlier gift.
  let progressed:boolean;
  do {
    progressed=false;
    for(const gift of gifts){
      if(state.seatMechanics?.receipts.some(r=>r.receiptId===gift.receiptId))continue;
      const request={...gift,source:SOURCE};
      const result=gift.kind==='item'?grantMechanicItem(state,request):grantMechanicUnit(state,request,policy);
      if(result.ok){state=result.state;progressed=true;}
      else if(result.reason!=='bench-full')throw new RangeError(`P2 grant: ${result.reason}`);
    }
  } while(progressed);
  return drainAllD11Gifts(state,policy);
}
/** No candidate receipt selects its own reward, cost or acquisition authority. */
export function validateP2Gifts(state: MatchState): void {
  const gifts=p2GiftPlan(state),receipts=state.seatMechanics?.receipts??[];
  for(const r of receipts)if(r.source===SOURCE||r.receiptId.startsWith('["s13-augments-p2",')){
    const gift=gifts.find(g=>g.receiptId===r.receiptId);
    if(!gift||r.source!==SOURCE||r.kind!==gift.kind||r.definitionId!==gift.definitionId||r.round<gift.acquiredRound||r.round>state.round
      ||r.kind==='unit'&&(r.resolution==='gold'?r.gold!==UNIT_DEFINITIONS[r.definitionId].cost:r.gold!==0))throw new RangeError('Invalid S13 P2 gift authority');
  }
  for(const gift of gifts)if(gift.kind==='item'&&!receipts.some(r=>r.receiptId===gift.receiptId))throw new RangeError('Missing S13 P2 item gift');
}

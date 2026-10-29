import { appendAugmentFact, requireAugmentFacts, historySeatId, historyCheck } from './augment-history';
import { transformH13Item } from './augment-pool-batch5-h13-transforms';
import { salvageRecipe } from './augment-pool-batch5-h13-salvage';
import { ITEM_DEFINITIONS } from './content/items';
import { G24_FORGE_POOLS } from './content/g2-4-forges';
import { nextRandom } from './rng';
import type { MatchState } from './match-types';

/** One explicit LCG word per eligible instance, source/seat/round/instance bound; equal with replacement. */
export function h13ItemDraw(s:MatchState,choiceId:string,itemId:string,pool:readonly string[]):string {
  historyCheck(pool.length>0,'empty inventory transform pool');
  const namespace=JSON.stringify(['batch5-h13',historySeatId(s),choiceId,s.round,itemId]);
  let hash=0x811c9dc5;for(let i=0;i<namespace.length;i++)hash=Math.imul(hash^namespace.charCodeAt(i),0x01000193)>>>0;
  return pool[Math.floor(nextRandom((s.seed^hash)>>>0).word*pool.length/4294967296)];
}
/** Permanent inventory items only; the ordinary catalogue deliberately excludes special classes. */
export function h13RoundItemPool(augmentId:string,definitionId:string):readonly string[]|null {
  if(augmentId==='artifactory')return salvageRecipe(definitionId)?G24_FORGE_POOLS.TFT_ArmoryKeyOrnn:null;
  if(augmentId!=='pandoras-items-iii')return null;
  if(ITEM_DEFINITIONS[definitionId]?.kind==='component')return G24_FORGE_POOLS.TFT_ArmoryKeyComponent;
  return salvageRecipe(definitionId)?G24_FORGE_POOLS.TFT_ArmoryKeyCompleted:null;
}
/** The pre-grant round-entry snapshot is authoritative; acquisition itself never rerolls existing items. */
export function enterH13ItemRound(initial:MatchState):MatchState {
  let s=initial;
  for(const a of s.augments.filter(a=>(a.definitionId==='artifactory'||a.definitionId==='pandoras-items-iii')&&a.acquiredRound<s.round)){
    if(s.augmentHistory?.facts.some(f=>f.kind==='inventory-transform-entry'&&f.choiceId===a.choiceId&&f.round===s.round))continue;
    const snapshot=requireAugmentFacts(s,'round-entry',s.round)[0].roster;
    const items=snapshot.items.filter(i=>i.location.kind==='inventory'&&h13RoundItemPool(a.definitionId,i.definitionId)).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
    for(const item of items){
      const pool=h13RoundItemPool(a.definitionId,item.definitionId)!;
      s=transformH13Item(s,a.choiceId,item,[h13ItemDraw(s,a.choiceId,item.id,pool)]);
    }
    s=appendAugmentFact(s,{kind:'inventory-transform-entry',choiceId:a.choiceId,itemIds:items.map(i=>i.id)});
  }
  return s;
}

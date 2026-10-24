import { EMBLEM_ITEMS } from './content/emblems';
import type { MatchState } from './match-types';
import type { OwnedAugment } from './strategy-types';
import { createG23Progress } from './g2-3-match-progress';
import { nextRandom } from './rng';
import { G24_FORGE_POOLS } from './content/g2-4-forges';
import { SHOP_CATALOG_BY_COST } from './match-rules';

export type AugmentGiftSpec =
  | {readonly kind:'item'|'unit'|'consumable'; readonly definitionId:string; readonly count?:number; readonly starLevel?:1|2|3}
  | {readonly kind:'random-item'; readonly pool:'component'|'completed'|'support'|'sponsored'|'emblem'; readonly count:number; readonly identical?:boolean}
  | {readonly kind:'random-unit-pool';readonly definitions:readonly string[];readonly count:number}
  | {readonly kind:'random-unit'; readonly cost:1|2|3|4|5; readonly count:number; readonly starLevel?:1|2|3}
  | {readonly kind:'all-units'; readonly cost:1|2|3|4|5};
export interface AugmentGift {
  readonly receiptId:string; readonly kind:'item'|'unit'|'consumable'; readonly definitionId:string;
  readonly acquiredRound:number; readonly starLevel?:1|2|3;
}
export const AUGMENT_GIFT_SOURCE='augment-pool-batch1';
/** Pure, source/seat/choice-bound stream; retry, restore and opening order never advance live RNG.
 * Random unit/item draws use the existing uniform sorted pools, with replacement.
 * Each spec owns a substream, so adding an item cannot change a hero draw. */
export function planAugmentGifts(state:Pick<MatchState,'seed'|'multiplayer'>, a:OwnedAugment, specs:readonly AugmentGiftSpec[]):AugmentGift[] {
  return specs.flatMap((spec,index)=>{
    const namespace=JSON.stringify([AUGMENT_GIFT_SOURCE,state.multiplayer?.seatId??'solo',a.choiceId,a.definitionId,index]);
    let hash=0x811c9dc5; for(let i=0;i<namespace.length;i++)hash=Math.imul(hash^namespace.charCodeAt(i),0x01000193)>>>0;
    let rng=(state.seed^hash)>>>0;
    const pool=spec.kind==='random-item' ? (spec.pool==='emblem'?Object.keys(EMBLEM_ITEMS).sort():spec.pool==='sponsored'?[...createG23Progress(state.seed).sponsored].sort():G24_FORGE_POOLS[spec.pool==='support'?'TFT_ArmoryKeySupport':spec.pool==='completed'?'TFT_ArmoryKeyCompleted':'TFT_ArmoryKeyComponent'])
      :spec.kind==='random-unit-pool'?[...spec.definitions].sort():spec.kind==='random-unit'||spec.kind==='all-units' ? [...SHOP_CATALOG_BY_COST[spec.cost]].sort() : null;
    const count=spec.kind==='all-units'?pool!.length:spec.count??1;
    let first:string|undefined;
    return Array.from({length:count},(_,copy)=>{
      let definitionId:string;
      if(spec.kind==='all-units')definitionId=pool![copy];
      else if(pool){
        const draw=nextRandom(rng);rng=draw.state;
        const pick=pool[Math.floor(draw.word*pool.length/4294967296)];
        definitionId=spec.kind==='random-item'&&spec.identical?(first??=pick):pick;
      }else definitionId=(spec as {definitionId:string}).definitionId;
      return {receiptId:JSON.stringify([AUGMENT_GIFT_SOURCE,a.choiceId,a.definitionId,index,copy]),
        kind:spec.kind==='random-item'?'item':spec.kind==='random-unit'||spec.kind==='random-unit-pool'||spec.kind==='all-units'?'unit':spec.kind,
        definitionId,acquiredRound:a.acquiredRound,...('starLevel' in spec?{starLevel:spec.starLevel}:{})};
    });
  });
}
/** All four existing bench anvil categories; no pending-choice queue or hidden inventory copy. */
export function augmentAnvilOffers(seed:number,receiptId:string,definitionId:keyof typeof G24_FORGE_POOLS):readonly string[] {
  const pool=[...G24_FORGE_POOLS[definitionId]];
  let rng=(seed^0x61323366)>>>0;
  for(let i=0;i<receiptId.length;i++)rng=Math.imul(rng^receiptId.charCodeAt(i),16777619)>>>0;
  for(let i=0;i<4;i++){const draw=nextRandom(rng);rng=draw.state;const j=i+Math.floor(draw.word*(pool.length-i)/4294967296);[pool[i],pool[j]]=[pool[j],pool[i]];}
  return pool.slice(0,4);
}

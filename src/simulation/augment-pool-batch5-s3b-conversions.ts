import { validSalvageConversion } from './augment-pool-batch5-s3b-salvage';
import type { MatchState } from './match-types';
import type { ItemInstance } from './strategy-types';
import { G24_FORGE_POOLS } from './content/g2-4-forges';
import { nextRandom } from './rng';
import { appendResourceProvenance, type ResourceFact } from './resource-provenance';
import { getMultiplayerRoundById } from './multiplayer-round';

export type S3bConversion = Extract<ResourceFact,{kind:'g23-item-converted'}>;
export const isS3bConversion = (fact:ResourceFact):boolean => fact.kind==='g23-item-converted'&&fact.receiptId.startsWith('["augment-pool-batch5-s3b",');
/** A private item/round stream leaves the shop, battle and loot RNG untouched. */
export function pandoraItem(seed:number,receiptId:string,from:string):string {
  const pool=G24_FORGE_POOLS.TFT_ArmoryKeyComponent.includes(from)?G24_FORGE_POOLS.TFT_ArmoryKeyComponent
    :G24_FORGE_POOLS.TFT_ArmoryKeyCompleted.includes(from)?G24_FORGE_POOLS.TFT_ArmoryKeyCompleted:undefined;
  if(!pool)throw new RangeError('Invalid Pandora item category');
  let hash=0x811c9dc5;for(let i=0;i<receiptId.length;i++)hash=Math.imul(hash^receiptId.charCodeAt(i),16777619)>>>0;
  return pool[Math.floor(nextRandom((seed^hash)>>>0).word*pool.length/4294967296)];
}
export function pandoraConversions(state:Pick<MatchState,'seed'|'augments'>,items:readonly ItemInstance[],round:number):S3bConversion[] {
  const owner=state.augments.find(a=>a.definitionId==='pandoras-items-ii'&&a.acquiredRound<round);
  if(!owner)return [];
  return items.filter(i=>i.location.kind==='inventory'&&(G24_FORGE_POOLS.TFT_ArmoryKeyComponent.includes(i.definitionId)||G24_FORGE_POOLS.TFT_ArmoryKeyCompleted.includes(i.definitionId)))
    .sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0).map(i=>{
      const receiptId=JSON.stringify(['augment-pool-batch5-s3b',owner.choiceId,'pandora',round,i.id]);
      return {kind:'g23-item-converted',itemId:i.id,from:i.definitionId,to:pandoraItem(state.seed,receiptId,i.definitionId),receiptId};
    });
}
export function pandoraRoundEntry(state:MatchState,round:number,roundId:string):MatchState {
  const facts=pandoraConversions(state,state.items,round);if(!facts.length)return state;
  return {...state,items:facts.reduce((items,f)=>items.map(i=>i.id===f.itemId?{...i,definitionId:f.to}:i),state.items),
    resourceProvenance:appendResourceProvenance(state.resourceProvenance,roundId,facts)};
}
/** Identity/category precheck; full replay below additionally proves inventory,
 * the round-entry boundary, complete coverage and order (including no-op rolls). */
export function validS3bConversion(state:Pick<MatchState,'seed'|'augments'|'resourceProvenance'>,fact:S3bConversion,roundId:string):boolean {
  if(!isS3bConversion(fact))return false;
  if(validSalvageConversion(state,fact,roundId))return true;
  const round=getMultiplayerRoundById(roundId).ordinal;
  const owner=state.augments.find(a=>a.definitionId==='pandoras-items-ii'&&a.acquiredRound<round);
  return !!owner&&fact.receiptId===JSON.stringify(['augment-pool-batch5-s3b',owner.choiceId,'pandora',round,fact.itemId])
    &&pandoraItem(state.seed,fact.receiptId,fact.from)===fact.to;
}

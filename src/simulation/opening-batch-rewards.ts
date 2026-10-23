import { OPENING_BATCH_A as P } from './content/opening-batch-a';
import { G24_FORGE_POOLS, resolveG24ForgePool } from './content/g2-4-forges';
import { UNIT_DEFINITIONS } from './units';
import { SHOP_CATALOG_BY_COST } from './match-rules';
import { openingWords, openingWeightedIndex } from './opening-random';
import { openingStage } from './opening-stage';
import { getMultiplayerRoundByOrdinal, getMultiplayerRoundById } from './multiplayer-round';
import { canonicalContent } from './content';
import { grantMechanicGold, grantMechanicItem, grantMechanicUnit } from './seat-mechanics/grants';
import { appendMechanicReceipt } from './seat-mechanics/state';
import { openMechanicChoice } from './seat-mechanics/choices';
import type { MatchState, MatchEvent, MatchCommandResult } from './match-types';
import type { OpeningEffectFact, OpeningEffectReceipt } from './opening-encounter';
import type { LootPayload } from './m8/contracts';
import type { UnitLootPolicy } from './loot-runtime';
import type { FrozenDirectDrop } from './loot-types';
import type { CostTier } from './unit-types';

export const BATCH_SOURCE='opening-encounter-batch-a';
const prefix='opening-reward:';
function instance(seed:number):string {
  let hash=0x811c9dc5;const name=`opening-instance/${seed}`;
  for(let i=0;i<name.length;i++)hash=Math.imul(hash^name.charCodeAt(i),0x01000193)>>>0;
  return hash.toString(16).padStart(8,'0');
}
export const batchEncounter=(id:string)=>['mels-blessing','gold-subscription','loot-subscription'].includes(id);
export function melBranch(seed:number):number {
  return P.melBranches[openingWeightedIndex(openingWords(seed,'shared/mels-blessing/outcome',1)[0],P.melWeights)];
}
export function subscriptionBucket(seed:number,id:string,stage:number):number {
  return openingWeightedIndex(openingWords(seed,`shared/${id}/stage/${stage}`,1)[0],id==='gold-subscription'?P.goldWeights:P.lootWeights);
}
export function subscriptionGold(stage:number,bucket:number):number {
  if(!Number.isSafeInteger(stage)||stage<2||!Number.isInteger(bucket)||bucket<0||bucket>5||bucket===4)throw new RangeError('Invalid subscription gold');
  return bucket===0?Math.floor(stage/2):stage*P.goldMultipliers[bucket];
}
export function subscriptionFact(seed:number,id:string,round:number):OpeningEffectFact|null {
  const {stage,subround}=openingStage(round);
  if(!['gold-subscription','loot-subscription'].includes(id)||stage<2||subround!==1)return null;
  const bucket=subscriptionBucket(seed,id,stage),nodeId=getMultiplayerRoundByOrdinal(round).roundId;
  const effectKey=`${id}/stage/${stage}/${bucket}`;
  return {factId:JSON.stringify(['opening-batch-a',instance(seed),id,effectKey,nodeId]),effectKey,nodeId};
}
export function subscriptionReceipts(state:MatchState):OpeningEffectReceipt[] {
  const o=state.openingEncounter;if(o.mode==='shared-deferred')return [];
  const id=o.mode==='solo'?o.context.selection.encounterId:o.selection.encounterId,seatId=o.mode==='solo'?'solo':o.seatId;
  const receipts:OpeningEffectReceipt[]=[];
  for(let round=1;round<=state.round;round++){
    const f=subscriptionFact(state.augmentTierSeed,id,round);
    if(f)receipts.push({receiptId:JSON.stringify(['opening-receipt',f.factId,seatId]),factId:f.factId,seatId,nodeId:f.nodeId});
  }
  return receipts;
}
interface Atom {readonly id:string;readonly round:number;readonly payload:LootPayload}
export function openingRewardAtoms(state:MatchState):Atom[] {
  const o=state.openingEncounter;if(o.mode==='shared-deferred')return [];
  const id=o.mode==='solo'?o.context.selection.encounterId:o.selection.encounterId;
  if(!batchEncounter(id))return [];
  const atoms:Atom[]=[];
  for(const receipt of o.receipts){
    const round=id==='mels-blessing'?(receipt as {round?:number}).round!:getRound(receipt.nodeId);
    const {stage}=openingStage(round),payloads:LootPayload[]=[];
    const word=openingWords(state.augmentTierSeed,`seat/${receipt.seatId}/${id}/${id==='mels-blessing'?'reward':`stage/${stage}`}`,12);
    let cursor=0;
    const item=(definitionId:string,count=1)=>{for(let i=0;i<count;i++)payloads.push({kind:'item',definitionId,quantity:1});};
    const components=(n:number)=>{for(let i=0;i<n;i++)item(G24_FORGE_POOLS.TFT_ArmoryKeyComponent[Math.floor(word[cursor++]*8/4294967296)]);};
    const gold=(quantity:number)=>payloads.push({kind:'gold',quantity});
    const tool=(definitionId:'reforger'|'TFT_Consumable_NeekosHelp',n=1)=>{for(let i=0;i<n;i++)payloads.push({kind:'consumable',definitionId,quantity:1});};
    const forge=(definitionId:Extract<LootPayload,{kind:'forge'}>['definitionId'],n=1)=>{for(let i=0;i<n;i++)payloads.push({kind:'forge',definitionId,quantity:1});};
    const unit=(cost:number,starLevel:1|2)=>{const pool=SHOP_CATALOG_BY_COST[cost as CostTier];payloads.push({kind:'unit',definitionId:pool[Math.floor(word[cursor++]*pool.length/4294967296)],quantity:1,starLevel});};
    if(id==='gold-subscription')gold(subscriptionGold(stage,subscriptionBucket(state.augmentTierSeed,id,stage)));
    else if(id==='loot-subscription')switch(subscriptionBucket(state.augmentTierSeed,id,stage)){
      case 0:break;case 1:item('spatula');break;case 2:gold(subscriptionGold(stage,3));break;
      case 3:forge('TFT_ArmoryKeySupport');break;case 4:forge('TFT_ArmoryKeyOrnn');break;
      case 5:unit(Math.min(5,Math.max(1,stage-1)),2);break;case 6:components(1);break;
      case 7:tool('reforger');break;case 8:item('TFT_Item_ForceOfNature');break;
    }
    else switch(melBranch(state.augmentTierSeed)){
      case 1:gold(30);break;
      case 2:tool('TFT_Consumable_NeekosHelp');components(2);item('spatula');break;
      case 4:components(4);tool('reforger');break;
      case 5:item('TFT_Item_ForceOfNature');break;
      case 6:components(2);item('spatula');tool('reforger');gold(10);break;
      case 7:item('thiefs-gloves',2);break;
      case 8:components(2);unit(5,1);break;
      case 9:forge('TFT_ArmoryKeyComponent',2);item('spatula');item('frying-pan');break;
      case 10:components(2);item('frying-pan');tool('reforger');gold(10);break;
      case 11:gold(50);break;case 12:item('TFT_Item_ForceOfNature',2);break;
      case 13:gold(20);tool('TFT_Consumable_NeekosHelp',2);break;case 14:components(8);break;
    }
    payloads.forEach((payload,i)=>atoms.push({id:prefix+JSON.stringify([receipt.receiptId,i]),round,payload}));
  }
  return atoms;
}
const getRound=(nodeId:string)=>getMultiplayerRoundById(nodeId).ordinal;
const claimed=(state:MatchState,id:string)=>state.seatMechanics?.receipts.find(r=>r.receiptId===id);
export function openingRewardOffers(state:MatchState,atom:Atom):readonly string[] {
  if(atom.payload.kind!=='forge')throw new RangeError('Invalid opening forge');
  const pool=[...resolveG24ForgePool(atom.payload.definitionId)].sort();
  const seat=state.openingEncounter.mode==='shared'?state.openingEncounter.seatId:'solo';
  const words=openingWords(state.augmentTierSeed,`seat/${seat}/forge/${atom.id}`,4);
  for(let i=0;i<4;i++){const j=i+Math.floor(words[i]*(pool.length-i)/4294967296);[pool[i],pool[j]]=[pool[j],pool[i]];}
  return pool.slice(0,4);
}
function grantAtom(state:MatchState,atom:Atom,policy?:UnitLootPolicy):MatchCommandResult {
  const p=atom.payload,request={receiptId:atom.id,source:BATCH_SOURCE};
  if(claimed(state,atom.id))return {ok:true,state,events:[]};
  if(p.kind==='forge'){
    if(state.pendingChoice||!['preparation','settlement'].includes(state.phase)||state.m8.round.kind==='supply')return {ok:true,state,events:[]};
    const offers=openingRewardOffers(state,atom);
    return openMechanicChoice(state,{choiceId:atom.id,offers,returnPhase:state.phase as 'preparation'|'settlement',payload:{kind:'forge',source:BATCH_SOURCE,timeoutOption:offers[0]}});
  }
  if(p.kind==='item')return grantMechanicItem(state,{...request,definitionId:p.definitionId});
  if(p.kind==='gold')return grantMechanicGold(state,{...request,amount:p.quantity});
  if(p.kind==='unit'){
    const result=grantMechanicUnit(state,{...request,definitionId:p.definitionId,starLevel:p.starLevel??1,immediate:true},policy);
    return !result.ok&&result.reason==='bench-full'?{ok:true,state,events:[]}:result;
  }
  if(p.kind==='consumable'){
    const consumableId=`consumable-${state.nextConsumableSerial}`;
    if(!Number.isSafeInteger(state.nextConsumableSerial+1))throw new RangeError('Invalid opening tool serial');
    const receipt={...request,kind:'consumable' as const,round:state.round,roundId:state.roundDefinitionId,consumableId,definitionId:p.definitionId};
    return {ok:true,state:appendMechanicReceipt({...state,nextConsumableSerial:state.nextConsumableSerial+1,consumables:[...state.consumables,{consumableId,definitionId:p.definitionId}]},receipt),events:[{type:'mechanicGranted',receipt}]};
  }
  throw new RangeError('Invalid opening reward');
}
/** Automatic immediate grants; deferred item/unit/forge entitlements remain projected as pickup orbs. */
export function grantOpeningRewards(initial:MatchState):{state:MatchState;events:MatchEvent[]} {
  let state=initial;const events:MatchEvent[]=[];
  for(const atom of openingRewardAtoms(state)){
    if(claimed(state,atom.id)||atom.payload.kind==='item'||atom.payload.kind==='forge'||atom.payload.kind==='unit'&&state.multiplayer)continue;
    const r=grantAtom(state,atom);if(!r.ok)throw new RangeError(r.reason);state=r.state;events.push(...r.events);
  }
  return {state,events};
}
export function openingRewardOrbs(state:MatchState){
  return openingRewardAtoms(state).filter(a=>!claimed(state,a.id)).map(a=>{
    const roundId=getMultiplayerRoundByOrdinal(a.round).roundId;
    const entry:FrozenDirectDrop={orbId:a.id,entryOrdinal:0,dropId:a.id,roundId,encounterId:BATCH_SOURCE,sourceUnitId:a.id,slotOrdinal:0,status:'planned',receiptId:null,revealCondition:'source-killed',payload:a.payload};
    return {orbId:a.id,roundId,tier:'gray' as const,source:'mechanic' as const,entries:[entry]};
  });
}
export const isOpeningRewardOrb=(id:string)=>id.startsWith(prefix);
export function claimOpeningReward(state:MatchState,id:string,policy?:UnitLootPolicy):import('./round-settlement').MultiplayerCommandResult {
  const atom=openingRewardAtoms(state).find(a=>a.id===id);
  if(!atom)return {ok:false,state,reason:'unknown-orb'};
  if(claimed(state,id))return {ok:false,state,reason:'already-claimed'};
  return grantAtom(state,atom,policy);
}
export function openBatchForge(state:MatchState):{state:MatchState;events:readonly MatchEvent[]} {
  if(state.playerHp<=0||state.multiplayer?.status==='eliminated')return {state,events:[]};
  const atom=openingRewardAtoms(state).find(a=>a.payload.kind==='forge'&&!claimed(state,a.id));
  if(!atom)return {state,events:[]};
  const r=grantAtom(state,atom);if(!r.ok)throw new RangeError(r.reason);return r;
}
export function validateOpeningRewards(state:MatchState):void {
  const check=(v:unknown)=>{if(!v)throw new RangeError('Invalid opening reward ledger');};
  const atoms=openingRewardAtoms(state),grants=(state.seatMechanics?.receipts??[]).filter(r=>r.source===BATCH_SOURCE||isOpeningRewardOrb(r.receiptId));
  check(new Set(grants.map(r=>r.receiptId)).size===grants.length);
  for(const r of grants){
    const a=atoms.find(a=>a.id===r.receiptId);check(a&&r.source===BATCH_SOURCE&&r.round>=a.round&&r.round<=state.round&&r.roundId===getMultiplayerRoundByOrdinal(r.round).roundId);if(!a)continue;
    const p=a.payload;
    if(p.kind==='gold')check(r.kind==='gold'&&r.amount===p.quantity&&r.round===a.round);
    else if(p.kind==='forge'){const offers=openingRewardOffers(state,a);check(r.kind==='choice'&&r.choiceKind==='forge'&&!r.skipped&&r.price===0&&offers.includes(r.optionId)&&(!r.timedOut||r.optionId===offers[0]));}
    else check(r.kind===p.kind&&'definitionId' in r&&r.definitionId===p.definitionId);
    if(p.kind==='unit'){
      check(r.kind==='unit'&&(r.starLevel??1)===(p.starLevel??1)&&['held','gold'].includes(r.resolution));
      if(r.kind==='unit')check(r.resolution==='gold'?!!state.multiplayer&&r.unitId===null&&r.gold===UNIT_DEFINITIONS[p.definitionId].cost
        :r.gold===0&&state.resourceProvenance.entries.some(e=>e.kind==='unit-acquired'&&e.unitId===r.unitId&&e.source.kind==='mechanic'&&e.source.receiptId===r.receiptId));
    }
    if(r.kind==='item'||r.kind==='choice')check(state.resourceProvenance.entries.some(e=>e.kind==='item-acquired'&&e.itemId===r.itemId&&e.source.kind==='mechanic'&&e.source.receiptId===r.receiptId));
  }
  for(const a of atoms)if(a.payload.kind==='gold'||a.payload.kind==='consumable')check(claimed(state,a.id));
  const c=state.pendingChoice;
  if(c&&(c.payload?.source===BATCH_SOURCE||isOpeningRewardOrb(c.choiceId))){
    const a=atoms.find(a=>a.id===c.choiceId);check(a?.payload.kind==='forge'&&!claimed(state,c.choiceId));
    if(a){const offers=openingRewardOffers(state,a);check(c.kind==='forge'&&canonicalContent(c.offers)===canonicalContent(offers)&&c.payload?.source===BATCH_SOURCE&&c.payload.timeoutOption===offers[0]);}
  }
}

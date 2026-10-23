import { grantAnvilUnit } from './anvils';
import { openingEncounterId } from './opening-encounter';
import { isCrabEncounter, GIANT_CRAB_ANVILS, GIANT_CRAB_SILVER_BOXES, GIANT_CRAB_FROM_STAGE } from './content/opening-batch-b';
import { ORB_BOXES } from './content/loot';
import { G24_FORGE_POOLS } from './content/g2-4-forges';
import { COMPONENT_POOL } from './component-pool';
import { SHOP_CATALOG_BY_COST } from './match-rules';
import { openingSeatDraw, weightedOpeningIndex } from './opening-batch-b-rng';
import { warwickLoot } from './opening-warwick';
import { readG23EconomyReceipts } from './g2-3-state';
import { grantMechanicGold, grantMechanicItem, grantMechanicUnit } from './seat-mechanics/grants';
import { appendMechanicReceipt } from './seat-mechanics/state';
import type { G23BattleFacts } from './g2-3-economy';
import type { MatchState, MatchEvent, MatchCommandResult } from './match-types';
import type { LootPayload } from './m8/contracts';
import type { FrozenDirectDrop } from './loot-types';
import type { UnitLootPolicy } from './loot-runtime';
const source='opening-batch-b';
export interface OpeningReward {readonly id:string;readonly round:number;readonly roundId:string;readonly payload:LootPayload;readonly tier:'gray'|'blue'|'gold'}
/** Existing box rows, sampled only on the encounter seat stream. No orb RNG is consumed. */
export function openingBox(draw:()=>number,kind:'gold'|'silver'):readonly LootPayload[] {
 const rows=ORB_BOXES[kind],row=rows[weightedOpeningIndex(draw(),rows.map(r=>r.weight*100))];
 return row.rewards.map(a=>{if(a.kind!=='hero')return a;const pool=SHOP_CATALOG_BY_COST[a.cost];return {kind:'unit',definitionId:pool[Math.floor(draw()*pool.length/4294967296)],quantity:1,...(a.starLevel?{starLevel:a.starLevel}:{})};});
}
export function openingBattleRewards(state:MatchState,facts:G23BattleFacts):readonly OpeningReward[] {
 const encounter=openingEncounterId(state),record=state.roundResults.find(r=>r.round===facts.round);
 if(!record||!facts.openingDeaths)return [];
 const seat=state.sharedPool?.seatId??'solo',out:OpeningReward[]=[];
 const add=(key:string,payloads:readonly LootPayload[],tier:OpeningReward['tier']='gray')=>payloads.forEach((payload,i)=>out.push({id:`opening-batch-b/${JSON.stringify([encounter,facts.battleId,key,i])}`,round:facts.round,roundId:record.roundId,payload,tier}));
 if(encounter==='warwicks-hunger'&&facts.roundKind==='pvp'){
  facts.openingDeaths.forEach(d=>add(d.victimId,warwickLoot(state.augmentTierSeed,seat,facts.battleId,d.victimId,record.levelBefore)));return out;
 }
 if(!isCrabEncounter(encounter)||facts.roundKind!=='pve')return [];
 const stage=Number(record.roundId.split('-')[0]);
 if(stage<=4)facts.openingDeaths.forEach(d=>add(d.victimId,[{kind:'gold',quantity:1}]));
 const draw=openingSeatDraw(state.augmentTierSeed,seat,`${encounter}/${record.roundId}/bonus`);
 // Approved extra budget is a round event, independent of win/loss; kill gold remains kill-gated.
 if(record.roundId==='2-7'||record.roundId==='3-7')add('component',[{kind:'item',definitionId:COMPONENT_POOL[Math.floor(draw()*COMPONENT_POOL.length/4294967296)].definitionId,quantity:1}],'blue');
 if(record.roundId==='4-7')add('gold-orb',openingBox(draw,'gold'),'gold');
 if(encounter==='crab-rave'&&stage>=GIANT_CRAB_FROM_STAGE&&facts.result==='win'){
  for(let i=0;i<GIANT_CRAB_ANVILS;i++)add(`anvil/${i}`,[{kind:'forge',definitionId:'TFT_ArmoryKeyCompleted',quantity:1}],'gold');
  for(let i=0;i<GIANT_CRAB_SILVER_BOXES;i++)add(`silver/${i}`,openingBox(draw,'silver'));
 }
 return out;
}
export function openingRewards(state:MatchState):readonly OpeningReward[]{
 if(!['warwicks-hunger','scuttle-puddle','crab-rave'].includes(openingEncounterId(state)??''))return [];
 return readG23EconomyReceipts(state).flatMap(r=>r.kind==='battle'?openingBattleRewards(state,r.facts):[]);
}
const claimed=(state:MatchState,id:string)=>state.seatMechanics?.receipts.some(r=>r.receiptId===id)??false;
export function openingRewardOffers(state:MatchState,reward:OpeningReward):readonly string[]{
 if(reward.payload.kind!=='forge')return [];
 const pool=[...G24_FORGE_POOLS[reward.payload.definitionId]].sort(),draw=openingSeatDraw(state.augmentTierSeed,state.sharedPool?.seatId??'solo',`${reward.id}/forge`);
 for(let i=0;i<4;i++){const j=i+Math.floor(draw()*(pool.length-i)/4294967296);[pool[i],pool[j]]=[pool[j],pool[i]];}return pool.slice(0,4);
}
function grant(state:MatchState,r:OpeningReward,policy?:UnitLootPolicy):MatchCommandResult{
 const p=r.payload,request={receiptId:r.id,source};
 if(claimed(state,r.id))return {ok:true,state,events:[]};
 if(p.kind==='forge')return grantAnvilUnit(state,{...request,definitionId:p.definitionId});
 if(p.kind==='consumable'){
  const consumableId=`consumable-${state.nextConsumableSerial}`,receipt={...request,kind:'consumable' as const,round:state.round,roundId:state.roundDefinitionId,definitionId:p.definitionId,consumableId};
  return {ok:true,state:appendMechanicReceipt({...state,nextConsumableSerial:state.nextConsumableSerial+1,consumables:[...state.consumables,{consumableId,definitionId:p.definitionId}]},receipt),events:[{type:'mechanicGranted',receipt}]};
 }
 const result=p.kind==='gold'?grantMechanicGold(state,{...request,amount:p.quantity}):p.kind==='item'?grantMechanicItem(state,{...request,definitionId:p.definitionId}):grantMechanicUnit(state,{...request,definitionId:p.definitionId,starLevel:p.starLevel??1,immediate:true},policy);
 return result.ok?result:{ok:false,state,reason:result.reason==='bench-full'?'bench-full':'invalid-opening-effect'};
}
export function settleOpeningBatchB(state:MatchState,facts:G23BattleFacts,policy?:UnitLootPolicy,events:MatchEvent[]=[]):MatchState{
 for(const r of openingBattleRewards(state,facts)){
  // Online unit allocations wait for a personal orb claim and the shared pool transaction.
  if(state.multiplayer&&r.payload.kind==='unit')continue;
  const g=grant(state,r,policy);if(g.ok){state=g.state;events.push(...g.events.filter(e=>e.type!=='mechanicGranted'));}else if(g.reason!=='bench-full')throw new RangeError(g.reason);
 }
 return state;
}
export function openingRewardOrbs(state:MatchState){
 return openingRewards(state).filter(r=>(r.payload.kind==='unit'||r.payload.kind==='forge')&&!claimed(state,r.id)).map(r=>({orbId:r.id,roundId:r.roundId,tier:r.tier,source:'mechanic' as const,entries:[{orbId:r.id,entryOrdinal:0,dropId:r.id,roundId:r.roundId,encounterId:source,sourceUnitId:r.id,slotOrdinal:0,status:'planned',receiptId:null,revealCondition:'source-killed',payload:r.payload} satisfies FrozenDirectDrop]}));
}
export function claimOpeningReward(state:MatchState,id:string,policy?:UnitLootPolicy):MatchCommandResult{
 const r=openingRewards(state).find(r=>r.id===id&&(r.payload.kind==='unit'||r.payload.kind==='forge'));if(!r)return {ok:false,state,reason:'invalid-opening-effect'};
 if(claimed(state,id))return {ok:true,state,events:[]};return grant(state,r,policy);
}
/** Authenticate all issued grants against the settled, replay-checked facts. Never grant on restore. */
export function validateBatchBRewards(state:MatchState):void{
 const check=(v:unknown)=>{if(!v)throw new RangeError('Invalid opening batch B reward');};
 const rewards=openingRewards(state),grants=state.seatMechanics?.receipts.filter(r=>r.source===source||r.receiptId.startsWith('opening-batch-b/['))??[];
 for(const g of grants){const r=rewards.find(r=>r.id===g.receiptId);check(r&&g.source===source&&g.round>=r.round&&g.round<=state.round);if(!r)continue;const p=r.payload;
  if(p.kind==='gold')check(g.kind==='gold'&&g.amount===p.quantity);
  if(p.kind==='item'||p.kind==='consumable'||p.kind==='unit')check(g.kind===p.kind&&g.definitionId===p.definitionId);
  if(p.kind==='unit'&&g.kind==='unit')check((g.starLevel??1)===(p.starLevel??1));
  if(p.kind==='forge')check(g.kind==='unit'&&g.definitionId===p.definitionId&&g.resolution==='held'&&g.gold===0);
 }
 for(const r of rewards)if(r.payload.kind!=='unit'&&r.payload.kind!=='forge')check(grants.some(g=>g.receiptId===r.id));
}

/** Owner-only grouping: 4-7 has one gold-orb bundle; each giant win has two silver bundles. */
export function readOpeningBatchBRewards(state:MatchState){
 const groups=new Map<string,{id:string;roundId:string;tier:OpeningReward['tier'];entries:{payload:LootPayload;claimed:boolean}[]}>();
 for(const r of openingRewards(state)){const key=JSON.parse(r.id.slice('opening-batch-b/'.length)) as (string|number)[];key.pop();const id=JSON.stringify(key);let group=groups.get(id);if(!group){group={id,roundId:r.roundId,tier:r.tier,entries:[]};groups.set(id,group);}group.entries.push({payload:r.payload,claimed:claimed(state,r.id)});}
 return [...groups.values()];
}

/** Legacy hooks: units persist; no automatic choice, including terminal rounds. */
export function openBatchBForge(state:MatchState):{state:MatchState;events:readonly MatchEvent[]}{return {state,events:[]};}
export const settleTerminalBatchBForges=openBatchBForge;

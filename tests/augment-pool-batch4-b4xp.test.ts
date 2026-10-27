import { expect, it } from 'vitest';
import { RESEARCH_FILE } from './augment-pool-source-expectations';
import { existsSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { createMatch, selectChoice, nextRound, startMatchCombat, stepMatch, buyUnit, rerollShop, lockMatchCombatRoster, equipItem, sellUnit } from '../src/simulation/match';
import type { MatchState, MatchEvent } from '../src/simulation/match-types';
import type { BattleRecord } from '../src/m6/contracts';
import { recordVersion } from '../src/simulation/battle-record-validation';
import { digestContent, canonicalContent } from '../src/simulation/content';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { AUGMENT_BATCH4_B4XP } from '../src/simulation/content/augment-pool-batch4-b4xp';
import { AUGMENT_TIERS } from '../src/simulation/content/augment-policy';
import { AUGMENT_POOL_API_NAMES } from '../src/simulation/content/augment-offer-rules';
import { augmentOfferAllowed } from '../src/simulation/augment-offers';
import { batch4B4xpSettlementXp, withBatch4B4xp } from '../src/simulation/augment-pool-batch4-b4xp-progress';
import { resolveRoundEconomy } from '../src/simulation/round-economy';
import { grantXp } from '../src/simulation/progression';
import { XP_TO_NEXT_LEVEL } from '../src/simulation/match-rules';
import { RULES_GAP_MANIFEST } from '../scripts/augment-content-archive';
import { firstNodeSeed } from './augment-stage-helpers';
import { accepted, resolveM5Choices, fieldBench, emptyBoard } from './match-helpers';
import { applyRoundSettlement, enableMultiplayerSettlement, ROUND_SETTLEMENT_VERSION } from '../src/simulation/round-settlement';

const total=(s:Pick<MatchState,'level'|'xp'>)=>s.xp+Object.entries(XP_TO_NEXT_LEVEL).filter(([l])=>Number(l)<s.level).reduce((n,[,xp])=>n+xp,0);
const rows=[['clear-mind',3,'2-1'],['cluttered-mind',3,'2-1'],['slammin',2,'2-1'],['slammin-plus',2,'3-2']] as const;
function fight(context:MatchState,battles:BattleRecord[]):MatchState {
 const start=startMatchCombat(context);let s=accepted(start),events:MatchEvent[]=[...start.ok?start.events:[]];const initial=s.combat!;
 while(s.phase==='combat'){const step=stepMatch(s);s=step.state;events.push(...step.events);}
 const terminal=s.combat!,ledger=events.filter((e):e is BattleRecord['events'][number]=>e.domain==='combat');
 battles.push({version:recordVersion(context),roundId:context.roundDefinitionId,runId:'b4xp',combatId:terminal.combatId!,context,initial,events:ledger,
  endTick:terminal.tick,nextEventSeq:terminal.nextEventSeq!,result:terminal.result,stateHash:digestContent(terminal),eventHash:digestContent(ledger)});
 return resolveM5Choices(s);
}
function opening(id:string):{state:MatchState;battles:BattleRecord[];before:MatchState} {
 const node=id==='slammin-plus'?'3-2':'2-1',seed=id==='slammin-plus'?PLUS_SEED:firstNodeSeed(id),battles:BattleRecord[]=[];
 let s=createMatch(seed);
 while(s.roundDefinitionId!==node){s=resolveM5Choices(s);if(s.phase==='preparation')s=fight(emptyBoard(s),battles);s=accepted(nextRound(s,s.round));}
 const before=s,c=s.pendingChoice!;expect(c.offers).toContain(id);
 s=accepted(selectChoice(s,c.choiceId,c.generation,id));return {state:s,battles,before};
}
const PLUS_SEED=4; // First public 3-2 offering seed on the v25 integrated pool.
function emptyInventory(state:MatchState):MatchState {
 let s=state;
 for(let tries=0;s.items.some(i=>i.location.kind==='inventory')&&tries<30;tries++){
  let equipped=false;
  for(const item of s.items.filter(i=>i.location.kind==='inventory')){
   for(const unit of s.preparation.units.filter(u=>u.team==='player')){
    for(let slot=0;slot<3;slot++){const r=equipItem(s,item.id,unit.id,slot);if(r.ok){s=r.state;equipped=true;break;}}
    if(equipped)break;
   }
   if(equipped)break;
  }
  if(!equipped){const slot=s.shop.slots.findIndex(x=>x.status==='available');s=accepted(buyUnit(s,slot,s.shop.generation));}
 }
 expect(s.items.filter(i=>i.location.kind==='inventory')).toHaveLength(0);return s;
}
function fillBench(state:MatchState):MatchState {
 let s=state;
 for(let tries=0;s.preparation.units.filter(u=>u.team==='player'&&u.location.kind==='bench').length<s.preparation.benchSize&&tries<40;tries++){
  const candidates=s.shop.slots.flatMap((slot,i)=>slot.status==='available'?[i]:[]);let bought=false;
  for(const slot of candidates){const r=buyUnit(s,slot,s.shop.generation);if(r.ok){s=r.state;bought=true;break;}}
  if(!bought){s=accepted(rerollShop(s));}
 }
 expect(s.preparation.units.filter(u=>u.team==='player'&&u.location.kind==='bench')).toHaveLength(s.preparation.benchSize);return s;
}
function roundTrip(s:MatchState,battles:BattleRecord[]){
 const text=serializeMatch(s,battles);expect(restoreMatch(text,battles)).toEqual(s);expect(restoreMatch(JSON.parse(text),battles)).toEqual(s);expect(restoreMatch(s,battles)).toEqual(s);
}
function reject(s:MatchState,battles:BattleRecord[]){
 expect(()=>restoreMatch(s,battles)).toThrow();expect(()=>restoreMatch(canonicalContent(s),battles)).toThrow();expect(()=>restoreMatch(JSON.parse(canonicalContent(s)),battles)).toThrow();expect(()=>serializeMatch(s,battles)).toThrow();
}
it.skipIf(!existsSync(RESEARCH_FILE))('all four rows retain exactly the 14.24 effects, including null, archive text, tiers and allowed offer nodes',()=>{
 const research=JSON.parse(readFileSync(RESEARCH_FILE,'utf8'));
 expect(Object.keys(AUGMENT_BATCH4_B4XP).sort()).toEqual(rows.map(([id])=>id).sort());
 for(const [id,,allowed] of rows){const row=AUGMENT_BATCH4_B4XP[id],r=research.find((x:any)=>x.apiName===row.apiName);
  expect(row.source.values).toEqual(r.effects);expect(AUGMENT_TIERS[id]).toBe('gold');expect(AUGMENT_POOL_API_NAMES[id]).toBe(r.apiName);
  const archive=(RULES_GAP_MANIFEST.augmentPoolBatch4B4xp.content as any)[id];expect([archive.name,archive.description,archive.source.description_en_us]).toEqual([r.name_zh_cn,r.description_zh_cn,r.description_en_us]);
  const tags:Record<string,string>={'{d02ae323}':'2-1','{d12ae4b6}':'3-2','{d22ae649}':'4-2'};
  expect(['2-1','3-2','4-2'].filter(node=>!r.item_tags_raw.some((tag:string)=>tags[tag]===node))).toEqual([allowed]);
  for(const node of ['2-1','3-2','4-2'])expect(augmentOfferAllowed(id,[],{node,fieldedTraits:[],blocked:[]})).toBe(node===allowed);
 }
});
it('source mutex excludes both mind variants and both Slammin variants',()=>{
 for(const [a,b] of [['clear-mind','cluttered-mind'],['slammin','slammin-plus']])for(const [id,other] of [[a,b],[b,a]])expect(augmentOfferAllowed(id,[{definitionId:other,choiceId:'old',acquiredRound:1}],{node:null,fieldedTraits:[],blocked:[]})).toBe(false);
});
for(const [id,xp] of rows){
 it(`${id}: public acquisition gifts/XP, qualifying player settlement, round trip and tamper rejection`,()=>{
  const opened=opening(id);let s=opened.state;const battles=opened.battles;
  roundTrip(s,battles);
  expect(total(s)-total(opened.before)).toBe(id==='slammin-plus'?10:0);
  if(id==='cluttered-mind'){
   const acquired=s.seatMechanics!.receipts.filter(r=>r.kind==='unit'&&r.round===s.round);expect(acquired).toHaveLength(4);
   // Purchases use real commands; the starting economy is topped up only in this capacity fixture.
   s=fillBench({...s,gold:s.gold+100});
  }else if(id==='clear-mind'){
   s=fieldBench(s);for(const u of s.preparation.units.filter(u=>u.team==='player'&&u.location.kind==='bench'))s=accepted(sellUnit(s,u.id));
  }else {
   expect(s.seatMechanics!.receipts.filter(r=>r.kind==='item'&&r.round===s.round)).toHaveLength(1);
   s=emptyInventory(s);
  }
  expect(batch4B4xpSettlementXp(s)).toBe(xp);const before=s;s=fight(s,battles);
  const result=s.roundResults.at(-1)!;expect(result.xpRequested).toBe(2+xp);expect(total(s)-total(before)).toBe(2+xp);
  roundTrip(s,battles);expect(()=>restoreMatch(s)).toThrow(/historical evidence/);
  expect(()=>restoreMatch(s,battles.slice(0,-1))).toThrow();
  // Coherent XP edits pass the numeric subset preflight but must fail the independent battle replay.
  const zero=grantXp(result.levelBefore,result.xpBefore,2),bad={...s,level:zero.level,xp:zero.xp,roundResults:[...s.roundResults.slice(0,-1),{...result,xpRequested:2,xpAwarded:zero.xpApplied,levelAfter:zero.level,xpAfter:zero.xp}]};
  reject(bad,battles);reject({...s,xp:s.xp+1},battles);
  const entered=accepted(nextRound(s,s.round));roundTrip(entered,battles);
 });
 it(`${id}: an unmet condition gives zero, and forging a coherent qualifying reward is rejected`,()=>{
  const {state,battles}=opening(id);let s=state;
  if(id==='clear-mind'){expect(s.preparation.units.some(u=>u.team==='player'&&u.location.kind==='bench')).toBe(true);}
  else if(id==='cluttered-mind'){expect(s.preparation.units.filter(u=>u.team==='player'&&u.location.kind==='bench').length).toBeLessThan(s.preparation.benchSize);}
  else expect(s.items.some(i=>i.location.kind==='inventory')).toBe(true);
  expect(batch4B4xpSettlementXp(s)).toBe(0);s=fight(s,battles);expect(s.roundResults.at(-1)!.xpRequested).toBe(2);roundTrip(s,battles);
  const r=s.roundResults.at(-1)!,p=grantXp(r.levelBefore,r.xpBefore,2+xp);
  reject({...s,level:p.level,xp:p.xp,roundResults:[...s.roundResults.slice(0,-1),{...r,xpRequested:2+xp,xpAwarded:p.xpApplied,levelAfter:p.level,xpAfter:p.xp}]},battles);
 });
}
it('PvE/supply never pays; max-level capping retains the requested entitlement; requested XP remains visible at max level',()=>{
 const s=opening('clear-mind').state,empty={...s,preparation:{...s.preparation,units:[]}};
 expect(batch4B4xpSettlementXp({...empty,m8:{...empty.m8,round:{...empty.m8.round,kind:'pve'}}})).toBe(0);
 expect(batch4B4xpSettlementXp({...empty,m8:{...empty.m8,round:{...empty.m8.round,kind:'supply'}}})).toBe(0);
 const plan=resolveRoundEconomy({augments:s.augments,roundId:s.roundDefinitionId,result:'enemyWin',gold:s.gold,streak:s.streak,level:10,xp:0,hp:s.playerHp,enemySurvivors:0});
 expect(withBatch4B4xp({level:10,xp:0},plan,3).progression).toMatchObject({xpRequested:5,xpApplied:0,level:10,xp:0});
});
it('online settlement uses the latest live bench/inventory and deduplicates atomically without server changes',()=>{
 for(const [id,xp] of rows){
  let s=opening(id).state;s=accepted(enableMultiplayerSettlement(s,'A') as any);
  if(id==='clear-mind'){s=fieldBench(s);for(const u of s.preparation.units.filter(u=>u.team==='player'&&u.location.kind==='bench'))s=accepted(sellUnit(s,u.id));}
  s=accepted(lockMatchCombatRoster(s));
  if(id==='cluttered-mind')s=fillBench({...s,gold:s.gold+100});
  if(id.startsWith('slammin'))s=emptyInventory(s);
  const receipt={version:ROUND_SETTLEMENT_VERSION,settlementId:`online-${s.round}`,battleId:`battle-${s.round}`,seatId:'A',round:s.round,roundId:s.roundDefinitionId,settlementEligible:true,result:'win',damage:0,baseDamage:s.roundDefinitionId==='3-2'?5:2,opposingSurvivors:0,growth:[],combatTicks:10,combatEventCount:2};
  const r=applyRoundSettlement(s,receipt);if(!r.ok)throw new Error(id+': '+r.reason+' '+s.roundDefinitionId+' '+JSON.stringify(receipt));expect(r.ok).toBe(true);
  expect(r.state.roundResults.at(-1)!.xpRequested).toBe(2+xp);
  expect(applyRoundSettlement(r.state,receipt)).toEqual({ok:false,state:r.state,reason:'duplicate-settlement'});
 }
});

it('champion bench boundaries exclude summons/anvils; equipped items and consumables do not block Slammin',()=>{
 const base=opening('clear-mind').state,unit=base.preparation.units.find(u=>u.team==='player')!;
 const own=(id:string)=>[{definitionId:id,choiceId:'boundary',acquiredRound:base.round}];
 const units=Array.from({length:9},(_,slot)=>({...unit,id:'boundary-'+slot,location:{kind:'bench' as const,slot}}));
 for(const definitionId of ['training-dummy','TFT_ArmoryKeyComponent']){
  const summon={...unit,id:'summon',definitionId,location:{kind:'bench' as const,slot:8}};
  expect(batch4B4xpSettlementXp({...base,preparation:{...base.preparation,units:[summon]}})).toBe(3);
  expect(batch4B4xpSettlementXp({...base,augments:own('cluttered-mind'),preparation:{...base.preparation,units:[...units.slice(0,8),summon]}})).toBe(0);
 }
 expect(batch4B4xpSettlementXp({...base,augments:own('cluttered-mind'),preparation:{...base.preparation,units}})).toBe(3);
 expect(batch4B4xpSettlementXp({...base,augments:own('slammin'),items:base.items.map(i=>({...i,location:{kind:'unit',unitId:unit.id,slot:0}}))})).toBe(2);
 expect(batch4B4xpSettlementXp({...base,augments:own('slammin'),items:[],consumables:[{consumableId:'consumable',definitionId:'magnetic-remover'}]})).toBe(2);
});

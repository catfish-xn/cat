import { readFileSync } from 'node:fs';
import { RESEARCH_FILE } from './augment-pool-source-expectations';
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AUGMENT_BATCH4, AUGMENT_BATCH4_BLOCKED } from '../src/simulation/content/augment-pool-batch4';
import { AUGMENT_DEFINITIONS } from '../src/simulation/content/augments';
import { AUGMENT_TIERS } from '../src/simulation/content/augment-policy';
import { AUGMENT_POOL_API_NAMES } from '../src/simulation/content/augment-offer-rules';
import { AUGMENT_STAGE_BANS } from '../src/simulation/content/augment-stage-bans';
import { augmentCandidates, resolveAugmentTier, augmentOfferAllowed } from '../src/simulation/augment-offers';
import { generateChoices } from '../src/simulation/choices';
import { createMatch, buyXp, selectChoice, openAnvil, nextRound, startMatchCombat, sellUnit } from '../src/simulation/match';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { acquisitionLevels, AUGMENT_ACQUISITION_LEVEL_KEY } from '../src/simulation/augment-xp';
import { batch4RewardPlan, drainBatch4Gold, batch4LevelRound } from '../src/simulation/augment-pool-batch4-progress';
import { validateBatch4Gold } from '../src/simulation/restore-checks/batch4-gold-check';
import { drainBatch1Gifts } from '../src/simulation/augment-pool-grants';
import { writeSeatMechanic } from '../src/simulation/seat-mechanics/state';
import { ITEM_DEFINITIONS } from '../src/simulation/content/g2-3-item-registry';
import { UNIT_DEFINITIONS } from '../src/simulation/units';
import { isAnvil } from '../src/simulation/content/anvils';
import { grantXp } from '../src/simulation/progression';
import { accepted, reachRound, resolveM5Choices, emptyBoard } from './match-helpers';
import type { MatchState } from '../src/simulation/match-types';

const ids=['caretakers-ally','lategame-specialist','caretakers-favor','birthday-presents','caretakers-chosen'];
const research=(existsSync(RESEARCH_FILE)?JSON.parse(readFileSync(RESEARCH_FILE,'utf8')):[]) as {apiName:string;tier:number;effects:Record<string,number|null>;item_tags_raw:string[]}[];
function reachLater(seed:number):MatchState {
 let s=createMatch(seed);
 while(s.roundDefinitionId!=='3-2'){
  s=resolveM5Choices(s);
  if(s.phase==='preparation'){
  // Release capacity through public commands before moving all deployed heroes to the bench.
  for(const u of s.preparation.units.filter(u=>isAnvil(u.definitionId)))s=resolveM5Choices(accepted(openAnvil(s,u.id)));
  while(s.preparation.units.filter(u=>u.team==='player').length>s.preparation.benchSize){
   const u=s.preparation.units.find(u=>u.team==='player'&&!isAnvil(u.definitionId))!;s=accepted(sellUnit(s,u.id));
  }
  const started=startMatchCombat(emptyBoard(s));expect(started.ok,started.ok?'':`${seed}/${s.roundDefinitionId}: ${started.reason}`).toBe(true);s=resolveM5Choices(accepted(started));
  }
  s=accepted(nextRound(s,s.round));
 }
 return s;
}
function pick(id:string):MatchState {
 if(id==='lategame-specialist'){
  const open=reachLater(107),c=open.pendingChoice!;expect(c.offers).toContain(id); // v26 D5 pool (7953c99a): seed 107 (was 24; v25 pool: 24, was 6).
  return accepted(selectChoice(open,c.choiceId,c.generation,id));
 }
 const node='2-1';
 for(let seed=0;seed<20000;seed++){
  const root=createMatch(seed);
  if(resolveAugmentTier(root,`round:${node}:augment`)!==AUGMENT_TIERS[id])continue;
  if(node==='2-1'){
   const candidates=augmentCandidates(AUGMENT_TIERS[id],[],[],null,{node,fieldedTraits:[],blocked:[]});
   if(!generateChoices(candidates,root.choiceRngState).offers.includes(id))continue;
  }
  const open=reachRound(node,false,seed),c=open.pendingChoice!;
  if(c.offers.includes(id))return accepted(selectChoice(open,c.choiceId,c.generation,id));
 }
 throw new Error('No public offer '+id);
}
const save=(s:MatchState)=>expect(restoreMatch(serializeMatch(s))).toEqual(s);
const advance=(s:MatchState)=>{
 s=resolveM5Choices(s);s=accepted(startMatchCombat(emptyBoard(s)));s=resolveM5Choices(s);
 return resolveM5Choices(accepted(nextRound(s,s.round)));
};
function gain(s:MatchState,target:number):MatchState {
 s={...s,gold:s.gold+2000};
 while(s.level<target)s=accepted(buyXp(s));
 return s;
}
const owns=(s:MatchState,id:string)=>s.augments.find(a=>a.definitionId===id)!;

describe.each(ids)('%s',id=>{
 it.skipIf(!existsSync(RESEARCH_FILE))('has exact 14.24 values/tier, enters offers and obeys every source stage tag',()=>{
  const row=AUGMENT_BATCH4[id],r=research.find(r=>r.apiName===row.apiName)!;
  expect(row.source.values).toEqual(r.effects);expect(row.tier).toBe(['silver','gold','prismatic'][r.tier-1]);
  expect(AUGMENT_DEFINITIONS[id].id).toBe(id);expect(AUGMENT_POOL_API_NAMES[id]).toBe(r.apiName);expect(AUGMENT_TIERS[id]).toBe(row.tier);
  const tags:Record<string,string>={'{d02ae323}':'2-1','{d12ae4b6}':'3-2','{d22ae649}':'4-2'};
  const bans=r.item_tags_raw.filter(t=>tags[t]).map(t=>tags[t]);expect(AUGMENT_STAGE_BANS[r.apiName]??[]).toEqual(bans);
  for(const node of ['2-1','3-2','4-2']){
   expect(augmentOfferAllowed(id,[],{node,fieldedTraits:[],blocked:[]})).toBe(!bans.includes(node));
   expect(augmentCandidates(row.tier,[],[],null,{node,fieldedTraits:[],blocked:[]}).includes(id)).toBe(!bans.includes(node));
  }
 });
 it('public selection, effect, exact save/restore, idempotence, forged reward and acquisition level rejection',()=>{
  let s=pick(id);const a=owns(s,id),from=s.level;
  expect(acquisitionLevels(s)[a.choiceId]).toBe(from);save(s);
  if(id==='caretakers-ally'){
   const initial=batch4RewardPlan(s).filter(g=>g.receiptId.includes(id));expect(initial).toHaveLength(1);
   expect(UNIT_DEFINITIONS[initial[0].definitionId].cost).toBe(2);
   s=gain(s,from+2);const plan=batch4RewardPlan(s).filter(g=>g.receiptId.includes(id));
   expect(plan).toHaveLength(3);expect(new Set(plan.map(g=>g.definitionId))).toEqual(new Set([initial[0].definitionId]));
  }else if(id==='lategame-specialist'){
   expect(s.seatMechanics!.receipts.filter(r=>r.source==='augment-pool-batch4')).toEqual([]);
   s=gain(s,8);expect(s.seatMechanics!.receipts.filter(r=>r.source==='augment-pool-batch4')).toEqual([]);
   s=gain(s,9);expect(s.seatMechanics!.receipts.filter(r=>r.source==='augment-pool-batch4')).toMatchObject([{kind:'gold',amount:33,round:s.round}]);
  }else if(id==='caretakers-favor'){
   s=gain(s,8);const plan=batch4RewardPlan(s).filter(g=>g.receiptId.includes(id));
   expect(plan).toHaveLength(4);expect(plan.map(g=>g.definitionId)).toEqual(Array(4).fill('TFT_ArmoryKeyComponent'));
  }else if(id==='birthday-presents'){
   expect(batch4RewardPlan(s)).toEqual([]);s=gain(s,10);
   const plan=batch4RewardPlan(s).filter(g=>g.receiptId.includes(id));expect(plan).toHaveLength(10-from);
   expect(plan.map(g=>[UNIT_DEFINITIONS[g.definitionId].cost,g.starLevel])).toEqual(Array.from({length:10-from},(_,i)=>[Math.max(1,from+i+1-4),2]));
  }else{
   s=gain(s,7);const plan=batch4RewardPlan(s).filter(g=>g.receiptId.includes(id));
   expect(plan.map(g=>g.definitionId)).toEqual(['TFT_ArmoryKeyComponent','TFT_ArmoryKeyCompleted','TFT_ArmoryKeyRadiant']);
  }
  save(s);const again=drainBatch1Gifts(s);expect(again).toEqual(s);save(again);
  const forged=structuredClone(s) as any;
  const receipt=forged.seatMechanics.receipts.find((r:any)=>id==='lategame-specialist'?r.source==='augment-pool-batch4':r.receiptId.includes(id));
  expect(receipt).toBeDefined();if(id==='lategame-specialist')receipt.amount++;else receipt.definitionId='darius';
  expect(()=>restoreMatch(JSON.stringify(forged))).toThrow();
  expect(()=>restoreMatch(JSON.stringify(writeSeatMechanic(s,AUGMENT_ACQUISITION_LEVEL_KEY,{...acquisitionLevels(s),[a.choiceId]:from-1})))).toThrow();
  expect(()=>restoreMatch(JSON.stringify(writeSeatMechanic(s,AUGMENT_ACQUISITION_LEVEL_KEY,undefined)))).toThrow();
 });
});
it('exactly five enabled rows; no batch-specific default disable mechanism',()=>{
 expect(Object.keys(AUGMENT_BATCH4).sort()).toEqual([...ids].sort());expect(AUGMENT_BATCH4_BLOCKED).toEqual({});
});
it('Caretaker Chosen opens exactly five distinct radiant options; restored pending/selected ledger rejects changed options and repeated open',()=>{
 let s=gain(pick('caretakers-chosen'),7),unit=s.preparation.units.find(u=>u.definitionId==='TFT_ArmoryKeyRadiant')!;
 expect(unit).toBeDefined();s=accepted(openAnvil(s,unit.id));const c=s.pendingChoice!;
 expect(c.offers).toHaveLength(5);expect(new Set(c.offers).size).toBe(5);expect(c.offers.every(id=>ITEM_DEFINITIONS[id].kind==='radiant')).toBe(true);save(s);
 expect(()=>restoreMatch(JSON.stringify({...s,pendingChoice:{...c,offers:c.offers.slice(0,4)}}))).toThrow();
 s=accepted(selectChoice(s,c.choiceId,c.generation,c.offers[4]));expect(s.items.some(i=>i.definitionId===c.offers[4])).toBe(true);save(s);
 expect(openAnvil(s,unit.id)).toMatchObject({ok:false,reason:'unknown-unit',state:s});
});
it('actual round entries and paid level-ups keep past trigger rounds stable across restore',()=>{
 let s=pick('caretakers-ally');s=gain(s,s.level+1);save(s);
 const plan=batch4RewardPlan(s),before=plan.map(g=>[g.receiptId,g.acquiredRound]);
 s=advance(s);save(s);
 expect(batch4RewardPlan(s).slice(0,plan.length).map(g=>[g.receiptId,g.acquiredRound])).toEqual(before);
});
it('multiple levels in one transition produce every crossed reward and authentic historical timing; missing/extra gold rejected',()=>{
 const s=pick('birthday-presents'),a=owns(s,'birthday-presents'),jump=grantXp(s.level,s.xp,80),leveled={...s,level:jump.level,xp:jump.xp};
 expect(batch4RewardPlan(leveled)).toHaveLength(jump.level-s.level);
 expect(batch4LevelRound(leveled,a,jump.level)).toBe(s.round);
 const late=gain(pick('lategame-specialist'),9);expect(drainBatch4Gold(late)).toEqual(late);validateBatch4Gold(late);
 const receipt=late.seatMechanics!.receipts.find(r=>r.source==='augment-pool-batch4')!;
 for(const receipts of [late.seatMechanics!.receipts.filter(r=>r!==receipt),[...late.seatMechanics!.receipts,receipt],late.seatMechanics!.receipts.map(r=>r===receipt?{...r,round:r.round-1}:r)])
  expect(()=>validateBatch4Gold({...late,seatMechanics:{...late.seatMechanics!,receipts}})).toThrow();
});
it('online XP during the roster lock defers hero rewards; unlock queues one initial hero plus every crossed level once',async()=>{
 const { enableMultiplayerSettlement }=await import('../src/simulation/round-settlement');
 const { recordAcquisitionLevel }=await import('../src/simulation/augment-xp');
 const { validateBatch1Gifts }=await import('../src/simulation/restore-checks/batch1-gifts-check');
 const enabled=enableMultiplayerSettlement(createMatch(42),'A');if(!enabled.ok)throw new Error(enabled.reason);const base=enabled.state;
 const a={definitionId:'caretakers-ally',choiceId:'lock-ally',acquiredRound:base.round};
 let s=recordAcquisitionLevel({...base,augments:[a],gold:20,multiplayer:{...base.multiplayer!,combatRosterLocked:true}},a);
 const before=s;s=accepted(buyXp(s));
 expect(s.level-before.level).toBe(2);expect(s.preparation).toEqual(before.preparation);
 expect(s.seatMechanics?.receipts.filter(r=>r.receiptId.includes('caretakers-ally'))??[]).toEqual([]);
 const unlocked={...s,multiplayer:{...s.multiplayer!,combatRosterLocked:undefined}};
 s=drainBatch1Gifts(unlocked);
 const receipts=s.seatMechanics!.receipts.filter(r=>r.receiptId.includes('caretakers-ally'));
 expect(receipts).toHaveLength(3);expect(receipts.every(r=>r.kind==='unit'&&r.resolution==='orb')).toBe(true);
 expect(new Set(receipts.map(r=>r.kind==='unit'?r.definitionId:null)).size).toBe(1);
 validateBatch1Gifts(s);expect(drainBatch1Gifts(s)).toEqual(s);
});
it('shared snapshot restore rejects an orphan Batch4 gold receipt even without its owner',async()=>{
 const {createSharedPool,initializeSharedSeat,restoreSharedOrbSnapshot}=await import('../src/simulation/shared-pool');
 const pool=createSharedPool('batch4-restore',42),r=initializeSharedSeat(pool,createMatch(9,{mode:'shared-deferred'}),'A',0);
 if(!r.ok)throw new Error(r.reason);expect(restoreSharedOrbSnapshot(r.pool,r.state)).toEqual(r.state);
 const forged=structuredClone(r.state) as any;
 forged.seatMechanics.receipts.push({kind:'gold',receiptId:'["augment-pool-batch4","forged","level",9]',source:'augment-pool-batch4',amount:33,round:r.state.round,roundId:r.state.roundDefinitionId});
 expect(()=>restoreSharedOrbSnapshot(r.pool,forged)).toThrow('Invalid batch4 gold authority');
});
it('multiplayer settlement without optional battle facts grants a crossed level through the same reward ledger',async()=>{
 const {applyRoundSettlement,ROUND_SETTLEMENT_VERSION}=await import('../src/simulation/round-settlement');
 const {XP_TO_NEXT_LEVEL}=await import('../src/simulation/match-rules');
 const {validateBatch1Gifts}=await import('../src/simulation/restore-checks/batch1-gifts-check');
 const base=pick('caretakers-ally');
 const s:MatchState={...base,xp:XP_TO_NEXT_LEVEL[base.level]-2,multiplayer:{version:ROUND_SETTLEMENT_VERSION,seatId:'solo',status:'active',receipts:[],forfeitedChoices:[]}};
 const result=applyRoundSettlement(s,{version:ROUND_SETTLEMENT_VERSION,settlementId:`${s.round}:solo`,battleId:`battle:${s.round}`,seatId:'solo',round:s.round,roundId:s.roundDefinitionId,
  settlementEligible:true,result:'win',damage:0,baseDamage:2,opposingSurvivors:0,growth:[],combatTicks:88,combatEventCount:20});
 if(!result.ok)throw new Error(result.reason);
 expect(result.state.level).toBe(s.level+1);
 const receipts=result.state.seatMechanics!.receipts.filter(r=>r.receiptId.includes('caretakers-ally'));
 expect(receipts).toHaveLength(2);expect(receipts.at(-1)).toMatchObject({kind:'unit',resolution:'orb',round:s.round});
 expect(result.events.some(e=>e.type==='mechanicGranted')).toBe(true);validateBatch1Gifts(result.state);
});

it('Lategame Specialist and Level Up remain source-mutually-exclusive in both directions',()=>{
 const owner=(definitionId:string)=>[{definitionId,choiceId:'owned',acquiredRound:1}];
 expect(augmentOfferAllowed('lategame-specialist',owner('level-up'))).toBe(false);
 expect(augmentOfferAllowed('level-up',owner('lategame-specialist'))).toBe(false);
});

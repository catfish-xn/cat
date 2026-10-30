import { validateCarouselMetadata } from '../src/simulation/carousel-units';
import { MatchSession } from '../src/rendering/match-session';
import { existsSync, readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

// D5 uses production registration for the public command/restore fixtures.
import { createMatch, selectChoice, claimOrb, equipItem, type MatchState } from '../src/simulation/match';
import { applyRestartMission, restartMissionGiftPlan } from '../src/simulation/restart-mission';
import { RESTART_MISSION } from '../src/simulation/content/restart-mission';
import { AUGMENT_TIERS } from '../src/simulation/content/augment-policy';
import { SHOP_CATALOG_BY_COST } from '../src/simulation/match-rules';
import { UNIT_DEFINITIONS, type Unit } from '../src/simulation/units';
import { createSharedPool, initializeSharedSeat, runSharedMatchCommand } from '../src/simulation/shared-pool';
import { assertSharedPoolConservation } from '../src/simulation/shared-pool-ledger';
import { recordAugmentAcquisition } from '../src/simulation/augment-history';
import { appendResourceProvenance } from '../src/simulation/resource-provenance';
import { foldResourceProvenance } from '../src/simulation/restore-checks/fold-provenance';
import { validateBatch1GiftReceipts } from '../src/simulation/restore-checks/batch1-gifts-check';
import { validateBatch3Dummies } from '../src/simulation/restore-checks/batch3-progress-check';
import { validateHistoricalEquipment } from '../src/simulation/b8-restore';
import { validateMultiplayerOrbLedger } from '../src/simulation/orb-restore';
import { soloPveLoot } from '../src/simulation/shop-orbs';
import { drainBatch1Gifts } from '../src/simulation/augment-pool-grants';
import { freezeOrbLayoutThroughRound } from '../src/simulation/orb-layout';
import { prepareMatchLoot } from '../src/simulation/loot-runtime';
import { getMultiplayerRoundByOrdinal } from '../src/simulation/multiplayer-round';
import { grantMechanicItem } from '../src/simulation/seat-mechanics/grants';
import type { RewardOrb } from '../src/simulation/loot-types';
import { grantCarryGolem, growCarryGolem } from '../src/simulation/augment-pool-batch5-g6';
import { validateCarryGolem } from '../src/simulation/restore-checks/carry-golem-check';
import { validateTrainerGolems, enterTrainerGolems } from '../src/simulation/trainer-golems';
import { openingEncounterId, validateOpeningEncounterState } from '../src/simulation/opening-encounter';
import { claimBotPreparationOrbs } from '../src/simulation/bot';

const id='restart-mission', choiceId='round:2-1:augment';
function offered(initial=createMatch(37)): MatchState {
  return {...initial,preparation:{...initial.preparation,units:initial.preparation.units.filter(u=>u.team==='player')},round:4,roundDefinitionId:'2-1',phase:'choice',combat:null,pendingChoice:{
    kind:'augment',step:'offer',choiceId,eventId:choiceId,generation:0,offers:[id],targetId:null,rerollCount:0,returnPhase:'preparation',
  }} as MatchState;
}
function accepted<T extends {ok:boolean;state:MatchState}>(r:T):MatchState { expect(r.ok).toBe(true);return r.state; }
function selected(s=offered()):MatchState { return accepted(selectChoice(s,choiceId,0,id)); }
function online(seed=37, capacities?:Readonly<Record<string,number>>) {
  const r=initializeSharedSeat(createSharedPool('restart-test',seed,{seatCount:1,capacities}),createMatch(seed,{mode:'shared-deferred'}),'s0',0);
  if(!r.ok)throw Error(r.reason);
  const frozen=freezeOrbLayoutThroughRound(r.pool.orbLayout,4);if(!frozen.ok)throw Error(frozen.reason);
  const pool={...r.pool,orbLayout:frozen.layout};
  const state=offered({...r.state,m8:{...r.state.m8,round:getMultiplayerRoundByOrdinal(4),loot:prepareMatchLoot(seed,4,r.state.m8.loot,pool.orbLayout)}});
  return {...r,pool,state};
}
function chooseOnline(seed=37, capacities?:Readonly<Record<string,number>>) {
  const before=online(seed,capacities),r=runSharedMatchCommand(before.pool,before.state,{type:'choose',choiceId,generation:0,definitionId:id});
  if(!r.ok)throw Error(r.reason);
  return {before,...r};
}
function fold(s:MatchState) {
  return foldResourceProvenance(s.resourceProvenance,{scheduleReceipts:s.scheduleReceipts,lootReceipts:s.m8.loot.receipts,
    mechanicReceipts:s.seatMechanics?.receipts,carouselReceipts:s.carousel?.receipts,pendingCarouselUnitIds:s.carousel?.pendingUnits.map(u=>u.unitId),
    throughRoundOrdinal:s.round,combatSettlements:[],augmentHistory:s.augmentHistory});
}
function orbDefinition(orb:RewardOrb):string {
  const payload=orb.entries[0].payload;if(payload.kind!=='unit')throw Error('expected a unit reward');return payload.definitionId;
}
// Independent integer oracle for the existing gift stream, with literal FNV/LCG constants.
function expectedDraws(seed:number,seat='solo') {
  return ([1,2,3] as const).flatMap((cost,spec)=>{
    const key=JSON.stringify(['augment-pool-batch1',seat,choiceId,id,spec]);
    let hash=2166136261;for(let i=0;i<key.length;i++)hash=Math.imul(hash^key.charCodeAt(i),16777619)>>>0;
    let word=(seed^hash)>>>0;const pool=[...SHOP_CATALOG_BY_COST[cost]].sort();
    return Array.from({length:[1,3,2][spec]},()=>{word=(Math.imul(word,1664525)+1013904223)>>>0;return pool[Math.floor(word*pool.length/4294967296)];});
  });
}

it('retains the 14.24 six-unit split and registers its silver tier',()=>{
  const research='/home/aiapps/workspace/augments-research-2026-10-23/data/augments-14.24.json';
  if(existsSync(research)) {
    const source=JSON.parse(readFileSync(research,'utf8')).find((r:{apiName:string})=>r.apiName===RESTART_MISSION.apiName);
    expect(RESTART_MISSION.source.values).toEqual(source.effects);
  }
  expect(AUGMENT_TIERS[id]).toBe('silver');
  expect(RESTART_MISSION.gifts.map(g=>[g.cost,g.count,g.starLevel])).toEqual([[1,1,2],[2,3,2],[3,2,2]]);
});

it('draws uniformly with replacement from the whole cost catalog, with stable identities and no live RNG consumption',()=>{
  for(let seed=0;seed<40;seed++) {
    const s=selected(offered(createMatch(seed))),gifts=restartMissionGiftPlan(s);
    expect(gifts.map(g=>g.definitionId)).toEqual(expectedDraws(seed));
    expect(gifts.map(g=>UNIT_DEFINITIONS[g.definitionId].cost)).toEqual([1,2,2,2,3,3]);
    expect(gifts.every(g=>g.starLevel===2)).toBe(true);expect(new Set(gifts.map(g=>g.receiptId)).size).toBe(6);
    expect(restartMissionGiftPlan(JSON.parse(JSON.stringify(s)))).toEqual(gifts);
  }
  expect(Array.from({length:40},(_,seed)=>expectedDraws(seed)).some(draws=>new Set(draws.slice(1,4)).size<3)).toBe(true);
});

it('clears board, bench and summons without sale gold; keeps anvils, pending carousel and their items',()=>{
  const base=offered(),hero=base.preparation.units[0];
  const unit=(unitId:string,definitionId:string,slot:number):Unit=>({id:unitId,definitionId,starLevel:1,team:'player',location:{kind:'bench',slot}});
  const anvil=unit('unit-4','TFT_ArmoryKeyCompleted',2);
  const pending={unitId:'unit-5',definitionId:'amumu',receiptId:'fixture:carousel:1-1:s0'};
  const s={...base,preparation:{...base.preparation,units:[{...hero,location:{kind:'board',cell:{row:4,col:0}}},unit('unit-2','amumu',0),unit('unit-3','training-dummy',1),anvil]},
    carousel:{receipts:[{id:pending.receiptId,carouselId:'fixture:carousel:1-1',seatId:'s0',slot:0,definitionId:pending.definitionId,itemId:'rod',holdingSource:'carousel-fixture',unitId:pending.unitId,itemInstanceId:'item-3',status:'granted'}],pendingUnits:[pending],heldCarouselUnits:[pending],preparationReceipts:[]},
    items:[{id:'item-1',definitionId:'sword',location:{kind:'unit',unitId:hero.id,slot:0}},
      {id:'item-2',definitionId:'bow',location:{kind:'unit',unitId:'unit-2',slot:0}},
      {id:'item-3',definitionId:'rod',location:{kind:'inventory'}}],
    anomalyBinding:{definitionId:'bulwark',unitId:hero.id,choiceId:'anomaly',boundRound:4},
    persistentGrowth:[{unitId:hero.id,attackDamageBps:500}],
  } as MatchState;
  // Real staged carousel units have no board/bench body; only their escrow ID exists.
  expect(s.preparation.units.some(u=>u.id===pending.unitId)).toBe(false);
  expect(()=>validateCarouselMetadata(s)).not.toThrow();
  const withOwner=recordAugmentAcquisition(s,{...s,augments:[{definitionId:id,choiceId,acquiredRound:4}]}),r=applyRestartMission(withOwner);
  expect(r.state.gold).toBe(s.gold);expect(r.state.preparation.units).toEqual([anvil]);
  expect(r.state.carousel).toBe(s.carousel);expect(()=>validateCarouselMetadata(r.state)).not.toThrow();expect(r.state.items.slice(0,2).every(i=>i.location.kind==='inventory')).toBe(true);
  expect(r.state.items[2]).toEqual(s.items[2]);expect(r.state.anomalyBinding).toBeNull();expect(r.state.persistentGrowth).toEqual([]);
  expect(r.events.filter(e=>e.type==='itemsReturned')).toHaveLength(2);
  expect(r.state.resourceProvenance.entries.filter(e=>e.kind==='unit-sold')).toEqual([]);
  expect(r.state.resourceProvenance.entries.filter(e=>e.kind==='unit-removed').map(e=>e.unitId)).toEqual([hero.id,'unit-2','unit-3']);
  expect(applyRestartMission(r.state)).toEqual({state:r.state,events:[]});
});

it('queues six 2-star orbs in solo; claims them through the ordinary command and preserves equipment history',()=>{
  const before=offered(),s=selected(before);
  expect(s.preparation.units).toEqual([]);expect(s.gold).toBe(before.gold);
  expect(s.m8.loot.rewardOrbs).toHaveLength(6);expect(s.nextUnitSerial).toBe(before.nextUnitSerial);
  for(const key of ['rngState','choiceRngState','rewardRngState','battleSeedRngState'] as const)expect(s[key]).toEqual(before[key]);
  expect(()=>validateBatch1GiftReceipts(s)).not.toThrow();expect(()=>validateBatch3Dummies(s)).not.toThrow();
  expect(()=>fold(s)).not.toThrow();expect(()=>soloPveLoot(s)).not.toThrow();
  expect(()=>validateHistoricalEquipment(null,s)).not.toThrow();
  let claimed=s;
  for(const orb of s.m8.loot.rewardOrbs!)claimed=accepted(claimOrb(claimed,orb.orbId,claimed.round));
  expect(claimed.preparation.units).toHaveLength(6);expect(claimed.preparation.units.every(u=>u.starLevel===2)).toBe(true);
  expect(()=>fold(claimed)).not.toThrow();expect(()=>soloPveLoot(claimed)).not.toThrow();
  expect(drainBatch1Gifts(claimed)).toBe(claimed);
  expect(applyRestartMission(claimed)).toEqual({state:claimed,events:[]});
});

it('returns every removed shared-pool copy before claim; allocation is deferred until each orb is claimed',()=>{
  const r=chooseOnline(),s=r.state,initial=r.before.state.preparation.units[0];
  expect(s.gold).toBe(r.before.state.gold);expect(s.preparation.units).toEqual([]);
  expect(r.pool.available[initial.definitionId]).toBe(r.before.pool.available[initial.definitionId]+1);
  expect(r.pool.holdings).toEqual([]);expect(r.pool.pending).toEqual([]);expect(r.pool.rewards).toEqual([]);
  expect(s.m8.loot.rewardOrbs!.map(orbDefinition)).toEqual(expectedDraws(s.seed,'s0'));
  expect(()=>assertSharedPoolConservation(r.pool,[s])).not.toThrow();expect(()=>validateMultiplayerOrbLedger(s)).not.toThrow();
  const orb=s.m8.loot.rewardOrbs![0],definitionId=orbDefinition(orb);
  const claim=runSharedMatchCommand(r.pool,s,{type:'claimOrb',orbId:orb.orbId,round:s.round});
  if(!claim.ok)throw Error(claim.reason);
  expect(claim.pool.available[definitionId]).toBe(r.pool.available[definitionId]-3);
  expect(claim.pool.holdings[0].sources).toHaveLength(3);expect(claim.state.preparation.units[0].starLevel).toBe(2);
  expect(()=>assertSharedPoolConservation(claim.pool,[claim.state])).not.toThrow();expect(()=>fold(claim.state)).not.toThrow();
  const duplicate=runSharedMatchCommand(claim.pool,claim.state,{type:'claimOrb',orbId:orb.orbId,round:s.round});
  expect(duplicate).toMatchObject({ok:false,reason:'already-claimed'});expect(duplicate.state).toBe(claim.state);expect(duplicate.pool).toBe(claim.pool);
});

it.each([1,2,3] as const)('returns all copies of a removed %i-star hero without paying its sale price',starLevel=>{
  const r=online(),hero=r.state.preparation.units.find(u=>u.team==='player')!,copies=3**(starLevel-1);
  const state={...r.state,preparation:{...r.state.preparation,units:r.state.preparation.units.map(u=>u.id===hero.id?{...u,starLevel}:u)}};
  const pool={...r.pool,available:{...r.pool.available,[hero.definitionId]:r.pool.available[hero.definitionId]-(copies-1)},
    holdings:r.pool.holdings.map(h=>h.unitId===hero.id?{...h,sources:Array.from({length:copies},(_,i)=>`star-fixture-${i}`)}:h)};
  expect(()=>assertSharedPoolConservation(pool,[state])).not.toThrow();
  const result=runSharedMatchCommand(pool,state,{type:'choose',choiceId,generation:0,definitionId:id});
  if(!result.ok)throw Error(result.reason);
  expect(result.pool.available[hero.definitionId]).toBe(pool.available[hero.definitionId]+copies);
  expect(result.state.gold).toBe(state.gold);expect(result.pool.holdings).toEqual([]);
  expect(result.state.m8.loot.rewardOrbs).toHaveLength(6);expect(()=>assertSharedPoolConservation(result.pool,[result.state])).not.toThrow();
});

it('returns equipped items through the public choice and authenticates their historical locations',()=>{
  const before=offered(),hero=before.preparation.units.find(u=>u.team==='player')!;
  const granted=accepted(grantMechanicItem(before,{source:'test-equipment',receiptId:'test-equipment',definitionId:'deathblade'}));
  const equipped=accepted(equipItem(granted,granted.items[0].id,hero.id,0));
  const after=selected({...equipped,anomalyBinding:{unitId:hero.id,definitionId:'bulwark',choiceId:'test-anomaly',boundRound:4},
    persistentGrowth:[{unitId:hero.id,attackDamageBps:250}]});
  expect(after.items[0].location).toEqual({kind:'inventory'});expect(after.anomalyBinding).toBeNull();expect(after.persistentGrowth).toEqual([]);
  expect(()=>validateHistoricalEquipment(null,after)).not.toThrow();
  const forged=structuredClone(after);Object.assign(forged.items[0],{location:{kind:'unit',unitId:hero.id,slot:0}});
  expect(()=>validateHistoricalEquipment(null,forged)).toThrow('historical equipment continuation');
});

it('keeps a full bench of anvils and all six orbs; a blocked solo claim is an unchanged successful retry',()=>{
  const base=offered(),units=Array.from({length:9},(_,i):Unit=>({id:`anvil-${i}`,definitionId:'TFT_ArmoryKeyCompleted',starLevel:1,team:'player',location:{kind:'bench',slot:i}}));
  const s=selected({...base,preparation:{...base.preparation,units}});
  expect(s.preparation.units).toEqual(units);expect(s.m8.loot.rewardOrbs).toHaveLength(6);
  const claim=claimOrb(s,s.m8.loot.rewardOrbs![0].orbId,s.round);
  expect(claim).toEqual({ok:true,state:s,events:[]});expect(claim.state).toBe(s);
  expect(s.m8.loot.receipts).toHaveLength(0);
});

it('removes a grown carry golem, returns its fixed kit, and keeps both its original grant and retirement authenticated',()=>{
  const owner={definitionId:'im-the-carry-now',choiceId,acquiredRound:4},base=offered();
  let s=grantCarryGolem({...base,augments:[owner],scheduleReceipts:[{eventId:choiceId,round:4,kind:'augment',itemIds:[],gold:0,unitId:null,definitionId:owner.definitionId}]}).state;
  const restartChoice='round:3-2:augment';
  s=growCarryGolem({...s,round:12,roundDefinitionId:'3-2',pendingChoice:{...s.pendingChoice!,choiceId:restartChoice,eventId:restartChoice}} as MatchState);
  expect(s.preparation.units.find(u=>u.definitionId==='carry-golem')!.starLevel).toBe(2);
  expect(()=>validateCarryGolem(s)).not.toThrow();
  const after=accepted(selectChoice(s,restartChoice,0,id));
  expect(after.preparation.units).toEqual([]);expect(after.items).toHaveLength(3);expect(after.items.every(i=>i.location.kind==='inventory')).toBe(true);
  expect(()=>validateCarryGolem(after)).not.toThrow();expect(()=>fold(after)).not.toThrow();expect(()=>validateHistoricalEquipment(null,after)).not.toThrow();
  expect(grantCarryGolem(after).state).toBe(after);expect(growCarryGolem(after)).toBe(after);
  const withoutProof={...after,resourceProvenance:{...after.resourceProvenance,entries:after.resourceProvenance.entries.filter(e=>e.kind!=='restart-mission-completed')}};
  expect(()=>validateCarryGolem(withoutProof)).toThrow('carry golem authority');
});

it('removes the trainer golem, returns its emblems, and never recreates it on opening retries',()=>{
  const base=Array.from({length:200},(_,seed)=>createMatch(seed)).find(s=>openingEncounterId(s)==='trainer-golems');
  expect(base).toBeDefined();const s=offered(base!),after=selected(s);
  expect(after.preparation.units).toEqual([]);expect(after.items).toHaveLength(3);expect(after.items.every(i=>i.location.kind==='inventory')).toBe(true);
  expect(()=>validateTrainerGolems(after)).not.toThrow();expect(()=>validateOpeningEncounterState(after)).not.toThrow();
  expect(()=>fold(after)).not.toThrow();expect(()=>validateHistoricalEquipment(null,after)).not.toThrow();
  expect(enterTrainerGolems(after).state).toBe(after);
  const withoutProof={...after,resourceProvenance:{...after.resourceProvenance,entries:after.resourceProvenance.entries.filter(e=>e.kind!=='restart-mission-completed')}};
  expect(()=>validateTrainerGolems(withoutProof)).toThrow();
});

it('claims a solo augment orb through MatchSession with pause and observer behavior',()=>{
  const session=new MatchSession(selected());
  try {
    const orb=session.state.m8.loot.rewardOrbs![0];let changes=0;
    session.subscribe(()=>changes++);
    session.pause('test');expect(session.claimOrb(orb.orbId).ok).toBe(false);expect(changes).toBe(0);
    session.resume('test');expect(session.claimOrb(orb.orbId).ok).toBe(true);
    expect(session.state.preparation.units.some(u=>u.starLevel===2)).toBe(true);expect(changes).toBe(1);
    const before=session.state;expect(session.claimOrb(orb.orbId).ok).toBe(false);expect(session.state).toBe(before);
  } finally {session.dispose();}
});

it('uses the existing cost-only gold conversion for a pool with fewer than three copies',()=>{
  const capacities=Object.fromEntries(Object.values(SHOP_CATALOG_BY_COST).flat().map(unit=>[unit,1]));
  const r=chooseOnline(37,capacities),orb=r.state.m8.loot.rewardOrbs![3],definitionId=orbDefinition(orb);
  const claim=runSharedMatchCommand(r.pool,r.state,{type:'claimOrb',orbId:orb.orbId,round:r.state.round});
  if(!claim.ok)throw Error(claim.reason);
  expect(claim.state.gold-r.state.gold).toBe(UNIT_DEFINITIONS[definitionId].cost);
  expect(claim.state.preparation.units).toEqual([]);expect(claim.pool.available).toEqual(r.pool.available);
  expect(claim.pool.rewards.at(-1)).toMatchObject({definitionId,resolution:'gold',gold:2,starLevel:2});
  expect(()=>assertSharedPoolConservation(claim.pool,[claim.state])).not.toThrow();
});

it('lets the existing bot preparation transaction claim all six orbs without a second reward path',()=>{
  const r=chooseOnline(),claim=claimBotPreparationOrbs(r.pool,r.state);
  if(!claim.ok)throw Error(claim.reason);
  expect(claim.state.preparation.units).toHaveLength(6);expect(claim.state.preparation.units.every(u=>u.starLevel===2)).toBe(true);
  expect(claim.pool.holdings.reduce((sum,h)=>sum+h.sources.length,0)).toBe(18);
  expect(claim.state.m8.loot.receipts).toHaveLength(6);expect(()=>assertSharedPoolConservation(claim.pool,[claim.state])).not.toThrow();
});

it('merges three equal 2-star rewards only at claim, holding nine real pool copies',()=>{
  const seed=Array.from({length:3000},(_,i)=>i).find(i=>{const d=expectedDraws(i,'s0').slice(1,4);return new Set(d).size===1;});
  expect(seed).toBeDefined();const r=chooseOnline(seed),orbs=r.state.m8.loot.rewardOrbs!.slice(1,4),definitionId=orbDefinition(orbs[0]);
  expect(r.state.preparation.units).toEqual([]);let current=r;
  for(const [i,orb] of orbs.entries()) {
    const claim=runSharedMatchCommand(current.pool,current.state,{type:'claimOrb',orbId:orb.orbId,round:current.state.round});
    if(!claim.ok)throw Error(claim.reason);current={...r,...claim};
    expect(current.state.preparation.units).toHaveLength(i===2?1:i+1);
    expect(current.state.preparation.units[0].starLevel).toBe(i===2?3:2);
  }
  expect(current.pool.holdings[0]).toMatchObject({definitionId});expect(current.pool.holdings[0].sources).toHaveLength(9);
  expect(current.pool.available[definitionId]).toBe(r.pool.available[definitionId]-9);
  expect(()=>fold(current.state)).not.toThrow();expect(()=>assertSharedPoolConservation(current.pool,[current.state])).not.toThrow();
});

it('an empty acquisition completes once and does not clear later rewards',()=>{
  const base=offered(),s=selected({...base,preparation:{...base.preparation,units:[]}});
  expect(s.m8.loot.rewardOrbs).toHaveLength(6);expect(s.resourceProvenance.entries.filter(e=>e.kind==='restart-mission-completed')).toHaveLength(1);
  expect(applyRestartMission(s).state).toBe(s);expect(drainBatch1Gifts(s)).toBe(s);
  expect(applyRestartMission(base).state).toBe(base);
});

it('rejects stale and invalid choices atomically',()=>{
  const r=online();
  for(const command of [{type:'choose' as const,choiceId,generation:1,definitionId:id},{type:'choose' as const,choiceId,generation:0,definitionId:'unknown'}]) {
    const rejected=runSharedMatchCommand(r.pool,r.state,command);
    expect(rejected.ok).toBe(false);expect(rejected.pool).toBe(r.pool);expect(rejected.state).toBe(r.state);expect('events' in rejected).toBe(false);
  }
});

it('rejects missing/duplicate boundaries, retained old units, forged rewards and removed owners after JSON roundtrip',()=>{
  const s=JSON.parse(JSON.stringify(selected())) as MatchState;
  expect(()=>validateBatch1GiftReceipts(s)).not.toThrow();expect(()=>fold(s)).not.toThrow();
  const missing={...s,resourceProvenance:{...s.resourceProvenance,entries:s.resourceProvenance.entries.filter(e=>e.kind!=='restart-mission-completed')}};
  expect(()=>validateBatch1GiftReceipts(missing)).toThrow('restart mission authority');
  const duplicate={...s,resourceProvenance:appendResourceProvenance(s.resourceProvenance,s.roundDefinitionId,{kind:'restart-mission-completed',choiceId})};
  expect(()=>validateBatch1GiftReceipts(duplicate)).toThrow('restart mission authority');expect(()=>fold(duplicate)).toThrow('duplicate restart');
  const retained={...s,resourceProvenance:{...s.resourceProvenance,entries:s.resourceProvenance.entries.filter(e=>e.kind!=='unit-removed').map((e,sequence)=>({...e,sequence}))}};
  expect(()=>fold(retained)).toThrow('restart removal completeness');
  const forged=structuredClone(s);const receipt=forged.seatMechanics!.receipts.find(r=>r.kind==='unit')!;Object.assign(receipt,{starLevel:1});
  expect(()=>validateBatch1GiftReceipts(forged)).toThrow('gift authority');expect(()=>soloPveLoot(forged)).toThrow();
  expect(()=>validateBatch1GiftReceipts({...s,augments:[]})).toThrow('restart mission authority');
  const missingGift={...s,seatMechanics:{...s.seatMechanics!,receipts:s.seatMechanics!.receipts.slice(1)}};
  expect(()=>validateBatch1GiftReceipts(missingGift)).toThrow('restart mission authority');
  const missingOrb={...s,m8:{...s.m8,loot:{...s.m8.loot,rewardOrbs:s.m8.loot.rewardOrbs!.slice(1)}}};
  expect(()=>validateBatch1GiftReceipts(missingOrb)).toThrow('restart mission authority');
});

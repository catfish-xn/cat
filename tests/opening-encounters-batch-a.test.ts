import { expect, it } from 'vitest';
import { createMatch, nextRound, startMatchCombat, selectAnomalyTarget, claimOrb, openAnvil, selectChoice, rerollAugment, type MatchState } from '../src/simulation/match';
import { isAnvil } from '../src/simulation/content/anvils';
import { createOpeningEncounter, planOpeningRound, applyOpeningEffects, commitOpeningEncounterHealth,
  validateOpeningEncounterState, isMelBlessingCrossing, readOpeningMelProgress } from '../src/simulation/opening-encounter';
import { OPENING_BATCH_A } from '../src/simulation/content/opening-batch-a';
import { openingWeightedIndex, openingWords } from '../src/simulation/opening-random';
import { melBranch, subscriptionBucket, subscriptionGold, subscriptionFact, openingRewardAtoms, openingRewardOrbs, openingRewardOffers, BATCH_SOURCE } from '../src/simulation/opening-batch-rewards';
import { sixCostOddsBps, sixCostSlotFromWords, planSixCostShop } from '../src/simulation/six-cost-shop';
import { openingStage } from '../src/simulation/opening-stage';
import { generateShop } from '../src/simulation/shop';
import { getMultiplayerRoundByOrdinal } from '../src/simulation/multiplayer-round';
import { getCatalogRoundById } from '../src/simulation/round-selectors';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { G24_FORGE_POOLS } from '../src/simulation/content/g2-4-forges';
import { UNIT_DEFINITIONS } from '../src/simulation/units';
import { grantMechanicItem } from '../src/simulation/seat-mechanics/grants';
import { readG23Progress } from '../src/simulation/g2-3-state';
import { crownTeamSizeBonus } from '../src/simulation/deployment-cap';
import { createSharedPool, initializeSharedSeat, refreshSharedShops, nextSharedRound, runSharedMatchCommand,
  setSharedShopLock, rerollSharedShop, restoreSharedOrbSnapshot, assertSharedPoolConservation } from '../src/simulation/shared-pool';
import { resolveRoundEconomy } from '../src/simulation/round-economy';
import { syntheticSharedRound } from './tp-helpers';
import { accepted, reachRound, resolveM5Choices, emptyBoard, freeze } from './match-helpers';
import { BattleHistory } from '../src/replay/history';
import type { LedgerCombatEvent } from '../src/simulation/combat-types';
import { captureAugmentHistoryAuthority } from '../src/simulation/augment-history';

const melSeeds=new Map<number,number>(),goldSeeds=new Map<number,number>(),lootSeeds=new Map<number,number>();
let viktorSeed=0;
for(let seed=0;seed<500000&&(melSeeds.size<13||goldSeeds.size<5||lootSeeds.size<9||!viktorSeed);seed++){
  const id=createOpeningEncounter(seed).selection.encounterId;
  if(id==='mels-blessing'&&!melSeeds.has(melBranch(seed)))melSeeds.set(melBranch(seed),seed);
  if(id==='gold-subscription'&&!goldSeeds.has(subscriptionBucket(seed,id,2)))goldSeeds.set(subscriptionBucket(seed,id,2),seed);
  if(id==='loot-subscription'&&!lootSeeds.has(subscriptionBucket(seed,id,2)))lootSeeds.set(subscriptionBucket(seed,id,2),seed);
  if(id==='viktors-vision')viktorSeed=seed;
}
const acceptOrb=(r:ReturnType<typeof claimOrb>):MatchState=>{expect(r.ok).toBe(true);if(!r.ok)throw Error(r.reason);return r.state;};
const streams=(s:MatchState)=>[s.rngState,s.choiceRngState,s.rewardRngState,s.battleSeedRngState,s.reforgeState];
const firstWord=(n:number,total=100)=>Number((BigInt(n)*4294967296n+BigInt(total)-1n)/BigInt(total));
function oracle(seed:number,path:string,n:number){let h=2166136261n;for(const c of `opening-encounter-v1/${path}`)h=((h^BigInt(c.charCodeAt(0)))*16777619n)&0xffffffffn;let r=BigInt(seed)^h;return Array.from({length:n},()=>{r=(r*1664525n+1013904223n)&0xffffffffn;return Number(r);});}
function at(s:MatchState,round:number):MatchState{const r=getMultiplayerRoundByOrdinal(round);return {...s,round,roundDefinitionId:r.roundId,m8:{...s.m8,round:r},phase:'preparation',pendingChoice:null,combat:null};}
/** Isolated settlement vectors; these synthetic HP records are not claimed to be a natural saved match. */
function melCross(seed:number,hpAfter=40):MatchState {
  const s=createMatch(seed);
  return {...s,phase:'settlement',combat:null,playerHp:hpAfter,roundResults:[{round:1,roundId:'1-2',settlementId:'mel-vector',hpBefore:41,hpAfter} as MatchState['roundResults'][number]]};
}
function applyAt(s:MatchState,round:number):MatchState {
  s=at(s,round);if(s.openingEncounter.mode!=='solo')throw Error('solo vector');
  const r=applyOpeningEffects(s,planOpeningRound(s.openingEncounter.context,s.roundDefinitionId).facts);
  if(!r.ok)throw Error(r.reason);return r.state;
}

it('finds every approved branch under actual opening selection',()=>{
  expect(melSeeds.size).toBe(13);expect(goldSeeds.size).toBe(5);expect(lootSeeds.size).toBe(9);expect(viktorSeed).toBeGreaterThan(0);
});
it.each([
  ['Mel',[7,15,10,15,10,15,10,2,10,1,1,1,3],OPENING_BATCH_A.melWeights],
  ['gold',[15,35,25,23,0,2],OPENING_BATCH_A.goldWeights],
  ['loot',[3,14,14,13,14,14,14,13,1],OPENING_BATCH_A.lootWeights],
] as const)('%s independent cumulative lower/upper bounds, including zero weight',(_name,expected,actual)=>{
  expect(actual).toEqual(expected);let start=0;
  expected.forEach((weight,index)=>{if(weight){expect(openingWeightedIndex(firstWord(start),actual)).toBe(index);expect(openingWeightedIndex(firstWord(start+weight)-1,actual)).toBe(index);}start+=weight;});expect(start).toBe(100);
});
it('shared/seat streams match a separate BigInt oracle and preserve other RNG',()=>{
  for(let seed=0;seed<1024;seed++){
    expect(openingWords(seed,'shared/mels-blessing/outcome',1)).toEqual(oracle(seed,'shared/mels-blessing/outcome',1));
    expect(openingWords(seed,'seat/seat-7/loot-subscription/stage/2',12)).toEqual(oracle(seed,'seat/seat-7/loot-subscription/stage/2',12));
  }
  for(const seed of [...melSeeds.values()]){const s=melCross(seed);expect(streams(commitOpeningEncounterHealth(s))).toEqual(streams(s));}
});
it('gold amounts are independent hand vectors for stages 2–8, including extrapolation',()=>{
  const expected=[[1,1,2,2,3,3,4],[2,3,4,5,6,7,8],[4,6,8,10,12,14,16],[10,15,20,25,30,35,40],[16,24,32,40,48,56,64]];
  [0,1,2,3,5].forEach((b,i)=>expect([2,3,4,5,6,7,8].map(s=>subscriptionGold(s,b))).toEqual(expected[i]));
  expect(()=>subscriptionGold(2,4)).toThrow();
});
it('stage-only extension keeps 6-7 and maps overtime 1/8/15 to 7-1/8-1/9-1',()=>{
  expect([38,39,45,46,53].map(openingStage)).toEqual([{stage:6,subround:7},{stage:7,subround:1},{stage:7,subround:7},{stage:8,subround:1},{stage:9,subround:1}]);
});
const qRows=[
 ['4-1',0,0,10,340],['4-5',0,0,10,340],['4-6',16,126,48,378],['4-7',16,126,48,378],
 ['5-1',19,129,57,387],['5-2',22,132,66,396],['5-3',25,135,75,405],['5-4',28,138,84,414],['5-5',28,138,84,414],['5-6',31,141,93,423],['5-7',34,144,102,432],
 ['6-1',38,148,114,444],['6-2',42,152,126,456],['6-3',46,156,138,468],['6-4',50,160,150,480],['6-5',50,160,150,480],['6-6',54,164,162,492],['6-7',58,168,174,504],
 ['overtime-1',78,188,234,564],['overtime-2',98,208,294,624],['overtime-3',118,228,354,684],['overtime-4',138,248,414,744],['overtime-5',138,248,414,744],['overtime-6',158,268,474,804],['overtime-7',178,288,534,864],['overtime-8',400,510,1200,1530],
] as const;
it.each(qRows)('entire V1 row %s is q, all four columns',(id,a,b,c,d)=>{
  const round=id.startsWith('overtime-')?38+Number(id.slice(9)):getCatalogRoundById(id).ordinal;
  expect([sixCostOddsBps(round,1),sixCostOddsBps(round,10),sixCostOddsBps(round,9,true),sixCostOddsBps(round,10,true)]).toEqual([a,b,c,d]);
});
it('one shop success has P=5q, never q or five independent slot rolls',()=>{
  // q=16bps gives P=80bps. Exact first failing word is ceil(.008*2^32).
  expect(sixCostSlotFromWords(16,34359738,0)).toBe(0);expect(sixCostSlotFromWords(16,34359739,0)).toBeNull();
  expect(sixCostSlotFromWords(10,21474836,0xffffffff)).toBe(4);expect(sixCostSlotFromWords(10,21474837,0)).toBeNull();
  expect(sixCostSlotFromWords(10000,0xffffffff,0xffffffff)).toBe(4);expect(sixCostSlotFromWords(0,0,0)).toBeNull();
  for(let seed=0;seed<400;seed++){
    const ctx={seed,seatId:'solo',viktor:true},s=generateShop(123,2,10,46,ctx),normal=generateShop(123,2,10,1,ctx);
    const six=s.shop.slots.filter(x=>x.status==='available'&&UNIT_DEFINITIONS[x.definitionId]?.cost===6);
    expect(six.length).toBe(planSixCostShop(46,10,2,ctx).slot===null?0:1);expect(s.rngState).toBe(normal.rngState);
  }
});
it.each([[41,40,true],[41,39,true],[41,0,false],[40,39,false],[39,40,false]])('Mel crossing %i→%i is %s',(oldHp,newHp,yes)=>{
  expect(isMelBlessingCrossing(oldHp as number,newHp as number)).toBe(yes);
  const s=melCross(melSeeds.get(1)!,newHp as number),after=commitOpeningEncounterHealth(s);
  expect(after.gold-s.gold).toBe(newHp===0?0:30);expect(commitOpeningEncounterHealth(after)).toBe(after);
});
it.each([1,2,4,5,6,7,8,9,10,11,12,13,14])('Mel branch %i has independent exact payload vector',branch=>{
  const after=commitOpeningEncounterHealth(melCross(melSeeds.get(branch)!)),p=openingRewardAtoms(after).map(a=>a.payload);
  const kinds:Record<number,string[]>={1:['gold'],2:['consumable','item','item','item'],4:['item','item','item','item','consumable'],5:['item'],6:['item','item','item','consumable','gold'],7:['item','item'],8:['item','item','unit'],9:['forge','forge','item','item'],10:['item','item','item','consumable','gold'],11:['gold'],12:['item','item'],13:['gold','consumable','consumable'],14:Array(8).fill('item')};
  expect(p.map(p=>p.kind)).toEqual(kinds[branch]);
  // Columns: gold, components, duplicators, spatulas, pans, crowns, gloves, reforgers, five-costs, component forges.
  const hand:Record<number,number[]>={1:[30,0,0,0,0,0,0,0,0,0],2:[0,2,1,1,0,0,0,0,0,0],4:[0,4,0,0,0,0,0,1,0,0],5:[0,0,0,0,0,1,0,0,0,0],6:[10,2,0,1,0,0,0,1,0,0],7:[0,0,0,0,0,0,2,0,0,0],8:[0,2,0,0,0,0,0,0,1,0],9:[0,0,0,1,1,0,0,0,0,2],10:[10,2,0,0,1,0,0,1,0,0],11:[50,0,0,0,0,0,0,0,0,0],12:[0,0,0,0,0,2,0,0,0,0],13:[20,0,2,0,0,0,0,0,0,0],14:[0,8,0,0,0,0,0,0,0,0]};
  const count=(id:string)=>p.filter(x=>'definitionId' in x&&x.definitionId===id).length;
  expect([p.reduce((n,x)=>n+(x.kind==='gold'?x.quantity:0),0),p.filter(x=>x.kind==='item'&&['belt','bow','cloak','gloves','rod','sword','tear','vest'].includes(x.definitionId)).length,
    count('TFT_Consumable_NeekosHelp'),count('spatula'),count('frying-pan'),count('TFT_Item_ForceOfNature'),count('thiefs-gloves'),count('reforger'),p.filter(x=>x.kind==='unit').length,count('TFT_ArmoryKeyComponent')]).toEqual(hand[branch]);

  if(branch===12){expect(p).toEqual(Array(2).fill({kind:'item',definitionId:'TFT_Item_ForceOfNature',quantity:1}));let claimed=after;for(const orb of openingRewardOrbs(after))claimed=acceptOrb(claimOrb(claimed,orb.orbId,claimed.round));expect(crownTeamSizeBonus(readG23Progress(claimed))).toBe(2);}
  if(branch===8){const u=p[2];expect(u).toMatchObject({kind:'unit',starLevel:1,quantity:1});if(u.kind==='unit')expect(UNIT_DEFINITIONS[u.definitionId].cost).toBe(5);}
  if(branch===14){const ids=p.map(p=>'definitionId' in p?p.definitionId:'');expect(new Set(ids).size).toBeLessThan(8);for(const id of ids)expect(G24_FORGE_POOLS.TFT_ArmoryKeyComponent).toContain(id);}
  expect(readOpeningMelProgress(after)).toMatchObject({thresholdReached:true,rewardStatus:'granted'});
  expect(()=>validateOpeningEncounterState(after)).not.toThrow();
});
it.each([0,1,2,3,4,5,6,7,8])('loot category %i: public 2-1 lifecycle, save restore and no duplicate',bucket=>{
  const seed=lootSeeds.get(bucket)!,s=reachRound('2-1',false,seed);
  const p=openingRewardAtoms(s).map(a=>a.payload);
  expect(p.map(x=>x.kind)).toEqual(bucket===0?[]:[['','item','gold','forge','forge','unit','item','consumable','item'][bucket]]);
  if(bucket===0)expect(s.seatMechanics?.receipts.filter(r=>r.source===BATCH_SOURCE)).toHaveLength(0);
  if(bucket===5)expect(p[0]).toMatchObject({kind:'unit',starLevel:2});
  const restored=restoreMatch(serializeMatch(s));expect(restored).toEqual(s);
  const context=createOpeningEncounter(seed),retry=applyOpeningEffects(restored,planOpeningRound(context,'2-1').facts);
  expect(retry).toEqual({ok:true,state:restored,events:[]});
});
it.each([0,1,2,3,5])('gold bucket %i: public grant before augment, replay equality and restore',bucket=>{
  const seed=goldSeeds.get(bucket)!,a=reachRound('2-1',false,seed),b=reachRound('2-1',false,seed);
  expect(a).toEqual(b);expect(a.phase).toBe('choice');
  expect(a.seatMechanics?.receipts.filter(r=>r.source===BATCH_SOURCE)).toMatchObject([{kind:'gold',amount:[1,2,4,10,0,16][bucket]}]);
  expect(restoreMatch(serializeMatch(a))).toEqual(a);
});
it('subscriptions never issue before 2-1 and continue independently at 7-1 / 8-1',()=>{
  for(const seed of [goldSeeds.get(0)!,lootSeeds.get(5)!]){
    let s=createMatch(seed);const id=createOpeningEncounter(seed).selection.encounterId;
    expect(openingRewardAtoms(s)).toEqual([]);
    for(let round=2;round<=46;round++){
      const before=s;s=applyAt(s,round);expect(streams(s)).toEqual(streams(before));
      const f=subscriptionFact(seed,id,round);
      if(f)expect(s.openingEncounter.mode==='solo'&&s.openingEncounter.receipts.at(-1)?.nodeId).toBe(s.roundDefinitionId);
    }
    expect(s.openingEncounter.mode==='solo'&&s.openingEncounter.receipts.map(r=>r.nodeId)).toEqual(['2-1','3-1','4-1','5-1','6-1','overtime-1','overtime-8']);
  }
});
it('tampered or missing prior subscription receipts and rewards are rejected, never repaired',()=>{
  const s=reachRound('2-1',false,goldSeeds.get(3)!);
  const bad=structuredClone(s);if(bad.openingEncounter.mode!=='solo')throw Error();
  (bad.openingEncounter as unknown as {receipts:unknown[]}).receipts=[];
  expect(()=>validateOpeningEncounterState(bad)).toThrow();
  expect(()=>restoreMatch(JSON.stringify(bad))).toThrow();
  const missing={...s,seatMechanics:{...s.seatMechanics!,receipts:s.seatMechanics!.receipts.filter(r=>r.source!==BATCH_SOURCE)}};
  expect(()=>validateOpeningEncounterState(missing)).toThrow();
});

/** Real admission, three real PvE command paths, then trusted PvP settlement receipts. */
function sharedThrough(seed:number,target:number,count=2,capacities?:Readonly<Record<string,number>>){
  let pool=createSharedPool(`batch-${seed}`,seed,{seatCount:count,...(capacities?{capacities}:{})}),states:MatchState[]=[];
  for(let i=0;i<count;i++){const r=initializeSharedSeat(pool,createMatch(100+i,{mode:'shared-deferred'}),i===0?'solo':`seat-${i}`,i);if(!r.ok)throw Error(r.reason);pool=r.pool;states.push(r.state);}
  const first=refreshSharedShops(pool,states,1);if(!first.ok)throw Error(first.reason);pool=first.pool;states=[...first.states];
  for(let round=1;round<target;round++){
    for(let i=0;i<count;i++){
      let state=states[i];
      const command=(c:import('../src/simulation/shared-pool-types').SharedMatchCommand)=>{const r=runSharedMatchCommand(pool,state,c);if(!r.ok)throw Error(`${round}/${i}/${c.type}:${r.reason}`);pool=r.pool;state=r.state;};
      while(state.phase==='choice'){const c=state.pendingChoice!;if(c.step==='target'){state=accepted(selectAnomalyTarget(state,c.choiceId,c.generation,state.preparation.units.find(u=>u.team==='player')!.id));continue;}command({type:'choose',choiceId:c.choiceId,generation:c.generation,definitionId:c.offers.find(x=>x!=='placebo')??c.offers[0]});}
      if(state.phase==='preparation'){
        if(state.m8.round.kind==='pvp'){
          const e=resolveRoundEconomy({roundId:state.roundDefinitionId,result:'playerWin',gold:state.gold,hp:state.playerHp,level:state.level,xp:state.xp,streak:state.streak,enemySurvivors:0,augments:state.augments});
          command({type:'settleRound',receipt:{version:'multiplayer-settlement-v1',settlementId:`b-${round}-${i}`,battleId:`battle-${round}-${i}`,seatId:state.multiplayer!.seatId,round,roundId:state.roundDefinitionId,settlementEligible:true,result:'win',damage:0,baseDamage:e.baseDamage,opposingSurvivors:0,growth:[],combatTicks:0,combatEventCount:1}});
        }else{state=emptyBoard(state);command({type:'startCombat'});}
      }
      while(state.phase==='choice'){const c=state.pendingChoice!;if(c.step==='target'){state=accepted(selectAnomalyTarget(state,c.choiceId,c.generation,state.preparation.units.find(u=>u.team==='player')!.id));continue;}command({type:'choose',choiceId:c.choiceId,generation:c.generation,definitionId:c.offers[0]});}
      states[i]=state;
    }
    const r=nextSharedRound(pool,states,round);if(!r.ok)throw Error(`advance ${round}: ${r.reason}`);pool=r.pool;states=[...r.states];
  }
  return {pool,states};
}
it.each([0,1,2,3,4,5,6,7,8])('shared loot category %i: same entitlement as solo, restore/retry and pool claim',bucket=>{
  const seed=lootSeeds.get(bucket)!,solo=reachRound('2-1',false,seed),{pool,states}=sharedThrough(seed,4);
  expect(openingRewardAtoms(states[0]).map(a=>a.payload)).toEqual(openingRewardAtoms(solo).map(a=>a.payload));
  assertSharedPoolConservation(pool,states);
  for(const state of states){
    expect(restoreSharedOrbSnapshot(pool,JSON.stringify(state))).toEqual(state);
    const retry=applyOpeningEffects(state,planOpeningRound(pool.openingEncounter,'2-1').facts,pool.openingEncounter);
    expect(retry).toEqual({ok:true,state,events:[]});
  }
  if(bucket===5){
    let p=pool,s=states[0];
    while(s.phase==='choice'){const c=s.pendingChoice!,r=runSharedMatchCommand(p,s,{type:'choose',choiceId:c.choiceId,generation:c.generation,definitionId:c.offers[0]});if(!r.ok)throw Error(r.reason);p=r.pool;s=r.state;}
    const orbId=openingRewardOrbs(s)[0].orbId,payload=openingRewardAtoms(s)[0].payload;
    if(payload.kind!=='unit')throw Error('unit');const before=p.available[payload.definitionId];
    const r=runSharedMatchCommand(p,s,{type:'claimOrb',round:4,orbId});if(!r.ok)throw Error(r.reason);
    expect(r.pool.available[payload.definitionId]).toBe(before-3);expect(r.state.preparation.units.some(u=>u.definitionId===payload.definitionId&&u.starLevel===2)).toBe(true);
    expect(restoreSharedOrbSnapshot(r.pool,JSON.stringify(r.state))).toEqual(r.state);
    assertSharedPoolConservation(r.pool,[r.state,states[1]]);
  }
});
it('eight gold subscribers receive one shared amount including bots; private streams unchanged',()=>{
  const seed=goldSeeds.get(5)!,{pool,states}=sharedThrough(seed,4,8);
  for(const state of states)expect(state.seatMechanics!.receipts.filter(r=>r.source===BATCH_SOURCE)).toMatchObject([{kind:'gold',amount:16}]);
  assertSharedPoolConservation(pool,states);
});
it('ordinary and Viktor shop lock preserves generation and all RNG; rejected reroll is atomic',()=>{
  const {pool,states}=sharedThrough(viktorSeed,4),s=resolveM5Choices(states[0]);
  const r=setSharedShopLock(pool,s,true,s.shop.generation);
  expect(r.ok).toBe(true);
  if(!r.ok)return;
  expect(r.state.shop.slots).toEqual(s.shop.slots);expect(streams(r.state)).toEqual(streams(s));
  const poor={...r.state,gold:0},denied=rerollSharedShop(r.pool,poor,poor.shop.generation);
  expect(denied).toMatchObject({ok:false,reason:'insufficient-gold'});expect(denied.state).toBe(poor);expect(denied.pool).toBe(r.pool);
});
it('Mel real command crossing and restore grants once; receipt tampering is rejected',()=>{
  let s=createMatch(melSeeds.get(1)!);
  for(let i=0;i<30&&!readOpeningMelProgress(s)?.thresholdReached;i++){
    s=resolveM5Choices(s);
    if(s.phase==='preparation')s=accepted(startMatchCombat(emptyBoard(s)));
    s=resolveM5Choices(s);
    if(!readOpeningMelProgress(s)?.thresholdReached&&s.phase==='settlement')s=accepted(nextRound(s,s.round));
  }
  expect(readOpeningMelProgress(s)?.thresholdReached).toBe(true);
  expect(restoreMatch(serializeMatch(s))).toEqual(s);
  expect(commitOpeningEncounterHealth(s)).toBe(s);
});

it('full unit bench preserves Mel entitlement in a claimable orb, then claims exactly once',()=>{
  let s=melCross(melSeeds.get(8)!);
  const hero=s.preparation.units.find(u=>u.team==='player')!;
  s={...s,preparation:{...s.preparation,units:[...s.preparation.units.filter(u=>u.team!=='player'),...Array.from({length:s.preparation.benchSize},(_,i)=>({...hero,id:`fixture-${i}`,location:{kind:'bench' as const,slot:i}}))]}};
  const after=commitOpeningEncounterHealth(freeze(s)),orb=openingRewardOrbs(after).find(o=>o.entries[0].payload.kind==='unit')!;
  expect(orb).toBeDefined();expect(after.preparation.units).toEqual(s.preparation.units);
  const full=claimOrb(after,orb.orbId,after.round);expect(full.ok).toBe(true);expect(full.state.preparation.units).toEqual(after.preparation.units);
  const room={...after,preparation:{...after.preparation,units:after.preparation.units.filter(u=>u.id!=='fixture-0')}};
  const claimed=claimOrb(room,orb.orbId,room.round);expect(claimed.ok).toBe(true);
  expect(openingRewardOrbs(claimed.state).find(o=>o.orbId===orb.orbId)).toBeUndefined();
  const retry=claimOrb(claimed.state,orb.orbId,claimed.state.round);expect(retry.ok).toBe(false);expect(retry.state).toBe(claimed.state);
});
it('forge rewards resolve through the existing choice command and authenticate offers and provenance',()=>{
  // v22 anvil units: the loot-subscription forge stays an orb, is claimed as a bench anvil and opened by selling.
  for(const bucket of [3,4]){
    const s=resolveM5Choices(reachRound('2-1',false,lootSeeds.get(bucket)!));
    expect(s.pendingChoice).toBeNull();
    const atom=openingRewardAtoms(s).find(a=>a.payload.kind==='forge')!,offers=openingRewardOffers(s,atom);
    expect(openingRewardOrbs(s).map(o=>o.orbId)).toContain(atom.id);
    const held=acceptOrb(claimOrb(s,atom.id,s.round)),anvil=held.preparation.units.find(u=>isAnvil(u.definitionId))!;
    expect(held.seatMechanics!.receipts.filter(r=>r.source===BATCH_SOURCE)).toMatchObject([{kind:'unit',unitId:anvil.id,resolution:'held',gold:0}]);
    expect(openingRewardOrbs(held)).toHaveLength(0);
    const opened=accepted(openAnvil(held,anvil.id)),c=opened.pendingChoice!;
    expect(c).toMatchObject({kind:'forge',offers});expect(restoreMatch(serializeMatch(opened))).toEqual(opened);
    const bad=structuredClone(opened);(bad.pendingChoice as unknown as {offers:string[]}).offers=['bf-sword',...offers.slice(1)];
    expect(()=>restoreMatch(serializeMatch(bad))).toThrow();
    const after=accepted(selectChoice(opened,c.choiceId,c.generation,c.offers[0]));
    expect(after.seatMechanics!.receipts.filter(r=>r.source==='anvil-unit')).toMatchObject([{kind:'choice',choiceKind:'forge',price:0,skipped:false}]);
    expect(restoreMatch(serializeMatch(after))).toEqual(after);
  }
});
it('six-cost shop uses common root/seat/generation and exact uniform slot boundaries',()=>{
  for(let slot=0;slot<5;slot++){
    expect(sixCostSlotFromWords(2000,0,firstWord(slot,5))).toBe(slot);
    expect(sixCostSlotFromWords(2000,0,firstWord(slot+1,5)-1)).toBe(slot);
  }
  const ctx={seed:viktorSeed,seatId:'seat-3',viktor:true};
  const [hit,slot,memberWord]=oracle(viktorSeed,'seat/seat-3/six-cost-shop/37',3);
  expect(planSixCostShop(23,10,37,ctx)).toEqual({slot:hit*10000<1890*4294967296?Math.floor(slot*5/4294967296):null,memberWord});
});
it('two-star subscription fee uses stage minus one capped at five, no six-cost identity',()=>{
  let s=createMatch(lootSeeds.get(5)!);let seen=0;
  for(let round=2;round<=80;round++){
    s=applyAt(s,round);
    for(const a of openingRewardAtoms(s))if(a.payload.kind==='unit'){
      expect(a.payload.starLevel).toBe(2);expect(UNIT_DEFINITIONS[a.payload.definitionId].cost).toBe(Math.min(5,Math.max(1,openingStage(a.round).stage-1)));seen++;
    }
  }
  expect(seen).toBeGreaterThan(0);
});
it('boot is only a resolved presentation event: no resources, no pity, no legacy RNG',()=>{
  const seed=lootSeeds.get(0)!,base=at(createMatch(seed),4),r=applyOpeningEffects(base,planOpeningRound(createOpeningEncounter(seed),'2-1').facts);
  expect(r.ok).toBe(true);if(!r.ok)return;
  expect(r.events.map(e=>e.type)).toEqual(['openingEffectApplied','openingRewardResolved']);
  expect([r.state.gold,r.state.items,r.state.consumables,r.state.preparation,streams(r.state)]).toEqual([base.gold,base.items,base.consumables,base.preparation,streams(base)]);
});
it('real shared lifecycle continues gold subscriptions through 6-7 into overtime 8 and restores',()=>{
  const {pool,states}=sharedThrough(goldSeeds.get(0)!,46);
  for(const s of states){
    // Capture the trusted command result before serializing the candidate; online history requires a separate server checkpoint.
    const authority=captureAugmentHistoryAuthority(s);
    expect(s.roundDefinitionId).toBe('overtime-8');
    expect(s.openingEncounter.mode==='shared'&&s.openingEncounter.receipts.map(r=>r.nodeId)).toEqual(['2-1','3-1','4-1','5-1','6-1','overtime-1','overtime-8']);
    expect(restoreSharedOrbSnapshot(pool,JSON.stringify(s),authority)).toEqual(s);
    expect(()=>restoreSharedOrbSnapshot(pool,JSON.stringify({...s,gold:s.gold+1}),authority)).toThrow('server facts/state mismatch');
  }
},30000);
it('shared two-star gift with fewer than three copies falls back to existing cost gold',()=>{
  const seed=lootSeeds.get(5)!,solo=reachRound('2-1',false,seed),payload=openingRewardAtoms(solo)[0].payload;
  if(payload.kind!=='unit')throw Error('unit');
  const capacities={...createSharedPool('capacity',seed).initial,[payload.definitionId]:2};
  const before=sharedThrough(seed,4,2,capacities);let pool=before.pool,state=before.states[0];
  while(state.phase==='choice'){const c=state.pendingChoice!,r=runSharedMatchCommand(pool,state,{type:'choose',choiceId:c.choiceId,generation:c.generation,definitionId:c.offers[0]});if(!r.ok)throw Error(r.reason);pool=r.pool;state=r.state;}
  const orb=openingRewardOrbs(state)[0],stock=pool.available[payload.definitionId];
  const r=runSharedMatchCommand(pool,state,{type:'claimOrb',round:4,orbId:orb.orbId});if(!r.ok)throw Error(r.reason);
  expect(r.state.gold-state.gold).toBe(1);expect(r.pool.available[payload.definitionId]).toBe(stock);
  expect(r.state.seatMechanics!.receipts.at(-1)).toMatchObject({kind:'unit',resolution:'gold',gold:1,starLevel:2});
  expect(restoreSharedOrbSnapshot(r.pool,JSON.stringify(r.state))).toEqual(r.state);
});
it('shared Viktor sampling never creates a second six-cost and conserves returned ordinary reservations',()=>{
  const before=sharedThrough(viktorSeed,4),synthetic=syntheticSharedRound(before.pool,before.states,46);
  let pool=synthetic.pool,state={...at(synthetic.states[0],46),gold:1000,level:10};
  for(let i=0;i<40;i++){
    const expected=planSixCostShop(46,10,state.shop.generation+1,{seed:viktorSeed,seatId:'solo',viktor:true});
    const r=rerollSharedShop(pool,state,state.shop.generation);if(!r.ok)throw Error(r.reason);pool=r.pool;state=r.state;
    expect(state.shop.slots.filter(s=>s.status==='available'&&UNIT_DEFINITIONS[s.definitionId].cost===6)).toHaveLength(expected.slot===null?0:1);
    assertSharedPoolConservation(pool,[state]);
  }
});
it('Mel shared settlement matches solo payloads and stamps the reward event exactly once',()=>{
  const seed=melSeeds.get(2)!,before=sharedThrough(seed,4);let pool=before.pool,state=before.states[0];
  while(state.phase==='choice'){const c=state.pendingChoice!,r=runSharedMatchCommand(pool,state,{type:'choose',choiceId:c.choiceId,generation:c.generation,definitionId:c.offers[0]});if(!r.ok)throw Error(r.reason);pool=r.pool;state=r.state;}
  state={...state,playerHp:41};
  const econ=resolveRoundEconomy({roundId:'2-1',result:'enemyWin',gold:state.gold,hp:41,level:state.level,xp:state.xp,streak:state.streak,enemySurvivors:0,augments:state.augments});
  const command={type:'settleRound' as const,receipt:{version:'multiplayer-settlement-v1' as const,settlementId:'mel-online-vector',battleId:'mel-online-battle',seatId:'solo',round:4,roundId:'2-1',settlementEligible:true,result:'loss' as const,damage:econ.playerDamage,baseDamage:econ.baseDamage,opposingSurvivors:0,growth:[],combatTicks:0,combatEventCount:1}};
  const r=runSharedMatchCommand(pool,state,command);if(!r.ok)throw Error(r.reason);
  expect(r.state.playerHp).toBeLessThanOrEqual(40);
  expect(openingRewardAtoms(r.state).map(a=>a.payload)).toEqual(openingRewardAtoms(commitOpeningEncounterHealth(melCross(seed))).map(a=>a.payload));
  const grants=r.events.filter(e=>e.type==='mechanicGranted'&&e.receipt.source===BATCH_SOURCE);
  expect(grants).toHaveLength(1);expect(new Set(grants.map(e=>e.type==='mechanicGranted'&&e.receipt.receiptId)).size).toBe(1);expect(openingRewardOrbs(r.state)).toHaveLength(3);
  expect(r.events.filter(e=>e.type==='openingRewardResolved')).toHaveLength(1);
  const retry=runSharedMatchCommand(r.pool,r.state,command);expect(retry.ok).toBe(false);expect(retry.state).toBe(r.state);
  expect(restoreSharedOrbSnapshot(r.pool,JSON.stringify(r.state))).toEqual(r.state);
});
it('crowded item inventory: Mel rewards stay in pending orbs without inventing a capacity or losing pieces',()=>{
  let before=melCross(melSeeds.get(14)!);
  for(let i=0;i<20;i++){const g=grantMechanicItem(before,{receiptId:`fixture-item-${i}`,source:'batch-vector',definitionId:'sword'});if(!g.ok)throw Error(g.reason);before=g.state;}
  const after=commitOpeningEncounterHealth(freeze(before));
  expect(after.items).toEqual(before.items);expect(openingRewardOrbs(after)).toHaveLength(8);
  const snapshot=JSON.parse(JSON.stringify(after)) as MatchState;
  expect(()=>validateOpeningEncounterState(snapshot)).not.toThrow();expect(commitOpeningEncounterHealth(snapshot)).toBe(snapshot);
  let claimed=snapshot;for(const orb of openingRewardOrbs(snapshot))claimed=acceptOrb(claimOrb(claimed,orb.orbId,claimed.round));
  expect(claimed.items).toHaveLength(28);expect(openingRewardOrbs(claimed)).toHaveLength(0);
});
it('item subscription survives strict save before/after pickup and refuses repeated pickup',()=>{
  // Take a 2-1 augment that grants no items: the 14.24 stage bans changed this seed's offers to item augments, so the
  // free card rerolls look further (public commands only).
  let open=reachRound('2-1',false,lootSeeds.get(8)!),before:MatchState|undefined;
  for(let slot=0;!before;slot++){
   const c=open.pendingChoice!;
   before=c.offers.map(id=>resolveM5Choices(accepted(selectChoice(open,c.choiceId,c.generation,id)))).find(s=>s.items.length===0);
   if(!before){expect(slot).toBeLessThan(3);open=accepted(rerollAugment(open,c.choiceId,c.generation,slot));}
  }
  const restored=restoreMatch(serializeMatch(before)),orb=openingRewardOrbs(restored)[0];
  expect(restored.items).toHaveLength(0);expect(crownTeamSizeBonus(readG23Progress(restored))).toBe(0);
  const result=claimOrb(restored,orb.orbId,restored.round);expect(result.ok).toBe(true);if(!result.ok)return;
  expect(crownTeamSizeBonus(readG23Progress(result.state))).toBe(1);
  expect(restoreMatch(serializeMatch(result.state))).toEqual(result.state);
  expect(claimOrb(result.state,orb.orbId,result.state.round).ok).toBe(false);
});
it.each(['gold','loot','mel'] as const)('%s command replay around reward boundary preserves complete state and event ledger',kind=>{
  const seed=kind==='gold'?goldSeeds.get(3)!:kind==='loot'?lootSeeds.get(3)!:melSeeds.get(2)!;
  // Mel crosses after real battles; retain their complete ledgers for any history-dependent augment on this route.
  const history=new BattleHistory(`batch-a-${kind}`);
  const roundTrip=(s:MatchState)=>restoreMatch(serializeMatch(s,history.completedRecords),history.completedRecords);
  let state=createMatch(seed),observed=false;
  for(let i=0;i<32&&!observed;i++){
    state=resolveM5Choices(state);
    if(state.phase==='preparation'){
      const before=emptyBoard(state),copy=roundTrip(before);
      const a=startMatchCombat(before),b=startMatchCombat(copy);expect(b).toEqual(a);
      if(!a.ok)throw Error(a.reason);state=a.state;
      history.observe({before,after:state,events:a.events.filter((e):e is LedgerCombatEvent=>e.domain==='combat'),reason:'command'});
      observed=a.events.some(e=>e.type==='openingRewardResolved');
    }
    if(observed)break;
    state=resolveM5Choices(state);
    if(state.phase!=='settlement')throw Error('unexpected terminal');
    const copy=roundTrip(state),a=nextRound(state,state.round),b=nextRound(copy,copy.round);
    expect(b).toEqual(a);if(!a.ok)throw Error(a.reason);state=a.state;
    observed=a.events.some(e=>e.type==='openingRewardResolved');
  }
  expect(observed).toBe(true);expect(roundTrip(state)).toEqual(state);
  expect(history.completedRecords).toHaveLength(state.roundResults.filter(r=>r.result!=='supply').length);
});

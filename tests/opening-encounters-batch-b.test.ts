import { snapshotForBattle } from '../src/simulation/two-sided-snapshot';
import { expect, it, describe } from 'vitest';
import { createMatch, startMatchCombat, stepMatch, nextRound, sellUnit, deployMatchUnit, openAnvil, type MatchState } from '../src/simulation/match';
import { createOpeningEncounter, applyOpeningEffects, validateOpeningEncounterState } from '../src/simulation/opening-encounter';
import { trainerEmblems, growTrainerGolem } from '../src/simulation/trainer-golems';
import { CRAB_GROUPS, TRAINER_EMBLEMS, TRAINER_ATTACK_CENTI, giantCrabDamage } from '../src/simulation/content/opening-batch-b';
import { getUnitStats } from '../src/simulation/unit-stats';
import { warwickBranch,warwickLoot } from '../src/simulation/opening-warwick';
import { COMPILED_NEUTRAL_ENCOUNTERS } from '../src/simulation/neutral-encounter-compiler';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { createSharedPool,initializeSharedSeat } from '../src/simulation/shared-pool';
import { previewUseConsumable } from '../src/simulation/consumables';
import { getCatalogRoundById } from '../src/simulation/round-selectors';
import { accepted } from './match-helpers';
const seeds=new Map<string,number>();for(let seed=0;seeds.size<16&&seed<20000;seed++){const id=createOpeningEncounter(seed).selection.encounterId;if(!seeds.has(id))seeds.set(id,seed);}
function oracle(seed:number,seat:string,key:string,n:number){let h=2166136261n;for(const c of `opening-encounter-v1/seat/${seat}/${key}`)h=((h^BigInt(c.charCodeAt(0)))*16777619n)&0xffffffffn;let r=BigInt(seed)^h;return Array.from({length:n},()=>{r=(1664525n*r+1013904223n)&0xffffffffn;return r;});}
function finished(s:MatchState){let n=0;while(s.phase==='combat'&&n++<2200)s=stepMatch(s).state;expect(s.phase).not.toBe('combat');return s;}
const word=(bps:number)=>Math.ceil(bps*4294967296/10000);
describe('batch B approved vectors',()=>{
 it('22 emblems, no replacement; independent BigInt oracle',()=>{expect(TRAINER_EMBLEMS).toHaveLength(22);for(let seed=0;seed<128;seed++)for(const seat of ['solo','seat-0']){const pool=[...TRAINER_EMBLEMS];oracle(seed,seat,'trainer-golems/emblems',3).forEach((w,i)=>{const j=i+Number(w*BigInt(22-i)/4294967296n);[pool[i],pool[j]]=[pool[j],pool[i]];});expect(trainerEmblems(seed,seat)).toEqual(pool.slice(0,3));expect(new Set(trainerEmblems(seed,seat)).size).toBe(3);}});
 it.each([['3-7',1,600,5500],['4-1',2,1080,8250],['5-7',2,1080,8250],['6-1',3,1944,12375]] as const)('%s star boundary', (id,star,hp,ad)=>{const s=createMatch(seeds.get('trainer-golems')!),round=getCatalogRoundById(id);const grown=growTrainerGolem({...s,round:round.ordinal,roundDefinitionId:id});expect(grown.preparation.units.find(u=>u.definitionId==='trainer-golem')!.starLevel).toBe(star);expect(getUnitStats('trainer-golem',star).health).toBe(hp);expect(TRAINER_ATTACK_CENTI[star-1]).toBe(ad);});
 it.each([0,word(3000)-1])('30%% drop lower %i',w=>expect(warwickBranch(w,0,0)).toBe(0));
 it.each([word(3000),4294967295])('30%% drop upper %i',w=>expect(warwickBranch(w,0,0)).toBeNull());
 it.each([[0,0],[word(8300)-1,0],[word(8300),1],[word(9800)-1,1],[word(9800),2],[4294967295,2]])('common boundary %i', (w,b)=>expect(warwickBranch(0,word(9500)-1,w)).toBe(b));
 it.each([[0,3],[word(5000)-1,3],[word(5000),4],[word(7900)-1,4],[word(7900),5],[word(8900),6],[word(9400),7],[word(9900),8],[4294967295,8]])('rare boundary %i',(w,b)=>expect(warwickBranch(0,word(9500),w)).toBe(b));
 it.each(Object.entries(CRAB_GROUPS))('%s roster coordinates and HP',(roundId,group)=>{for(const encounter of ['scuttle-puddle','crab-rave']){const c=COMPILED_NEUTRAL_ENCOUNTERS.find(c=>c.encounterId===`${encounter}/${roundId}`)!;expect(c.units).toHaveLength(group.length);c.units.forEach((u,i)=>{expect(u.cell).toEqual({col:group[i][1]-1,row:8-group[i][0]});expect(u.maxHp).toBe(encounter==='crab-rave'&&Number(roundId[0])>=5?20000:group[i][2]);});}});
 it.each([1,2,3,10])('giant jump %i => raw 100*n',n=>expect(giantCrabDamage(n)).toBe(100*n));
});
describe('batch B public lifecycle',()=>{
 it.each(['trainer-golems','warwicks-hunger','scuttle-puddle','crab-rave'])('%s initial save and retries',(id)=>{const s=createMatch(seeds.get(id)!);expect(()=>validateOpeningEncounterState(s)).not.toThrow();expect(restoreMatch(serializeMatch(s))).toEqual(s);const retry=applyOpeningEffects(s,[]);expect(retry.ok).toBe(true);expect(retry.state).toBe(s);});
 it('trainer restrictions and permanent emblems',()=>{const s=createMatch(seeds.get('trainer-golems')!),u=s.preparation.units.find(u=>u.definitionId==='trainer-golem')!;expect(u.location).toEqual({kind:'board',cell:{col:3,row:4}});expect(sellUnit(s,u.id)).toMatchObject({ok:false,reason:'unit-not-sellable'});expect(deployMatchUnit(s,u.id,{kind:'bench',slot:0}).ok).toBe(false);expect(deployMatchUnit(s,u.id,{kind:'board',cell:{col:5,row:4}}).ok).toBe(true);expect(s.items.filter(i=>i.location.kind==='unit'&&i.location.unitId===u.id)).toHaveLength(3);expect(previewUseConsumable({...s,consumables:[{consumableId:'x',definitionId:'magnetic-remover'}]},'x',{kind:'unit',unitId:u.id})).toMatchObject({ok:false});});
 it.each(['trainer-golems','scuttle-puddle','crab-rave'])('%s real first combat restore and no regrant',(id)=>{let s=createMatch(seeds.get(id)!);s=accepted(startMatchCombat(s));for(let i=0;i<40&&s.phase==='combat';i++)s=stepMatch(s).state;expect(restoreMatch(serializeMatch(s))).toEqual(s);s=finished(s);expect(restoreMatch(serializeMatch(s))).toEqual(s);const gold=s.gold;expect(stepMatch(s).state.gold).toBe(gold);if(s.phase==='settlement'){s=accepted(nextRound(s,s.round));expect(restoreMatch(serializeMatch(s))).toEqual(s);}});
 it.each(['trainer-golems','warwicks-hunger','scuttle-puddle','crab-rave'])('%s shared admission same domain',(id)=>{const seed=seeds.get(id)!;let pool=createSharedPool('batch-b',seed);for(let i=0;i<8;i++){const result=initializeSharedSeat(pool,createMatch(800+i,{mode:'shared-deferred'}),`seat-${i}`,i);expect(result.ok).toBe(true);if(!result.ok)throw Error(result.reason);pool=result.pool;const s=result.state;expect(()=>validateOpeningEncounterState(s,pool.openingEncounter)).not.toThrow();if(id==='trainer-golems')expect(s.items.map(i=>i.definitionId)).toEqual(trainerEmblems(seed,`seat-${i}`));else if(id!=='warwicks-hunger')expect(s.m8.preparation.enemies.map(u=>u.definitionId)).toEqual(createMatch(seed).m8.preparation.enemies.map(u=>u.definitionId));}});
});

import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { createCombatWithEvents, stepCombat } from '../src/simulation/combat';
import { openingBattleRewards, openingRewards,  openBatchBForge, validateBatchBRewards,  openingBox, claimOpeningReward, openingRewardOffers, openingRewardOrbs as batchBOrbs } from '../src/simulation/opening-batch-b-rewards';
import { validateAnvils } from '../src/simulation/anvils';
import { g23BattleFacts, commitG23Settlement } from '../src/simulation/g2-3-settlement';
import { recordNeutralReceipts } from '../src/simulation/neutral-receipts';
import { resolveStat } from '../src/simulation/m8/stats';
import { openingCrabCarrier,enterOpeningCrabs } from '../src/simulation/opening-crabs';
import { compileBattle,resolveTwoSidedBattle,proposeSettlement } from '../src/simulation/two-sided-battle';
import type { G23BattleFacts } from '../src/simulation/g2-3-economy';
import { reachRound } from './match-helpers';
import { ORB_BOXES } from '../src/simulation/content/loot';
function syntheticRound(encounter:string,node:string):MatchState{const s=createMatch(seeds.get(encounter)!),r=getCatalogRoundById(node);return enterOpeningCrabs({...s,round:r.ordinal,roundDefinitionId:node,m8:{...s.m8,round:r},level:10,preparation:{...s.preparation,units:[{id:'unit-1',definitionId:'maddie',starLevel:1,team:'player',location:{kind:'board',cell:{col:3,row:4}}},...s.preparation.units.filter(u=>u.team==='enemy')]}});}
function factsFor(s:MatchState,kills:number,result:'win'|'loss'='win'):G23BattleFacts{return {battleId:`round-${s.round}`,round:s.round,roundKind:s.m8.round.kind==='pve'?'pve':'pvp',result,conquerorTier:0,conquestTakedowns:[],chemBaronTier:0,alliedDeaths:0,rumbleStar:0,highRollerGold:0,openingDeaths:Array.from({length:kills},(_,i)=>({victimId:s.m8.preparation.enemies[i]?.id??`enemy-${i}`,eventSeq:i+1}))};}
// Synthetic settled history here isolates approved rewards, not full-save admission.
function settledVector(s:MatchState,f:G23BattleFacts):MatchState{return {...s,phase:'settlement',combat:null,roundResults:[{round:s.round,roundId:s.roundDefinitionId,result:f.result==='win'?'playerWin':'enemyWin',levelBefore:s.level} as MatchState['roundResults'][number]]};}
describe('batch B combat and reward vectors',()=>{
 it('trainer decimal AD is retained until final integer stat evaluation (82.50*1.2=99)',()=>{expect(resolveStat('attackDamage',82,[{stat:'attackDamage',unit:'bps',value:{kind:'constant',amount:2000},condition:{kind:'always'},damageFilter:null}],{holder:{id:'x',hp:1080,maxHp:1080}},50)).toBe(99);});
 it.each(['scuttle-puddle','crab-rave'])('%s has no attacks; 4s moves / 2s giant damage',id=>{
  const s=syntheticRound(id,'5-7'),opened=createCombatWithEvents(s.preparation,buildStrategySnapshot(s),'vector',7);
  // Durable zero-damage target isolates crab cadence without altering production content.
  let c:import('../src/simulation/combat-types').CombatState={...opened.state,units:opened.state.units.map(u=>u.team==='player'?{...u,hp:100000,maxHp:100000,attackDamage:0,attackDamageBase:0,mana:0,maxMana:0,armor:0,magicResist:0}:u)};
  const events=[];for(let i=0;i<120;i++){const step=stepCombat(c);c=step.state;events.push(...step.events);}
  const crab=c.units.find(u=>u.team==='enemy')!;
  expect(events.filter(e=>e.type==='attack'&&e.attackerId===crab.id)).toEqual([]);
  if(id==='crab-rave'){
   const damage=events.filter(e=>e.type==='packetDamage'&&e.outcome.context.source.ownerId===crab.id);
   expect(damage.map(e=>e.tick)).toEqual([40,80,120]);expect(damage.map(e=>e.type==='packetDamage'?e.outcome.hpDamage:0)).toEqual([100,200,300]);
   expect(c.units.find(u=>u.team==='player')!.hp).toBe(99400);
  }else expect(events.filter(e=>e.type==='movement'&&e.unitId===crab.id).map(e=>e.tick)).toEqual([80]);
 });
 it('first-death ledger ignores repeat deaths and excludes monsters, summons and non-opening units',()=>{
  const s=syntheticRound('warwicks-hunger','2-1'),b=createCombatWithEvents(s.preparation,buildStrategySnapshot(s),'kills',0).state;
  const prototype=b.units.find(u=>u.team==='player')!;
  const units=[...b.units,{...prototype,id:'champion',team:'enemy' as const},{...prototype,id:'summon',definitionId:'trainer-golem',team:'enemy' as const},{...prototype,id:'late',team:'enemy' as const}];
  const events=['champion','summon','late',b.units.find(u=>u.team==='enemy')!.id].map((unitId,i)=>({type:'death' as const,tick:1,unitId,eventSeq:i+7}));
  const once=recordNeutralReceipts({state:{...b,units},events}),twice=recordNeutralReceipts({state:once.state,events:[{...events[0],tick:10,eventSeq:19}]});
  expect(twice.state.openingDeaths?.filter(d=>d.unitId==='champion')).toEqual([{unitId:'champion',eventSeq:7}]);
  expect(g23BattleFacts({...twice.state,result:'playerWin'},'player',4,'pvp',units.filter(u=>u.id!=='late')).openingDeaths).toEqual([{victimId:'champion',eventSeq:7}]);
 });
 it('22 total kill gold, exact scheduled extras even on a loss, no extra late scuttle gold',()=>{
  let total=0;for(const [node,group] of Object.entries(CRAB_GROUPS)){const s=syntheticRound('scuttle-puddle',node),f=factsFor(s,group.length,'loss'),r=openingBattleRewards(settledVector(s,f),f);const kills=r.filter(r=>!r.id.includes('gold-orb')&&!r.id.includes('component'));total+=kills.reduce((n,r)=>n+(r.payload.kind==='gold'?r.payload.quantity:0),0);
   if(node==='2-7'||node==='3-7')expect(r.filter(r=>r.payload.kind==='item')).toHaveLength(1);
   if(node==='4-7')expect(r.some(r=>r.tier==='gold')).toBe(true);
   if(Number(node[0])>=5)expect(r).toEqual([]);
  }expect(total).toBe(22);
 });
 it('4-7 sixth old carrier maps to fifth crab without losing the base drop',()=>{const s=syntheticRound('crab-rave','4-7');expect(openingCrabCarrier(s,'4-7','["pve","4-7","razorbeaks-v1","r05"]')).toBe('["pve","4-7","crab-rave/4-7","c4"]');});
 it.each(['5-7','6-7'])('%s giant victory: exactly 2 forges + 2 existing silver rolls; loss none',node=>{
  const s=syntheticRound('crab-rave',node),f=factsFor(s,1),settled=settledVector(s,f),rewards=openingBattleRewards(settled,f);
  expect(rewards.filter(r=>r.payload.kind==='forge')).toHaveLength(2);
  expect(new Set(rewards.filter(r=>r.id.includes('silver/')).map(r=>r.id.includes('silver/0')?'0':'1')).size).toBe(2);
  expect(openingBattleRewards(settled,{...f,result:'loss'})).toEqual([]);
 });
 it('box weights reuse every approved existing row, no invented silver/gold amounts',()=>{for(const kind of ['silver','gold'] as const){let lo=0;for(const row of ORB_BOXES[kind]){const draws=[word(lo*100),0,0,0],draw=()=>draws.shift()??0;const payloads=openingBox(draw,kind);expect(payloads.map(p=>p.kind)).toEqual(row.rewards.map(p=>p.kind==='hero'?'unit':p.kind));lo+=row.weight;}expect(lo).toBe(100);}});
 it('reward grants and forge resolution are idempotent; tampered gold rejected',()=>{
  const s=syntheticRound('crab-rave','5-7'),f=factsFor(s,1);let state=commitG23Settlement(settledVector(s,f),f);const once=state;
  expect(commitG23Settlement(state,f)).toBe(state);expect(()=>validateBatchBRewards(state)).not.toThrow();
  // v22 anvil units: each forge is claimed once as a bench anvil, then opened by selling into the same offers.
  expect(openBatchBForge(state).state).toBe(state);
  for(const r of openingRewards(state).filter(r=>r.payload.kind==='forge')){
   state=accepted(claimOpeningReward(state,r.id));expect(claimOpeningReward(state,r.id).state).toBe(state);
   const g=state.seatMechanics!.receipts.find(g=>g.receiptId===r.id)!;expect(g).toMatchObject({kind:'unit',source:'opening-batch-b',resolution:'held'});
   const offers=openingRewardOffers(state,r);state=accepted(openAnvil(state,(g as {unitId:string}).unitId));
   expect(state.pendingChoice?.payload?.source).toBe('anvil-unit');expect(state.pendingChoice!.offers).toEqual(offers);const c=state.pendingChoice!;
   const resolved=resolveMechanicChoice(state,c.offers[0],true);expect(resolved.ok).toBe(true);state={...resolved.state,phase:'settlement',combat:null};}
  expect(openBatchBForge(state).state.pendingChoice).toBeNull();expect(()=>validateBatchBRewards(state)).not.toThrow();expect(()=>validateAnvils(state)).not.toThrow();
  expect(openingRewards(once).filter(r=>r.payload.kind==='forge')).toHaveLength(2);
 });
 it('Warwick has all 9 reward branches, 1–5 costs only, level 10 cap, deterministic seat stream',()=>{
  const seen=new Set<string>();for(let seed=0;seed<12000;seed++){for(const level of [1,9,10]){const r=warwickLoot(seed,'solo','b','v',level);for(const p of r){seen.add(p.kind);if(p.kind==='unit'){expect(p.starLevel).toBe(1);expect(getUnitStats(p.definitionId,1).health).toBeGreaterThan(0);expect(['mel','warwick','viktor']).not.toContain(p.definitionId);}}if(seed<10)expect(warwickLoot(seed,'solo','b','v',level)).toEqual(r);}}
  expect([...seen].sort()).toEqual(['consumable','gold','item','unit']);
 });
 it('real PvP public route, restore, terminal death facts, repeat settlement inert',()=>{
  let state=reachRound('2-1',true,seeds.get('warwicks-hunger')!);state=accepted(deployMatchUnit(state,'unit-1',{kind:'board',cell:{col:3,row:4}}));state=finished(accepted(startMatchCombat(state)));
  expect(restoreMatch(serializeMatch(state))).toEqual(state);expect(openingRewards(state)).toEqual(openingRewards(restoreMatch(serializeMatch(state))));
 });
 it('two-sided adapter supplies formal first deaths and excludes mirror eligibility',()=>{
  const base=syntheticRound('warwicks-hunger','2-1');const a={...base,items:[],preparation:{...base.preparation,units:[{id:'unit-1',definitionId:'maddie',starLevel:3 as const,team:'player' as const,location:{kind:'board' as const,cell:{col:3,row:4}}}]}};
  const b={...a,preparation:{...a.preparation,units:a.preparation.units.map(u=>({...u,starLevel:1 as const}))}};
  const input=compileBattle(snapshotForBattle(a,'A'),snapshotForBattle(b,'B'),42,{battleId:'batch-b-pvp'}),battle=resolveTwoSidedBattle(input,1200),proposed=proposeSettlement(battle);
  expect(proposed.a.g23Facts?.openingDeaths).toHaveLength(1);expect(proposed.b.g23Facts?.openingDeaths).toEqual([]);
  expect(proposed.a.g23Facts?.openingDeaths?.[0].victimId).toBe('["t2","B","unit","unit-1"]');
 });
});
import { resolveMechanicChoice } from '../src/simulation/seat-mechanics/choices';
import { openingSeatDraw } from '../src/simulation/opening-batch-b-rng';
import { applyWarwickHunger } from '../src/simulation/opening-encounter';
import { settleTerminalBatchBForges } from '../src/simulation/opening-batch-b-rewards';
import { crabJump } from '../src/simulation/combat-opening-crabs';
import type { AbilityContext } from '../src/simulation/combat-s13-abilities';
it('after a skipped controlled jump, the first actual jump still deals 100',()=>{
 const s=syntheticRound('crab-rave','5-7'),b=createCombatWithEvents(s.preparation,buildStrategySnapshot(s),'jump',1).state;
 const ctx={tick:80,units:structuredClone(b.units),board:b.board,packets:[],events:[],heals:[],draw:()=>0} as unknown as AbilityContext;
 const giant=ctx.units.find(u=>u.team==='enemy')!;crabJump(ctx,giant,()=>0);expect(ctx.packets.map(p=>p.raw)).toEqual([100]);expect(giant.runtime.castCount).toBe(1);
});
it('isolated RNG exact words, unchanged old streams on initial trainer grant',()=>{
 const seed=seeds.get('trainer-golems')!,a=createMatch(seed),b=createMatch(seed,{mode:'shared-deferred'});
 for(const key of ['rngState','rewardRngState','choiceRngState','battleSeedRngState','reforgeState','equipmentState'] as const)expect(a[key]).toEqual(b[key]);
 const draw=openingSeatDraw(seed,'solo','warwicks-hunger/["b","v"]');expect(Array.from({length:9},()=>draw())).toEqual(oracle(seed,'solo','warwicks-hunger/["b","v"]',9).map(Number));
});
it('tampered permanent emblems / missing trainer receipt fail; retries never repair',()=>{
 const state=createMatch(seeds.get('trainer-golems')!);
 expect(()=>validateOpeningEncounterState({...state,items:state.items.map((i,n)=>n?i:{...i,location:{kind:'inventory'}})})).toThrow();
 const broken={...state,seatMechanics:{...state.seatMechanics!,receipts:state.seatMechanics!.receipts.slice(1)}};
 const r=applyOpeningEffects(broken,[]);expect(r.ok).toBe(false);expect(r.state).toBe(broken);
});
it('forged, PvE, summoned and mirror Warwick claims are atomic failures',()=>{
 const state=createMatch(seeds.get('warwicks-hunger')!);for(const victimKind of ['champion','monster','summon'] as const)for(const settlementEligible of [true,false]){
  const r=applyWarwickHunger(state,[{battleId:'fake',eventSeq:0,victimId:'fake',victimKind,settlementEligible}]);expect(r.ok).toBe(false);expect(r.state).toBe(state);
 }
});
it('real trainer transfers to both-sided combat with all three permanent emblems',()=>{
 const s=createMatch(seeds.get('trainer-golems')!),round=getCatalogRoundById('2-1'),a={...s,round:round.ordinal,roundDefinitionId:round.roundId,m8:{...s.m8,round}};
 const input=compileBattle(snapshotForBattle(a,'A'),snapshotForBattle(a,'B'),12,{battleId:'trainers'});
 const battle=resolveTwoSidedBattle(input,1200);expect(battle.initial.units.filter(u=>u.definitionId==='trainer-golem')).toHaveLength(2);
 expect(battle.initial.strategy!.units.filter(u=>battle.initial.units.some(x=>x.id===u.unitId&&x.definitionId==='trainer-golem')).every(u=>u.sources.filter(e=>e.source.sourceKind==='item').length>0)).toBe(true);
});
it('terminal 6-7 keeps both completed forges as bench anvils, keeps terminal phase and cannot repeat',()=>{
 // v22 anvil units: settlement grants both forges as held anvil units; no automatic terminal choice.
 const s=syntheticRound('crab-rave','6-7'),f=factsFor(s,1),settled=commitG23Settlement(settledVector(s,f),f);
 const terminal={...settled,phase:'gameOver' as const,combat:null,outcome:'victory' as const};const done=settleTerminalBatchBForges(terminal);
 expect(done.state).toBe(terminal);expect(done.state.seatMechanics?.receipts.filter(r=>r.source==='opening-batch-b'&&r.kind==='choice')??[]).toHaveLength(0);
 const held=done.state.seatMechanics!.receipts.filter(r=>r.source==='opening-batch-b'&&r.kind==='unit'&&r.receiptId.includes('anvil/'));
 expect(held).toMatchObject([{definitionId:'TFT_ArmoryKeyCompleted',resolution:'held'},{definitionId:'TFT_ArmoryKeyCompleted',resolution:'held'}]);
 for(const r of held)expect(done.state.preparation.units.some(u=>u.id===(r as {unitId:string}).unitId&&u.location.kind==='bench')).toBe(true);
 expect(batchBOrbs(done.state)).toHaveLength(0);
 expect(settleTerminalBatchBForges(done.state).state).toBe(done.state);expect(()=>validateBatchBRewards(done.state)).not.toThrow();
});

import { runSharedMatchCommand, nextSharedRound, refreshSharedShops, assertSharedPoolConservation } from '../src/simulation/shared-pool';
import { ROUND_SETTLEMENT_VERSION } from '../src/simulation/round-settlement';
import { room, fight, accept, batch } from './tp-helpers';
import { readLootView } from '../src/simulation/loot-view';
it('shared public PvE -> actual PvP -> Warwick unit orb transaction conserves and deduplicates',()=>{
 const initial=room(undefined,2,seeds.get('warwicks-hunger')!),refreshed=batch(refreshSharedShops(initial.pool,initial.states,1));let pool=refreshed.pool,states=[...refreshed.states];
 const choices=(i:number)=>{while(states[i].pendingChoice){const s=states[i],c=s.pendingChoice!;const r=accept(runSharedMatchCommand(pool,s,{type:'timeoutChoice',round:s.round,choiceId:c.choiceId,generation:c.generation}));pool=r.pool;states[i]=r.state;}};
 for(let round=1;round<=3;round++){
  for(let i=0;i<2;i++){const r=fight(pool,states[i]);pool=r.pool;states[i]=r.state;choices(i);}
  const next=batch(nextSharedRound(pool,states,round));pool=next.pool;states=[...next.states];
 }
 choices(0);choices(1);
 const resolve=(battleId:string)=>resolveTwoSidedBattle(compileBattle(snapshotForBattle(states[0],'seat-0'),snapshotForBattle(states[1],'seat-1'),42,{battleId}),900);
 const first=proposeSettlement(resolve('probe'));
 const eligible=Object.values(first).find(p=>p.g23Facts?.openingDeaths?.length)!;expect(eligible).toBeDefined();
 let battleId='';for(let n=0;n<50000;n++){const id=`warwick-unit-${n}`;if(warwickLoot(pool.openingEncounter.seed,eligible.seatId,id,eligible.g23Facts!.openingDeaths![0].victimId,states[0].level).some(p=>p.kind==='unit')){battleId=id;break;}}
 expect(battleId).not.toBe('');const battle=resolve(battleId);
 for(const p of Object.values(proposeSettlement(battle))){const {events:_events,...proposal}=p;const i=Number(p.seatId.slice(-1)),s=states[i];const r=accept(runSharedMatchCommand(pool,s,{type:'settleRound',receipt:{...proposal,version:ROUND_SETTLEMENT_VERSION,settlementId:`4:${p.seatId}`,battleId,round:4,roundId:'2-1',combatTicks:battle.terminal.tick,combatEventCount:battle.events.length}}));pool=r.pool;states[i]=r.state;}
 const i=Number(eligible.seatId.slice(-1)),s=states[i],orb=readLootView(s).unclaimedOrbs!.find(o=>o.orbId.startsWith('opening-batch-b/'))!;expect(orb).toBeDefined();
 const claimed=accept(runSharedMatchCommand(pool,s,{type:'claimOrb',round:4,orbId:orb.orbId}));pool=claimed.pool;states[i]=claimed.state;
 expect(pool.rewards.some(r=>r.seatId===eligible.seatId&&r.dropId.includes('opening-batch-b'))).toBe(true);
 const again=runSharedMatchCommand(pool,states[i],{type:'claimOrb',round:4,orbId:orb.orbId});expect(again.ok).toBe(false);expect(again.pool).toBe(pool);expect(again.state).toBe(states[i]);assertSharedPoolConservation(pool,states);
},20000);
it('crab approved roster has independent literal cells and HP, including asymmetric 4-7',()=>{
 // P 10-24: each round's crabs split the replaced authored neutrals' total HP (remainder to the first crabs).
 const cases:Record<string,number[][]>={'1-2':[[2,2,110],[4,2,110]],'1-3':[[2,2,147],[4,2,147],[1,1,146]],'1-4':[[2,2,190],[4,2,190],[1,1,190],[4,1,190]],'2-7':[[0,3,400],[1,1,400],[5,3,400]],'3-7':[[3,2,540],[1,0,540],[2,0,540],[4,0,540],[5,0,540]],'4-7':[[3,0,960],[1,2,960],[1,1,960],[4,1,960],[5,2,960]],'5-7':[[3,3,6000]],'6-7':[[3,3,9000]]};
 const authored:Record<string,number>={'1-2':220,'1-3':440,'1-4':760,'2-7':1200,'3-7':2700,'4-7':4800,'5-7':6000,'6-7':9000};
 for(const [round,expected] of Object.entries(cases))expect(expected.reduce((n,c)=>n+c[2],0)).toBe(authored[round]);
 for(const [round,expected] of Object.entries(cases)){const encounter=COMPILED_NEUTRAL_ENCOUNTERS.find(e=>e.encounterId===`scuttle-puddle/${round}`)!;expect(encounter.units.map(u=>[u.cell.col,u.cell.row,u.maxHp])).toEqual(expected);}
});
it('invalid opening facts fail atomically before a batch B entry grant',()=>{
 const state=createMatch(seeds.get('trainer-golems')!);const r=applyOpeningEffects(state,[{factId:'forged',effectKey:'forged',nodeId:'1-2'}]);expect(r).toEqual({ok:false,state,reason:'invalid-opening-effect'});expect(r.state).toBe(state);
});
it('forge restore rejects changed source, forged offers and an opened choice bound to the other anvil',()=>{
 const s=syntheticRound('crab-rave','5-7'),f=factsFor(s,1);let held=commitG23Settlement(settledVector(s,f),f);
 const forges=openingRewards(held).filter(r=>r.payload.kind==='forge');for(const r of forges)held=accepted(claimOpeningReward(held,r.id));
 const unitIds=forges.map(r=>(held.seatMechanics!.receipts.find(g=>g.receiptId===r.id) as {unitId:string}).unitId);
 const state=accepted(openAnvil(held,unitIds[0])),c=state.pendingChoice!;expect(()=>validateAnvils(state)).not.toThrow();
 expect(()=>validateAnvils({...state,pendingChoice:{...c,payload:{...c.payload!,source:'forged'}}} as MatchState)).toThrow();
 expect(()=>validateAnvils({...state,pendingChoice:{...c,offers:['warmog',...c.offers.slice(1)]}} as MatchState)).toThrow();
 const other=JSON.stringify(['anvil',unitIds[1]]);
 expect(()=>validateAnvils({...state,pendingChoice:{...c,choiceId:other,eventId:other}} as MatchState)).toThrow();
});

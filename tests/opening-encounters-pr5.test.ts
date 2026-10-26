import { deferredRoundIncome } from '../src/simulation/deferred-income';
import { describe, expect, it } from 'vitest';
import { createMatch, nextRound, startMatchCombat, useConsumable, selectChoice, equipItem, type MatchState } from '../src/simulation/match';
import { createOpeningEncounter, planOpeningRound, applyOpeningEffects, validateOpeningEncounterContext, readOpeningEncounterView,
  commitOpeningEncounterHealth, readOpeningMelProgress, readOpeningForgeProgress, validateOpeningEncounterState } from '../src/simulation/opening-encounter';
import { MONKEY_NODE, MONKEY_ROUND, MONKEY_OUTCOMES, selectMonkeyOutcomeFromWord, monkeyOutcome, monkeyComponents } from '../src/simulation/opening-monkey';
import { createSharedPool, initializeSharedSeat, nextSharedRound, refreshSharedShops, assertSharedPoolConservation, restoreSharedOrbSnapshot } from '../src/simulation/shared-pool';
import { G24_FORGE_POOLS } from '../src/simulation/content/g2-4-forges';
import { G23_RADIANT_MAPPING } from '../src/simulation/content/g2-3-special-item-runtime';
import { ITEM_DEFINITIONS } from '../src/simulation/content/g2-3-item-registry';
import { grantMechanicItem } from '../src/simulation/seat-mechanics/grants';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { validateConsumableState, previewUseConsumable } from '../src/simulation/consumables';
import { accepted, freeze, reachRound as originalReachRound, resolveM5Choices as originalResolveChoices, emptyBoard } from './match-helpers';

// These empty-board opening controls do not exercise post-battle bench XP.
const excludedAugments=['clear-mind','cluttered-mind','slammin','slammin-plus','spoils-of-war-i','spoils-of-war-ii','spoils-of-war-iii'];
const resolveM5Choices=(state:MatchState)=>originalResolveChoices(state,[],excludedAugments);
const reachRound=(id:string,resolve=true,seed=42)=>originalReachRound(id,resolve,seed,[],excludedAugments);

const seeds = new Map<string,number>();
for(let seed=0; seed<200000 && seeds.size<4; seed++) if(createOpeningEncounter(seed).selection.encounterId==='wind-up-monkey') seeds.set(monkeyOutcome(seed),seed);
function words(seed:number,name:string,count:number) {
  let hash=2166136261n;
  for(let i=0;i<name.length;i++) hash=((hash^BigInt(name.charCodeAt(i)))*16777619n)&0xffffffffn;
  let r=BigInt(seed)^hash;
  return Array.from({length:count},()=>{r=(r*1664525n+1013904223n)&0xffffffffn;return Number(r);});
}
function streams(s:MatchState){return [s.rngState,s.choiceRngState,s.rewardRngState,s.battleSeedRngState,s.reforgeState];}
function grant(state:MatchState,definitionId:string,id:string){const r=grantMechanicItem(state,{receiptId:id,source:'pr5-fixture',definitionId});if(!r.ok)throw Error(r.reason);return r.state;}

it('covers all 36 existing ordinary → radiant mappings without adding numerical definitions',()=>{
  expect(Object.keys(G23_RADIANT_MAPPING)).toHaveLength(36);
  for(const id of G24_FORGE_POOLS.TFT_ArmoryKeyCompleted) expect(ITEM_DEFINITIONS[G23_RADIANT_MAPPING[id as keyof typeof G23_RADIANT_MAPPING]]).toMatchObject({kind:'radiant',radiantOf:id});
});
it('four equal intervals match independent BigInt oracle over 65536 roots; all outcomes reachable within monkey selection',()=>{
  expect(seeds.size).toBe(4);const counts=[0,0,0,0];
  for(let seed=0;seed<65536;seed++){
    const index=Math.floor(words(seed,'opening-encounter-v1/shared/wind-up-monkey/outcome',1)[0]/1073741824);
    expect(monkeyOutcome(seed)).toBe(MONKEY_OUTCOMES[index]);counts[index]++;
  }
  for(const count of counts)expect(count).toBeGreaterThan(15000);
});
it('components use four independent seat-stream draws with replacement and never touch the outcome stream',()=>{
  const variants=new Set<string>();
  for(let seat=0;seat<8;seat++){
    const id=`seat-${seat}`,seed=seeds.get('components')!,pool=G24_FORGE_POOLS.TFT_ArmoryKeyComponent;
    const expected=words(seed,`opening-encounter-v1/seat/${id}/wind-up-monkey/components`,4).map(w=>pool[Math.floor(w*8/4294967296)]);
    expect(monkeyComponents(seed,id)).toEqual(expected);variants.add(expected.join(','));
  }
  expect(variants.size).toBeGreaterThan(1);
});

describe('PR5 solo public lifecycle',()=>{
  it.each(MONKEY_OUTCOMES)('%s: reveals only at 3-5, applies once and restores without regrant',outcome=>{
    const seed=seeds.get(outcome)!,context=createOpeningEncounter(seed);
    expect(readOpeningEncounterView(createMatch(seed))!.revealedFacts).toEqual([]);
    expect(planOpeningRound(context,'3-4')).toEqual({context,facts:[]});
    const plan=planOpeningRound(context,MONKEY_NODE);
    expect(plan.facts[0].outcome).toBe(outcome);expect(plan.context.facts).toEqual(plan.facts);
    expect(planOpeningRound(plan.context,MONKEY_NODE).context).toBe(plan.context);
    const before=reachRound('3-4',true,seed);
    const settled=before.phase==='settlement'?before:resolveM5Choices(accepted(startMatchCombat(emptyBoard(before))));
    const after=accepted(nextRound(freeze(settled),settled.round));
    expect(after.roundDefinitionId).toBe('3-5');expect(after.openingEncounter.mode==='solo'&&after.openingEncounter.receipts).toHaveLength(1);
    expect(commitOpeningEncounterHealth(after)).toBe(after);
    expect(readOpeningMelProgress(after)).toBeNull();expect(readOpeningForgeProgress(after)).toBeNull();
    expect(()=>validateOpeningEncounterState(after)).not.toThrow();
    if(after.openingEncounter.mode==='solo') {
      const opening=after.openingEncounter,receipt=opening.receipts[0];
      expect(()=>validateOpeningEncounterState({...after,openingEncounter:{...opening,receipts:[receipt,receipt]}}))
        .toThrow('opening-context-mismatch');
    }
    expect(readOpeningEncounterView(after)!.revealedFacts).toEqual([{nodeId:'3-5',outcome}]);
    if(outcome==='damage')expect(after.playerHp).toBe(settled.playerHp-10);
    // Round income now lands at the next preparation entry (deferred-income.ts), then the monkey's 25 on top.
    if(outcome==='gold')expect(after.gold).toBe(settled.gold+deferredRoundIncome(settled.roundResults.at(-1)!)+25);
    if(outcome==='components')expect(after.items.slice(-4).map(i=>i.definitionId)).toEqual(monkeyComponents(seed,'solo'));
    if(outcome==='masterwork')expect(after.consumables.filter(c=>c.definitionId==='masterwork-upgrade')).toHaveLength(1);
    const retried=applyOpeningEffects(after,plan.facts);
    expect(retried).toEqual({ok:true,state:after,events:[]});expect(retried.state).toBe(after);
    expect(after.augments.filter(a=>excludedAugments.includes(a.definitionId))).toEqual([]);
    const restored=restoreMatch(serializeMatch(after));expect(restored).toEqual(after);
    expect(applyOpeningEffects(restored,plan.facts)).toEqual({ok:true,state:restored,events:[]});
    expect(()=>restoreMatch({...after,openingEncounter:{...after.openingEncounter,receipts:[]}})).toThrow();
  });
  it('rejects early, wrong or forged facts atomically',()=>{
    const seed=seeds.get('gold')!,state=freeze(createMatch(seed)),plan=planOpeningRound(createOpeningEncounter(seed),'3-5');
    for(const facts of [plan.facts,[{...plan.facts[0],outcome:'damage' as const}]]){
      const r=applyOpeningEffects(state,facts);expect(r.ok).toBe(false);expect(r.state).toBe(state);expect('events' in r).toBe(false);
    }
    expect(()=>validateOpeningEncounterContext({...plan.context,facts:[{...plan.facts[0],outcome:'damage'}]},seed)).toThrow();
  });
});

describe('PR5 masterwork tool',()=>{
  function fixture(){let s=reachRound('3-5',true,seeds.get('masterwork')!);s=grant(s,'deathblade','pr5-deathblade');s=grant(s,'warmog','pr5-warmog');
    const unit=s.preparation.units.find(u=>u.team==='player')!.id;
    for(const [slot,definition] of ['deathblade','warmog'].entries()){const item=s.items.find(i=>i.definitionId===definition&&i.location.kind==='inventory')!;s=accepted(equipItem(s,item.id,unit,slot));}
    const tool=s.consumables.find(c=>c.definitionId==='masterwork-upgrade')!;return {s,unit,tool};}
  it('unit first, then personal item selection; upgrades only chosen item, unequips, consumes once with no RNG',()=>{
    const {s,unit,tool}=fixture(),rng=streams(s),original=s.items.filter(i=>i.location.kind==='unit'&&i.location.unitId===unit);
    const opened=accepted(useConsumable(freeze(s),tool.consumableId,{kind:'unit',unitId:unit})),c=opened.pendingChoice!;
    expect(opened.consumables).toEqual(s.consumables);expect(c.offers).toEqual(original.map(i=>i.id));
    expect(restoreMatch(serializeMatch(opened))).toEqual(opened);
    const selected=accepted(selectChoice(opened,c.choiceId,c.generation,original[1].id));
    expect(selected.consumables.some(t=>t.consumableId===tool.consumableId)).toBe(false);
    expect(selected.items.find(i=>i.id===original[0].id)).toEqual(original[0]);
    expect(selected.items.some(i=>i.definitionId===G23_RADIANT_MAPPING.warmog&&i.location.kind==='inventory')).toBe(true);
    expect(selected.items.some(i=>i.id===original[1].id)).toBe(false);expect(streams(selected)).toEqual(rng);
    expect(()=>validateConsumableState(selected)).not.toThrow();expect(restoreMatch(serializeMatch(selected))).toEqual(selected);
    expect(useConsumable(selected,tool.consumableId,{kind:'unit',unitId:unit})).toMatchObject({ok:false,reason:'unknown-consumable'});
  });
  it('invalid targets/options leave tool, state and all RNG untouched; frozen armory rejects equipment mutations',()=>{
    const {s,unit,tool}=fixture();
    for(const target of [{kind:'item' as const,itemId:s.items[0].id},{kind:'unit' as const,unitId:'missing'},{kind:'unit' as const,unitId:unit,itemId:s.items[0].id}]){
      const r=useConsumable(freeze(s),tool.consumableId,target);expect(r.ok).toBe(false);expect(r.state).toBe(s);
    }
    const opened=accepted(useConsumable(s,tool.consumableId,{kind:'unit',unitId:unit})),c=opened.pendingChoice!;
    expect(selectChoice(opened,c.choiceId,0,'bad')).toMatchObject({ok:false,state:opened});
    expect(equipItem(opened,c.offers[0],unit,2)).toMatchObject({ok:false,reason:'wrong-phase'});
    expect(()=>restoreMatch({...opened,pendingChoice:{...c,offers:[...c.offers].reverse()}})).toThrow();
  });
  it.each([G24_FORGE_POOLS.TFT_ArmoryKeyComponent[0],G24_FORGE_POOLS.TFT_ArmoryKeyOrnn[0],Object.values(ITEM_DEFINITIONS).find(d=>d.emblemTrait)!.id,'TFT5_Item_DeathbladeRadiant'])('%s cannot be upgraded',definitionId=>{
    // Category fixtures use actual admitted IDs; do not invent definitions.
    const actual=definitionId;
    let s=reachRound('3-5',true,seeds.get('masterwork')!);const unit=s.preparation.units.find(u=>u.team==='player')!.id;
    s=grant(s,actual,'pr5-invalid-item');const item=s.items.at(-1)!;
    s={...s,items:s.items.map(i=>i.id===item.id?{...i,location:{kind:'unit' as const,unitId:unit,slot:0}}:i)};
    const tool=s.consumables.find(c=>c.definitionId==='masterwork-upgrade')!;
    expect(previewUseConsumable(s,tool.consumableId,{kind:'unit',unitId:unit})).toMatchObject({ok:false,reason:'invalid-consumable-target'});
  });
});

/** Public domain traversal: real PvE/supply commands and trusted T3 zero-damage PvP win receipts. */
function sharedBeforeMonkey(outcome: string) {
  let pool=createSharedPool(`pr5-${outcome}`,seeds.get(outcome)!);let states:MatchState[]=[];
  for(let i=0;i<8;i++){const r=initializeSharedSeat(pool,createMatch(900+i,{mode:'shared-deferred'}),`seat-${i}`,i);if(!r.ok)throw Error(r.reason);pool=r.pool;states.push(r.state);}
  let first=refreshSharedShops(pool,states,1);if(!first.ok)throw Error(first.reason);pool=first.pool;states=[...first.states];
  for(let round=1;round<MONKEY_ROUND;round++){
    for(let i=0;i<states.length;i++){
      let state=states[i];
      const command=(c:import('../src/simulation/shared-pool-types').SharedMatchCommand)=>{const r=runSharedMatchCommand(pool,state,c);if(!r.ok)throw Error(`${round}/${i}/${c.type}:${r.reason}`);pool=r.pool;state=r.state;};
      while(state.phase==='choice'){const c=state.pendingChoice!;command({type:'choose',choiceId:c.choiceId,generation:c.generation,definitionId:c.offers.find(x=>x!=='placebo')??c.offers[0]});}
      if(state.phase==='preparation'){
        if(state.m8.round.kind==='pvp'){
          const economy=resolveRoundEconomy({roundId:state.roundDefinitionId,result:'playerWin',gold:state.gold,hp:state.playerHp,level:state.level,xp:state.xp,streak:state.streak,enemySurvivors:0,augments:state.augments});
          command({type:'settleRound',receipt:{version:'multiplayer-settlement-v1',settlementId:`test-${round}-${i}`,battleId:`battle-${round}-${i}`,seatId:state.multiplayer!.seatId,round,roundId:state.roundDefinitionId,settlementEligible:true,result:'win',damage:0,baseDamage:economy.baseDamage,opposingSurvivors:0,growth:[],combatTicks:0,combatEventCount:1}});
        }else{state=emptyBoard(state);command({type:'startCombat'});}
      }
      while(state.phase==='choice'){const c=state.pendingChoice!;command({type:'choose',choiceId:c.choiceId,generation:c.generation,definitionId:c.offers[0]});}
      states[i]=state;
    }
    if(round===MONKEY_ROUND-1)break;
    const advanced=nextSharedRound(pool,states,round);if(!advanced.ok)throw Error(`${round}/advance:${advanced.reason}`);pool=advanced.pool;states=[...advanced.states];
  }
  return {pool,states};
}
import { runSharedMatchCommand } from '../src/simulation/shared-pool';
import { resolveRoundEconomy } from '../src/simulation/round-economy';

describe('PR5 shared atomic lifecycle',()=>{
  it.each(MONKEY_OUTCOMES)('%s: eight seats share one fact, individual rewards, retry/restore and conservation',outcome=>{
    const before=sharedBeforeMonkey(outcome),r=nextSharedRound(freeze(before.pool),freeze(before.states),MONKEY_ROUND-1);
    if(!r.ok)throw Error(r.reason);
    expect(r.pool.openingEncounter.facts).toHaveLength(1);expect(r.openingResolution).toMatchObject({nodeId:'3-5',outcome,eliminated:[],ended:false});
    assertSharedPoolConservation(r.pool,r.states);
    for(const [i,s] of r.states.entries()){
      expect(readOpeningEncounterView(s)!.revealedFacts).toEqual([{nodeId:'3-5',outcome}]);
      expect(restoreSharedOrbSnapshot(r.pool,JSON.stringify(s))).toEqual(s);
      expect(applyOpeningEffects(s,r.pool.openingEncounter.facts,r.pool.openingEncounter)).toEqual({ok:true,state:s,events:[]});
      if(outcome==='damage')expect(s.playerHp).toBe(before.states[i].playerHp-10);
      if(outcome==='gold')expect(s.gold).toBe(before.states[i].gold+deferredRoundIncome(before.states[i].roundResults.at(-1)!)+25);
      if(outcome==='components')expect(s.items.slice(-4).map(x=>x.definitionId)).toEqual(monkeyComponents(r.pool.seed,`seat-${i}`));
      if(outcome==='masterwork')expect(s.consumables.filter(x=>x.definitionId==='masterwork-upgrade')).toHaveLength(1);
    }
    expect(nextSharedRound(r.pool,r.states,MONKEY_ROUND-1)).toMatchObject({ok:false,pool:r.pool,states:r.states});
  });
  it.each([[5,10,10,1,11,20,30,40],[5,10,10,1,2,3,4,6],[5,10,10,1,2,3,4,11]])('damage simultaneously ranks HP %j and releases stock once, independent of input order',(...hp)=>{
    const before=sharedBeforeMonkey('damage');
    // Explicit low-HP boundary fixture: only HP/history tail is lowered; no claim that this is a naturally played defeat route.
    const states=before.states.map((s,i)=>({...s,playerHp:hp[i],roundResults:s.roundResults.map((r,n)=>n===s.roundResults.length-1?{...r,hpAfter:hp[i]}:r)}));
    const r=nextSharedRound(freeze(before.pool),freeze(states),MONKEY_ROUND-1);if(!r.ok)throw Error(r.reason);
    const expected=hp.map((value,i)=>({value,i})).filter(x=>x.value<=10).sort((a,b)=>a.value-b.value||b.i-a.i);
    expect(r.openingResolution!.eliminated).toEqual(expected.map((x,i)=>({seatId:`seat-${x.i}`,rank:8-i,hpBefore:x.value,hpAfterRaw:x.value-10})));
    expect(r.openingResolution!.ended).toBe(hp.filter(x=>x>10).length<=1);
    assertSharedPoolConservation(r.pool,r.states);
    for(const {i} of expected){expect(r.pool.seats[i].released).toBe(true);expect(r.pool.holdings.some(h=>h.seatId===`seat-${i}`)).toBe(false);expect(r.states[i].multiplayer!.status).toBe('eliminated');expect(restoreSharedOrbSnapshot(r.pool,JSON.stringify(r.states[i]))).toEqual(r.states[i]);}
    const reversed=nextSharedRound(before.pool,[...states].reverse(),MONKEY_ROUND-1);if(!reversed.ok)throw Error(reversed.reason);
    expect(reversed.openingResolution).toEqual(r.openingResolution);expect(reversed.pool).toEqual(r.pool);
    expect([...reversed.states].reverse()).toEqual(r.states);
  });
  it('a later bad seat rejects the whole batch; no earlier damage, receipt, RNG or pool mutation escapes',()=>{
    const {pool,states}=sharedBeforeMonkey('damage');const bad=[...states.slice(0,7),{...states[7],phase:'preparation' as const,combat:null}];
    const r=nextSharedRound(freeze(pool),freeze(bad),MONKEY_ROUND-1);expect(r).toMatchObject({ok:false,pool,states:bad});expect(r.pool).toBe(pool);expect(r.states).toBe(bad);
    expect(pool.openingEncounter.facts).toEqual([]);expect(states.every(s=>s.openingEncounter.mode==='shared'&&!s.openingEncounter.receipts.length)).toBe(true);
  });
});

it('all exact quarter boundaries are 25%, with no empty/fifth branch',()=>{
  for(let index=0;index<4;index++)for(const word of [index*1073741824,(index+1)*1073741824-1])expect(selectMonkeyOutcomeFromWord(word)).toBe(MONKEY_OUTCOMES[index]);
  expect(()=>selectMonkeyOutcomeFromWord(4294967296)).toThrow();
});
it.each([1,10,11])('solo HP %i: lethal boundary and dedicated receipt are atomic and never invoke combat rescue',hp=>{
  const seed=seeds.get('damage')!,prior=reachRound('3-4',true,seed);
  const state={...prior,playerHp:hp,roundResults:prior.roundResults.map((r,i)=>i===prior.roundResults.length-1?{...r,hpAfter:hp}:r)};
  const result=nextRound(freeze(state),state.round);if(!result.ok)throw Error(result.reason);
  expect(result.state.playerHp).toBe(Math.max(0,hp-10));expect(result.state.phase).toBe(hp<=10?'gameOver':'preparation');
  expect(result.state.roundResults).toEqual(state.roundResults);
  expect(result.events.find(e=>e.type==='openingMonkeyResolved')).toMatchObject({hpBefore:hp,hpAfterRaw:hp-10,hpAfter:Math.max(0,hp-10)});
  expect(applyOpeningEffects(result.state,planOpeningRound(createOpeningEncounter(seed),'3-5').facts)).toEqual({ok:true,state:result.state,events:[]});
});
it('after the next combat/Continue, damage history restores and trigger cannot run again',()=>{
  let s=reachRound('3-5',true,seeds.get('damage')!);const initial=s.openingEncounter;
  s=resolveM5Choices(accepted(startMatchCombat(emptyBoard(s))));
  expect(restoreMatch(serializeMatch(s))).toEqual(s);
  if(s.phase==='settlement')s=accepted(nextRound(s,s.round));
  expect(s.openingEncounter).toEqual(initial);expect(restoreMatch(serializeMatch(s))).toEqual(s);
});
it('shared armory times out to first offer exactly once, with independent personal tool and mapped UI data',()=>{
  const before=sharedBeforeMonkey('masterwork');let r=nextSharedRound(before.pool,before.states,MONKEY_ROUND-1);if(!r.ok)throw Error(r.reason);
  const pool=r.pool;let s=r.states[0];s=grant(s,'deathblade','timeout-item');const item=s.items.at(-1)!,unit=s.preparation.units.find(u=>u.team==='player')!.id;
  s=accepted(equipItem(s,item.id,unit,0));const tool=s.consumables.find(c=>c.definitionId==='masterwork-upgrade')!;
  const opened=runSharedMatchCommand(pool,s,{type:'useConsumable',consumableId:tool.consumableId,target:{kind:'unit',unitId:unit}});if(!opened.ok)throw Error(opened.reason);
  const choice=opened.state.pendingChoice!;
  expect(runSharedMatchCommand(opened.pool,opened.state,{type:'claimOrb',round:MONKEY_ROUND,orbId:'pending-orb'})).toMatchObject({ok:false,reason:'wrong-phase',state:opened.state});
  expect(toPrivateSeatView(opened.state).masterworkOptions).toEqual([{itemId:item.id,definitionId:'deathblade',radiantDefinitionId:G23_RADIANT_MAPPING.deathblade}]);
  const command={type:'timeoutChoice' as const,round:MONKEY_ROUND,choiceId:choice.choiceId,generation:0};
  const done=runSharedMatchCommand(opened.pool,opened.state,command);if(!done.ok)throw Error(done.reason);
  expect(done.state.seatMechanics!.receipts.find(c=>c.receiptId===choice.choiceId)).toMatchObject({kind:'choice',optionId:item.id,timedOut:true});
  expect(restoreSharedOrbSnapshot(done.pool,JSON.stringify(done.state))).toEqual(done.state);
  expect(runSharedMatchCommand(done.pool,done.state,command)).toMatchObject({ok:false});
  expect(r.states[1].consumables.some(c=>c.definitionId==='masterwork-upgrade')).toBe(true);
});
import { toPrivateSeatView } from '../src/simulation/private-seat-view';

it('thief gloves can upgrade; generated temporary children cannot; children are removed and saved history restores',()=>{
  let s=reachRound('3-5',true,seeds.get('masterwork')!);const unit=s.preparation.units.find(u=>u.team==='player')!.id;
  s=grant(s,'thiefs-gloves','pr5-gloves');const parent=s.items.at(-1)!;
  s=accepted(equipItem(s,parent.id,unit,0));const tool=s.consumables.find(c=>c.definitionId==='masterwork-upgrade')!;
  const child=s.temporaryEquipment[0];expect(child).toBeDefined();
  const childId=JSON.stringify([parent.id,s.roundDefinitionId,1]);
  expect(previewUseConsumable(s,tool.consumableId,{kind:'unit',unitId:unit,itemId:childId})).toEqual({ok:false,reason:'temporary-item'});
  const opened=accepted(useConsumable(s,tool.consumableId,{kind:'unit',unitId:unit})),c=opened.pendingChoice!;
  expect(c.offers).toEqual([parent.id]);const done=accepted(selectChoice(opened,c.choiceId,0,parent.id));
  expect(done.temporaryEquipment).toEqual([]);expect(restoreMatch(serializeMatch(done))).toEqual(done);
});
it('refuses forged gold/components/tool grants, branch facts, and duplicate receipts on restore',()=>{
  for(const outcome of ['gold','components','masterwork']){
    const s=reachRound('3-5',true,seeds.get(outcome)!);const receipts=s.seatMechanics!.receipts;
    const index=receipts.findIndex(r=>r.source==='opening-encounter-monkey');
    for(const replacement of [{...receipts[index],source:'forged'},{...receipts[index],definitionId:'deathblade',amount:26}]){
      expect(()=>restoreMatch({...s,seatMechanics:{...s.seatMechanics!,receipts:receipts.map((r,i)=>i===index?replacement:r)}})).toThrow();
    }
    expect(()=>restoreMatch({...s,seatMechanics:{...s.seatMechanics!,receipts:[...receipts,receipts[index]]}})).toThrow();
  }
});

it('previously eliminated seats receive nothing; public global fact remains available to spectators',()=>{
  const before=sharedBeforeMonkey('damage');
  const dead={...before.states[0],playerHp:0,multiplayer:{...before.states[0].multiplayer!,status:'eliminated' as const}};
  const released=releaseSeatOnElimination(before.pool,dead);if(!released.ok)throw Error(released.reason);
  const survivors=before.states.slice(1).map(s=>({...s,playerHp:10,roundResults:s.roundResults.map((r,i)=>i===s.roundResults.length-1?{...r,hpAfter:10}:r)}));
  const result=nextSharedRound(released.pool,survivors,MONKEY_ROUND-1);if(!result.ok)throw Error(result.reason);
  expect(result.openingResolution!.eliminated.map(x=>x.rank)).toEqual([7,6,5,4,3,2,1]);
  expect(restoreSharedOrbSnapshot(result.pool,JSON.stringify(released.state))).toEqual(released.state);
  expect(readOpeningEncounterView(released.state,result.pool.openingEncounter)!.revealedFacts).toEqual([{nodeId:'3-5',outcome:'damage'}]);
  expect(released.state.openingEncounter.mode==='shared'&&released.state.openingEncounter.receipts).toEqual([]);
});
import { releaseSeatOnElimination } from '../src/simulation/shared-pool';

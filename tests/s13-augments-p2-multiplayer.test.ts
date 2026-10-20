import { syntheticSharedRound } from './tp-helpers';
import { expect, it } from 'vitest';
import { createMatch, selectChoice, deployMatchUnit, claimOrb } from '../src/simulation/match';
import { readLootView } from '../src/simulation/loot-view';
import { snapshotForBattle } from '../src/simulation/two-sided-snapshot';
import { compileBattle, resolveTwoSidedBattle, proposeSettlement } from '../src/simulation/two-sided-battle';
import { applyRoundSettlement, enableMultiplayerSettlement, ROUND_SETTLEMENT_VERSION, type RoundSettlementReceipt } from '../src/simulation/round-settlement';
import { deriveTraits } from '../src/simulation/trait-snapshot';
import { p2GiftPlan } from '../src/simulation/s13-augments-p2-grants';
import { UNIT_DEFINITIONS } from '../src/simulation/units';
import { accepted, reachRound } from './match-helpers';
import type { Unit } from '../src/simulation/unit-types';
import { createSharedPool, initializeSharedSeat, runSharedMatchCommand, assertSharedPoolConservation } from '../src/simulation/shared-pool';
import { selectOpeningUnit } from '../src/simulation/opening-unit';
const IDS=['not-today','all-for-one-ii','calculated-enhancement','flurry-of-blows','pair-of-fours','trifecta-ii'];
const board=(definitionId:string,i:number):Unit=>({id:`unit-${i+100}`,definitionId,starLevel:1,team:'player',location:{kind:'board',cell:{col:i,row:7}}});
it.each(IDS.flatMap(id=>['conqueror','chem-baron'].map(trait=>({id,trait}))))('$id crosses a $trait breakpoint through choice/deployment and commits the actual two-sided receipt',({id,trait})=>{
  const base=reachRound('2-1',false,7),c=base.pendingChoice!,cost=id==='all-for-one-ii'?1:id==='pair-of-fours'?4:id==='trifecta-ii'?3:0;
  let seed=0,incoming=trait==='conqueror'?'draven':'smeech';
  if(cost){
    for(;seed<5000;seed++){
      const gifts=p2GiftPlan({seed,augments:[{definitionId:id,choiceId:c.choiceId,acquiredRound:4}],multiplayer:{version:'multiplayer-settlement-v1',seatId:'A',status:'active',receipts:[],forfeitedChoices:[]}});
      const candidate=gifts.find(g=>g.kind==='unit'&&UNIT_DEFINITIONS[g.definitionId].traits.includes(trait));
      if(candidate){incoming=candidate.definitionId;break;}
    }expect(seed).toBeLessThan(5000);
  }
  const prior=trait==='conqueror'?['darius','draven','swain'].filter(n=>n!==incoming).slice(0,1):['singed','renata','smeech','silco'].filter(n=>n!==incoming).slice(0,2);
  const units=prior.map(board);if(!cost)units.push({...board(incoming,3),location:{kind:'bench',slot:0}});
  const enabled=enableMultiplayerSettlement({...base,seed,level:9,xp:0,nextUnitSerial:200,items:[],temporaryEquipment:[],augments:[],preparation:{...base.preparation,units},pendingChoice:{...c,offers:[id]}},'A');if(!enabled.ok)throw Error(enabled.reason);let state=enabled.state;
  const beforeTier=deriveTraits(state.preparation,'player').find(t=>t.traitId===trait)!.tier;expect(beforeTier).toBe(0);
  state=accepted(selectChoice(state,c.choiceId,c.generation,id));
  if(cost){
    const orbs=readLootView(state).unclaimedOrbs!.filter(o=>o.source==='mechanic');
    expect(orbs).toHaveLength(p2GiftPlan(state).filter(g=>g.kind==='unit').length);expect(state.preparation.units).toEqual(units);
    for(const orb of orbs){
      const claimed=claimOrb(state,orb.orbId,state.round);if(!claimed.ok)throw Error(claimed.reason);state=claimed.state;
    }
  }
  const target=state.preparation.units.find(u=>u.definitionId===incoming&&u.location.kind==='bench')!;expect(target).toBeTruthy();
  state=accepted(deployMatchUnit(state,target.id,{kind:'board',cell:{col:3,row:7}}));
  const afterTier=deriveTraits(state.preparation,'player').find(t=>t.traitId===trait)!.tier;expect(afterTier).toBe(trait==='conqueror'?2:3);
  const opponent={...state,augments:[],items:[],temporaryEquipment:[],preparation:{...state.preparation,units:[{...board('garen',0),starLevel:3 as const}]}};
  const battle=resolveTwoSidedBattle(compileBattle(snapshotForBattle(state,'A'),snapshotForBattle(opponent,'B'),42,{battleId:`p2:${id}:${trait}`}),1201),p=proposeSettlement(battle).a;
  expect(p.g23Facts![trait==='conqueror'?'conquerorTier':'chemBaronTier']).toBe(afterTier);
  const receipt:RoundSettlementReceipt={version:ROUND_SETTLEMENT_VERSION,settlementId:`p2:${id}:${trait}:A`,battleId:p.battleId,seatId:'A',round:state.round,roundId:state.roundDefinitionId,settlementEligible:true,
    result:p.result,damage:p.damage,baseDamage:p.baseDamage,opposingSurvivors:p.opposingSurvivors,growth:p.growth,combatTicks:battle.terminal.tick,combatEventCount:battle.events.length,g23Facts:p.g23Facts};
  expect(applyRoundSettlement(state,{...receipt,g23Facts:{...receipt.g23Facts,[trait==='conqueror'?'conquerorTier':'chemBaronTier']:beforeTier}})).toMatchObject({ok:false,reason:'invalid-receipt',state});
  const settled=applyRoundSettlement(state,receipt);if(!settled.ok)throw Error(settled.reason);expect(settled.ok).toBe(true);
  expect(settled.state.multiplayer!.receipts.at(-1)!.g23Facts).toEqual(p.g23Facts);expect(applyRoundSettlement(settled.state,receipt)).toMatchObject({ok:false,reason:'duplicate-settlement'});
});
it.each(['all-for-one-ii','pair-of-fours','trifecta-ii'].flatMap(id=>[false,true].map(exhausted=>({id,exhausted}))))('$id resolves shared gifts exactly once (pool exhausted: $exhausted)',({id,exhausted})=>{
  let pool=createSharedPool('p2-pool',42,{seatCount:1,...(exhausted?{capacities:{[selectOpeningUnit(42,'A')]:1}}:{})});const born=initializeSharedSeat(pool,createMatch(5,{mode:'shared-deferred'}),'A',0);if(!born.ok)throw Error(born.reason);pool=born.pool;
  const c={kind:'augment' as const,step:'offer' as const,choiceId:'round:2-1:augment',eventId:'round:2-1:augment',generation:0,offers:[id],targetId:null,rerollCount:0,returnPhase:'preparation' as const};
  const base=reachRound('2-1',false,5),layout=syntheticSharedRound(pool,[born.state],base.round);pool=layout.pool;
  const state={...base,m8:{...base.m8,loot:layout.states[0].m8.loot},preparation:born.state.preparation,shop:born.state.shop,rngState:born.state.rngState,resourceProvenance:born.state.resourceProvenance,sharedPool:born.state.sharedPool,multiplayer:born.state.multiplayer,pendingChoice:c};
  const selected=runSharedMatchCommand(pool,state,{type:'choose',choiceId:c.choiceId,generation:0,definitionId:id});if(!selected.ok)throw Error(selected.reason);expect(selected.ok).toBe(true);
  assertSharedPoolConservation(selected.pool,[selected.state]);
  const gifts=p2GiftPlan(selected.state),orbs=readLootView(selected.state).unclaimedOrbs!.filter(o=>o.source==='mechanic');
  expect(orbs).toHaveLength(gifts.length);
  expect(selected.pool.holdings).toEqual(pool.holdings);expect(selected.pool.available).toEqual(pool.available);
  expect(selected.state.gold).toBe(state.gold);expect(selected.state.preparation).toEqual(state.preparation);
  for(const r of selected.state.seatMechanics!.receipts.filter(r=>r.source==='s13-augments-p2'))expect(r).toMatchObject({kind:'unit',resolution:'orb',gold:0,unitId:null});
  let claimed=selected;
  for(const orb of orbs){
    const result=runSharedMatchCommand(claimed.pool,claimed.state,{type:'claimOrb',round:claimed.state.round,orbId:orb.orbId});
    if(!result.ok)throw Error(result.reason);claimed=result;
    assertSharedPoolConservation(claimed.pool,[claimed.state]);
  }
  expect(claimed.pool.holdings.reduce((n,h)=>n+h.sources.length,0)).toBe(1+(exhausted?0:gifts.length));
  expect(claimed.state.gold-state.gold).toBe(exhausted?gifts.reduce((n,g)=>n+UNIT_DEFINITIONS[g.definitionId].cost,0):0);
  const receipts=readLootView(claimed.state).claimReceipts!;
  for(const orb of orbs)expect(receipts.find(r=>r.dropId===claimed.state.m8.loot.rewardOrbs!.find(o=>o.orbId===orb.orbId)!.entries[0].dropId))
    .toMatchObject({resolution:exhausted?'gold':'held'});
  const duplicate=runSharedMatchCommand(selected.pool,selected.state,{type:'choose',choiceId:c.choiceId,generation:0,definitionId:id});expect(duplicate.ok).toBe(false);expect(duplicate.pool).toBe(selected.pool);
});

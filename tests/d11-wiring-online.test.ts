import { augmentTier, augmentDraw, openingEncounter } from './fixtures/m5/oracle.g2.cjs';
import { expect, it } from 'vitest';
import { accepted, reachRound } from './match-helpers';
import { createMatch, selectChoice, equipItem, claimOrb, lockMatchCombatRoster } from '../src/simulation/match';
import { grantMechanicItem } from '../src/simulation/seat-mechanics';
import { grantAnomalyAcquisition } from '../src/simulation/anomaly-acquisition';
import { snapshotForBattle, restorePlayerBattleSnapshot } from '../src/simulation/two-sided-snapshot';
import { compileBattle, resolveTwoSidedBattle, proposeSettlement } from '../src/simulation/two-sided-battle';
import { enableMultiplayerSettlement, applyRoundSettlement, ROUND_SETTLEMENT_VERSION } from '../src/simulation/round-settlement';
import { d11PriorKills, d11GiftPlan, sampleD11CombatGold } from '../src/simulation/d11-fill';
import { readG23Progress } from '../src/simulation/g2-3-state';
import { createSharedPool, initializeSharedSeat, runSharedMatchCommand, assertSharedPoolConservation, restoreSharedOrbSnapshot } from '../src/simulation/shared-pool';
import { selectOpeningUnit } from '../src/simulation/opening-unit';
import { syntheticSharedRound } from './tp-helpers';
import { UNIT_DEFINITIONS } from '../src/simulation/units';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { createCombatWithEvents, stepCombat, type CombatState } from '../src/simulation/combat';
import { readCombatStats } from '../src/simulation/combat-s13';
import { toCombatViewState } from '../src/simulation/combat-replay-view';
import { toPrivateSeatView } from '../src/simulation/private-seat-view';
import { readPublicOrbSummary } from '../src/simulation/loot-view';
import type { Unit } from '../src/simulation/unit-types';

const unit=(id:string,definitionId:string,team:'player'|'enemy',col:number,row:number,starLevel:1|2|3=1):Unit=>
  ({id,definitionId,team,starLevel,location:{kind:'board',cell:{col,row}}});
const ids=['all-for-one-i','trifecta-i','spirit-link','avarice-incarnate','headhunter'];
it.each(ids)('%s survives online snapshot JSON, both combat sides, authoritative settlement and duplicate rejection',id=>{
  const base=reachRound('2-1',false,7),c=base.pendingChoice!,augment=ids.indexOf(id)<3;
  const units=[unit('unit-1',id==='trifecta-i'?'nami':'lux','player',1,7,3),...(id==='headhunter'?[]:[unit('unit-2','leona','player',0,4,2)])];
  const enabled=enableMultiplayerSettlement({...base,items:[],temporaryEquipment:[],nextUnitSerial:3,level:9,xp:0,gold:20,
    preparation:{...base.preparation,units},pendingChoice:{...c,kind:augment?'augment':'anomaly',targetId:augment?null:'unit-1',offers:[id]}},'A');
  if(!enabled.ok)throw Error(enabled.reason);
  // The Match suite covers genuine 4-6 acquisition. These isolated online
  // vectors place the anomaly directly on a PvP preparation boundary.
  let state=augment?accepted(selectChoice(enabled.state,c.choiceId,c.generation,id))
    :grantAnomalyAcquisition({...enabled.state,phase:'preparation',combat:null,pendingChoice:null,
      anomalyBinding:{definitionId:id,unitId:'unit-1',choiceId:'d11-online',boundRound:base.round}}).state;
  const giftOrbs=toPrivateSeatView(state).unclaimedOrbs!.filter(o=>o.source==='mechanic');
  if(id==='avarice-incarnate'){
    state=accepted(grantMechanicItem(state,{receiptId:'d11:collector',source:'test',definitionId:'TFT4_Item_OrnnTheCollector'}));
    state=accepted(equipItem(state,state.items.at(-1)!.id,'unit-1',0));
  }
  const opponent={...state,augments:[],anomalyBinding:null,items:id==='headhunter'?[{id:'item-1',definitionId:'TFT9_Item_OrnnTrickstersGlass',location:{kind:'unit' as const,unitId:'unit-1',slot:0}}]:[],temporaryEquipment:[],preparation:{...state.preparation,units:[unit('unit-1','irelia','player',1,4)]}};
  const a=snapshotForBattle(state,'A'),b=snapshotForBattle(opponent,'B');
  expect(restorePlayerBattleSnapshot(JSON.parse(JSON.stringify(a)))).toEqual(a);
  if(giftOrbs.length){
    expect(giftOrbs).toHaveLength(2);
    state=accepted(lockMatchCombatRoster(state));
    const before=state;
    for(const orb of giftOrbs){
      const queued=claimOrb(state,orb.orbId,state.round);if(!queued.ok)throw Error(queued.reason);state=queued.state;
    }
    expect(state.preparation).toBe(before.preparation);expect(state.gold).toBe(before.gold);
    expect(toPrivateSeatView(state).unclaimedOrbs!.filter(o=>o.queued)).toHaveLength(2);
  }
  const battle=resolveTwoSidedBattle(compileBattle(a,b,42,{battleId:'d11:'+id}),1201);
  const owner=battle.initial.units.find(u=>u.id===battle.mapping.find(m=>m.seatId==='A'&&m.kind==='unit'&&m.originalId==='unit-1')!.combatId)!;
  expect(toCombatViewState(battle.initial).units.find(u=>u.id===owner.id)?.choiceEffects).toContainEqual(expect.objectContaining({definitionId:id}));
  expect(toCombatViewState(battle.initial).units.find(u=>u.id===owner.id)?.statuses).toEqual(expect.any(Array));
  if(id==='trifecta-i')expect(owner.sources).toContainEqual(expect.objectContaining({effect:{kind:'statFlat',stat:'maxHp',amount:250}}));
  if(id==='headhunter'){
    expect(readCombatStats(owner,battle.initial).attackIntervalTicks).toBeLessThan(owner.attackIntervalTicks);
    expect(battle.terminal.units.find(u=>u.id===owner.id)?.d11Kills).toHaveLength(1);
    expect(battle.events).toContainEqual(expect.objectContaining({type:'statChanged',stat:'attackSpeed',before:1500,after:1600}));
    expect(battle.events.filter(e=>e.type==='kill'&&e.source.ownerId===owner.id)).toHaveLength(2);
  }
  if(id==='avarice-incarnate'){
    expect(battle.terminal.itemGoldReceipts?.filter(r=>r.gold)).toHaveLength(1);
    expect(battle.terminal.units.find(u=>u.id===owner.id)?.currentItemBankGold).toBe(state.gold+1);
    expect(sampleD11CombatGold(battle.terminal,'player',state.gold).units.find(u=>u.id===owner.id)?.currentItemBankGold).toBe(state.gold+1);
  }
  const proposal=proposeSettlement(battle).a;
  const receipt={version:ROUND_SETTLEMENT_VERSION,settlementId:'d11:'+id+':A',battleId:proposal.battleId,seatId:'A',round:state.round,roundId:state.roundDefinitionId,
    settlementEligible:true,result:proposal.result,damage:proposal.damage,baseDamage:proposal.baseDamage,opposingSurvivors:proposal.opposingSurvivors,growth:proposal.growth,
    combatTicks:battle.terminal.tick,combatEventCount:battle.events.length,g23Facts:proposal.g23Facts};
  const committed=applyRoundSettlement(state,receipt);if(!committed.ok)throw Error(committed.reason);
  expect(committed.state.multiplayer!.receipts.at(-1)?.g23Facts).toEqual(proposal.g23Facts);
  if(giftOrbs.length){
    expect(committed.state.m8.loot.queuedOrbClaims).toEqual([]);
    expect(toPrivateSeatView(committed.state).orbClaimReceipts).toHaveLength(2);
    expect(toPrivateSeatView(committed.state).unclaimedOrbs!.filter(o=>o.source==='mechanic')).toEqual([]);
    expect(committed.state.seatMechanics!.receipts.filter(r=>r.source==='d11-fill')).toHaveLength(2);
  }
  expect(applyRoundSettlement(committed.state,receipt)).toEqual({ok:false,state:committed.state,reason:'duplicate-settlement'});
  if(id==='headhunter')expect(d11PriorKills(readG23Progress(committed.state),state.anomalyBinding!.boundRound)).toBe(1);
  if(id==='headhunter'){
    expect(applyRoundSettlement(state,{...receipt,g23Facts:{...receipt.g23Facts,d11Headhunter:undefined}})).toMatchObject({ok:false,state,reason:'invalid-receipt'});
    expect(applyRoundSettlement(state,{...receipt,g23Facts:{...receipt.g23Facts,d11Headhunter:{...receipt.g23Facts!.d11Headhunter!,holderId:'forged'}}})).toMatchObject({ok:false,state,reason:'invalid-receipt'});
  }
  const reversed=resolveTwoSidedBattle(compileBattle(b,a,42,{battleId:'d11:reverse:'+id}),1201);
  expect(toCombatViewState(reversed.initial).units.some(u=>u.team==='enemy'&&u.choiceEffects?.some(d=>d.definitionId===id))).toBe(true);
  const mirror=resolveTwoSidedBattle(compileBattle(b,a,42,{battleId:'d11:mirror:'+id,mirrorOfSeatId:'A'}),1201);
  expect(proposeSettlement(mirror).b.settlementEligible).toBe(false);
  expect(proposeSettlement(mirror).b.g23Facts).toBeUndefined();
});

// 14.24 stage tags put Trifecta I at 3-2/4-2 only; this 2-1 shared-seat fixture keeps All for One I, which takes the same
// two-receipt orb route (d11-fill gifts).
it.each(['all-for-one-i'].flatMap(id=>[false,true].map(exhausted=>({id,exhausted}))))('$id routes gifts through the actual shared transaction (pool exhausted $exhausted)',({id,exhausted})=>{
  // Search independent literal-table offers; shared root and solo prefix must
  // bind the same encounter/tier. Keep a genuinely offered card for strict restore.
  let seed=0;
  for(;seed<10000;seed++) {
    // v23: subscription openings carry seat-bound receipts the solo-prefix transplant below cannot reuse.
    if(['golden-gala','prismatic-party','prismatic-prelude','prismatic-finale','wind-up-monkey','component-anvils','artifact-anvil','loot-subscription','gold-subscription'].includes(openingEncounter(seed)))continue;
    // v23: pass the 2-1 node so the oracle applies the node's offer rules (Black Rose exclusion) like the real offer.
    if(augmentDraw((seed^0x9e3779b9)>>>0,augmentTier(seed,'round:2-1:augment'),[],[],'round:2-1:augment').offers.includes(id))break;
  }
  expect(seed).toBeLessThan(10000);
  let pool=createSharedPool('d11-pool',seed,{seatCount:1,...(exhausted?{capacities:{[selectOpeningUnit(seed,'A')]:1}}:{})});
  const born=initializeSharedSeat(pool,createMatch(seed,{mode:'shared-deferred'}),'A',0);if(!born.ok)throw Error(born.reason);pool=born.pool;
  const base=reachRound('2-1',false,seed),layout=syntheticSharedRound(pool,[born.state],base.round);pool=layout.pool;
  const c=base.pendingChoice!,state={...base,m8:{...base.m8,loot:layout.states[0].m8.loot},preparation:born.state.preparation,shop:born.state.shop,
    rngState:born.state.rngState,resourceProvenance:born.state.resourceProvenance,sharedPool:born.state.sharedPool,multiplayer:born.state.multiplayer,openingEncounter:born.state.openingEncounter,augmentTierSeed:born.state.augmentTierSeed,pendingChoice:c};
  const selected=runSharedMatchCommand(pool,state,{type:'choose',choiceId:c.choiceId,generation:c.generation,definitionId:id});if(!selected.ok)throw Error(selected.reason);
  assertSharedPoolConservation(selected.pool,[selected.state]);
  const gifts=d11GiftPlan(selected.state,selected.state.augments.at(-1)!);
  // Online D11 grants share the orb contract: acquisition records the fixed gift,
  // while only claiming allocates inventory/pool copies or shortage compensation.
  expect(selected.pool.holdings).toEqual(pool.holdings);
  expect(selected.pool.available).toEqual(pool.available);
  expect(selected.state.preparation).toEqual(state.preparation);
  expect(selected.state.gold).toBe(state.gold);
  expect(selected.state.seatMechanics!.receipts.filter(r=>r.source==='d11-fill')).toHaveLength(2);
  const view=toPrivateSeatView(selected.state),orbs=view.unclaimedOrbs!.filter(o=>o.source==='mechanic');
  expect(view.d11Display?.definitions).toContainEqual(expect.objectContaining({definitionId:id}));
  expect(orbs).toHaveLength(2);
  expect(orbs.map(o=>o.entries[0].kind==='unit'?o.entries[0].definitionId:undefined)).toEqual(gifts.map(g=>g.definitionId));
  expect(orbs.every(o=>!o.queued)).toBe(true);
  expect(readPublicOrbSummary(selected.state)).toEqual({count:orbs.length,tiers:['gray','gray']});
  expect(restoreSharedOrbSnapshot(selected.pool,JSON.stringify(selected.state))).toEqual(selected.state);
  expect(selected.state.seatMechanics!.receipts.filter(r=>r.source==='d11-fill').every(r=>r.kind==='unit'&&r.resolution==='orb'&&r.gold===0)).toBe(true);
  let claimed=selected;
  for(const orb of orbs){
    const result=runSharedMatchCommand(claimed.pool,claimed.state,{type:'claimOrb',round:claimed.state.round,orbId:orb.orbId});
    if(!result.ok)throw Error(result.reason);claimed=result;
    assertSharedPoolConservation(claimed.pool,[claimed.state]);
    expect(runSharedMatchCommand(claimed.pool,claimed.state,{type:'claimOrb',round:claimed.state.round,orbId:orb.orbId}))
      .toMatchObject({ok:false,pool:claimed.pool,state:claimed.state,reason:'already-claimed'});
  }
  expect(claimed.pool.holdings.reduce((n,h)=>n+h.sources.length,0)).toBe(exhausted?1:3);
  expect(claimed.state.gold-state.gold).toBe(exhausted?gifts.reduce((n,g)=>n+UNIT_DEFINITIONS[g.definitionId].cost,0):0);
  expect(restoreSharedOrbSnapshot(claimed.pool,JSON.stringify(claimed.state))).toEqual(claimed.state);
  expect(runSharedMatchCommand(selected.pool,selected.state,{type:'choose',choiceId:c.choiceId,generation:c.generation,definitionId:id})).toMatchObject({ok:false,pool:selected.pool,state:selected.state});
});

function avarice():CombatState {
  const base=reachRound('2-1'),preparation={...base.preparation,units:[unit('p','lux','player',0,4),unit('e','irelia','enemy',0,3)]};
  const inputs={...base,gold:0,preparation,augments:[],items:[],temporaryEquipment:[],anomalyBinding:{definitionId:'avarice-incarnate',unitId:'p',choiceId:'avarice',boundRound:1}};
  return createCombatWithEvents(preparation,buildStrategySnapshot(inputs),'d11-live-gold',42).state;
}
function firstPacket(state:CombatState){
  for(let i=0;i<100&&state.status==='running';i++){
    const next=stepCombat(state);state=next.state;
    const e=next.events.find(e=>e.type==='packetDamage'&&e.outcome.context.source.ownerId==='p');
    if(e?.type==='packetDamage')return e.outcome;
  }throw Error('No real D11 attack');
}
it('Avarice samples authoritative bank changes in both directions at damage time, without mutating prior state or RNG',()=>{
  const start=avarice(),before=JSON.stringify(start),low=firstPacket(start),high=firstPacket(sampleD11CombatGold(start,'player',50));
  expect(high.hpDamage).toBeGreaterThan(low.hpDamage);
  expect(firstPacket(sampleD11CombatGold(sampleD11CombatGold(start,'player',50),'player',0))).toEqual(low);
  expect(JSON.stringify(start)).toBe(before);
  expect(sampleD11CombatGold(start,'player',0)).toBe(start);
  expect(sampleD11CombatGold(start,'player',50).rngState).toBe(start.rngState);
  expect(()=>sampleD11CombatGold(start,'player',-1)).toThrow();
});

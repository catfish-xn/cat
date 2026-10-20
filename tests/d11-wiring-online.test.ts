import { expect, it } from 'vitest';
import { accepted, reachRound } from './match-helpers';
import { createMatch, selectChoice, equipItem } from '../src/simulation/match';
import { grantMechanicItem } from '../src/simulation/seat-mechanics';
import { grantAnomalyAcquisition } from '../src/simulation/anomaly-acquisition';
import { snapshotForBattle, restorePlayerBattleSnapshot } from '../src/simulation/two-sided-snapshot';
import { compileBattle, resolveTwoSidedBattle, proposeSettlement } from '../src/simulation/two-sided-battle';
import { enableMultiplayerSettlement, applyRoundSettlement, ROUND_SETTLEMENT_VERSION } from '../src/simulation/round-settlement';
import { d11PriorKills, d11GiftPlan, sampleD11CombatGold } from '../src/simulation/d11-fill';
import { readG23Progress } from '../src/simulation/g2-3-state';
import { createSharedPool, initializeSharedSeat, runSharedMatchCommand, assertSharedPoolConservation } from '../src/simulation/shared-pool';
import { selectOpeningUnit } from '../src/simulation/opening-unit';
import { syntheticSharedRound } from './tp-helpers';
import { UNIT_DEFINITIONS } from '../src/simulation/units';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { createCombatWithEvents, stepCombat, type CombatState } from '../src/simulation/combat';
import { readCombatStats } from '../src/simulation/combat-s13';
import { toCombatViewState } from '../src/simulation/combat-replay-view';
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
  if(id==='avarice-incarnate'){
    state=accepted(grantMechanicItem(state,{receiptId:'d11:collector',source:'test',definitionId:'TFT4_Item_OrnnTheCollector'}));
    state=accepted(equipItem(state,state.items.at(-1)!.id,'unit-1',0));
  }
  const opponent={...state,augments:[],anomalyBinding:null,items:id==='headhunter'?[{id:'item-1',definitionId:'TFT9_Item_OrnnTrickstersGlass',location:{kind:'unit' as const,unitId:'unit-1',slot:0}}]:[],temporaryEquipment:[],preparation:{...state.preparation,units:[unit('unit-1','irelia','player',1,4)]}};
  const a=snapshotForBattle(state,'A'),b=snapshotForBattle(opponent,'B');
  expect(restorePlayerBattleSnapshot(JSON.parse(JSON.stringify(a)))).toEqual(a);
  const battle=resolveTwoSidedBattle(compileBattle(a,b,42,{battleId:'d11:'+id}),1201);
  const owner=battle.initial.units.find(u=>u.id===battle.mapping.find(m=>m.seatId==='A'&&m.kind==='unit'&&m.originalId==='unit-1')!.combatId)!;
  expect(toCombatViewState(battle.initial).units.find(u=>u.id===owner.id)?.choiceEffects).toContainEqual(expect.objectContaining({definitionId:id}));
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

it.each(['all-for-one-i','trifecta-i'].flatMap(id=>[false,true].map(exhausted=>({id,exhausted}))))('$id routes gifts through the actual shared transaction (pool exhausted $exhausted)',({id,exhausted})=>{
  let pool=createSharedPool('d11-pool',42,{seatCount:1,...(exhausted?{capacities:{[selectOpeningUnit(42,'A')]:1}}:{})});
  const born=initializeSharedSeat(pool,createMatch(5,{mode:'shared-deferred'}),'A',0);if(!born.ok)throw Error(born.reason);pool=born.pool;
  const base=reachRound('2-1',false,5),layout=syntheticSharedRound(pool,[born.state],base.round);pool=layout.pool;
  const c=base.pendingChoice!,state={...base,m8:{...base.m8,loot:layout.states[0].m8.loot},preparation:born.state.preparation,shop:born.state.shop,
    rngState:born.state.rngState,resourceProvenance:born.state.resourceProvenance,sharedPool:born.state.sharedPool,multiplayer:born.state.multiplayer,pendingChoice:{...c,offers:[id]}};
  const selected=runSharedMatchCommand(pool,state,{type:'choose',choiceId:c.choiceId,generation:c.generation,definitionId:id});if(!selected.ok)throw Error(selected.reason);
  assertSharedPoolConservation(selected.pool,[selected.state]);
  const gifts=d11GiftPlan(selected.state,selected.state.augments.at(-1)!);
  expect(selected.pool.holdings.reduce((n,h)=>n+h.sources.length,0)).toBe(exhausted?1:3);
  expect(selected.state.gold-state.gold).toBe(exhausted?gifts.reduce((n,g)=>n+UNIT_DEFINITIONS[g.definitionId].cost,0):0);
  expect(selected.state.seatMechanics!.receipts.filter(r=>r.source==='d11-fill')).toHaveLength(2);
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

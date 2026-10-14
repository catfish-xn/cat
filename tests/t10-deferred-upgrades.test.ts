import { syntheticSharedRound } from './tp-helpers';
import { describe, expect, it } from 'vitest';
import { autoDeployToCap, buyUnit, buySharedUnit, buyXp, combineItems, deployMatchUnit, equipItem,
  generateSharedShop, rerollSharedShop, setSharedShopLock, sellSharedUnit, runSharedMatchCommand,
  lockMatchCombatRoster, applyRoundSettlement, snapshotForBattle, compileBattle, resolveTwoSidedBattle,
  proposeSettlement, ROUND_SETTLEMENT_VERSION, stepMatch, type MatchState, type RoundSettlementReceipt } from '../src/server-entry';
import { CONTENT_DIGEST } from '../src/simulation/content';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { MULTIPLAYER_OPERATION_RULES } from '../src/simulation/operation-policy';
import { createMatch } from '../src/simulation/match';
import { room, accept, conserved, rejected, fullBench } from './tp-helpers';
import { accepted, bench, board, hero, operating } from './t10-helpers';
import { catalogPreparation } from './t5r-helpers';
import { freeze } from './combat-helpers';

function ireliaRoom() {
  const r=room({irelia:20},1), generated=accept(generateSharedShop(r.pool,{...r.states[0],gold:100},0));
  return accept(runSharedMatchCommand(generated.pool,generated.state,{type:'startCombat'}));
}
function finish(r:ReturnType<typeof ireliaRoom>) {
  let budget=1201;const events=[];
  while(r.state.phase==='combat'&&budget-->0){r=accept(runSharedMatchCommand(r.pool,r.state,{type:'step'}));events.push(...r.events);}
  expect(budget).toBeGreaterThanOrEqual(0);conserved(r.pool,[r.state]);return {...r,events};
}
function asPvp(state: MatchState): MatchState {
  const catalog=catalogPreparation('2-1');
  return {...state,phase:'preparation',combat:null,pendingChoice:null,combatInputBasis:null,round:4,roundDefinitionId:'2-1',m8:catalog.m8,
    roundResults:Array.from({length:3},(_,i)=>({...state.roundResults[0],round:i+1})),
    preparation:{...state.preparation,units:state.preparation.units.filter(u=>u.team==='player')}};
}
function receipt(state:MatchState, growth:RoundSettlementReceipt['growth']=[]):RoundSettlementReceipt {
  return {version:ROUND_SETTLEMENT_VERSION,settlementId:'t10:A',battleId:'t10',seatId:state.multiplayer!.seatId,
    round:4,roundId:'2-1',settlementEligible:true,result:'win',damage:0,baseDamage:2,opposingSurvivors:0,growth,combatTicks:88,combatEventCount:20};
}
describe('t10-deferred-upgrades and shared-pool operations',()=>{
  it('board A + two bought A remain separate during combat, then merge at PvE settlement exactly once',()=>{
    let r=ireliaRoom();const original=r.state, frozen=structuredClone(original.combatInputBasis);
    r=accept(buySharedUnit(r.pool,r.state,0,r.state.shop.generation));
    r=accept(buySharedUnit(r.pool,r.state,1,r.state.shop.generation));
    expect(r.state.preparation.units.filter(u=>u.definitionId==='irelia').map(u=>u.starLevel)).toEqual([1,1,1]);
    expect(r.events.some(e=>e.type==='unitUpgraded')).toBe(false);conserved(r.pool,[r.state]);
    const done=finish(r), boardUnit=done.state.preparation.units.find(u=>u.id==='unit-1')!;
    expect(boardUnit.starLevel).toBe(2);
    expect(done.events.filter(e=>e.type==='unitUpgraded')).toEqual([expect.objectContaining({survivorId:'unit-1',consumedIds:['unit-2','unit-3'],fromStar:1,toStar:2})]);
    expect(done.pool.holdings.find(h=>h.unitId==='unit-1')?.sources).toHaveLength(3);
    expect(done.state.combatInputBasis).toEqual(frozen);expect(done.state.combat!.units.find(u=>u.id==='unit-1')?.starLevel).toBe(1);
    expect(stepMatch(done.state)).toEqual({state:done.state,events:[]});
  });
  it('a third bench A merges immediately without using the fourth copy fighting on board',()=>{
    let r=ireliaRoom();const frozen=r.state.combatInputBasis, combat=r.state.combat;
    for(const slot of [0,1,2])r=accept(buySharedUnit(r.pool,r.state,slot,r.state.shop.generation));
    expect(r.state.preparation.units.find(u=>u.id==='unit-1')?.starLevel).toBe(1);
    expect(r.state.preparation.units.find(u=>u.id==='unit-2')).toMatchObject({starLevel:2,location:bench(0)});
    expect(r.events.filter(e=>e.type==='unitUpgraded')).toEqual([expect.objectContaining({survivorId:'unit-2',consumedIds:['unit-3','unit-4']})]);
    expect(r.state.combatInputBasis).toBe(frozen);expect(r.state.combat).toBe(combat);conserved(r.pool,[r.state]);
  });
  it('recursive bench upgrades never consume two deployed two-star copies',()=>{
    const base=operating('combat'), state={...base,nextUnitSerial:10,shop:{generation:1,slots:[{status:'available' as const,definitionId:'irelia'}]},
      preparation:{...base.preparation,units:[hero('board-a',board(2),'irelia',2),hero('board-b',board(3),'irelia',2),
        hero('bench-a',bench(0),'irelia'),hero('bench-b',bench(1),'irelia')]}};
    const result=buyUnit(freeze(state),0,1),next=accepted(result);
    expect(next.preparation.units.map(u=>u.starLevel)).toEqual([2,2,2]);
    expect(result.ok&&result.events.filter(e=>e.type==='unitUpgraded')).toHaveLength(1);
  });
  it.each(['combat','choice','settlement'] as const)('%s shared buy/reroll/lock/sell stay atomic and conserve every copy',phase=>{
    let r=ireliaRoom();r={...r,state:phase==='combat'?r.state:{...r.state,phase,combat:null} as MatchState};
    r=accept(buySharedUnit(r.pool,r.state,0,r.state.shop.generation));
    const reserve=r.state.preparation.units.find(u=>u.team==='player'&&u.location.kind==='bench')!;
    r=accept(setSharedShopLock(r.pool,r.state,true,r.state.shop.generation));
    r=accept(rerollSharedShop(r.pool,r.state,r.state.shop.generation));
    r=accept(sellSharedUnit(r.pool,r.state,reserve.id));conserved(r.pool,[r.state]);
    rejected(buySharedUnit(r.pool,r.state,0,r.state.shop.generation-1),r.pool,r.state,'stale-shop');
    rejected(sellSharedUnit(r.pool,r.state,'unit-1'),r.pool,r.state,'wrong-phase');
    const poor={...r.state,gold:0};rejected(rerollSharedShop(r.pool,poor,poor.shop.generation),r.pool,poor,'insufficient-gold');
  });
  it('shared full bench failure retains pool, shop reservation, state and all RNG',()=>{
    const {pool,state}=fullBench();
    const started=accept(runSharedMatchCommand(pool,state,{type:'startCombat'}));
    let r=started;
    // Find a non-merging reserved offer; refresh only when necessary.
    for(let tries=0;tries<20;tries++){
      const slot=r.state.shop.slots.findIndex(s=>s.status==='available'&&r.state.preparation.units.filter(u=>u.team==='player'&&u.location.kind==='bench'&&u.definitionId===s.definitionId&&u.starLevel===1).length<2);
      if(slot>=0){rejected(buySharedUnit(r.pool,r.state,slot,r.state.shop.generation),r.pool,r.state,'bench-full');conserved(r.pool,[r.state]);return;}
      r=accept(rerollSharedShop(r.pool,r.state,r.state.shop.generation));
    }
    throw new Error('No non-merging offer');
  });
  it('PvP roster lock protects the preparation-shaped live state and settlement migrates growth/items/pool sources',()=>{
    const setup=room({irelia:1,tristana:20},1);
    let r=accept(generateSharedShop(setup.pool,{...setup.states[0],gold:100,level:3},0));
    r=accept(buySharedUnit(r.pool,r.state,0,r.state.shop.generation));
    r={...r,state:accepted(deployMatchUnit(r.state,'unit-2',board(2)))};
    // Contiguous synthetic history isolates the PvP receipt; this is not an offline save.
    r={...r,state:asPvp({...r.state,persistentGrowth:[{unitId:'unit-2',attackDamageBps:250}]})};
    const bound=syntheticSharedRound(r.pool,[r.state],r.state.round);r={...r,pool:bound.pool,state:bound.states[0]};
    const snapshot=snapshotForBattle(r.state,r.state.multiplayer!.seatId),frozen=structuredClone(snapshot);
    r={...r,state:accepted(lockMatchCombatRoster(r.state))};
    expect(lockMatchCombatRoster(r.state).state).toBe(r.state);
    for(const command of [s=>deployMatchUnit(s,'unit-2',bench(0)),autoDeployToCap] as ((s:MatchState)=>ReturnType<typeof autoDeployToCap>)[])
      expect(command(r.state)).toEqual({ok:false,state:r.state,reason:'wrong-phase'});
    rejected(sellSharedUnit(r.pool,r.state,'unit-2'),r.pool,r.state,'wrong-phase');
    for(const slot of [1,2])r=accept(buySharedUnit(r.pool,r.state,slot,r.state.shop.generation));
    expect(r.state.preparation.units.filter(u=>u.definitionId==='tristana')).toHaveLength(3);
    r={...r,state:{...r.state,items:[{id:'item-1',definitionId:'sword',location:{kind:'unit',unitId:'unit-3',slot:0}}],nextItemSerial:2}};
    const before=r.state,request=receipt(before,[{unitId:'unit-2',attackDamageBps:125}]);
    r=accept(runSharedMatchCommand(r.pool,r.state,{type:'settleRound',receipt:request}));
    expect(snapshot).toEqual(frozen);expect(r.state.multiplayer?.combatRosterLocked).toBeUndefined();
    expect(r.state.preparation.units.find(u=>u.id==='unit-2')?.starLevel).toBe(2);
    expect(r.state.persistentGrowth).toEqual([{unitId:'unit-2',attackDamageBps:375}]);
    expect(r.state.items[0].location).toEqual({kind:'unit',unitId:'unit-2',slot:0});
    expect(r.pool.holdings.find(h=>h.unitId==='unit-2')?.sources).toHaveLength(3);conserved(r.pool,[r.state]);
    rejected(runSharedMatchCommand(r.pool,r.state,{type:'settleRound',receipt:request}),r.pool,r.state,'duplicate-settlement');
    expect(applyRoundSettlement(before,request).state).toMatchObject({persistentGrowth:r.state.persistentGrowth});
  });
  it('frozen two-sided battle remains byte-identical while the live seat buys and levels',()=>{
    const base=asPvp(operating('settlement')), a=snapshotForBattle(base,'A'),b={...a,seatId:'B'};
    const input=compileBattle(a,b,42,{battleId:'t10-frozen'}), expected=resolveTwoSidedBattle(input,1201);
    let live=accepted(lockMatchCombatRoster(base));live=accepted(buyUnit(live,0,live.shop.generation));live=accepted(buyXp(live));
    live=accepted(combineItems(live,'item-1','item-2'));live=accepted(equipItem(live,'item-3','unit-2',0));
    expect(resolveTwoSidedBattle(input,1201)).toEqual(expected);
    expect(proposeSettlement(expected).a.seatId).toBe('A');expect(live.gold).not.toBe(base.gold);
  });
  it('versions participate in computed digest; old content saves reject and new offline saves round-trip',()=>{
    expect(MULTIPLAYER_OPERATION_RULES).toMatchObject({version:'multiplayer-combat-ops-v2',autoDeploymentVersion:'front-center-left-first-v1'});
    const state=createMatch(5);expect(state.contentDigest).toBe(CONTENT_DIGEST);
    expect(CONTENT_DIGEST).not.toBe('fnv1a32-utf16:20b58a63');
    expect(()=>restoreMatch({...state,contentDigest:'fnv1a32-utf16:20b58a63'})).toThrow('content-digest');
    expect(restoreMatch(serializeMatch(state))).toEqual(state);
  });
});

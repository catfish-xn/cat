import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
// D3 remains absent from the real catalog. A test-only one-for-one definition swap
// exercises the existing public commands/restore without changing production offers.
vi.mock('../src/simulation/content/augments', async original => {
  const actual = await original<typeof import('../src/simulation/content/augments')>();
  const { placebo: _replaced, ...definitions } = actual.AUGMENT_DEFINITIONS;
  return {...actual,AUGMENT_DEFINITIONS:{...definitions,'over-encumbered':{id:'over-encumbered',name:'运力不足',description:'D3 test fixture',effects:[{kind:'mechanic',mechanic:'acquisitionBundle',values:{enabled:1}}]}}};
});
vi.mock('../src/simulation/content/augment-policy', async original => {
  const actual = await original<typeof import('../src/simulation/content/augment-policy')>();
  return {...actual,AUGMENT_TIERS:{...actual.AUGMENT_TIERS,'over-encumbered':'silver'}};
});
import { createMatch, buyUnit, sellUnit, openAnvil, deployMatchUnit, selectAnomalyTarget, forfeitPendingChoice, equipItem, autoDeployToCap, startMatchCombat, getDeploymentCap, buyXp, rerollShop, setShopLock, type MatchState } from '../src/simulation/match';
import { getPlayerDeploymentCount } from '../src/simulation/game';
import { getCatalogRoundById } from '../src/simulation/round-selectors';
import { enableMultiplayerSettlement } from '../src/simulation/round-settlement';
import { OVER_ENCUMBERED_DEFINITION, overEncumberedActive, reconcileOverEncumbered, completeOverEncumbered, overEncumberedRewardPlan, validateOverEncumbered } from '../src/simulation/over-encumbered';
import { combatBenchProjection, usableBenchSlots, isOverflowUnit } from '../src/simulation/bench-capacity';
import { planPurchase, planDeferredUpgrades } from '../src/simulation/upgrades';
import { createCombatWithEvents } from '../src/simulation/combat';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { readCombatStrategyInputs, freezeCombatInput } from '../src/simulation/combat-input';
import { snapshotForBattle } from '../src/simulation/two-sided-snapshot';
import { deriveTraits } from '../src/simulation/trait-snapshot';
import { captureAugmentHistoryAuthority, recordAugmentAcquisition, validateAugmentAuthority } from '../src/simulation/augment-history';
import { toPrivateSeatView } from '../src/simulation/private-seat-view';
import { toPublicBoard } from '../src/server/room/projection';
import { placeCarouselUnit } from '../src/simulation/carousel-units';
import { returnLocation } from '../src/simulation/d14-runtime';
import { G24_FORGE_POOLS } from '../src/simulation/content/g2-4-forges';
import { grantMechanicUnit } from '../src/simulation/seat-mechanics/grants';
import { validateBatch1GiftReceipts } from '../src/simulation/restore-checks/batch1-gifts-check';
import { accepted, reachRoundFielded, resolveM5Choices, finish, fieldBench, freeze } from './match-helpers';
import { firstNodeSeed } from './augment-stage-helpers';
import { selectChoice, nextRound } from '../src/simulation/match';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { roomOffer } from './augment-pool-batch5-h12-helpers';
import { runUntil } from './server/helpers';
import { assertSharedPoolConservation, restoreSharedOrbSnapshot } from '../src/simulation/shared-pool';
import { canonicalContent } from '../src/simulation/content';
import { nextRandom } from '../src/simulation/rng';
import { createOpeningEncounter } from '../src/simulation/opening-encounter';
import { isAnvil } from '../src/simulation/content/anvils';
import { validateAnvils } from '../src/simulation/restore-checks/anvils-check';
import { getMultiplayerRoundById } from '../src/simulation/multiplayer-round';
import { augmentDynamicValues } from '../src/simulation/augment-dynamic-values';
import { readEncounterPreview } from '../src/simulation/encounter-selectors';
import { readItemSummons, moveItemSummon, VOIDSPAWN_ITEM } from '../src/simulation/g2-4b-voidspawn';

function atRound(s: MatchState, id: string): MatchState {
  const round = getMultiplayerRoundById(id);
  return {...s,round:round.ordinal,roundDefinitionId:id,m8:{...s.m8,round,preparation:{...s.m8.preparation,roundId:id,encounterId:round.encounterId,enemies:[]}},phase:'preparation',pendingChoice:null,combat:null,
    preparation:{...s.preparation,units:s.preparation.units.filter(u=>u.team==='player')}};
}
function fixture(id='3-1', count=9): MatchState {
  const enabled=enableMultiplayerSettlement(createMatch(42),'s1');if(!enabled.ok)throw Error(enabled.reason);
  let s=enabled.state;
  s=atRound(s,'2-1');
  s=recordAugmentAcquisition(s,{...s,augments:[{definitionId:'over-encumbered',choiceId:'round:2-1:augment',acquiredRound:4}]});
  s=atRound(s,id);
  s={...s,items:[],level:3,xp:0,nextUnitSerial:20,gold:100,
    preparation:{...s.preparation,units:[
      {id:'unit-1',team:'player',definitionId:'irelia',starLevel:1,location:{kind:'board',cell:{row:4,col:0}}},
      ...Array.from({length:count},(_,slot)=>({id:`unit-${slot+2}`,team:'player' as const,definitionId:slot%2?'lux':'maddie',starLevel:1 as const,location:{kind:'bench' as const,slot}})),
    ]}};
  return s;
}
const active = (n=9) => reconcileOverEncumbered(fixture('3-1',n)).state;
function anvilFixture(benchAnvil=false):MatchState {
  let seed=0;while(createOpeningEncounter(seed).selection.encounterId!=='component-anvils')seed++;
  const enabled=enableMultiplayerSettlement(createMatch(seed),'s1');if(!enabled.ok)throw Error(enabled.reason);
  const base=atRound(enabled.state,'3-1');
  const anvils=base.preparation.units.filter(u=>isAnvil(u.definitionId));expect(anvils).toHaveLength(2);
  const acquired=recordAugmentAcquisition(base,{...base,augments:fixture().augments});
  return reconcileOverEncumbered({...acquired,preparation:{...base.preparation,units:[
    {id:'unit-99',team:'player',definitionId:'lux',starLevel:1,location:{kind:'bench',slot:benchAnvil?1:0}},
    ...anvils.map((u,i)=>({...u,location:{kind:'bench' as const,slot:benchAnvil?i*2:i+1}})),
  ]},nextUnitSerial:100}).state;
}

describe('D3 capacity and non-combat reserves',()=>{
  it('does not register the real definition or tier',async()=>{
    const defs=await vi.importActual<typeof import('../src/simulation/content/augments')>('../src/simulation/content/augments');
    const tiers=await vi.importActual<typeof import('../src/simulation/content/augment-policy')>('../src/simulation/content/augment-policy');
    expect(defs.AUGMENT_DEFINITIONS['over-encumbered']).toBeUndefined();expect(tiers.AUGMENT_TIERS['over-encumbered']).toBeUndefined();
    expect(OVER_ENCUMBERED_DEFINITION.id).toBe('over-encumbered');
  });
  it.each(['2-1','2-7','4-1'])('has no restriction at %s',id=>{
    const s=fixture(id);expect(overEncumberedActive(s)).toBe(false);expect(reconcileOverEncumbered(s).state).toBe(s);
  });
  it.each(['3-1','3-2','3-3','3-4','3-5','3-6','3-7'])('restricts the whole next stage, including %s',id=>{
    const s=reconcileOverEncumbered(fixture(id)).state;
    expect(usableBenchSlots(s.preparation)).toBe(1);expect(s.preparation.benchSize).toBe(9);expect(s.preparation.overflowUnitIds).toHaveLength(8);
    expect(getPlayerDeploymentCount(s.preparation)).toBe(1);expect(s.preparation.units).toHaveLength(10);validateOverEncumbered(s);
    expect(reconcileOverEncumbered(s)).toEqual({state:s,events:[]});
  });
  it('retains slot zero, compacts an empty zero, and uses unique parking cells',()=>{
    const s=active();expect(s.preparation.units.find(u=>u.id==='unit-2')!.location).toEqual({kind:'bench',slot:0});
    expect(new Set(s.preparation.units.map(u=>JSON.stringify(u.location))).size).toBe(10);
    const sparse=fixture();const p={...sparse,preparation:{...sparse.preparation,units:sparse.preparation.units.filter(u=>u.id!=='unit-2')}};
    const next=reconcileOverEncumbered(p).state;expect(next.preparation.units.find(u=>u.id==='unit-3')!.location).toEqual({kind:'bench',slot:0});expect(next.preparation.overflowUnitIds).toHaveLength(7);
  });
  it('rejects purchases, even a potential triple or an empty usable cell, without RNG/events/state changes',()=>{
    for(const s of [active(),active(0)]) {
      const result=buyUnit(s,0,s.shop.generation);expect(result).toEqual({ok:false,state:s,reason:'bench-full'});expect(result.state).toBe(s);
    }
    const s=active();expect(planPurchase(s.preparation,'lux','unit-20')).toEqual({ok:false,reason:'bench-full'});
    expect(planDeferredUpgrades(s.preparation).events).toEqual([]);
  });
  it('rejects disabled targets and moving/swapping parked units',()=>{
    const s=active(),id=s.preparation.overflowUnitIds![0];
    for(const [unitId,target] of [[id,{kind:'board',cell:{row:5,col:5}}],['unit-1',{kind:'bench',slot:1}],['unit-1',s.preparation.units.find(u=>u.id===id)!.location]] as const){
      const r=deployMatchUnit(s,unitId,target);expect(r).toMatchObject({ok:false,reason:'invalid-location'});expect(r.state).toBe(s);
    }
  });
  it('a sale returns the first parked unit immediately and keeps the one usable cell full',()=>{
    const s=active(),id=s.preparation.overflowUnitIds![0],beforeGold=s.gold;
    const r=sellUnit(s,'unit-2');expect(r.ok).toBe(true);
    const n=r.state;expect(n.gold).toBeGreaterThan(beforeGold);expect(n.preparation.units.find(u=>u.id===id)!.location).toEqual({kind:'bench',slot:0});expect(n.preparation.overflowUnitIds).toHaveLength(7);
    if(r.ok)expect(r.events.some(e=>e.type==='unitDeployed'&&e.unitId===id)).toBe(true);
    expect(buyUnit(n,0,n.shop.generation).ok).toBe(false);
  });
  it('deployment cannot rotate parked pieces onto the bench, including across later commands',()=>{
    const s=active(3),ids=s.preparation.overflowUnitIds;
    let n=accepted(deployMatchUnit(s,'unit-2',{kind:'board',cell:{row:5,col:5}}));
    for(const step of [
      (x:MatchState)=>buyXp(x),
      (x:MatchState)=>rerollShop(x),
      (x:MatchState)=>setShopLock(x,true,x.shop.generation),
      (x:MatchState)=>autoDeployToCap(x),
    ]) {
      expect(n.preparation.units.filter(u=>u.location.kind==='bench')).toEqual([]);
      expect(n.preparation.overflowUnitIds).toEqual(ids);validateOverEncumbered(n);
      expect(reconcileOverEncumbered(n)).toEqual({state:n,events:[]});
      n=accepted(step(n));
    }
    expect(n.preparation.overflowUnitIds).toEqual(ids);
    n=accepted(deployMatchUnit(n,'unit-2',{kind:'bench',slot:0}));
    n=accepted(sellUnit(n,'unit-2'));
    expect(n.preparation.units.find(u=>u.id===ids![0])!.location).toEqual({kind:'bench',slot:0});
    expect(n.preparation.overflowUnitIds).toEqual(ids!.slice(1));validateOverEncumbered(n);
  });
  it.each(['unit-1','unit-3'])('selling %s without freeing a bench cell does not release other parked units',unitId=>{
    const s=accepted(deployMatchUnit(active(3),'unit-2',{kind:'board',cell:{row:5,col:5}}));
    const n=accepted(sellUnit(s,unitId));
    expect(n.preparation.units.filter(u=>u.location.kind==='bench')).toEqual([]);
    expect(n.preparation.overflowUnitIds).toEqual(s.preparation.overflowUnitIds!.filter(id=>id!==unitId));validateOverEncumbered(n);
  });
  it.each([['openAnvil',openAnvil],['sellUnit',sellUnit]] as const)('opens multiple parked anvils through %s without gold or RNG and removes their markers',(_name,command)=>{
    let s=anvilFixture();const anvils=s.preparation.units.filter(u=>isAnvil(u.definitionId));
    const gold=s.gold,itemCount=s.items.length,rng=[s.rngState,s.choiceRngState,s.rewardRngState,s.battleSeedRngState];
    validateAnvils(s);
    for(const unit of anvils){
      expect(s.preparation.overflowUnitIds).toContain(unit.id);
      const unmarked={...s,preparation:{...s.preparation,overflowUnitIds:s.preparation.overflowUnitIds!.filter(id=>id!==unit.id)}};
      expect(command(unmarked,unit.id)).toEqual({ok:false,state:unmarked,reason:'invalid-target'});
      expect(()=>validateAnvils(unmarked)).toThrow('anvil ledger');
      s=accepted(command(s,unit.id));
      expect(s.pendingChoice?.payload).toMatchObject({kind:'forge',source:'anvil-unit'});
      expect(s.pendingChoice!.offers).toHaveLength(4);
      expect(s.preparation.overflowUnitIds).not.toContain(unit.id);validateOverEncumbered(s);validateAnvils(s);
      const c=s.pendingChoice!;s=accepted(selectChoice(s,c.choiceId,c.generation,c.offers[0]));
      expect(command(s,unit.id)).toEqual({ok:false,state:s,reason:'unknown-unit'});
    }
    expect(s.items).toHaveLength(itemCount+2);expect(s.gold).toBe(gold);
    expect([s.rngState,s.choiceRngState,s.rewardRngState,s.battleSeedRngState]).toEqual(rng);
  });
  it('opening a bench anvil frees its slot for the first parked unit, keeping another anvil parked',()=>{
    const s=anvilFixture(true),anvil=s.preparation.units.find(u=>u.location.kind==='bench')!;
    const n=accepted(openAnvil(s,anvil.id));
    expect(n.preparation.units.find(u=>u.id==='unit-99')!.location).toEqual({kind:'bench',slot:0});
    expect(n.preparation.overflowUnitIds).toHaveLength(1);validateOverEncumbered(n);validateAnvils(n);
  });
  it('anomaly targeting skips parked pieces for manual commands and system timeouts',()=>{
    const base=fixture('4-6');
    const shifted={...base,nextUnitSerial:100,augments:[{...base.augments[0],acquiredRound:12}],preparation:{...base.preparation,units:base.preparation.units.map(u=>u.id==='unit-1'?{...u,id:'unit-99'}:u)}};
    const s={...reconcileOverEncumbered(shifted).state,phase:'choice',combat:null,pendingChoice:{kind:'anomaly',step:'target',choiceId:'round:4-6:anomaly',eventId:'round:4-6:anomaly',generation:0,offers:['kill-streak'],targetId:null,rerollCount:0,returnPhase:'preparation'}} as MatchState;
    const parked=s.preparation.overflowUnitIds![0];
    const refused=selectAnomalyTarget(s,'round:4-6:anomaly',0,parked);expect(refused).toMatchObject({ok:false,reason:'invalid-target'});expect(refused.state).toBe(s);
    const timed=forfeitPendingChoice(s,s.round,'round:4-6:anomaly',0);expect(timed.ok).toBe(true);
    expect(timed.state.anomalyBinding?.unitId).toBe('unit-2');
  });
  it('parked units cannot receive equipment',()=>{
    const s=active();const id=s.preparation.overflowUnitIds![0];
    const result=equipItem(s,'item-1',id,0);expect(result).toMatchObject({ok:false,reason:'wrong-phase'});expect(result.state).toBe(s);
  });
  it('parked units stay sellable under the combat roster lock',()=>{
    const s=active(),locked={...s,multiplayer:{...s.multiplayer!,combatRosterLocked:true as const}};
    expect(sellUnit(locked,s.preparation.overflowUnitIds![0]).ok).toBe(true);
    expect(sellUnit(locked,'unit-1')).toMatchObject({ok:false,reason:'wrong-phase'});
  });
  it('system auto-deployment succeeds within the active population cap',()=>{
    const s=active();const n=accepted(autoDeployToCap(s));expect(getPlayerDeploymentCount(n.preparation)).toBeLessThanOrEqual(getDeploymentCap(n));validateOverEncumbered(n);
  });
  it('heroes/rewards and carousel wait instead of filling disabled slots or empty board cells',()=>{
    const s=active();
    expect(placeCarouselUnit(s,{unitId:'unit-20',definitionId:'lux',receiptId:'c'} as any)).toBeNull();expect(returnLocation(s)).toBeNull();
    const queued=grantMechanicUnit(s,{receiptId:'d3:gift',source:'augment-pool-batch1',definitionId:'lux'});
    expect(queued.ok).toBe(true);if(queued.ok){expect(queued.receipt).toMatchObject({resolution:'orb'});expect(queued.state.preparation).toBe(s.preparation);}
    const one=active(1);expect(placeCarouselUnit(one,{unitId:'unit-20',definitionId:'lux',receiptId:'c'} as any)).toBeNull();
    expect(returnLocation(one)).toBeNull();
    expect(returnLocation(active(0))).toEqual({kind:'bench',slot:0});
    const ordinary=fixture('2-1',9);expect(returnLocation(ordinary)?.kind).toBe('board');
  });
  it('freezes every resource while excluding parked units from PvE/PvP and traits',()=>{
    const s=active(),input=readCombatStrategyInputs(s),basis=freezeCombatInput(s,5,s.resourceProvenance.entries.length);
    expect(input.preparation.units).toHaveLength(s.preparation.units.length);expect(input.preparation.units.filter(u=>u.location.kind==='board')).toHaveLength(1);expect(input.preparation.benchSize).toBe(9);
    const snap=snapshotForBattle(s,'s1');expect(snap.units.map(u=>u.id)).toEqual(['unit-1']);
    const started=createCombatWithEvents(input.preparation,buildStrategySnapshot(input),'d3',5);expect(started.state.units.filter(u=>u.team==='player').map(u=>u.id)).toEqual(['unit-1']);
    expect(deriveTraits(s.preparation,'player')).toEqual(deriveTraits(combatBenchProjection(s.preparation),'player'));
    expect(basis.inputs.preparation).toEqual(input.preparation);
  });
  it('projects both owner and scouting non-combat markers',()=>{
    const s=active(),p=toPrivateSeatView(s);expect(p.preparation.usableBenchSlots).toBe(1);expect(p.preparation.overflowUnitIds).toHaveLength(8);
    expect(toPublicBoard(s).units.filter(u=>u.nonCombat)).toHaveLength(8);
  });
  it('rejects forged overlays and independent-authority changes',()=>{
    const s=active(),authority=captureAugmentHistoryAuthority(s);validateAugmentAuthority(s,authority,true);
    for(const change of [(p:any)=>p.usableBenchSlots=9,(p:any)=>p.overflowUnitIds=[],(p:any)=>p.overflowUnitIds=['unit-1'],(p:any)=>p.units=p.units.filter((u:any)=>u.id!=='unit-2')]){
      const bad=structuredClone(s);change(bad.preparation as any);expect(()=>validateAugmentAuthority(bad,authority,true)).toThrow();
    }
    const orphan={...createMatch(42),preparation:s.preparation};expect(()=>validateOverEncumbered(orphan)).toThrow();
  });
});

describe('D3 display projections',()=>{
  it.each(['superstars-i','superstars-ii'])('%s counts only fielded three-star heroes',definitionId=>{
    const base=fixture('3-1',3),s=reconcileOverEncumbered({...base,augments:[...base.augments,{definitionId,choiceId:'superstars',acquiredRound:4}],preparation:{...base.preparation,units:base.preparation.units.map(u=>({...u,starLevel:3}))}}).state;
    const n={...s,preparation:{...s.preparation,units:s.preparation.units.filter(u=>!s.preparation.overflowUnitIds!.includes(u.id)),overflowUnitIds:[]}};
    expect(augmentDynamicValues(s)[definitionId]).toEqual(augmentDynamicValues(n)[definitionId]);
    expect(augmentDynamicValues(s)[definitionId].values![0]).toBeGreaterThan(0);
  });
  it('does not show or move portals and Jayce forges owned by parked heroes',()=>{
    const base=fixture('3-1',3),s=reconcileOverEncumbered({...base,items:[{id:'item-1',definitionId:VOIDSPAWN_ITEM,location:{kind:'unit',unitId:'unit-3',slot:0}},{id:'item-2',definitionId:VOIDSPAWN_ITEM,location:{kind:'unit',unitId:'unit-1',slot:0}}],nextItemSerial:3,preparation:{...base.preparation,units:base.preparation.units.map(u=>u.id==='unit-3'||u.id==='unit-1'?{...u,definitionId:'jayce'}:u)}}).state;
    const before=structuredClone(s),summons=readItemSummons(s);
    expect(summons.map(u=>[u.ownerId,u.kind]).sort()).toEqual([['unit-1','forge'],['unit-1','voidspawn']]);
    for(const itemInstanceId of ['item-1','unit-3'])expect(moveItemSummon(s,itemInstanceId,{col:5,row:5})).toEqual({ok:false,state:s,reason:'unknown-unit'});
    expect(s).toEqual(before);
  });
  it('enemy Garen opening preview uses the combat roster with parked heroes excluded',()=>{
    const base=active(),enemy={id:'enemy-garen',definitionId:'garen',team:'enemy' as const,starLevel:1 as const,location:{kind:'board' as const,cell:{row:3,col:0}}};
    const s={...base,preparation:{...base.preparation,units:[...base.preparation.units,enemy]},m8:{...base.m8,preparation:{...base.m8.preparation,enemies:[enemy]}}};
    const before=structuredClone(s),projected={...s,preparation:combatBenchProjection(s.preparation)};
    const expected=readEncounterPreview(projected);
    expect(expected?.units[0].definitionId).toBe('garen');
    expect(readEncounterPreview(s)).toEqual(expected);expect(readEncounterPreview(s)).toEqual(expected);expect(s).toEqual(before);
  });
});

describe('D3 stage reward',()=>{
  function settled(seed=42): MatchState {
    let s=reconcileOverEncumbered(fixture('3-7')).state;
    return {...s,seed,phase:'settlement',combat:null,roundResults:[{round:s.round,hpAfter:100} as MatchState['roundResults'][number]]} as MatchState;
  }
  it('unlocks and returns all parked pieces exactly at stage-end; pays three components once',()=>{
    const s=settled(),n=completeOverEncumbered(s);expect(overEncumberedActive(n.state)).toBe(false);expect(n.state.preparation.usableBenchSlots).toBeUndefined();expect(n.state.preparation.overflowUnitIds).toBeUndefined();
    expect(n.state.preparation.units.filter(u=>u.location.kind==='bench')).toHaveLength(9);
    const grants=n.state.seatMechanics!.receipts.filter(r=>r.receiptId.includes('over-encumbered-stage'));expect(grants).toHaveLength(3);
    const pool=G24_FORGE_POOLS.TFT_ArmoryKeyComponent;expect(pool).toHaveLength(8);expect(n.state.items).toHaveLength(3);expect(n.state.items.every(i=>pool.includes(i.definitionId))).toBe(true);
    expect(n.events.filter(e=>e.type==='mechanicGranted')).toHaveLength(3);
    expect(new Set(n.events.filter(e=>e.type==='mechanicGranted').map(e=>e.receipt.receiptId)).size).toBe(3);
    expect(completeOverEncumbered(n.state)).toEqual({state:n.state,events:[]});validateBatch1GiftReceipts(n.state);
  });
  it('uses the specified choice substream with replacement, permits duplicates and never consumes live RNG',()=>{
    let duplicates=false;const seen=new Set<string>();
    for(let seed=0;seed<100;seed++){
      const s=settled(seed),plan=overEncumberedRewardPlan(s),a={...s.augments[0],acquiredRound:s.round,choiceId:JSON.stringify([s.augments[0].choiceId,'over-encumbered-stage',3])};
      const ns=JSON.stringify(['augment-pool-batch1','s1',a.choiceId,a.definitionId,0]);let hash=0x811c9dc5;for(let i=0;i<ns.length;i++)hash=Math.imul(hash^ns.charCodeAt(i),0x01000193)>>>0;
      let rng=(seed^hash)>>>0;const expected=Array.from({length:3},()=>{const d=nextRandom(rng);rng=d.state;return G24_FORGE_POOLS.TFT_ArmoryKeyComponent[Math.floor(d.word*8/4294967296)];});
      expect(plan.map(p=>p.definitionId)).toEqual(expected);expected.forEach(i=>seen.add(i));duplicates ||= new Set(expected).size<3;
      const n=completeOverEncumbered(s).state;expect([n.rngState,n.rewardRngState,n.choiceRngState,n.battleSeedRngState]).toEqual([s.rngState,s.rewardRngState,s.choiceRngState,s.battleSeedRngState]);
    }
    expect(duplicates).toBe(true);expect(seen.size).toBe(8);
  });
  it('does not pay before stage-end or on elimination',()=>{
    expect(overEncumberedRewardPlan(active())).toEqual([]);const s=settled();expect(overEncumberedRewardPlan({...s,roundResults:[{...s.roundResults[0],hpAfter:0}]})).toEqual([]);
  });
  it('does not reactivate in stage-six overtime or repay the stage reward',()=>{
    const base=fixture('6-7',3),restricted=reconcileOverEncumbered({...base,augments:[{...base.augments[0],acquiredRound:getCatalogRoundById('5-2').ordinal}]}).state;
    expect(overEncumberedActive(restricted)).toBe(true);
    let s=completeOverEncumbered({...restricted,phase:'settlement',combat:null,roundResults:[{round:restricted.round,hpAfter:100} as MatchState['roundResults'][number]]}).state;
    expect(s.items).toHaveLength(3);
    for(const id of ['overtime-1','overtime-2','overtime-8']){
      s=atRound(s,id);expect(overEncumberedActive(s)).toBe(false);
      expect(completeOverEncumbered(s)).toEqual({state:s,events:[]});validateOverEncumbered(s);
      expect(usableBenchSlots(s.preparation)).toBe(9);expect(s.items).toHaveLength(3);
    }
  });
});

// Public offline commands authenticate the overlay and actual overflow by replay.
// Build each deterministic prefix in a bounded hook, then validate immutable copies.
describe('D3 public offline progression and authenticated overflow', () => {
  let s: MatchState, text: string;
  const checkpoints = new Map<string, { before: MatchState; settled: MatchState; next: ReturnType<typeof nextRound> }>();
  beforeAll(() => {
    const seed = firstNodeSeed('over-encumbered'); s = reachRoundFielded('2-1', seed);
    const c = s.pendingChoice!; s = accepted(selectChoice(s, c.choiceId, c.generation, 'over-encumbered'));
    expect(usableBenchSlots(s.preparation)).toBe(9);
  });
  for (const round of ['2-1', '2-2', '2-3', '2-4', '2-5', '2-6', '2-7']) {
    beforeAll(() => {
      const before = structuredClone(s); s = resolveM5Choices(s);
      if (s.phase === 'preparation') {
        for (let slot = 0; slot < s.shop.slots.length; slot++) {
          // Leave normal PvE reward capacity; retain enough reserves to overflow next stage.
          if (s.preparation.units.filter(u => u.location.kind === 'bench').length >= 5) break;
          const bought = buyUnit(s, slot, s.shop.generation); if (bought.ok) s = bought.state;
        }
        s = finish(accepted(startMatchCombat(fieldBench(s))));
      }
      s = resolveM5Choices(s);
      const settled = structuredClone(s), next = nextRound(s, s.round); s = accepted(next);
      checkpoints.set(round, freeze({ before, settled, next: structuredClone(next) }));
    });
    it(`progresses through ${round} using public commands`, () => {
      const checkpoint = checkpoints.get(round)!;
      expect(checkpoint.before.roundDefinitionId).toBe(round); expect(checkpoint.settled.phase).toBe('settlement');
      if (checkpoint.next.ok) for (const e of checkpoint.next.events) if (e.type === 'unitDeployed') {
        expect(e).toMatchObject({ domain: 'match', eventSeq: expect.any(Number) });
      }
    });
  }
  beforeAll(() => { s = freeze(structuredClone(s)); text = serializeMatch(s); });
  it('activates at 3-1 with actual parked units', () => {
    expect(s.roundDefinitionId).toBe('3-1'); expect(s.preparation.usableBenchSlots).toBe(1);
    expect(s.preparation.overflowUnitIds!.length).toBeGreaterThan(0);
  });
  for (const form of ['object', 'JSON', 'serialized'] as const) it(`authenticates ${form} overflow restore`, () => {
    expect(restoreMatch(form === 'object' ? structuredClone(s) : form === 'JSON' ? JSON.parse(text) : text)).toEqual(s);
  });
  for (const [label, mutate] of [
    ['capacity', (x: any) => x.preparation.usableBenchSlots = 9],
    ['missing overlay', (x: any) => delete x.preparation.usableBenchSlots],
    ['acquisition round', (x: any) => x.augments[0].acquiredRound = 11],
  ] as const) it(`rejects ${label} tampering in all offline forms`, () => {
    const x = structuredClone(s); mutate(x); expect(() => restoreMatch(x)).toThrow(); expect(() => restoreMatch(JSON.stringify(x))).toThrow(); expect(() => serializeMatch(x)).toThrow();
  });
});

describe('D3 real shared Room / production carousel / bots (test-only offer catalog)', () => {
  let ctx: ReturnType<typeof roomOffer>;
  const match = () => ctx.room.state.seats.find(s => s.seatId === ctx.seatId)!.match;
  type Checkpoint = {
    state: MatchState; pool: typeof ctx.room.state.pool;
    authority: ReturnType<typeof ctx.room.augmentHistoryAuthority>;
    fault: typeof ctx.room.state.fault; seats: MatchState[];
  };
  const capture = (): Checkpoint => freeze({ ...structuredClone({ state: match(), pool: ctx.room.state.pool,
    fault: ctx.room.state.fault, seats: ctx.room.state.seats.map(s => s.match) }),
    // This already-frozen opaque server handle is identity-bound; clone only
    // the candidate/pool graphs, never manufacture a JSON authority token.
    authority: ctx.room.augmentHistoryAuthority(ctx.seatId) });
  const checkpoints = new Map<number, Checkpoint>();
  const forms = [
    ['object', (s: MatchState) => s], ['JSON', (s: MatchState) => JSON.stringify(s)],
    ['canonical', (s: MatchState) => canonicalContent(s)],
  ] as const;
  function authenticate(label: string, read: () => Checkpoint, edit: (s: MatchState) => void) {
    for (const [form, encode] of forms) it(`${label}: authenticates ${form} and rejects tampering`, () => {
      const { state: s, pool, authority } = read();
      expect(restoreSharedOrbSnapshot(pool, encode(structuredClone(s)), authority)).toEqual(s);
      const bad = structuredClone(s); edit(bad);
      expect(() => restoreSharedOrbSnapshot(pool, encode(bad), authority)).toThrow();
    });
    it(`${label}: requires independent authority`, () => {
      const { state, pool } = read();
      expect(() => restoreSharedOrbSnapshot(pool, structuredClone(state))).toThrow(/authority/);
    });
  }

  // Deterministic public-command progression belongs to bounded setup hooks.
  // All hooks run even with -t; cases only read detached frozen checkpoints.
  beforeAll(() => { ctx = roomOffer('over-encumbered'); });
  afterAll(() => ctx?.room.dispose());
  for (const round of [2, 3, 4]) {
    beforeAll(() => {
      runUntil(ctx.room, ctx.clock, s => s.round === round && s.phase === 'preparation');
      checkpoints.set(round, capture());
    });
    it(`reaches acquisition round ${round} through server deadlines`, () => {
      expect(checkpoints.get(round)!.state.round).toBe(round);
    });
  }
  let acquisition: { before: MatchState; result: ReturnType<typeof ctx.room.handle>; after: Checkpoint };
  beforeAll(() => {
    const before = structuredClone(match()), c = before.pendingChoice!;
    const result = ctx.room.handle(ctx.seatId, { type: 'choose', choiceId: c.choiceId, generation: c.generation, definitionId: 'over-encumbered' });
    acquisition = freeze({ before, result: structuredClone(result), after: capture() });
  });
  it('chooses via the public command and still permits purchases in the acquisition stage', () => {
    expect(acquisition.before.pendingChoice!.offers).toContain('over-encumbered');
    expect(acquisition.result.ok).toBe(true);
    expect(usableBenchSlots(acquisition.after.state.preparation)).toBe(9);
  });
  for (const round of [5, 6, 8, 9, 10]) {
    beforeAll(() => {
      runUntil(ctx.room, ctx.clock, s => s.round === round && s.phase === 'preparation');
      for (let slot = 0; slot < 5; slot++) {
        const s = match(), offer = s.shop.slots[slot];
        if (offer.status === 'available' && s.gold >= 1) ctx.room.handle(ctx.seatId, { type: 'buy', slot, generation: s.shop.generation });
      }
      checkpoints.set(round, capture());
    });
    it(`keeps the original capacity in acquisition-stage round ${round}`, () => {
      const checkpoint = checkpoints.get(round)!;
      expect(usableBenchSlots(checkpoint.state.preparation)).toBe(9); expect(checkpoint.fault).toBeNull();
    });
  }
  const purchases = new Map<number, { result: ReturnType<typeof ctx.room.handle>; unchanged: boolean }>();
  let sale: { reserve: ReturnType<typeof ctx.room.handle>; fielded: ReturnType<typeof ctx.room.handle>;
    deploy: ReturnType<typeof ctx.room.handle>; afterReserve: MatchState; parked: readonly string[]; after: Checkpoint };
  for (const round of [11, 12, 13, 15, 16, 17]) {
    beforeAll(() => {
      runUntil(ctx.room, ctx.clock, s => s.round === round && s.phase === 'preparation');
      const s = match();
      const result = ctx.room.handle(ctx.seatId, { type: 'buy', slot: 0, generation: s.shop.generation });
      purchases.set(round, freeze(structuredClone({ result, unchanged: match() === s })));
      checkpoints.set(round, capture());
      if (round === 11) {
        const reserve = s.preparation.units.find(u => u.location.kind === 'bench')!;
        const reserveResult = ctx.room.handle(ctx.seatId, { type: 'sell', unitId: reserve.id });
        const afterReserve = structuredClone(match());
        const fielded = match().preparation.units.find(u => u.team === 'player' && u.location.kind === 'board' && !isOverflowUnit(match().preparation, u.id))!;
        const location = fielded.location;
        const fieldedResult = ctx.room.handle(ctx.seatId, { type: 'sell', unitId: fielded.id });
        const bench = match().preparation.units.find(u => u.location.kind === 'bench')!, parked = [...match().preparation.overflowUnitIds!];
        const deploy = ctx.room.handle(ctx.seatId, { type: 'deploy', unitId: bench.id, target: location });
        sale = freeze({ ...structuredClone({ reserve: reserveResult, fielded: fieldedResult, deploy, afterReserve, parked }), after: capture() });
      }
    });
    it(`keeps server/bot/autodeploy/choices/carousel live in restricted round ${round}`, () => {
      const checkpoint = checkpoints.get(round)!, s = checkpoint.state, purchase = purchases.get(round)!;
      expect(s.preparation.usableBenchSlots).toBe(1); validateOverEncumbered(s);
      expect(purchase.result).toMatchObject({ ok: false, reason: 'bench-full' });
      expect(purchase.unchanged).toBe(true); assertSharedPoolConservation(checkpoint.pool, checkpoint.seats);
      if (round === 11) {
        expect(s.preparation.overflowUnitIds!.length).toBeGreaterThan(0);
        expect(sale.reserve.ok).toBe(true);
        expect(sale.afterReserve.preparation.units.some(u => u.location.kind === 'bench' && u.location.slot === 0)).toBe(true);
        expect(sale.fielded.ok).toBe(true); expect(sale.deploy.ok).toBe(true);
        expect(sale.after.state.preparation.units.some(u => u.location.kind === 'bench')).toBe(false);
        expect(sale.after.state.preparation.overflowUnitIds).toEqual(sale.parked); validateOverEncumbered(sale.after.state);
      }
    });
    authenticate(`restricted round ${round}`, () => checkpoints.get(round)!, x => Object.assign(x.preparation, { usableBenchSlots: 9 }));
    if (round === 11) authenticate('empty usable slot after public sales/deploy', () => sale.after, x => Object.assign(x.preparation, { overflowUnitIds: [] }));
  }
  beforeAll(() => {
    runUntil(ctx.room, ctx.clock, s => s.round === 18 && s.phase === 'preparation');
    checkpoints.set(18, capture());
  });
  it('the final PvE settlement gives three unique reward receipts and restores the nine-cell bench', () => {
    const checkpoint = checkpoints.get(18)!, s = checkpoint.state;
    expect(s.preparation.usableBenchSlots).toBeUndefined();
    expect(s.seatMechanics!.receipts.filter(r => r.receiptId.includes('over-encumbered-stage'))).toHaveLength(3);
    expect(checkpoint.fault).toBeNull();
  });
  authenticate('final PvE reward', () => checkpoints.get(18)!, x => {
    Object.assign(x.seatMechanics!.receipts.find(r => r.receiptId.includes('over-encumbered-stage'))!, { definitionId: 'rageblade' });
  });
});

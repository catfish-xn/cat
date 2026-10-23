import { describe, expect, it } from 'vitest';
import { createMatch, enableMultiplayerSettlement, claimOrDiscardLoot, claimOrb, nextRound, startMatchCombat, stepMatch,
  type MatchState, type MultiplayerCommandResult } from '../src/server-entry';
import { createCombat } from '../src/simulation/combat';
import { prepareMatchLoot, revealMatchLoot, unresolvedLootChoices } from '../src/simulation/loot-runtime';
import { getCatalogRoundById } from '../src/simulation/round-selectors';
import { createRoundEnemies } from '../src/simulation/round-enemies';
import type { Unit } from '../src/simulation/unit-types';
import { freeze } from './combat-helpers';
import { enterOpeningCrabs, openingCrabCarrier } from '../src/simulation/opening-crabs';
const accept=(r:MultiplayerCommandResult)=>{if(!r.ok)throw new Error(r.reason);return r.state;};
// Earned-loot vectors isolate timeout commits; normal command traversal is in t3-round-settlement.
function fixture(roundId='1-2',seed=roundId==='2-7'?26:5):MatchState {
  const base=accept(enableMultiplayerSettlement(createMatch(seed),'A')),round=getCatalogRoundById(roundId),enemies=createRoundEnemies(round.ordinal);
  // v22 opening encounters: Crab Rave seeds (5, 26) fight crabs; loot keeps its
  // original carriers, mapped to the crab whose death earns it.
  const state:MatchState=enterOpeningCrabs({...base,round:round.ordinal,roundDefinitionId:roundId,
    m8:{...base.m8,round,loot:prepareMatchLoot(seed,round.ordinal),preparation:{...base.m8.preparation,roundId,encounterId:round.encounterId,enemies}},
    preparation:{...base.preparation,units:[...base.preparation.units.filter(u=>u.team==='player'),...enemies]}});
  const plan=state.m8.loot.frozen.rounds.find(r=>r.encounterPlan.roundId===roundId)!;
  const ids=[...new Set([...plan.encounterPlan.drops,...plan.choices].map(d=>openingCrabCarrier(state,roundId,d.sourceUnitId!)))];
  const initial=createCombat(state.preparation);
  const combat={...initial,combatId:`round-${state.round}`,status:'finished' as const,result:'draw' as const,tick:5,nextEventSeq:30,
    units:initial.units.map(u=>ids.includes(u.id)?{...u,alive:false,hp:0}:u),
    neutralReceipts:{deaths:ids.map((unitId,i)=>({unitId,tick:4,eventSeq:7+i})),controls:[]}};
  return {...revealMatchLoot(state,combat).state,phase:'settlement',combat};
}
function fullBench(state:MatchState):MatchState {
  return {...state,nextUnitSerial:20,preparation:{...state.preparation,units:[...state.preparation.units,
    ...Array.from({length:9},(_,slot):Unit=>({id:`unit-${slot+2}`,definitionId:'irelia',team:'player',starLevel:3,location:{kind:'bench',slot}}))]}};
}
function claimAll(state:MatchState):MatchState {
  const orbs=state.m8.loot.frozen.rounds.flatMap(r=>r.orbs).filter(o=>o.entries.every(e=>state.m8.loot.direct.some(d=>d.dropId===e.dropId&&d.status==='revealed')));
  for(const orb of orbs)state=accept(claimOrb(state,orb.orbId,state.round));return state;
}
function retry(next:MatchState) {
  expect(claimOrDiscardLoot(freeze(next),next.round)).toEqual({ok:true,state:next,events:[]});
}
describe('T3 earned loot timeout transaction',()=>{
  it('grants the earned hero once, with original lineage and zero gold spent',()=>{
    const state=fixture(),deadline=accept(claimOrDiscardLoot(freeze(state),state.round));
    expect(deadline).toBe(state);expect(deadline.m8.loot.receipts).toEqual([]);
    const next=claimAll(deadline);
    expect(next.gold).toBe(state.gold);expect(next.m8.loot.receipts).toHaveLength(3);expect(next.consumables).toHaveLength(0);
    expect(next.m8.loot.receipts[1].payload).toEqual({kind:'unit',definitionId:'maddie',quantity:1});
    expect(next.preparation.units.find(u=>u.id==='unit-2')).toMatchObject({definitionId:'maddie',location:{kind:'bench',slot:0}});
    retry(next);
  });
  it('keeps a capacity-blocked orb at deadline and sells its hero only on explicit claim',()=>{
    const state=fullBench(fixture()),deadline=accept(claimOrDiscardLoot(freeze(state),state.round));
    expect(deadline).toBe(state);expect(deadline.m8.loot.direct[0].status).toBe('revealed');
    const next=claimAll(deadline);
    expect(next.m8.loot.direct[0].status).toBe('granted');expect(next.m8.loot.receipts[1]).toMatchObject({resolution:'capacity-sold',gold:1,grantedUnitIds:[]});expect(next.gold).toBe(state.gold+2);expect(next.m8.loot.receipts.map(r=>r.payload.kind)).toEqual(['item','unit','unit']);expect(next.consumables).toHaveLength(0);
    expect(next.preparation).toEqual(state.preparation);expect(next.items.map(i=>i.definitionId)).toEqual(['tear']);expect(next.nextUnitSerial).toBe(20);retry(next);
    // A real public settlement has the same blocker and can now advance.
    let live=accept(startMatchCombat(fullBench(accept(enableMultiplayerSettlement(createMatch(5),'A')))));
    while(live.phase==='combat') live=stepMatch(live).state;
    const cleared=accept(claimOrDiscardLoot(live,live.round));expect(nextRound(cleared,cleared.round).ok).toBe(true);
  });
  it('claims all earned orb entries without opening a PvE choice; never grants planned drops',()=>{
    const state=fixture('2-7');
    const plan=state.m8.loot.frozen.rounds.find(r=>r.encounterPlan.roundId==='2-7')!;
    expect(unresolvedLootChoices(state)).toEqual([]);
    const gold=plan.encounterPlan.drops.reduce((sum,d)=>sum+(d.payload.kind==='gold'?d.payload.quantity:0),0);
    expect(gold).toBeGreaterThan(0);
    const deadline=accept(claimOrDiscardLoot(freeze(state),state.round));expect(deadline).toBe(state);
    const next=claimAll(deadline);
    expect(next.gold).toBe(state.gold+gold);
    expect(next.items.map(i=>i.definitionId)).toEqual(plan.encounterPlan.drops.flatMap(d=>d.payload.kind==='item'?[d.payload.definitionId]:[]));
    expect(next.m8.loot.receipts.map(r=>r.payload)).toEqual(plan.encounterPlan.drops.map(d=>d.payload));
    expect(next.pendingChoice).toBeNull();expect(next.m8.loot.choiceResolutions).toEqual([]);
    expect(next.m8.loot.direct.filter(d=>d.status==='planned')).toEqual(state.m8.loot.direct.filter(d=>d.status==='planned'));
    retry(next);
  });
  it('rolls back the entire clicked orb if a gold grant overflows',()=>{
    const state={...fixture('2-7'),gold:Number.MAX_SAFE_INTEGER},before=JSON.stringify(state);
    const orb=state.m8.loot.frozen.rounds.at(-1)!.orbs.find(o=>o.entries.some(e=>e.payload.kind==='gold'))!;
    expect(claimOrb(freeze(state),orb.orbId,state.round)).toEqual({ok:false,state,reason:'invalid-loot'});
    expect(JSON.stringify(state)).toBe(before);
  });
  it('claims the independently planned v17 tool once, from its own 2-7 carrier',()=>{
    const before=fixture('2-7',27566),next=claimAll(before);
    expect(next.consumables.map(c=>c.definitionId)).toEqual(['magnetic-remover']);
    expect(next.m8.loot.receipts.filter(r=>r.payload.kind==='consumable').map(r=>r.grantedConsumableIds)).toEqual([['consumable-1']]);
    retry(next);expect(next.nextConsumableSerial).toBe(2);
  });
  it('online PvE HP zero eliminates without single-player gameOver; offline remains gameOver',()=>{
    for(const online of [false,true]) {
      const base=online?accept(enableMultiplayerSettlement(createMatch(5),'A')):createMatch(5);
      const state={...base,playerHp:1,preparation:{...base.preparation,units:base.preparation.units.filter(u=>u.team==='enemy')}};
      let next=accept(startMatchCombat(state));while(next.phase==='combat')next=stepMatch(next).state;
      expect(next.playerHp).toBe(0);expect(next.phase).toBe(online?'settlement':'gameOver');
      expect(next.outcome).toBe(online?null:'defeat');if(online)expect(next.multiplayer!.status).toBe('eliminated');
    }
  });
  it('catalog-final online PvE remains active for future overtime orchestration',()=>{
    const f=fixture('6-7'),state:MatchState={...f,phase:'preparation',combat:null,playerHp:100,
      m8:{...f.m8,loot:prepareMatchLoot(f.seed,f.round)},preparation:{...f.preparation,units:f.preparation.units.filter(u=>u.team==='enemy')}};
    let next=accept(startMatchCombat(state));while(next.phase==='combat')next=stepMatch(next).state;
    expect(next).toMatchObject({phase:'settlement',outcome:null,multiplayer:{status:'active'}});
    expect(nextRound(next,next.round)).toMatchObject({ok:false,reason:'unsettled-round'}); // synthetic history is intentionally incomplete
  });
});

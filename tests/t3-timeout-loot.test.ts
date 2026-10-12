import { describe, expect, it } from 'vitest';
import { createMatch, enableMultiplayerSettlement, claimOrDiscardLoot, nextRound, startMatchCombat, stepMatch,
  type MatchState, type MultiplayerCommandResult } from '../src/server-entry';
import { createCombat } from '../src/simulation/combat';
import { prepareMatchLoot, revealMatchLoot, unresolvedLootChoices } from '../src/simulation/loot-runtime';
import { makeLootPendingChoice } from '../src/simulation/loot-choice';
import { getCatalogRoundById } from '../src/simulation/round-selectors';
import { createRoundEnemies } from '../src/simulation/round-enemies';
import type { Unit } from '../src/simulation/unit-types';
import { freeze } from './combat-helpers';
const accept=(r:MultiplayerCommandResult)=>{if(!r.ok)throw new Error(r.reason);return r.state;};
// Earned-loot vectors isolate timeout commits; normal command traversal is in t3-round-settlement.
function fixture(roundId='1-2',seed=5):MatchState {
  const base=accept(enableMultiplayerSettlement(createMatch(seed),'A')),round=getCatalogRoundById(roundId),enemies=createRoundEnemies(round.ordinal);
  const state:MatchState={...base,round:round.ordinal,roundDefinitionId:roundId,
    m8:{...base.m8,round,loot:prepareMatchLoot(seed,round.ordinal),preparation:{...base.m8.preparation,roundId,encounterId:round.encounterId,enemies}},
    preparation:{...base.preparation,units:[...base.preparation.units.filter(u=>u.team==='player'),...enemies]}};
  const plan=state.m8.loot.frozen.rounds.find(r=>r.encounterPlan.roundId===roundId)!;
  const ids=[...new Set([...plan.encounterPlan.drops,...plan.choices].map(d=>d.sourceUnitId!))];
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
function retry(next:MatchState) {
  expect(claimOrDiscardLoot(freeze(next),next.round)).toEqual({ok:true,state:next,events:[]});
}
describe('T3 earned loot timeout transaction',()=>{
  it('grants the earned hero once, with original lineage and zero gold spent',()=>{
    const state=fixture(),next=accept(claimOrDiscardLoot(freeze(state),state.round));
    expect(next.gold).toBe(state.gold);expect(next.m8.loot.receipts).toHaveLength(1);
    expect(next.m8.loot.receipts[0].payload).toEqual({kind:'unit',definitionId:'maddie',quantity:1});
    expect(next.preparation.units.find(u=>u.id==='unit-2')).toMatchObject({definitionId:'maddie',location:{kind:'bench',slot:0}});
    retry(next);
  });
  it('discards a capacity-blocked hero once, without allocating a unit or reward receipt',()=>{
    const state=fullBench(fixture()),next=accept(claimOrDiscardLoot(freeze(state),state.round));
    expect(next.m8.loot.direct[0].status).toBe('forfeited');expect(next.m8.loot.receipts).toEqual([]);
    expect(next.preparation).toEqual(state.preparation);expect(next.nextUnitSerial).toBe(20);retry(next);
    // A real public settlement has the same blocker and can now advance.
    let live=accept(startMatchCombat(fullBench(accept(enableMultiplayerSettlement(createMatch(5),'A')))));
    while(live.phase==='combat') live=stepMatch(live).state;
    const cleared=accept(claimOrDiscardLoot(live,live.round));expect(nextRound(cleared,cleared.round).ok).toBe(true);
  });
  it('claims earned gold and first component offers; never grants planned future drops',()=>{
    const state=fixture('2-7'),descriptors=unresolvedLootChoices(state),first=makeLootPendingChoice(descriptors[0]);
    if (state.phase!=='settlement') throw new Error('fixture phase');
    const choice:MatchState={...state,phase:'choice',pendingChoice:first};
    const plan=state.m8.loot.frozen.rounds.find(r=>r.encounterPlan.roundId==='2-7')!;
    const gold=plan.encounterPlan.drops.reduce((sum,d)=>sum+(d.payload.kind==='gold'?d.payload.quantity:0),0);
    expect(gold).toBeGreaterThan(0);
    const next=accept(claimOrDiscardLoot(freeze(choice),choice.round));
    expect(next.gold).toBe(state.gold+gold);
    expect(next.items.some(i=>i.definitionId===first.offers[0])).toBe(true);
    expect(next.pendingChoice).toBeNull();expect(next.m8.loot.choiceResolutions).toHaveLength(descriptors.length);
    expect(next.m8.loot.direct.filter(d=>d.status==='planned')).toEqual(state.m8.loot.direct.filter(d=>d.status==='planned'));
    retry(next);
  });
  it('rolls back earlier component grants if a later gold grant overflows',()=>{
    const state={...fixture('2-7'),gold:Number.MAX_SAFE_INTEGER},before=JSON.stringify(state);
    expect(claimOrDiscardLoot(freeze(state),state.round)).toEqual({ok:false,state,reason:'invalid-loot'});
    expect(JSON.stringify(state)).toBe(before);
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

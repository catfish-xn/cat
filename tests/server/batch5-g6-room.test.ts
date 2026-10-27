import { createRequire } from 'node:module';
import { afterAll, describe, expect, it } from 'vitest';
import { makeRoom, runUntilClaiming } from './helpers';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import { restoreSharedOrbSnapshot, assertSharedPoolConservation } from '../../src/simulation/shared-pool';
import { canonicalContent } from '../../src/simulation/content';
import { serializeMatch } from '../../src/simulation/serialization';
import { buildStrategySnapshot } from '../../src/simulation/strategy-snapshot';
import { readCombatStrategyInputs } from '../../src/simulation/combat-input';
import { getDeploymentCap, sellUnit, deployMatchUnit, useConsumable } from '../../src/simulation/match';
const require = createRequire(import.meta.url);
const oracle = require('../fixtures/m5/augment-pool-batch5-g6-oracle.cjs');
const id='im-the-carry-now';

describe('B5-83 real online room',()=>{
  const {room,clock}=makeRoom(new TwoSidedBattleResolver(),{seed:0});
  let seatId:string;
  let golemId:string, kitIds:readonly string[];
  afterAll(()=>room.dispose());
  for(const round of ['1-2','1-3','1-4','2-1'])it(`room reaches ${round}`,()=>{
    if(round==='1-2')room.start();
    expect(runUntilClaiming(room,clock,s=>s.roundId===round&&s.phase==='preparation',5000).roundId).toBe(round);
  });
  it('chooses an actual offered card and grants the complete fixed unit transaction',()=>{
    for(const seat of room.state.seats)for(let slot=0;slot<3&&!room.state.seats.some(s=>s.match.pendingChoice?.offers.includes(id));slot++){
      const c=room.state.seats.find(s=>s.seatId===seat.seatId)!.match.pendingChoice!;
      expect(room.handle(seat.seatId,{type:'rerollAugment',choiceId:c.choiceId,generation:c.generation,optionIndex:slot})).toMatchObject({ok:true});
    }
    const seat=room.state.seats.find(s=>s.match.pendingChoice?.offers.includes(id));expect(seat).toBeDefined();if(!seat)throw Error('missing real B5-83 offer');
    seatId=seat.seatId;const before=seat.match,c=before.pendingChoice!;
    const selected=room.handle(seatId,{type:'choose',choiceId:c.choiceId,generation:c.generation,definitionId:id});
    expect(selected).toMatchObject({ok:true});if(!selected.ok)throw Error(selected.reason);
    const state=room.state.seats.find(s=>s.seatId===seatId)!.match;
    oracle.validateTransition(before,state,{type:'select',definitionId:id},selected.events);
    oracle.validateState(state,buildStrategySnapshot(readCombatStrategyInputs(state)));
    golemId=state.preparation.units.find(u=>u.definitionId==='carry-golem')!.id;
    kitIds=state.items.filter(i=>i.location.kind==='unit'&&i.location.unitId===golemId).map(i=>i.id);
    expect(state.gold).toBe(before.gold);expect(state.rngState).toBe(before.rngState);expect(state.choiceRngState).toBe(before.choiceRngState);
    expect(getDeploymentCap(state)).toBe(getDeploymentCap(before));assertSharedPoolConservation(room.state.pool,room.state.seats.map(s=>s.match));
    const retry=room.handle(seatId,{type:'choose',choiceId:c.choiceId,generation:c.generation,definitionId:id});expect(retry.ok).toBe(false);
    expect(room.state.seats.find(s=>s.seatId===seatId)!.match).toEqual(state);
  });
  it('round-trips online object/JSON/canonical snapshots and rejects independent tamper vectors',()=>{
    const state=room.state.seats.find(s=>s.seatId===seatId)!.match;
    const authority=room.augmentHistoryAuthority(seatId);
    for(const input of [state,JSON.stringify(state),canonicalContent(state)])expect(restoreSharedOrbSnapshot(room.state.pool,input,authority)).toEqual(state);
    const golem=state.preparation.units.find(u=>u.definitionId==='carry-golem')!;
    const mutations:((s:any)=>void)[]=[
      s=>{s.preparation.units.find((u:any)=>u.id===golem.id).starLevel=4;},
      s=>{s.preparation.units=s.preparation.units.filter((u:any)=>u.id!==golem.id);},
      s=>{s.preparation.units.push({...s.preparation.units.find((u:any)=>u.id===golem.id),id:`unit-${s.nextUnitSerial++}`});},
      s=>{s.items.find((i:any)=>i.location.unitId===golem.id).definitionId='rageblade';},
      s=>{s.items.find((i:any)=>i.location.unitId===golem.id).location={kind:'inventory'};},
      s=>{s.seatMechanics.receipts=s.seatMechanics.receipts.filter((r:any)=>r.source!=='augment-pool-batch5-g6');},
      s=>{s.augments=s.augments.filter((a:any)=>a.definitionId!==id);},
      s=>{s.seatMechanics.receipts.find((r:any)=>r.source==='augment-pool-batch5-g6').source='test';},
      s=>{s.resourceProvenance.entries=s.resourceProvenance.entries.filter((e:any)=>e.kind!=='unit-acquired'||e.unitId!==golem.id);},
      s=>{s.resourceProvenance.entries.find((e:any)=>e.kind==='item-equipped'&&e.unitId===golem.id).slot=2;},
    ];
    for(const edit of mutations)for(const form of ['object','json','canonical']){
      const bad=structuredClone(state);edit(bad);const input=form==='object'?bad:form==='json'?JSON.stringify(bad):canonicalContent(bad);
      expect(()=>restoreSharedOrbSnapshot(room.state.pool,input,authority)).toThrow();
    }
    expect(()=>serializeMatch(state)).toThrow(); // Existing offline boundary refuses shared saves.
  });
  it('fixed equipment cannot be removed, reforged, upgraded or swapped through ordinary controls',()=>{
    const state=room.state.seats.find(s=>s.seatId===seatId)!.match,golem=state.preparation.units.find(u=>u.definitionId==='carry-golem')!;
    for(const result of [sellUnit(state,golem.id),deployMatchUnit(state,golem.id,{kind:'bench',slot:0})]){
      expect(result.ok).toBe(false);expect(result.state).toBe(state);
    }
    const remover=state.consumables.find(c=>c.definitionId==='magnetic-remover');expect(remover).toBeDefined();if(!remover)throw Error('real PvE remover missing');
    const result=useConsumable(state,remover.consumableId,{kind:'unit',unitId:golem.id});expect(result.ok).toBe(false);expect(result.state).toBe(state);
  });
  it('freezes its fixed items and rank in the real PvP input and runs a golem cast',()=>{
    runUntilClaiming(room,clock,s=>s.roundId==='2-1'&&s.phase==='settlement',5000);
    const seat=room.state.seats.find(s=>s.seatId===seatId)!;
    oracle.validateState(seat.match);
    expect(seat.match.roundResults.at(-1)?.roundKind).toBe('pvp');
    const battle=room.state.battles.find(b=>b.kind==='two-sided'&&b.participants.includes(seatId));
    expect(battle?.kind).toBe('two-sided');if(!battle||battle.kind!=='two-sided')throw Error('real battle missing');
    const golem=battle.battle.initial.units.find(u=>u.definitionId==='carry-golem')!;expect(golem).toBeDefined();
    expect(golem.starLevel).toBe(1);expect(golem.ability).toMatchObject({championId:'carry-golem',variables:{Damage:3000000}});
    expect(battle.battle.events.some(e=>e.type==='cast'&&('sourceId' in e?e.sourceId===golem.id:e.receipt.source.ownerId===golem.id))).toBe(true);
  });
  for(const round of ['2-2','2-3','2-4','2-5','2-6','2-7','3-1','3-2','3-3','3-4','3-5','3-6','3-7',
    '4-1','4-2','4-3','4-4','4-5','4-6','4-7','5-1','5-2','5-3','5-4','5-5','5-6','5-7','6-1'])it(`online entry ${round} keeps the fixed kit and derived stage rank`,()=>{
    runUntilClaiming(room,clock,s=>s.roundId===round&&s.phase===(round.endsWith('-4')?'settlement':'preparation'),5000);
    const seat=room.state.seats.find(s=>s.seatId===seatId)!;expect(seat.alive).toBe(true);
    oracle.validateState(seat.match);
    expect(seat.match.preparation.units.find(u=>u.definitionId==='carry-golem')?.id).toBe(golemId);
    expect(seat.match.items.filter(i=>i.location.kind==='unit'&&i.location.unitId===golemId).map(i=>i.id)).toEqual(kitIds);
    expect(seat.match.seatMechanics?.receipts.filter(r=>r.source==='augment-pool-batch5-g6')).toHaveLength(4);
    if(round.endsWith('-1')){
      // An augment menu can be pending on other rounds; the battle compiler still uses the same formal roster.
      const strategy=buildStrategySnapshot(readCombatStrategyInputs(seat.match));oracle.validateState(seat.match,strategy);
      const authority=room.augmentHistoryAuthority(seatId);
      expect(restoreSharedOrbSnapshot(room.state.pool,JSON.stringify(seat.match),authority)).toEqual(seat.match);
      const golem=seat.match.preparation.units.find(u=>u.definitionId==='carry-golem')!;
      expect(golem.starLevel).toBe(Math.min(4,Number(round[0])-1));
    }
  });
});

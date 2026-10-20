import { describe, expect, it } from 'vitest';
import { room } from './tp-helpers';
import { freeze } from './combat-helpers';
import { createD14State, transactD14, restoreD14, serializeD14, projectD14Unit,
  type D14State, type D14Authority, type D14Command, type D14Boundary, type D14AnomalyId } from '../src/simulation/d14-anomalies';
import { assertOwnershipConservation } from '../src/simulation/owned-resources';
import { getMultiplayerRoundByOrdinal } from '../src/simulation/multiplayer-round';
import { getUnitStats } from '../src/simulation/unit-stats';
import { deriveTraits } from '../src/simulation/trait-snapshot';
import { makeSourcedEffects } from '../src/simulation/effects';
import { createCombatWithEvents, stepCombat } from '../src/simulation/combat';
import { packets } from './helpers/replay2-views';
import type { StrategyUnitSnapshot } from '../src/simulation/strategy-types';
import { resolveAbility } from '../src/simulation/combat-abilities';

function commit(state: D14State, authority: D14Authority, command: D14Command) {
  const result = transactD14(freeze(state), freeze(command), freeze(authority));
  if (!result.ok) throw new Error(result.reason);
  assertOwnershipConservation(result.state.ownership);
  return result;
}
function resources(state: D14State, a: D14Authority, id: string, operations: Extract<D14Command,{kind:'resources'}>['operations']) {
  return commit(state, a, {id, kind:'resources', operations}).state;
}
function round(state: D14State, a: D14Authority, ordinal = state.ownership.settledOrdinal + 1) {
  return commit(state, a, {id:`round-${ordinal}`,kind:'settle',roundId:getMultiplayerRoundByOrdinal(ordinal).roundId});
}
function rejected(state: D14State, a: D14Authority, command: D14Command, reason: string) {
  const before = structuredClone(state), result = transactD14(freeze(state), command, a);
  expect(result).toEqual({ok:false,state,reason});expect(result.state).toBe(state);expect(state).toEqual(before);
}
function setup(anomalyId: D14AnomalyId = 'ultimate-hero', definitionId = 'lux', atOrdinal = 0, copies = anomalyId === 'ultimate-hero' ? 9 : 1) {
  const {pool,states} = room();
  const boundary: D14Boundary = {pool,states,lastSettledRoundId:atOrdinal === 0 ? null : getMultiplayerRoundByOrdinal(atOrdinal).roundId};
  let state = createD14State(boundary);
  let a: D14Authority = {ownership:{grants:[
    {id:'target',seatId:'seat-0',resources:Array.from({length:copies},()=>({kind:'unit' as const,definitionId}))},
    {id:'equipment',seatId:'seat-0',resources:[{kind:'item',definitionId:'bow'},{kind:'duplicator',maxCost:3}]},
    {id:'fill-nine',seatId:'seat-0',resources:Array.from({length:9},()=>({kind:'unit' as const,definitionId:'maddie'}))},
    {id:'fill',seatId:'seat-0',resources:Array.from({length:10},()=>({kind:'unit' as const,definitionId:'maddie'}))},
    {id:'siblings',seatId:'seat-0',resources:Array.from({length:2},()=>({kind:'unit' as const,definitionId}))},
  ]},selections:[]};
  state = resources(state,a,'sell-opening',[{kind:'sell',seatId:'seat-0',unitId:'unit-1'}]);
  state = resources(state,a,'grant',[{kind:'acquire',grantId:'target',full:'hold'}]);
  if (copies === 9) state = resources(state,a,'merge',[{kind:'merge-live',seatId:'seat-0'}]);
  const target = state.ownership.seats[0].preparation.units.find(u=>u.definitionId===definitionId)!;
  state = resources(state,a,'deploy',[{kind:'deploy',seatId:'seat-0',unitId:target.id,location:{kind:'board',cell:{col:1,row:4}}}]);
  state = resources(state,a,'tools',[{kind:'acquire',grantId:'equipment',full:'hold'},{kind:'equip',seatId:'seat-0',unitId:target.id,itemId:'item-1',slot:0}]);
  const selection = {choiceId:'choice',seatId:'seat-0',unitId:target.id,anomalyId,atOrdinal};
  a = {...a,selections:[selection]};
  const command: D14Command = {id:'select',kind:'select',selection};
  return {boundary,a,state,targetId:target.id,command};
}
function advance(state: D14State,a:D14Authority,count=3) {
  for(let i=0;i<count;i++)state=round(state,a).state;
  return state;
}
function p(state: D14State,id=state.records[0].unitId) {return projectD14Unit(state,'seat-0',id)!;}
/** Actual combat consumes the independent projection; this is NOT Match/restoreMatch integration. */
function combat(state:D14State) {
  const seat=state.ownership.seats[0], target=p(state);
  const enemy={id:'enemy',definitionId:'lux',starLevel:1 as const,team:'enemy' as const,location:{kind:'board' as const,cell:{col:1,row:3}}};
  const foe:StrategyUnitSnapshot={unitId:'enemy',stats:{...getUnitStats('lux',1),health:100000,armor:0,magicResist:0,attack:0,initialMana:0,maxMana:100000},ability:resolveAbility('lux-ability',1),sources:[],triggers:[]};
  return createCombatWithEvents({...seat.preparation,units:[{...seat.preparation.units.find(u=>u.id===target.unitId)!,location:{kind:'board',cell:{col:1,row:4}}},enemy]},
    {traits:[],units:[{...target},foe]},'d14-independent').state;
}

describe('D14 Ultimate Hero dedicated permanent promotion (independent API)',()=>{
  it('promotes only after three real settlements; keeps identity, nine shares, equipment and gold',()=>{
    const f=setup();let s=commit(f.state,f.a,f.command).state;
    const pool=structuredClone(s.ownership.pool), seat=s.ownership.seats[0];
    expect(p(s).effectiveStarLevel).toBe(3);expect(p(s).stats.health).toBe(1620);expect(p(s).stats.attack).toBe(97);
    s=advance(s,f.a,2);expect(s.records[0].phase).toBe('waiting');expect(p(s).effectiveStarLevel).toBe(3);
    const last=round(s,f.a);s=last.state;
    expect(last.events.filter(e=>e.type==='d14Promoted')).toEqual([{type:'d14Promoted',receiptId:'choice',unitId:f.targetId}]);
    expect(p(s).effectiveStarLevel).toBe(4);expect(p(s).physicalStarLevel).toBe(3);
    expect(p(s).stats.health).toBe(2916);expect(p(s).stats.attack).toBe(174);
    const spell=p(s).ability;expect(spell.kind).toBe('s13');if(spell.kind==='s13')expect(spell.variables).toMatchObject({Damage:12600000,Shield:3000000});
    expect(s.ownership.pool).toEqual(pool);expect(pool.holdings.find(h=>h.unitId===f.targetId)!.sources).toHaveLength(9);
    expect(s.ownership.seats[0]).toEqual(seat);expect(s.ownership.seats[0].items[0].location).toEqual({kind:'unit',unitId:f.targetId,slot:0});
    s=advance(s,f.a,4);expect(p(s).stats).toEqual(p(last.state).stats);expect(s.records[0].phase).toBe('promoted');
    const retry=commit(s,f.a,f.command);expect(retry.state).toBe(s);expect(retry.events).toEqual([]);
  });
  it('feeds the promoted AD to the actual combat damage pipeline',()=>{
    const f=setup();const s=advance(commit(f.state,f.a,f.command).state,f.a);let c=combat(s);
    c={...c,units:c.units.map(u=>({...u,baseCritChanceBps:0,mana:0,maxMana:100000}))};
    const step=stepCombat(c),enemy=step.state.units.find(u=>u.id==='enemy')!;
    expect(100000-enemy.hp).toBe(174);
  });
  it('uses rank-four Singed coefficients with the explicit 14.24b 60% DR override',()=>{
    const f=setup('ultimate-hero','singed');const s=advance(commit(f.state,f.a,f.command).state,f.a);
    const ability=p(s).ability;expect(ability.kind).toBe('s13');
    if(ability.kind==='s13')expect(ability.variables).toMatchObject({DR:6000,AttackSpeed:2000000,Duration:40000});
  });
  it('keeps promotion after independent save/restore and bench/redeploy without resetting the clock',()=>{
    const f=setup();let s=advance(commit(f.state,f.a,f.command).state,f.a);
    s=resources(s,f.a,'bench',[{kind:'deploy',seatId:'seat-0',unitId:f.targetId,location:{kind:'bench',slot:0}}]);
    const restored=restoreD14(serializeD14(s,f.boundary,f.a,[...s.commands]),f.boundary,f.a,[...s.commands]);
    expect(p(restored).effectiveStarLevel).toBe(4);expect(p(restored).stats.health).toBe(2916);
    const operations=[{kind:'deploy' as const,seatId:'seat-0',unitId:f.targetId,location:{kind:'board' as const,cell:{col:3,row:5}}}];
    expect(resources(restored,f.a,'back',operations)).toEqual(resources(s,f.a,'back',operations));
  });
  it.each([1,3])('sale at settlement %i retires the certificate, returns only nine shares and pays the ordinary physical price',n=>{
    const f=setup();let s=advance(commit(f.state,f.a,f.command).state,f.a,n);
    const before=s.ownership.seats[0].gold, available=s.ownership.pool.available.lux;
    s=resources(s,f.a,'sell',[{kind:'sell',seatId:'seat-0',unitId:f.targetId}]);
    expect(s.records[0].phase).toBe('retired');expect(projectD14Unit(s,'seat-0',f.targetId)).toBeNull();
    expect(s.ownership.seats[0].gold).toBe(before+9);expect(s.ownership.pool.available.lux).toBe(available+9);
    expect(s.ownership.seats[0].items[0].location).toEqual({kind:'inventory'});
    expect(s.ownership.seats[0].anomalyBinding).toBeNull();
  });
  it.each([['lux',1],['tristana',9]] as const)('rejects ineligible %s / %i copies atomically', (id,copies)=>{
    const f=setup('ultimate-hero',id,0,copies);rejected(f.state,f.a,f.command,'invalid-target');
  });
  it('rejects untrusted selections and changed retry facts',()=>{
    const f=setup();const bad={...f.command,selection:{...f.a.selections[0],unitId:'foreign'}} as D14Command;
    rejected(f.state,f.a,bad,'unauthorized-choice');const s=commit(f.state,f.a,f.command).state;
    rejected(s,f.a,{id:'select',kind:'settle',roundId:'1-2'},'receipt-conflict');
    rejected(s,f.a,{...f.command,id:'another-id'},'already-acquired');
  });
  it('leaves ordinary units and the public three-star API unchanged',()=>{
    const f=setup('into-the-unknown');expect(projectD14Unit(f.state,'seat-0',f.targetId)!.effectiveStarLevel).toBe(1);
    expect(()=>getUnitStats('lux',4 as never)).toThrow('Invalid star level');
  });
});

describe('D14 Into the Unknown lifecycle (Q3 fallback where scripts unavailable)',()=>{
  it('holds the original unit and equipment for three rounds, excludes traits/population, returns bench-first with exact permanent AD/AP',()=>{
    const f=setup('into-the-unknown');const before=f.state.ownership;let s=commit(f.state,f.a,f.command).state;
    expect(projectD14Unit(s,'seat-0',f.targetId)).toBeNull();expect(s.records[0].phase).toBe('absent');
    expect(s.ownership.seats[0].preparation.units.filter(u=>u.team==='player')).toHaveLength(0);
    expect(deriveTraits(s.ownership.seats[0].preparation,'player').every(t=>t.count===0&&t.tier===0&&t.targetUnitIds.length===0)).toBe(true);
    expect(s.ownership.held[0]).toMatchObject({kind:'unit',unit:{id:f.targetId,definitionId:'lux',starLevel:1},boundRound:0,returnRound:3,originLocation:{kind:'board',cell:{col:1,row:4}}});
    expect(s.ownership.held[0].kind==='unit'&&s.ownership.held[0].items).toEqual(before.seats[0].items);
    expect(s.ownership.pool).toEqual(before.pool);expect(s.ownership.seats[0].anomalyBinding).toMatchObject({unitId:f.targetId,definitionId:'into-the-unknown'});
    s=advance(s,f.a,2);expect(projectD14Unit(s,'seat-0',f.targetId)).toBeNull();
    const returned=round(s,f.a);s=returned.state;
    expect(returned.events.filter(e=>e.type==='d14Returned')).toHaveLength(1);
    expect(s.records[0].phase).toBe('returned');expect(s.ownership.held).toEqual([]);
    expect(p(s).location).toEqual({kind:'bench',slot:0});expect(p(s).stats.attack).toBe(45);expect(p(s).abilityPower).toBe(150);
    expect(p(s).stats.health).toBe(500);expect(p(s).attackDamagePercentBps).toBe(5000);
    expect(s.ownership.pool).toEqual(before.pool);expect(s.ownership.seats[0].items).toEqual(before.seats[0].items);
    expect(s.ownership.seats[0].nextUnitSerial).toBe(before.seats[0].nextUnitSerial);
    const later=advance(s,f.a,4);expect(p(later).stats).toEqual(p(s).stats);expect(p(later).abilityPower).toBe(150);
  });
  it('composes return AD and AP with item/trait sources exactly once using the existing arithmetic',()=>{
    const f=setup('into-the-unknown');const s=advance(commit(f.state,f.a,f.command).state,f.a);
    const sources=makeSourcedEffects(f.targetId,'item','synthetic','item-proof',[
      {kind:'statFlat',stat:'attackDamage',amount:10},{kind:'statPercentBps',stat:'attackDamage',bps:2000},{kind:'statFlat',stat:'abilityPower',amount:25}]);
    const projection=projectD14Unit(s,'seat-0',f.targetId,sources)!;
    expect(projection.stats.attack).toBe(68);expect(projection.abilityPower).toBe(175);
    let c=combat(s);c={...c,units:c.units.map(u=>({...u,baseCritChanceBps:0,mana:0,maxMana:100000}))};
    expect(100000-stepCombat(c).state.units.find(u=>u.id==='enemy')!.hp).toBe(45);
  });
  it.each(['sell','equip','duplicate'] as const)('rejects %s while absent without consuming gold/items/tools or changing facts',kind=>{
    const f=setup('into-the-unknown');const s=commit(f.state,f.a,f.command).state;
    const op=kind==='sell'?{kind,seatId:'seat-0',unitId:f.targetId}:kind==='equip'?{kind,seatId:'seat-0',unitId:f.targetId,itemId:'item-1',slot:1}:{kind,seatId:'seat-0',unitId:f.targetId,duplicatorId:'duplicator-1',full:'hold' as const};
    // D3 rejects the unavailable target or equipment plan atomically.
    rejected(s,f.a,{id:'forbidden',kind:'resources',operations:[op]},kind==='equip'?'invalid-target':'unknown-unit');
  });
  it('does not let caller bypass the clock with generic hold or settle operations',()=>{
    const f=setup('into-the-unknown'),s=commit(f.state,f.a,f.command).state;
    rejected(s,f.a,{id:'bypass',kind:'resources',operations:[{kind:'settle',roundId:'1-4'} as never]},'unsupported-operation');
  });
  it('retains ownership and delays the bonus when full, then returns into the first freed bench slot',()=>{
    const f=setup('into-the-unknown');let s=commit(f.state,f.a,f.command).state;
    s=resources(s,f.a,'fill',[{kind:'acquire',grantId:'fill',full:'hold'}]);
    // Ten units occupy nine bench slots and the one legal population slot.
    const blocker=s.ownership.seats[0].preparation.units.find(u=>u.location.kind==='bench')!;
    s=resources(s,f.a,'fill-board',[{kind:'deploy',seatId:'seat-0',unitId:blocker.id,location:{kind:'board',cell:{col:0,row:4}}}]);
    // Existing occupied board destination swaps; population remains one.
    s=advance(s,f.a);expect(s.records[0].phase).toBe('absent');expect(projectD14Unit(s,'seat-0',f.targetId)).toBeNull();
    expect(s.ownership.held.some(h=>h.kind==='unit'&&h.unit.id===f.targetId)).toBe(true);
    const pool=s.ownership.pool, blockerBench=s.ownership.seats[0].preparation.units.find(u=>u.location.kind==='bench')!;
    const result=commit(s,f.a,{id:'make-space',kind:'resources',operations:[{kind:'sell',seatId:'seat-0',unitId:blockerBench.id}]});
    s=result.state;expect(result.events.filter(e=>e.type==='d14Returned')).toHaveLength(1);
    expect(p(s).location).toEqual(blockerBench.location);expect(p(s).stats.attack).toBe(45);expect(p(s).abilityPower).toBe(150);
    expect(s.ownership.pool.available.lux).toBe(pool.available.lux);expect(s.ownership.pool.holdings.find(h=>h.unitId===f.targetId)).toEqual(pool.holdings.find(h=>h.unitId===f.targetId));
  });
  it('uses a legal board cell when the bench is full and population allows it',()=>{
    const f=setup('into-the-unknown');let s=commit(f.state,f.a,f.command).state;
    // Exactly nine grant units fill bench, leaving population available.
    s=resources(s,f.a,'fill',[{kind:'acquire',grantId:'fill-nine',full:'hold'}]);
    s=advance(s,f.a);expect(s.records[0].phase).toBe('returned');
    expect(p(s).location).toEqual({kind:'board',cell:{col:0,row:4}});expect(p(s).stats.attack).toBe(45);
  });
  it.each([6,37])('counts supply/carousel and overtime boundaries from ordinal %i without skipping or double settlement',ordinal=>{
    const f=setup('into-the-unknown','lux',ordinal);let s=commit(f.state,f.a,f.command).state;
    rejected(s,f.a,{id:'skip',kind:'settle',roundId:getMultiplayerRoundByOrdinal(ordinal+2).roundId},'invalid-round');
    s=round(s,f.a).state;const duplicate=commit(s,f.a,{id:'same-round-new-id',kind:'settle',roundId:getMultiplayerRoundByOrdinal(ordinal+1).roundId});
    expect(duplicate.events).toEqual([]);expect(duplicate.state.ownership.settledOrdinal).toBe(ordinal+1);
    s=advance(duplicate.state,f.a,2);expect(s.records[0].phase).toBe('returned');expect(s.records[0].dueOrdinal).toBe(ordinal+3);
  });
  it('normal merge after return transfers the binding and bonus to the surviving identity; a duplicate receives no bonus',()=>{
    const f=setup('into-the-unknown');let s=advance(commit(f.state,f.a,f.command).state,f.a);
    s=resources(s,f.a,'copy',[{kind:'duplicate',seatId:'seat-0',unitId:f.targetId,duplicatorId:'duplicator-1',full:'hold'}]);
    const copy=s.ownership.seats[0].preparation.units.find(u=>u.id!==f.targetId&&u.team==='player')!;
    expect(projectD14Unit(s,'seat-0',copy.id)!.abilityPower).toBe(100);expect(projectD14Unit(s,'seat-0',copy.id)!.stats.attack).toBe(30);
    s=resources(s,f.a,'copy-to-board',[{kind:'deploy',seatId:'seat-0',unitId:copy.id,location:{kind:'board',cell:{col:0,row:4}}}]);
    s=resources(s,f.a,'third',[{kind:'acquire',grantId:'siblings',full:'hold'},{kind:'merge-live',seatId:'seat-0'}]);
    expect(s.records[0].unitId).toBe(copy.id);expect(s.records[0].unitId).not.toBe(f.targetId);
    expect(s.ownership.seats[0].anomalyBinding!.unitId).toBe(s.records[0].unitId);
    expect(p(s).physicalStarLevel).toBe(2);expect(p(s).stats.attack).toBe(81);expect(p(s).abilityPower).toBe(150);
    expect(s.ownership.pool.holdings.find(h=>h.unitId===s.records[0].unitId)!.sources).toHaveLength(3);
  });
});

describe('independent D14 restore only; production restoreMatch is UNWIRED',()=>{
  it.each(['ultimate-hero','into-the-unknown'] as const)('positive restore for %s before and after effect, with identical continuation and no regrant',id=>{
    const f=setup(id);let s=commit(f.state,f.a,f.command).state;
    for(const rounds of [1,2]) {
      s=advance(s,f.a,rounds);const verified=structuredClone(s.commands);
      const restored=restoreD14(serializeD14(s,f.boundary,f.a,verified),f.boundary,f.a,verified);
      expect(restored).toEqual(s);expect(round(restored,f.a)).toEqual(round(s,f.a));
      expect(commit(restored,f.a,f.command).events).toEqual([]);
    }
  });
  const mutations:Record<string,(s:D14State)=>unknown>={
    phase:s=>({...s,records:s.records.map(r=>({...r,phase:'waiting'}))}),
    clock:s=>({...s,records:s.records.map(r=>({...r,dueOrdinal:2}))}),
    binding:s=>({...s,ownership:{...s.ownership,seats:s.ownership.seats.map((x,i)=>i?x:{...x,anomalyBinding:null})}}),
    gold:s=>({...s,ownership:{...s.ownership,seats:s.ownership.seats.map((x,i)=>i?x:{...x,gold:x.gold+1})}}),
    pool:s=>({...s,ownership:{...s.ownership,pool:{...s.ownership.pool,available:{...s.ownership.pool.available,lux:999}}}}),
    equipment:s=>({...s,ownership:{...s.ownership,seats:s.ownership.seats.map((x,i)=>i?x:{...x,items:[]})}}),
    identity:s=>({...s,records:s.records.map(r=>({...r,unitId:'unit-999'}))}),
    receipts:s=>({...s,commands:s.commands.slice(0,-1)}),
    resourceFacts:s=>({...s,ownership:{...s.ownership,transactions:[]}}),
    star:s=>({...s,ownership:{...s.ownership,seats:s.ownership.seats.map((x,i)=>i?x:{...x,preparation:{...x.preparation,units:x.preparation.units.map(u=>({...u,starLevel:4}))}})}}),
    extraField:s=>({...s,forgedBonus:5000}),
  };
  it.each(Object.entries(mutations))('rejects %s tampering against independently retained facts',(_,mutate)=>{
    const f=setup();const s=advance(commit(f.state,f.a,f.command).state,f.a);
    expect(()=>restoreD14(JSON.stringify(mutate(structuredClone(s))),f.boundary,f.a,[...s.commands])).toThrow();
  });
  it('rejects deleted held ownership/equipment and rollback to an earlier valid save',()=>{
    const f=setup('into-the-unknown');const s=commit(f.state,f.a,f.command).state;
    expect(()=>restoreD14({...s,ownership:{...s.ownership,held:[]}},f.boundary,f.a,[...s.commands])).toThrow();
    const later=advance(s,f.a);expect(()=>restoreD14(s,f.boundary,f.a,[...later.commands])).toThrow();
  });
});

it.each([['ultimate-hero',1260],['into-the-unknown',540]] as const)('independent %s spell projection deals exact real Lux empowered magic damage', (id,damage)=>{
  const f=setup(id);const s=advance(commit(f.state,f.a,f.command).state,f.a);let c=combat(s);
  c={...c,units:c.units.map(u=>u.id===f.targetId?{...u,mana:u.maxMana,cooldownTicks:0,baseCritChanceBps:0}:{...u,mana:0,maxMana:100000})};
  const raw:number[]=[];
  for(let i=0;i<60;i++){const step=stepCombat(c);c=step.state;raw.push(...packets(step.events).filter(p=>p.source.ownerId===f.targetId&&p.damageType==='magic').map(p=>p.raw));}
  expect(raw[0]).toBe(damage);
});

it.each(['held clock','held equipment','original position','held shares'] as const)('independent restore rejects %s tampering during absence',kind=>{
  const f=setup('into-the-unknown');const s=commit(f.state,f.a,f.command).state;const candidate=structuredClone(s);
  const h=candidate.ownership.held[0];
  const replacement=kind==='held clock'?{...h,returnRound:2}:kind==='held equipment'?{...h,items:[]}:kind==='original position'?{...h,originLocation:{kind:'bench',slot:8}}:h;
  const ownership={...candidate.ownership,held:[replacement],...(kind==='held shares'?{pool:{...candidate.ownership.pool,holdings:candidate.ownership.pool.holdings.map(x=>x.unitId===f.targetId?{...x,sources:[]}:x)}}:{})};
  expect(()=>restoreD14({...candidate,ownership},f.boundary,f.a,[...s.commands])).toThrow();
});
it('independent restore cannot authenticate a choice from candidate facts alone',()=>{
  const f=setup();const s=advance(commit(f.state,f.a,f.command).state,f.a);
  expect(()=>restoreD14(s,f.boundary,{...f.a,selections:[]},[...s.commands])).toThrow();
});

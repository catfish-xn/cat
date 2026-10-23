import { expect, it } from 'vitest';
import { createMatch, snapshotForBattle, compileBattle, resolveTwoSidedBattle, startTwoSidedBattle,
  startCombatReplay, toCombatReplay, type MatchState } from '../src/server-entry';
import { getCatalogRoundById } from '../src/simulation/round-selectors';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { freezeCombatInput } from '../src/simulation/combat-input';
import { createRestoreCombatReplay } from '../src/simulation/restore-combat-replay';
import { validateM5Runtime } from '../src/simulation/serialization-structure';
import { createCombatWithEvents, stepCombat } from '../src/simulation/combat';

function army(name:string,star:1|2|3=3):MatchState {
  const base=createMatch(42),round=getCatalogRoundById('2-1');
  return {...base,level:9,round:round.ordinal,roundDefinitionId:round.roundId,m8:{...base.m8,round},items:[],
    preparation:{...base.preparation,units:[name,'drmundo','drmundo'].map((definitionId,i)=>({id:`unit-${i+1}`,definitionId,
      team:'player',starLevel:i===0?star:3,location:{kind:'board',cell:{col:2+i,row:i===0?5:4}}}))}};
}
it.each(['sevika','malzahar','jinx','mordekaiser'])('%s synchronous / 1- and 7-tick slices / replay preserve complete bytes',(name)=>{
  const source=compileBattle(snapshotForBattle(army(name),'A'),snapshotForBattle(army('garen'),'B'),42,{battleId:'five-cost'});
  const expected=resolveTwoSidedBattle(source,901),expectedReplay=toCombatReplay(expected);
  expect(expected.events.some(e=>e.type==='cast'&&e.receipt.source.definitionId===name+'-ability')).toBe(true);
  for(const budget of [1,7]){
    const task=startTwoSidedBattle(source);let result=task.advance(budget);
    while(!result)result=task.advance(budget);
    expect(JSON.stringify(result)).toBe(JSON.stringify(expected));
    const replay=startCombatReplay(JSON.parse(JSON.stringify(result)));let frames=replay.advance(budget);
    while(!frames)frames=replay.advance(budget);
    expect(JSON.stringify(frames)).toBe(JSON.stringify(expectedReplay));
  }
});
it.each(['jinx','mordekaiser','malzahar'])('%s geometry restores from authenticated input after casting',(name)=>{
  const player=army(name),opponent=army('garen');
  const s:MatchState={...player,items:(['blue-buff','tear','tear'] as const).map((definitionId,slot)=>({id:`mana-${slot}`,definitionId,location:{kind:'unit' as const,unitId:'unit-1',slot:slot as 0|1|2}})),preparation:{...player.preparation,units:[...player.preparation.units,
    ...opponent.preparation.units.map(u=>({...u,id:'enemy-'+u.id,team:'enemy' as const,
      location:{kind:'board' as const,cell:{col:u.location.kind==='board'?u.location.cell.col:0,row:2}}}))]}};
  const strategy=buildStrategySnapshot(s),basis=freezeCombatInput(s,42,s.resourceProvenance.entries.length);
  let state=createCombatWithEvents(s.preparation,strategy,basis.combatId,42).state,cast=false;
  while(state.status==='running'){
    const next=stepCombat(state);state=next.state;
    if(!next.events.some(e=>e.type==='cast'&&'receipt' in e&&e.receipt.source.definitionId===name+'-ability'))continue;
    const rebuilt=createRestoreCombatReplay(JSON.parse(JSON.stringify(basis)),strategy,state.tick).stateAtSaveTick();
    expect(rebuilt).toEqual(state);
    expect(stepCombat(JSON.parse(JSON.stringify(rebuilt)))).toEqual(stepCombat(state));cast=true;break;
  }
  expect(cast).toBe(true);
});
it.each([['sevika',1,'g23Flame'],['sevika',3,'g23Chomp'],['malzahar',3,'g2Infection']] as const)('%s star %s restores %s from authenticated inputs and rejects forged tasks',(name,star,expectedKind)=>{
  const player=army(name,star),opponent=army('garen');
  const s:MatchState={...player,items:(['blue-buff','tear','tear'] as const).map((definitionId,slot)=>({id:`mana-${slot}`,definitionId,location:{kind:'unit' as const,unitId:'unit-1',slot:slot as 0|1|2}})),preparation:{...player.preparation,units:[...player.preparation.units,
    ...opponent.preparation.units.map(u=>({...u,id:'enemy-'+u.id,team:'enemy' as const,
      location:{kind:'board' as const,cell:{col:u.location.kind==='board'?u.location.cell.col:0,row:2}}}))]}};
  const checked=new Set<string>(),strategy=buildStrategySnapshot(s);
  for(const battleSeed of [42,1,2]){
  const basis=freezeCombatInput(s,battleSeed,s.resourceProvenance.entries.length);
  let state=createCombatWithEvents(s.preparation,strategy,basis.combatId,battleSeed).state;
  while(state.status==='running'){
    state=stepCombat(state).state;
    const pending=state.units.flatMap(u=>(u.tasks??[]).filter(t=>['g23Flame','g23Chomp','g2Infection'].includes(t.kind)));
    const kind=pending.find(t=>t.kind===expectedKind&&!checked.has(t.kind))?.kind;
    if(!kind)continue;
    const rebuilt=createRestoreCombatReplay(JSON.parse(JSON.stringify(basis)),strategy,state.tick).stateAtSaveTick();
    expect(rebuilt).toEqual(state);
    const ids=new Set(state.units.map(u=>u.id)),same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
    for(const u of state.units)validateM5Runtime(u,state.tick,ids,state.units,state.combatId!,new Set(),same,state.nextActionSeq!);
    const forged=structuredClone(state),owner=forged.units.find(u=>u.tasks?.some(t=>t.kind===kind))!;
    Object.assign(owner.tasks!.find(t=>t.kind===kind)!,{source:{...owner.tasks!.find(t=>t.kind===kind)!.source,definitionId:'lux-ability'}});
    expect(()=>validateM5Runtime(owner,state.tick,ids,forged.units,state.combatId!,new Set(),same,state.nextActionSeq!)).toThrow();
    expect(stepCombat(JSON.parse(JSON.stringify(rebuilt)))).toEqual(stepCombat(state));
    checked.add(kind);
  }
  }
  expect(checked).toEqual(new Set([expectedKind]));
});

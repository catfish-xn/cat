import { describe, expect, it } from 'vitest';
import { createMatch, snapshotForBattle, compileBattle, resolveTwoSidedBattle, toCombatReplay, toCombatViewState, toCombatViewEvents,
  applyCombatReplayTick, stepCombat, startMatchCombat, type MatchState, type CombatState, type LedgerCombatEvent } from '../src/server-entry';
import { getCatalogRoundById } from '../src/simulation/round-selectors';
import { toLedgerEvents } from '../src/simulation/combat-ledger';
import { freeze } from './combat-helpers';
import { ROUND_CATALOG } from '../src/simulation/content/round-catalog';
import { catalogPreparation } from './t5r-helpers';

function catalogBattle(roundId: string, seed = 42) {
  const start=startMatchCombat(catalogPreparation(roundId,seed));
  if(!start.ok||!start.state.combat)throw new Error('start');
  const initial=start.state.combat,all:CombatState[]=[initial];let terminal:CombatState=initial;
  const events=start.events.filter((event):event is LedgerCombatEvent=>event.domain==='combat');
  while(terminal.status==='running') {
    const next=stepCombat(terminal);terminal=next.state;all.push(terminal);events.push(...toLedgerEvents(next.events));
  }
  return {initial,terminal,events,all};
}
function battle(large=false,empty=false) {
  const base=createMatch(42),round=getCatalogRoundById('2-1');
  const state:MatchState={...base,round:round.ordinal,roundDefinitionId:round.roundId,m8:{...base.m8,round},level:9,
    preparation:{...base.preparation,units:empty?[]:(large?['irelia','leona','tristana','maddie','lux','darius']:['maddie']).map((definitionId,i)=>({
      id:`unit-${i+1}`,definitionId,team:'player',starLevel:1,location:{kind:'board',cell:{col:i,row:i<2?4:7}}}))},
    items:large?[{id:'item-1',definitionId:'bloodthirster',location:{kind:'unit',unitId:'unit-1',slot:0}}]:[]};
  return resolveTwoSidedBattle(compileBattle(snapshotForBattle(state,'A'),snapshotForBattle(state,'B'),42,{battleId:'replay'}),1201);
}
function frames(initial:CombatState) {
  const all=[initial];let state=initial;
  while(state.status==='running') {state=stepCombat(state).state;all.push(state);}return all;
}
describe('T5R compact combat replay',()=>{
  it.each(ROUND_CATALOG.filter(r=>r.kind!=='supply').map(r=>r.roundId))('catalog %s: every battle produces exact per-tick replay',roundId=>{
    const source=catalogBattle(roundId),replay=toCombatReplay(freeze(source));let view=replay.initial;
    for(const frame of replay.ticks) {
      view=applyCombatReplayTick(view,frame);expect(view).toEqual(toCombatViewState(source.all[frame.tick]));
    }
    expect(view).toEqual(replay.terminal);
    expect(toCombatViewEvents(source.events)).toEqual(replay.ticks.flatMap(f=>f.events).filter(e=>e.type!=='unitUpdated'));
    const visible=source.events.filter(e=>e.type!=='activityChanged'&&e.type!=='effectTriggered');
    expect(replay.ticks.flatMap(f=>f.events).filter(e=>'eventSeq' in e).map(e=>e.eventSeq)).toEqual(visible.map(e=>e.eventSeq));
  });
  it.each(Array.from({length:8},(_,i)=>42+i))('SR-B7-01 wolves seed %s: deferred tick0 movements appear once and remain validated',seed=>{
    const source=freeze(catalogBattle('3-7',seed)),before=JSON.stringify(source);
    const deferred=toLedgerEvents(stepCombat(source.initial).events).filter(e=>e.tick===0);
    expect(deferred).toHaveLength(5);expect(deferred.every(e=>e.type==='movement')).toBe(true);
    const replay=toCombatReplay(source),sequences=new Set(deferred.map(e=>e.eventSeq));
    expect(replay.ticks[0].events.filter(e=>'eventSeq' in e&&sequences.has(e.eventSeq))).toEqual([]);
    expect(replay.ticks[1].events.filter(e=>'eventSeq' in e&&sequences.has(e.eventSeq)))
      .toEqual(deferred.map(({domain:_,combatId:__,...event})=>event));
    const missing={...source,events:source.events.filter(e=>e.eventSeq!==deferred[0].eventSeq)};
    expect(()=>toCombatReplay(missing)).toThrow('replay-divergence');
    const altered={...source,events:source.events.map(e=>e.eventSeq===deferred[0].eventSeq&&e.type==='movement'
      ? {...e,to:{...e.to,col:(e.to.col+1)%7}} : e)};
    expect(()=>toCombatReplay(altered)).toThrow('replay-divergence');
    expect(()=>toCombatReplay({...source,events:[...source.events,deferred[0]]})).toThrow('replay-divergence');
    expect(JSON.stringify(source)).toBe(before);
  });
  it.each([false,true])('every tick matches authoritative view (six-per-side=%s), terminal exact, input untouched',large=>{
    const source=freeze(battle(large)),before=JSON.stringify(source),replay=toCombatReplay(source),all=frames(source.initial);
    expect(toCombatViewEvents(source.events)).toEqual(replay.ticks.flatMap(f=>f.events).filter(e=>e.type!=='unitUpdated'));
    let view=replay.initial;
    for(const frame of replay.ticks) {
      view=applyCombatReplayTick(view,frame);expect(view).toEqual(toCombatViewState(all[frame.tick]));
      expect(!!frame.keyframe).toBe(frame.tick>0&&(frame.tick%20===0||frame.tick===source.terminal.tick));
    }
    expect(view).toEqual(replay.terminal);expect(replay.terminal).toEqual(toCombatViewState(source.terminal));
    expect(JSON.stringify(source)).toBe(before);expect(toCombatReplay(source)).toEqual(replay);
    const bytes=Buffer.byteLength(JSON.stringify(replay)),raw=Buffer.byteLength(JSON.stringify(all));
    console.info(JSON.stringify({fixture:large?'6v6':'1v1',ticks:source.terminal.tick,rawBytes:raw,replayBytes:bytes,ratio:bytes/raw}));
    expect(bytes).toBeLessThan(raw/3);
    expect(JSON.stringify(replay)).not.toMatch(/rngState|rngDraws|tasks|strategy|mechanismState|equipmentState|battleSeed|triggerLedger/);
    if(large) expect(replay.ticks.flatMap(f=>f.events).some(e=>e.type==='shieldLayerChanged')).toBe(true);
  });
  it('tick-zero finish needs no advancing, damage replay or second settlement',()=>{
    const source=battle(false,true),replay=toCombatReplay(source);
    expect(source.terminal.tick).toBe(0);expect(replay.ticks).toHaveLength(1);
    expect(toCombatViewEvents(source.events)).toEqual(replay.ticks[0].events);
    expect(applyCombatReplayTick(replay.initial,replay.ticks[0])).toEqual(replay.terminal);
  });
  it('PvE accepts the same initial/terminal/ledger shape and rejects inconsistent inputs',()=>{
    const start=startMatchCombat(createMatch(5));if(!start.ok||!start.state.combat)throw new Error('start');
    const initial=start.state.combat;let terminal:CombatState=initial;
    const events:LedgerCombatEvent[]=start.events.filter((event):event is LedgerCombatEvent=>event.domain==='combat');
    while(terminal.status==='running') {const next=stepCombat(terminal);terminal=next.state;events.push(...toLedgerEvents(next.events));}
    const source={initial,terminal,events},replay=toCombatReplay(source);
    expect(replay.terminal).toEqual(toCombatViewState(terminal));
    expect(()=>toCombatReplay({...source,terminal:{...terminal,tick:terminal.tick+1}})).toThrow('replay-divergence');
    expect(()=>toCombatReplay({...source,events:events.slice(0,-1)})).toThrow('replay-divergence');
    expect(()=>toCombatReplay({...source,terminal:{...terminal,status:'running'}})).toThrow('invalid-replay-input');
  });
  it('explicit nested whitelists omit unknown fields, including cells, boards and damage contexts',()=>{
    const source=structuredClone(battle());
    function inject(value:unknown):void {
      if(!value||typeof value!=='object')return;
      for(const child of Object.values(value))inject(child);
      if(!Array.isArray(value))Object.assign(value,{privateSentinel:'DO_NOT_SEND'});
    }
    inject(source);const before=JSON.stringify(source),replay=toCombatReplay(source);
    expect(JSON.stringify(replay)).not.toContain('DO_NOT_SEND');expect(JSON.stringify(source)).toBe(before);
    expect(JSON.stringify(toCombatViewEvents(source.events))).not.toContain('DO_NOT_SEND');
  });
});

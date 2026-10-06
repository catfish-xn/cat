import { describe, expect, it } from 'vitest';
import { BattleHistory, PlaybackSession, validateBattleCollection, validateBattleRecord } from '../src/replay';
import { startMatchCombat, stepMatch, nextRound, sellUnit } from '../src/simulation/match';
import type { CombatEvent } from '../src/simulation/combat';
import type { MatchState } from '../src/simulation/match-types';
import type { SaveEnvelope } from '../src/m6/contracts';
import { readyMatch, accepted, resolveM5Choices } from './match-helpers';

function battle(initial = readyMatch(42), maxTick = Infinity) {
  const history = new BattleHistory('test-run');
  const start = startMatchCombat(initial); if (!start.ok) throw Error(start.reason);
  let match = start.state;
  history.observe({ before: initial, after: match, events: start.events.filter((e):e is CombatEvent=>e.domain==='combat'),reason:'command' });
  const ticks = new Map<number, MatchState>([[0,structuredClone(match)]]);
  while(match.phase === 'combat' && match.combat.tick < maxTick) {
    const before = match, next = stepMatch(match); match = next.state;
    history.observe({before,after:match,events:next.events.filter((e):e is CombatEvent=>e.domain==='combat'),reason:'tick'});
    ticks.set(match.combat!.tick,structuredClone(match));
  }
  const envelope: SaveEnvelope={kind:'hex-autobattler-save',saveFormatVersion:1,replayFormatVersion:1,runId:'test-run',createdAt:'2026-10-06T00:00:00Z',match,battles:history.completedRecords,currentBattle:history.capturePrefix()};
  return {history,envelope,ticks};
}
describe('M6 isolated battle records and replay',()=>{
  it('captures tick zero, current prefix, and restores an identical terminal without mutating the active match',async()=>{
    const {history,envelope,ticks}=battle();
    await expect(validateBattleCollection(envelope)).resolves.toBeUndefined();
    expect(history.capturePrefix()).toBeNull(); expect(envelope.battles).toHaveLength(1);
    const original=structuredClone(envelope), record=envelope.battles[0], playback=new PlaybackSession(record);
    for(const tick of [0, Math.floor(record.endTick/2),record.endTick,0,record.endTick-1]) {
      expect(playback.seek(tick).combat).toEqual(ticks.get(tick)!.combat);
      expect(playback.read().events).toEqual(record.events.filter(e=>e.tick<=tick));
    }
    playback.seek(0); playback.play(); playback.setSpeed(4); expect(playback.advance(50).tick).toBe(4);
    playback.pause(); const paused=playback.read(); expect(playback.advance(5000)).toEqual(paused);
    expect(envelope).toEqual(original);
    expect(()=>playback.seek(-1)).toThrow();expect(()=>playback.seek(0.5)).toThrow();expect(()=>playback.advance(NaN)).toThrow();
    playback.dispose();expect(()=>playback.read()).toThrow('关闭');
  });
  it('validates a running event prefix at ticks 39/40/41 and resumes recording with no repeated tick zero',async()=>{
    for(const tick of [39,40,41]) {
      const {envelope}=battle(undefined,tick);expect(envelope.currentBattle?.endTick).toBe(tick);
      await expect(validateBattleCollection(envelope)).resolves.toBeUndefined();
      const history=new BattleHistory(envelope.runId,envelope.battles,envelope.currentBattle);
      const before=envelope.match,next=stepMatch(before);
      history.observe({before,after:next.state,events:next.events.filter((e):e is CombatEvent=>e.domain==='combat'),reason:'tick'});
      expect(history.capturePrefix()?.events.slice(0,envelope.currentBattle!.events.length)).toEqual(envelope.currentBattle!.events);
      await expect(validateBattleCollection({...envelope,match:next.state,currentBattle:history.capturePrefix(),battles:history.completedRecords})).resolves.toBeUndefined();
    }
  });
  it('owns observed inputs and keeps earlier frozen prefixes unchanged across later ticks and completion',()=>{
    const initial=readyMatch(42), start=startMatchCombat(initial); if(!start.ok)throw Error(start.reason);
    const history=new BattleHistory('owned-run');
    let match=structuredClone(start.state);
    const events=start.events.filter((event):event is CombatEvent=>event.domain==='combat');
    history.observe({before:initial,after:start.state,events,reason:'command'});
    const zero=history.capturePrefix()!, zeroSnapshot=structuredClone(zero);
    Object.assign(initial,{seed:99}); Object.assign(start.state.combat!,{tick:999});
    if(events[0]) Object.assign(events[0],{tick:999});
    expect(history.capturePrefix()).toEqual(zeroSnapshot);
    const prefixes=[zero];
    while(match.phase==='combat') {
      const before=match, next=stepMatch(match); match=structuredClone(next.state);
      const events=next.events.filter((event):event is CombatEvent=>event.domain==='combat');
      history.observe({before,after:next.state,events,reason:'tick'});
      if(match.combat!.tick===40||match.combat!.tick===80) prefixes.push(history.capturePrefix()!);
      Object.assign(next.state.combat!,{tick:999});
      if(events[0]) Object.assign(events[0],{tick:999});
    }
    expect(prefixes.length).toBe(3);
    const completed=history.completedRecords[0];
    expect(zero).toEqual(zeroSnapshot);
    for(const prefix of prefixes) {
      expect(prefix.context).toBe(completed.context);
      expect(prefix.initial).toBe(completed.initial);
      expect(prefix.events).not.toBe(completed.events);
      expect(Object.isFrozen(prefix.events)).toBe(true);
      expect(Object.isFrozen(prefix.context.preparation.units)).toBe(true);
      for(const [index,event] of prefix.events.entries()) {
        expect(event).toBe(completed.events[index]); expect(Object.isFrozen(event)).toBe(true);
      }
      expect(validateBattleRecord(prefix).terminal.tick).toBe(prefix.endTick);
    }
    expect(validateBattleRecord(completed).terminal.tick).toBe(match.combat!.tick);
    const imported=structuredClone(prefixes[1]), restored=new BattleHistory('owned-run',[],imported);
    const beforeMutation=restored.capturePrefix(); Object.assign(imported.context,{seed:99});
    Object.assign(imported.events[0],{tick:999});
    expect(restored.capturePrefix()).toEqual(beforeMutation);
  });
  it('rejects missing/reordered events, forged checkpoint, wrong result, future identity, and topology',async()=>{
    const {envelope}=battle(),record=envelope.battles[0];
    expect(()=>validateBattleRecord({...record,events:record.events.slice(1)})).toThrow();
    expect(()=>validateBattleRecord({...record,checkpoint:{tick:0}} as typeof record)).toThrow();
    expect(()=>validateBattleRecord({...record,result:record.result==='playerWin'?'enemyWin':'playerWin'})).toThrow();
    expect(()=>validateBattleRecord({...record,combatId:'round-99'})).toThrow();
    await expect(validateBattleCollection({...envelope,battles:[]})).rejects.toThrow();
    await expect(validateBattleCollection({...envelope,battles:[record,record]})).rejects.toThrow();
    await expect(validateBattleCollection({...envelope,currentBattle:record})).rejects.toThrow();
    const broken=structuredClone(record); const events=broken.events as CombatEvent[]; [events[0],events[1]]=[events[1],events[0]];
    expect(()=>validateBattleRecord(broken)).toThrow();
  });
  it('retains frozen units after sale and does not duplicate an ended combat on later choice commands',async()=>{
    const {history,envelope}=battle();let match=envelope.match;
    match=resolveM5Choices(match);
    expect(match.phase).toBe('settlement');
    match=resolveM5Choices(accepted(nextRound(match,match.round)));
    expect(match.phase).toBe('preparation');
    const player=match.preparation.units.find(u=>u.team==='player')!;
    match=accepted(sellUnit(match,player.id));
    expect(history.completedRecords[0].context.preparation.units.some(u=>u.id===player.id)).toBe(true);
    await expect(validateBattleCollection({...envelope,match})).resolves.toBeUndefined();
    history.observe({before:envelope.match,after:envelope.match,events:[],reason:'command'});
    expect(history.completedRecords).toHaveLength(1);
  });
  it('keeps completed records through after-choice and exposes frozen history/snapshot references',async()=>{
    const history=new BattleHistory('choice-run');let match=readyMatch(42);let sawChoice=false;
    for(let round=0;round<7&&!sawChoice;round++) {
      const before=match,start=startMatchCombat(match);if(!start.ok)throw Error(start.reason);match=start.state;
      history.observe({before,after:match,events:start.events.filter((e):e is CombatEvent=>e.domain==='combat'),reason:'command'});
      while(match.phase==='combat'){const before=match,next=stepMatch(match);match=next.state;history.observe({before,after:match,events:next.events.filter((e):e is CombatEvent=>e.domain==='combat'),reason:'tick'});}
      if(match.phase==='choice'){sawChoice=true;break;}
      if(match.phase==='gameOver')break;
      match=resolveM5Choices(accepted(nextRound(match,match.round)));
      while(match.phase==='settlement') match=resolveM5Choices(accepted(nextRound(match,match.round)));
    }
    expect(sawChoice).toBe(true);expect(history.capturePrefix()).toBeNull();
    await expect(validateBattleCollection({kind:'hex-autobattler-save',saveFormatVersion:1,replayFormatVersion:1,runId:'choice-run',createdAt:'2026-10-06',match,battles:history.completedRecords,currentBattle:null})).resolves.toBeUndefined();
    const first=history.completedRecords[0];expect(history.completedRecords[0]).toBe(first);expect(Object.isFrozen(first.context.preparation.units)).toBe(true);
    const playback=new PlaybackSession(first), snapshot=playback.read();expect(playback.advance(50)).toBe(snapshot);expect(Object.isFrozen(snapshot.combat.units)).toBe(true);
  });
  it('records legal empty-roster tick0 defeat exactly once',async()=>{
    let match=readyMatch(42);for(const unit of match.preparation.units.filter(u=>u.team==='player'))match=accepted(sellUnit(match,unit.id));
    const {envelope,history}=battle(match);
    expect(envelope.battles[0].endTick).toBe(0);expect(envelope.battles[0].result).toBe('enemyWin');
    expect(history.capturePrefix()).toBeNull();await expect(validateBattleCollection(envelope)).resolves.toBeUndefined();
    expect(new PlaybackSession(envelope.battles[0]).read().tick).toBe(0);
  });
});

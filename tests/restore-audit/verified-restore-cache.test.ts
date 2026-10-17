import { describe, expect, it, vi } from 'vitest';
import * as content from '../../src/simulation/content';
import * as api from '../../src/simulation/match';
import { restoreMatch } from '../../src/simulation/serialization';
import { VerifiedRestoreCache } from '../../src/simulation/verified-restore-cache';
import { BattleHistory, validateBattleCollection } from '../../src/replay/history';
import type { SaveEnvelope } from '../../src/m6/contracts';

function completed(seed: number): SaveEnvelope {
  let state = api.createMatch(seed);
  const history = new BattleHistory(`cache-${seed}`);
  const observe = (result: ReturnType<typeof api.stepMatch>) => {
    history.observe({before:state,after:result.state,events:result.events.filter(e=>e.domain==='combat'),reason:'tick'});
    state=result.state;
  };
  const start=api.startMatchCombat(state);expect(start.ok).toBe(true);observe(start as ReturnType<typeof api.stepMatch>);
  while(state.phase==='combat')observe(api.stepMatch(state));
  return {kind:'hex-autobattler-save',saveFormatVersion:3,replayFormatVersion:3,runId:`cache-${seed}`,
    createdAt:'2026-10-17T00:00:00Z',match:state,battles:history.completedRecords,currentBattle:null};
}
function errorOf(run:()=>unknown): string {try {run();throw Error('accepted');} catch(error){return (error as Error).message;}}
describe('process-local exact verified input cache',()=>{
  it('bounds entries and bytes, evicts least-recently-used, and copies on ingress/egress',()=>{
    const cache=new VerifiedRestoreCache<{gold:number}>(2,1000), value={gold:1};
    cache.put('a',value);value.gold=8;expect(cache.get('a')).toEqual({gold:1});
    const got=cache.get('a')!;got.gold=99;expect(cache.get('a')).toEqual({gold:1});
    cache.put('b',{gold:2});cache.get('a');cache.put('c',{gold:3});expect(cache.get('b')).toBeUndefined();
    cache.put('huge'.repeat(1000),{gold:4});expect(cache.get('a')).toEqual({gold:1});
    const tiny=new VerifiedRestoreCache<{gold:number}>(5,70);
    tiny.put('aaaa',{gold:1});tiny.put('bbbb',{gold:2});tiny.put('cccc',{gold:3});
    expect(tiny.get('aaaa')).toBeUndefined();expect(tiny.get('cccc')).toEqual({gold:3});
  });
  it('never treats a hash collision as exact input equality',()=>{
    const hash=vi.spyOn(content,'digestContent').mockReturnValue('collision');
    try {
      const cache=new VerifiedRestoreCache<number>();cache.put('first',1);
      expect(cache.get('second')).toBeUndefined();cache.put('second',2);
      expect(cache.get('first')).toBeUndefined();expect(cache.get('second')).toBe(2);
    } finally {hash.mockRestore();}
  });
  it('cold/warm states and refusals agree; changed ledger never hits; failures and returned mutation are not admitted',()=>{
    const envelope=completed(73421),next=api.nextRound(envelope.match,envelope.match.round);
    expect(next.ok).toBe(true);const state=next.state;
    const steps=state.preparationLedger.commands.reduce((n,c)=>n+(c.name==='stepMatch'?c.repeats:0),0);
    expect(steps).toBeGreaterThan(0);
    const spy=vi.spyOn(api,'stepMatch');
    try {
      const restored=restoreMatch(state);expect(restored).toEqual(state);expect(spy).toHaveBeenCalledTimes(steps);
      spy.mockClear();expect(restoreMatch(JSON.stringify(state))).toEqual(state);expect(spy).not.toHaveBeenCalled();
      Object.assign(restored,{gold:restored.gold+1});expect(restoreMatch(state)).toEqual(state);
      const bad=structuredClone(state);Object.assign(bad,{gold:bad.gold+1});
      spy.mockClear();const first=errorOf(()=>restoreMatch(bad));expect(first).toBe('Invalid Match save: preparation-ledger-gold');
      // The independently verified completed history remains reusable; current gold is still rejected each time.
      expect(spy).not.toHaveBeenCalled();
      spy.mockClear();expect(errorOf(()=>restoreMatch(bad))).toBe(first);expect(spy).not.toHaveBeenCalled();
      const ledger=structuredClone(state);Object.assign(ledger.preparationLedger.commands.find(c=>c.name==='stepMatch')!,{repeats:steps-1});
      spy.mockClear();expect(errorOf(()=>restoreMatch(ledger))).not.toBe('accepted');expect(spy.mock.calls.length).toBeGreaterThan(0);
    } finally {spy.mockRestore();}
  });
  it('collection keys include every battle byte and never borrow a standalone-state cache on a miss',async()=>{
    const envelope=completed(73422);restoreMatch(envelope.match);
    const spy=vi.spyOn(api,'stepMatch');
    try {
      await validateBattleCollection(envelope);expect(spy.mock.calls.length).toBeGreaterThan(0);
      spy.mockClear();await validateBattleCollection(structuredClone(envelope));expect(spy).not.toHaveBeenCalled();
      const getterInput=structuredClone(envelope),wrongMatch=structuredClone(envelope.match);
      Object.assign(wrongMatch,{gold:wrongMatch.gold+1});let reads=0;
      Object.defineProperty(getterInput,'match',{enumerable:true,get(){return ++reads===1?envelope.match:wrongMatch;}});
      await expect(validateBattleCollection(getterInput)).rejects.toThrow('Invalid Match save: current settlement totals');
      const bad=structuredClone(envelope);Object.assign(bad.battles[0],{stateHash:bad.battles[0].stateHash+'x'});
      spy.mockClear();await expect(validateBattleCollection(bad)).rejects.toThrow('内容校验');expect(spy.mock.calls.length).toBeGreaterThan(0);
      spy.mockClear();await expect(validateBattleCollection(bad)).rejects.toThrow('内容校验');expect(spy.mock.calls.length).toBeGreaterThan(0);
      Object.assign(envelope.match,{gold:envelope.match.gold+1});
      await expect(validateBattleCollection(envelope)).rejects.toThrow('Invalid Match save: current settlement totals');
    } finally {spy.mockRestore();}
  });
});

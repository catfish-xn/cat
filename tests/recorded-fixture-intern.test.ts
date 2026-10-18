import {expect,it,vi} from 'vitest';
vi.mock('node:crypto',async original=>({
  ...await original<typeof import('node:crypto')>(),
  createHash:()=>({update:()=>({digest:()=> 'forced-collision'})}),
}));
import {internRecordedBattles} from './fixtures/recorded-fixture';
import {BattleHistory,validateBattleRecord} from '../src/replay/history';
import {startMatchCombat,stepMatch} from '../src/simulation/match';
import {readyMatch} from './match-helpers';

it('keeps distinct real recordings distinct even when every bucket digest collides',()=>{
  let state=readyMatch(42);const history=new BattleHistory('intern-a');
  const observe=(next:ReturnType<typeof stepMatch>)=>{
    history.observe({before:state,after:next.state,events:next.events.filter(e=>e.domain==='combat'),reason:state.combat?'tick':'command'});
    state=next.state;
  };
  const started=startMatchCombat(state);if(!started.ok)throw Error(started.reason);observe(started);
  while(state.phase==='combat')observe(stepMatch(state));
  const a=history.completedRecords[0],b={...structuredClone(a),runId:'intern-b'};
  const [first,second,again]=internRecordedBattles([a,b,a]);
  expect(first).not.toBe(second);expect(again).toBe(first);
  expect([first.runId,second.runId]).toEqual(['intern-a','intern-b']);
  expect(validateBattleRecord(first,[]).terminal).toEqual(state.combat);
  expect(validateBattleRecord(second,[]).terminal).toEqual(state.combat);
});

import { expect, it } from 'vitest';
import { reachRound } from './match-helpers';
import { snapshotForBattle } from '../src/simulation/two-sided-snapshot';
import { compileBattle, startTwoSidedBattle, proposeSettlement } from '../src/simulation/two-sided-battle';
import { toCombatReplay, startCombatReplay } from '../src/simulation/combat-replay-view';
import currentIdentity from './v20-traits-content-baseline.json';

function input(){
  const base=reachRound('2-1'),units=[{id:'unit-1',definitionId:'lux',team:'player' as const,starLevel:3 as const,location:{kind:'board' as const,cell:{col:0,row:4}}}];
  const state={...base,items:[],temporaryEquipment:[],augments:[],gold:0,preparation:{...base.preparation,units},
    anomalyBinding:{definitionId:'avarice-incarnate',unitId:'unit-1',choiceId:'d11-bank',boundRound:base.round}};
  const other={...state,anomalyBinding:null,preparation:{...state.preparation,units:units.map(u=>({...u,definitionId:'irelia',starLevel:3 as const}))}};
  return compileBattle(snapshotForBattle(state,'A'),snapshotForBattle(other,'B'),42,{battleId:'d11-bank-samples'});
}
it('a resumable online task consumes live bank samples, replays the exact same ledger and keeps bank values private',()=>{
  const frozen=input(),task=startTwoSidedBattle(frozen,{captureReplay:true}),original=JSON.stringify(frozen);
  task.sampleBankGold('A',50);expect(task.advance(1)).toBeNull();
  task.sampleBankGold('A',0);expect(task.advance(1)).toBeNull();
  task.sampleBankGold('A',20);
  const result=task.advance(1201)!;expect(result).toBeTruthy();
  expect(result.bankSamples).toEqual([{tick:0,team:'player',liveGold:50},{tick:1,team:'player',liveGold:0},{tick:2,team:'player',liveGold:20}]);
  expect(proposeSettlement(result).a.battleId).toBe(frozen.battleId);
  const replay=toCombatReplay(JSON.parse(JSON.stringify(result)));
  expect(replay).toEqual(task.replay());
  const sliced=startCombatReplay(result);let completed=null;
  for(let n=0;n<1201&&!completed;n++)completed=sliced.advance(1);
  expect(completed).toEqual(replay);
  expect(JSON.stringify(replay)).not.toMatch(/liveGold|bankSamples|currentItemBankGold|openingItemBankGold/);
  expect(JSON.stringify(frozen)).toBe(original);
  expect(()=>task.sampleBankGold('A',30)).toThrow('wrong-phase');
  const forged=structuredClone(result);Object.assign(forged.bankSamples![0],{liveGold:0});
  expect(()=>proposeSettlement(forged)).toThrow();
  expect(()=>toCombatReplay(forged)).toThrow('replay-divergence');
  // Keep the historical identity gate, after exercising live-bank/replay behavior
  // so the pending v15 baseline migration cannot mask an integration regression.
  expect(frozen.a.contentDigest).toBe(currentIdentity.contentDigest);
});
it('rejects invalid bank authority and chronology, and identical samples remain inert',()=>{
  const task=startTwoSidedBattle(input());
  for(const [seat,gold] of [['foreign',10],['A',-1],['A',0.5],['A',Infinity]] as const)expect(()=>task.sampleBankGold(seat,gold)).toThrow('invalid-bank-sample');
  task.sampleBankGold('A',0);
  const result=task.advance(1201)!;expect(result.bankSamples).toBeUndefined();
  expect(()=>toCombatReplay({...result,bankSamples:[{tick:result.terminal.tick,team:'player',liveGold:20}]})).toThrow('bank samples');
});

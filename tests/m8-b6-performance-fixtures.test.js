import { describe, expect, it } from 'vitest';
import { createMatch, deployMatchUnit, nextRound, startMatchCombat } from '../src/simulation/match';
import { BattleHistory, validateBattleCollection } from '../src/replay';
import { validateFile, exportFile } from '../src/persistence/format';
import { boundedImportEnvelope } from '../scripts/b6-performance-fixtures.cjs';

// Small real-command unit vectors for the collector, not fabricated performance evidence.
function fixture() {
  let state=createMatch(42);const history=new BattleHistory('bounded-collector-test');
  const command=operation=>{const before=state,result=operation(state);expect(result.ok,result.reason).toBe(true);state=result.state;
    history.observe({before,after:state,events:result.events.filter(event=>event.domain==='combat'),reason:'command'});};
  command(state=>deployMatchUnit(state,'unit-1',{kind:'bench',slot:0}));command(startMatchCombat);
  return {history,read:()=>state,command};
}
describe('B6 bounded performance fixture capture',()=>{
  it('captures the complete actual battle-end save through the real import path',async()=>{
    const f=fixture(),match=f.read(),records=f.history.completedRecords;
    const envelope=boundedImportEnvelope(match,records,1,'bounded-collector-test');
    expect(envelope.match).toBe(match);expect(envelope.battles).toBe(records);expect(envelope.currentBattle).toBeNull();
    expect(await validateFile(exportFile(envelope),validateBattleCollection)).toEqual(envelope);
  });
  it('rejects truncating a later match to an earlier capacity-sized record list',()=>{
    const f=fixture();f.command(state=>nextRound(state,state.round));f.command(startMatchCombat);
    expect(f.read().roundResults).toHaveLength(2);
    expect(()=>boundedImportEnvelope(f.read(),f.history.completedRecords.slice(0,1),1,'bounded-collector-test')).toThrow('complete history');
    expect(()=>boundedImportEnvelope(f.read(),f.history.completedRecords,1,'bounded-collector-test')).toThrow('capacity');
  });
  it('rejects a preparation state instead of relabeling it as a settled full save',()=>{
    const f=fixture();f.command(state=>nextRound(state,state.round));
    expect(()=>boundedImportEnvelope(f.read(),f.history.completedRecords,1,'bounded-collector-test')).toThrow('actual battle-end');
  });
});

// Synthetic metadata vectors exercise fail-closed gate validation only; they are
// never written to artifacts or treated as real performance measurements.
import { assertDeferredPerformanceGate, assertBoundedImportGate, RESTORATION_ISSUE } from '../scripts/b6-performance-gates.cjs';
describe('B6 explicit performance evidence boundary',()=>{
  it('rejects fabricated zero-ms or passed measurements for a deferred gate',()=>{
    const summary={status:'skipped',owner:'B9',restorationIssue:RESTORATION_ISSUE};
    const gate={name:'completeImport',metric:'max',ceiling:30000,...summary};
    expect(()=>assertDeferredPerformanceGate(gate,summary,'completeImport','max',30000)).not.toThrow();
    for(const extra of [{actual:0},{passed:true},{samples:[]}])expect(()=>assertDeferredPerformanceGate({...gate,...extra},summary,'completeImport','max',30000)).toThrow();
    expect(()=>assertDeferredPerformanceGate({...gate,name:'firstSeek'},summary,'firstSeek','max',30000)).toThrow('unknown');
  });
  it('requires three actual bounded samples, original ceiling and the complete public path',()=>{
    const fixture={battles:30,bytes:123,build:'unit-vector',roundId:'6-3'};
    const result={...fixture,sourceBuild:fixture.build,notEquivalentToFullPayload:true,restorationIssue:RESTORATION_ISSUE,
      phase:'settlement',samples:[1,2,3],metric:'max',actual:3,ceiling:30000,passed:true,
      completeObjectEqual:true,nativeReadbackEqual:true,coldDatabaseFirstActivation:true,
      path:['exportFile','validateFile','validateBattleCollection','MatchSession','BattleHistory','SaveRepository.activate']};
    expect(()=>assertBoundedImportGate(result,fixture,30,30000)).not.toThrow();
    for(const mutate of [value=>value.samples.pop(),value=>value.actual=0,value=>value.ceiling=40000,value=>value.notEquivalentToFullPayload=false,
      value=>value.nativeReadbackEqual=false,value=>value.path.splice(2,1),value=>value.battles=33,value=>value.samples[1]=NaN]){
      const invalid=structuredClone(result);mutate(invalid);expect(()=>assertBoundedImportGate(invalid,fixture,30,30000)).toThrow();
    }
  });
});

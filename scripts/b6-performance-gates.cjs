const assert=require('node:assert/strict');
const RESTORATION_ISSUE='https://github.com/catfish-xn/cat/issues/23';
const DEFERRED_PERFORMANCE_GATES=Object.freeze(['capture','write','activation','completeImport']);
function assertDeferredPerformanceGate(gate,summary,name,metric,ceiling){
 assert(DEFERRED_PERFORMANCE_GATES.includes(name),'unknown deferred performance gate');
 assert.deepEqual(gate,{name,metric,ceiling,status:'skipped',owner:'B9',restorationIssue:RESTORATION_ISSUE});
 assert.deepEqual(summary,{status:'skipped',owner:'B9',restorationIssue:RESTORATION_ISSUE});
}
function assertBoundedImportGate(result,fixture,maxBattles,ceiling){
 assert.equal(result.notEquivalentToFullPayload,true,'bounded payload must not stand in for the original full route');
 assert.equal(result.restorationIssue,RESTORATION_ISSUE);assert.equal(result.battles,maxBattles);
 assert.equal(result.battles,fixture.battles);assert.equal(result.bytes,fixture.bytes);assert.equal(result.sourceBuild,fixture.build);
 assert.equal(result.roundId,fixture.roundId);assert.equal(result.phase,'settlement');
 assert.equal(result.samples.length,3,'bounded complete import requires three genuine samples');
 assert(result.samples.every(value=>Number.isFinite(value)&&value>=0));
 assert.equal(result.metric,'max');assert.equal(result.actual,Math.max(...result.samples));
 assert.equal(result.ceiling,ceiling);assert.equal(result.passed,true);assert(result.actual<=ceiling);
 assert.equal(result.completeObjectEqual,true);assert.equal(result.nativeReadbackEqual,true);assert.equal(result.coldDatabaseFirstActivation,true);
 assert.deepEqual(result.path,['exportFile','validateFile','validateBattleCollection','MatchSession','BattleHistory','SaveRepository.activate']);
}
module.exports={RESTORATION_ISSUE,DEFERRED_PERFORMANCE_GATES,assertDeferredPerformanceGate,assertBoundedImportGate};

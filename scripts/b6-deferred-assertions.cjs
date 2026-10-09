const assert = require('node:assert/strict');
/* User-approved B6-only dependency boundary. Keep each original assertion body
 * visible; this helper NEVER executes it or reports it as passed. B8/B9 must
 * remove the matching deferral and rerun the original gate after integration. */
function skipB6Dependency(report, owner, id, reason, assertion) {
  if (!['B8', 'B9'].includes(owner) || !id || !reason || typeof assertion !== 'function')
    throw new Error('B6 deferral requires an explicit B8/B9 owner, ID, reason and preserved assertion body');
  const entry = { status: 'skipped', owner, id, reason };
  (report.skipped ??= []).push(entry);
  console.log(`SKIPPED [${owner}] ${id}: ${reason}`);
}
module.exports = { skipB6Dependency };

// Test boundary, not an application limit change. A domain-backed test requires
// this to equal the current exported MAX_BATTLE_RECORDS; only B9 may move it.
const B6_APPLICATION_CAPACITY = 30;
function b6DeferredBrowserRounds(route) {
  const rounds = route.rounds.slice(B6_APPLICATION_CAPACITY);
  const ids = rounds.map(round => round.roundDefinitionId);
  if (JSON.stringify(ids) !== JSON.stringify(['6-5', '6-6', '6-7']))
    throw new Error(`Unapproved B9 browser omission set: ${JSON.stringify(ids)}`);
  return rounds;
}
module.exports.B6_APPLICATION_CAPACITY = B6_APPLICATION_CAPACITY;
module.exports.b6DeferredBrowserRounds = b6DeferredBrowserRounds;

function validateB6BrowserBoundary(manifest,route){
 const tail=b6DeferredBrowserRounds(route),deferred=tail.map(round=>round.roundDefinitionId);
 const completed=route.rounds.slice(0,B6_APPLICATION_CAPACITY).map(round=>round.roundDefinitionId);
 assert.deepEqual(manifest.deferredBrowserRounds,deferred,'only the exact approved B9 tail may be omitted');
 assert.deepEqual(manifest.completedBrowserRounds,completed,'every capacity-supported browser battle must execute');
 assert.equal(manifest.applicationBoundary?.completedBattles,B6_APPLICATION_CAPACITY);
 assert.equal(manifest.applicationBoundary?.roundId,'6-5');assert.equal(manifest.applicationBoundary?.phase,'preparation');
 assert.equal(manifest.fullApplicationRoutePassed,false,'deferred application tail cannot be called a full browser pass');
 assert.deepEqual(manifest.skipped.map(entry=>[entry.status,entry.owner,entry.id]),[
  ...deferred.map(id=>['skipped','B9',`browser-round-${id}`]),['skipped','B9','browser-complete-application-route'],
 ],'unknown/missing browser skips are not authorized');
 const firstOmitted=route.actions.findIndex(entry=>entry.command.type==='start'&&entry.round===tail[0].round);
 assert(firstOmitted>=0,'full domain route must contain the first omitted battle');
 assert.equal(manifest.checkpoints.length,firstOmitted,'all command checkpoints before the exact boundary must be present');
 for(let i=0;i<firstOmitted;i++)assert.deepEqual(manifest.checkpoints[i],{index:route.actions[i].index,stateHash:route.actions[i].afterHash},'browser command checkpoint must match its domain route');
 assert.equal(manifest.applicationBoundary.stateHash,route.actions[firstOmitted].beforeHash,'boundary state must equal the first omitted start preparation');
 return new Set(tail.map(round=>round.round));
}

module.exports.validateB6BrowserBoundary = validateB6BrowserBoundary;

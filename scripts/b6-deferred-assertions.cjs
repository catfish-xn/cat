const assert = require('node:assert/strict');
const { hash } = require('./m4-evidence.cjs');
/* B6 introduced explicit B8/B9 deferrals here (skipB6Dependency and a 30-battle browser boundary).
 * B8 and B9 restored every deferred assertion, so the deferral helper is removed; only the strict
 * full-route validator remains. */

// B9: the application holds the whole catalog, so the browser route has no omitted tail. Every
// command checkpoint of the complete domain route must be observed and the route must end in the
// real final state; any skip, boundary or partial-route claim is rejected.
function validateFullBrowserRoute(manifest,route){
 assert.equal(manifest.fullApplicationRoutePassed,true,'browser job must complete the full application route');
 assert.deepEqual(manifest.skipped??[],[],'no browser skip is authorized after B9');
 for(const key of ['deferredBrowserRounds','applicationBoundary'])assert.equal(manifest[key],undefined,`no ${key} after B9`);
 assert.equal(manifest.checkpoints.length,route.actions.length,'every command checkpoint of the complete route must be present');
 for(let i=0;i<route.actions.length;i++){
  const action=route.actions[i];let stateHash=action.afterHash;
  // The native runner observes Start after the normal-time battle settles;
  // action.afterHash instead identifies the immediate command result (tick 0).
  if(action.command.type==='start'){
   const rounds=route.rounds.filter(round=>round.round===action.round);
   assert.equal(rounds.length,1,'each observed Start must have exactly one completed domain battle');
   stateHash=hash(rounds[0].after);
   assert.equal(rounds[0].stateHash,stateHash,'completed domain state hash must match its full state');
  }
  assert.deepEqual(manifest.checkpoints[i],{index:action.index,stateHash},'browser command checkpoint must match its observed domain phase');
 }
}

module.exports = { validateFullBrowserRoute };

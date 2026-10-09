/* B6 changes round identities, opening resources, shop/battle streams and schedule.
 * This is trajectory recording, not acceptance. Public victory/build/15-component
 * assertions remain in tests/m5-route.test.ts and may fail until B7/B8/B9 integration.
 * The pre-B6 golden is preserved byte-for-byte; independent oracle.cjs checks every
 * command, RNG stream and settlement against handwritten OPENING policy. */
const fs=require('node:fs'),assert=require('node:assert/strict'),generate=require('./generate-m5-route.cjs');
(async()=>{
 const file='tests/fixtures/m5/full-match-golden.json',archive='tests/fixtures/m5/full-match-golden.pre-m8-b6.json';
 assert(fs.existsSync(archive),'Archive the previous golden before recording B6');
 const old=JSON.parse(fs.readFileSync(archive,'utf8')),next=structuredClone(old),observations={};
 for(const build of Object.keys(old.routes)) {
  const route=await generate({build,seed:42});
  assert.deepEqual([route.initial.roundDefinitionId,route.initial.gold,route.initial.level,route.initial.xp,route.initial.nextUnitSerial],['1-2',0,1,0,2]);
  assert.deepEqual(route.ledger.rounds.slice(0,3).map(r=>[r.roundId,r.incomeBreakdown.base,r.xpRequested]),[['1-2',2,2],['1-3',3,2],['1-4',5,0]]);
  next.routes[build].versions=Object.fromEntries(Object.keys(old.routes[build].versions).map(k=>[k,route.initial[k]]));
  next.routes[build].commands=route.actions.map(a=>a.command);
  next.routes[build].rounds=route.rounds.map(r=>({round:r.round,stateHash:r.stateHash,eventsHash:r.eventsHash}));
  observations[build]={outcome:route.summary.outcome,roundId:route.final.roundDefinitionId,battles:route.rounds.length,
   formedBattles:route.summary.formedBattles,componentGrants:route.final.scheduleReceipts.reduce((n,r)=>n+r.itemIds.length,0)};
  console.log(build,JSON.stringify(observations[build]));
 }
 next.note=(old.note??'')+' B6 roundRulesVersion=m8-b6-round-opening-v1: approved 38-round directory and opening economy installed. New commands and RNG trajectories are recorded, not compared as unchanged to M7/B5. Stage1 enemies are explicit existing-neutral placeholders pending B7; all PvE loot, two starting components and Maddie/Lux grants remain pending B8. B9 full 33-battle application capacity is not implemented. This golden records observed trajectories, including defeat; it does not approve or weaken the unchanged victory/build/15-component acceptance conditions.';
 next.b6ObservedOutcomes=observations;
 fs.writeFileSync(file,JSON.stringify(next,null,2)+'\n');
 fs.writeFileSync('docs/evidence/m8-b6/route-observations.json',JSON.stringify(observations,null,2)+'\n');
})().catch(e=>{console.error(e);process.exitCode=1;});

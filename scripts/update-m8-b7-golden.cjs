/* B7 intentionally replaces all eight PvE rosters, their mechanics and content digest.
 * Preserve the exact accepted baseline; record new trajectories only after the independent
 * command/economy oracle AND unchanged victory/38-round/33-battle conditions pass.
 * This does not alter assert-golden, route generation, skips or CI/budget policy. */
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const generate=require('./generate-m5-route.cjs');
const archive='tests/fixtures/m5/full-match-golden.pre-m8-b7.json';
const source=fs.readFileSync(archive);
assert.equal(crypto.createHash('sha256').update(source).digest('hex'),'983806603e27718f263d280c0a4fd42740226bca1e56163f9b5d214ef8ec5fac','947 baseline golden must be preserved exactly');
(async()=>{
 const old=JSON.parse(source),next=structuredClone(old),observations={};
 for(const build of Object.keys(old.routes)) {
  const route=await generate({build,seed:42,retainStates:true});
  assert.equal(route.summary.outcome,'victory');assert.equal(route.summary.round,38);
  assert.equal(route.ledger.rounds.length,38);assert.equal(route.rounds.length,33);
  assert.deepEqual([route.initial.roundDefinitionId,route.initial.gold,route.initial.level,route.initial.xp],['1-2',0,1,0]);
  assert.deepEqual(route.ledger.rounds.slice(0,3).map(r=>[r.roundId,r.incomeBreakdown.base,r.xpRequested]),[['1-2',2,2],['1-3',3,2],['1-4',5,0]]);
  const expected={'1-2':2,'1-3':3,'1-4':4,'2-7':3,'3-7':5,'4-7':6,'5-7':1,'6-7':1};
  for(const [id,count] of Object.entries(expected)) {
   const combat=route.rounds.find(r=>r.roundDefinitionId===id);
   assert(combat,`Missing real neutral encounter ${id}`);
   const enemies=combat.after.combat.units.filter(u=>u.team==='enemy');
   assert.equal(enemies.length,count);assert(enemies.every(u=>u.unitKind==='neutral' && u.maxMana===0 && u.baseCritChanceBps===2500 && u.baseCritMultiplierBps===14000));
  }
  next.routes[build].versions=Object.fromEntries(Object.keys(old.routes[build].versions).map(k=>[k,route.initial[k]]));
  assert.deepEqual(route.actions.map(a=>a.command),old.routes[build].commands,'B7 does not change the accepted route commands');
  next.routes[build].commands=route.actions.map(a=>a.command);
  next.routes[build].rounds=route.rounds.map(r=>({round:r.round,stateHash:r.stateHash,eventsHash:r.eventsHash}));
  observations[build]={outcome:route.summary.outcome,roundId:route.final.roundDefinitionId,battles:route.rounds.length,commands:route.actions.length,
   changedRoundEventHashes:route.rounds.filter(r=>old.routes[build].rounds.find(p=>p.round===r.round)?.eventsHash!==r.eventsHash).map(r=>r.round),
   formedBattles:route.summary.formedBattles,componentGrants:route.final.scheduleReceipts.reduce((n,r)=>n+r.itemIds.length,0)};
  console.log(build,JSON.stringify(observations[build]));
 }
 next.note=(old.note??'')+' B7 supersedes old placeholder observations: all eight approved neutral encounters now execute in Match. Their changed damage/crit/RNG trajectories intentionally invalidate old event/state hashes. The original 947 golden is archived byte-for-byte. Recording requires the unchanged independent command/economy oracle plus victory/38 rounds/33 battles and real B7 roster checks; this is not proof of B8 loot, complete builds, B9 capacity or blanket balance. Existing deferred assertions remain unchanged.';
 next.b7ObservedOutcomes=observations;
 fs.writeFileSync('tests/fixtures/m5/full-match-golden.json',JSON.stringify(next,null,2)+'\n');
 fs.mkdirSync('docs/evidence/m8-b7/golden',{recursive:true});
 fs.writeFileSync('docs/evidence/m8-b7/golden/route-observations.json',JSON.stringify(observations,null,2)+'\n');
})().catch(e=>{console.error(e);process.exitCode=1;});

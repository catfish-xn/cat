/* B4 audit: content metadata/timing revision. Independent R1–R5 counterexamples
 * are authoritative for changed effects. Existing four routes use B3 equipment;
 * command sequences and complete event hashes must stay identical. */
const fs=require('node:fs'),assert=require('node:assert/strict'),generate=require('./generate-m5-route.cjs');
(async()=>{
 const file='tests/fixtures/m5/full-match-golden.json',old=JSON.parse(fs.readFileSync('tests/fixtures/m5/full-match-golden.pre-m8-b4-audit.json','utf8')),next=structuredClone(old);
 const counts=commands=>commands.reduce((r,c)=>(r[c.type]=(r[c.type]??0)+1,r),{});
 for(const build of Object.keys(old.routes)) {
  const route=await generate({build,seed:42});
  next.routes[build].versions=Object.fromEntries(Object.keys(old.routes[build].versions).map(k=>[k,route.initial[k]]));
  next.routes[build].commands=route.actions.map(a=>a.command);
  assert.deepEqual(next.routes[build].commands,old.routes[build].commands,'audit keeps every existing command unchanged');
  assert.deepEqual(counts(next.routes[build].commands),counts(old.routes[build].commands));
  next.routes[build].rounds=route.rounds.map(r=>({round:r.round,stateHash:r.stateHash,eventsHash:r.eventsHash}));
  assert.equal(route.rounds.length,30,'same legacy campaign, B6 not enabled');
  assert.deepEqual(next.routes[build].rounds.map(r=>r.eventsHash),old.routes[build].rounds.map(r=>r.eventsHash),'B3 equipment event trajectories unchanged');
  console.log(build,JSON.stringify(route.summary));
 }
 next.note=(old.note??'')+' B4 audit R1–R5/R3b: equipment catalog v3 includes a complete once-per-combat consumption partition; content digest and state hashes change; all four command sequences and complete per-round event hashes remain identical. Independent audit counterexamples prove corrected new-item behavior.';
 fs.writeFileSync(file,JSON.stringify(next,null,2)+'\n');
})().catch(e=>{console.error(e);process.exitCode=1;});

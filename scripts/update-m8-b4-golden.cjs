/* B4 explicit catalogue/pool revision. Independent item vectors are in m8-b4-*.test.ts.
 * The original B3 trajectories remain archived. Economics/RNG use the updated
 * independent eight-component oracle; operations and counts are compared below. */
const fs=require('node:fs'),assert=require('node:assert/strict'),generate=require('./generate-m5-route.cjs');
(async()=>{
 const file='tests/fixtures/m5/full-match-golden.json',old=JSON.parse(fs.readFileSync('tests/fixtures/m5/full-match-golden.pre-m8-b4.json','utf8')),next=structuredClone(old);
 const counts=commands=>commands.reduce((r,c)=>(r[c.type]=(r[c.type]??0)+1,r),{});
 for(const build of Object.keys(old.routes)) {
  const route=await generate({build,seed:42});
  next.routes[build].versions=Object.fromEntries(Object.keys(old.routes[build].versions).map(k=>[k,route.initial[k]]));
  next.routes[build].commands=route.actions.map(a=>a.command);
  assert.deepEqual(counts(next.routes[build].commands),counts(old.routes[build].commands),'same ordinary operation counts; reward identities may change timing');
  next.routes[build].rounds=route.rounds.map(r=>({round:r.round,stateHash:r.stateHash,eventsHash:r.eventsHash}));
  assert.equal(route.rounds.length,30,'same legacy campaign, B6 not enabled');
  console.log(build,JSON.stringify(route.summary));
 }
 next.note=(old.note??'')+' B4: eight-component API-sorted pool; full 36 recipes. Random reward identity and component-choice order changed per IF-POOL; gameplay operation adjustments recorded in docs/M8_B4_STATUS.md. Item numbers proven separately.';
 fs.writeFileSync(file,JSON.stringify(next,null,2)+'\n');
})().catch(e=>{console.error(e);process.exitCode=1;});

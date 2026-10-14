/* Single canonical identity freeze, public-route recording, and explicit legacy trajectory comparison. */
const fs=require('node:fs'),assert=require('node:assert/strict'),{createHash}=require('node:crypto'),zlib=require('node:zlib');
const {run}=require('./generate-m5-route.cjs');
const sha=x=>createHash('sha256').update(typeof x==='string'||Buffer.isBuffer(x)?x:JSON.stringify(x)).digest('hex');
const randomState=state=>({seed:state.seed,shop:state.rngState,choice:state.choiceRngState,reward:state.rewardRngState,battleSeed:state.battleSeedRngState,equipment:state.equipmentState.equipment,reforge:state.reforgeState,layout:state.m8.loot.layoutBinding.mode==='solo'?state.m8.loot.layoutBinding.layout.rng:null,loot:state.m8.loot.frozen.rng,combat:state.combat?{state:state.combat.rngState,draws:state.combat.rngDraws}:null});
async function main(){
 const {createServer}=await import('vite');const server=await createServer({configFile:false,server:{middlewareMode:true,ws:false},appType:'custom',logLevel:'error'});
 try {
 const api=await server.ssrLoadModule('/src/simulation/match.ts'),ser=await server.ssrLoadModule('/src/simulation/serialization.ts');
 const {CONTENT_DIGEST}=await server.ssrLoadModule('/src/simulation/content/index.ts');const {LOOT_REPLAY_DIGEST}=await server.ssrLoadModule('/src/simulation/loot-freeze.ts');
 const previous=JSON.parse(fs.readFileSync('tests/t13-content-baseline.json'));
 const identities=[[previous.contentDigest,CONTENT_DIGEST],[previous.lootReplayDigest,LOOT_REPLAY_DIGEST],['s13-rules-gap-v1','s13-rules-gap-v2'],['s13-14.24b-rules-gap-v1','s13-14.24b-rules-gap-v2']];
 const normalize=s=>JSON.parse(JSON.stringify(s),(_,v)=>identities.find(([old])=>v===old)?.[1]??v);
 const initial=api.createMatch(42),steps=[];let result=api.startMatchCombat(initial);steps.push(result);
 while(result.state.phase==='combat'){result=api.stepMatch(result.state);steps.push(result);}
 const traceHashes={state:sha(steps.map(s=>s.state)),events:sha(steps.map(s=>s.events)),rng:sha(steps.map(s=>randomState(s.state)))};
 assert.equal(traceHashes.events,previous.traceHashes.events);assert.equal(traceHashes.rng,previous.traceHashes.rng);
 assert.throws(()=>ser.restoreMatch({...initial,contentDigest:previous.contentDigest}));
 const baseline={contentDigest:CONTENT_DIGEST,lootReplayDigest:LOOT_REPLAY_DIGEST,rulesVersion:initial.rulesVersion,schemaVersion:7,previousContentDigest:previous.contentDigest,previousLootReplayDigest:previous.lootReplayDigest,traceHashes,reason:'P3-A overtime17; P4-A nine levels unchanged; P5-A frozen cumulative weights unchanged. Same serialization/protocol; old digest export-only.'};
 fs.writeFileSync('tests/p3p4p5-content-baseline.json',JSON.stringify(baseline,null,2)+'\n');
 const oldPath='tests/fixtures/m5/full-match-golden.t13.json',oldBytes=fs.readFileSync(oldPath),old=JSON.parse(oldBytes);
 const golden={note:'P3/P4/P5 combined release. Public commands rerun; ordinary route gameplay and all recorded states equal T13 after four explicit identity replacements.',routes:{}};
 const audit={baseline,identityReplacements:identities,previousGoldenSha256:sha(oldBytes),driverSha256:sha(fs.readFileSync('scripts/generate-m5-route.cjs')),oracleSha256:sha(fs.readFileSync('tests/fixtures/m5/oracle.cjs')),builds:{}};
 for(const build of ['cannon','sniper','mage','sniper-caitlyn']){
  const states=[];const route=await run(api,{build,seed:42,onStep:(before,result,command)=>{if(command?.type==='start')states.push(before);if(before.phase==='combat'&&result.state.phase!=='combat')states.push(result.state);}});states.push(route.final);
  assert.equal(route.summary.outcome,'victory');assert.equal(route.summary.round,38);assert.equal(route.rounds.length,33);
  assert.deepEqual(route.actions.map(a=>a.command),old.routes[build].commands,'ordinary/P4/P5 command transcript');
  assert.deepEqual(route.rounds.map(r=>r.eventsHash),old.routes[build].rounds.map(r=>r.eventsHash),'ordinary/P4/P5 event trajectory');
  let comparedStates=0,previousRecordingSha256=null;
  if(['cannon','sniper'].includes(build)){
   const bytes=fs.readFileSync(`tests/fixtures/t13-recorded-states/${build}.json.gz`),prior=JSON.parse(zlib.gunzipSync(bytes)).states;
   assert.equal(states.length,67);assert.deepEqual(states,normalize(prior),'every state field except explicit release identity');
   comparedStates=states.length;previousRecordingSha256=sha(bytes);
   for(const s of states)assert.deepEqual(ser.restoreMatch(ser.serializeMatch(s)),s);
   fs.mkdirSync('tests/fixtures/p3p4p5-recorded-states',{recursive:true});fs.writeFileSync(`tests/fixtures/p3p4p5-recorded-states/${build}.json.gz`,zlib.gzipSync(JSON.stringify({states})));
  }
  golden.routes[build]={versions:Object.fromEntries(['schemaVersion','rulesVersion','contentVersion','contentDigest','commandProtocolVersion','rngAlgorithm','tickMs'].map(k=>[k,route.initial[k]])),seed:42,commands:route.actions.map(a=>a.command),rounds:route.rounds.map(r=>({round:r.round,stateHash:r.stateHash,eventsHash:r.eventsHash}))};
  const summary={...route.summary};delete summary.tickTimingMs;delete summary.durationSeconds;
  audit.builds[build]={summary,comparedStates,previousRecordingSha256,commandsUnchanged:true,allRoundEventsUnchanged:true,ledger:route.ledger};console.log(JSON.stringify({build,comparedStates,commands:route.actions.length,rounds:route.rounds.length}));
 }
 assert.equal(sha(fs.readFileSync(oldPath)),audit.previousGoldenSha256);
 const output=JSON.stringify(golden,null,2)+'\n';audit.candidateSha256=sha(output);fs.writeFileSync('tests/fixtures/m5/full-match-golden.p3p4p5.json',output);
 fs.mkdirSync('docs/evidence/p3p4p5',{recursive:true});fs.writeFileSync('docs/evidence/p3p4p5/release-audit.json',JSON.stringify(audit,null,2)+'\n');
 console.log(JSON.stringify(baseline));
 }finally{await server.close();}
}main().catch(e=>{console.error(e);process.exitCode=1;});

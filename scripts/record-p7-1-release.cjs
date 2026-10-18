/* P7-1 identity release. Re-run real public offline routes and compare every prior
 * recorded field after the ONE content identity replacement. Original G2/P3/T13
 * golden files remain archived, never overwritten. */
const fs=require('node:fs'),assert=require('node:assert/strict'),zlib=require('node:zlib'),{createHash}=require('node:crypto');
const {run}=require('./generate-m5-route.cjs');
const record=(file,bytes)=>{if(process.argv.includes('--check'))assert.deepEqual(fs.readFileSync(file),Buffer.from(bytes),file);else fs.writeFileSync(file,bytes);};
const byteEvidence=(before,after)=>{const a=Buffer.from(before),b=Buffer.from(after);let offset=0;while(offset<Math.min(a.length,b.length)&&a[offset]===b[offset])offset++;return {previousBytes:a.length,currentBytes:b.length,previousSha256:sha(a),currentSha256:sha(b),byteEqual:a.equals(b),firstByteOffset:a.equals(b)?null:offset};};
const sha=x=>createHash('sha256').update(typeof x==='string'||Buffer.isBuffer(x)?x:JSON.stringify(x)).digest('hex');
const randomState=s=>({seed:s.seed,shop:s.rngState,choice:s.choiceRngState,reward:s.rewardRngState,battleSeed:s.battleSeedRngState,equipment:s.equipmentState.equipment,reforge:s.reforgeState,layout:s.m8.loot.layoutBinding.mode==='solo'?s.m8.loot.layoutBinding.layout.rng:null,loot:s.m8.loot.frozen.rng,combat:s.combat?{state:s.combat.rngState,draws:s.combat.rngDraws}:null});
async function main(){const {createServer}=await import('vite');const server=await createServer({configFile:false,server:{middlewareMode:true,ws:false},appType:'custom',logLevel:'error'});
try{
 const api=await server.ssrLoadModule('/tests/fixtures/recorded-match.ts'),ser=await server.ssrLoadModule('/tests/fixtures/history-evidence.ts'),content=await server.ssrLoadModule('/src/simulation/content/index.ts'),loot=await server.ssrLoadModule('/src/simulation/loot-freeze.ts');
 const previous=JSON.parse(fs.readFileSync('tests/g2-2-content-baseline.json')),oldGolden=JSON.parse(fs.readFileSync('tests/fixtures/m5/full-match-golden.g2-2.json'));
 const normalize=s=>JSON.parse(JSON.stringify(s),(_,v)=>v===previous.contentDigest?content.CONTENT_DIGEST:v);
 assert.notEqual(previous.contentDigest,content.CONTENT_DIGEST);assert.equal(previous.lootReplayDigest,loot.LOOT_REPLAY_DIGEST);
 let result=api.startMatchCombat(api.createMatch(42));const steps=[result];while(result.state.phase==='combat'){result=api.stepMatch(result.state);steps.push(result);}
 const traceHashes={state:sha(steps.map(s=>s.state)),events:sha(steps.map(s=>s.events)),rng:sha(steps.map(s=>randomState(s.state)))};
 assert.equal(traceHashes.events,previous.traceHashes.events);assert.equal(traceHashes.rng,previous.traceHashes.rng);
 assert.throws(()=>ser.restoreMatch({...api.createMatch(42),contentDigest:previous.contentDigest}));
 const baseline={contentDigest:content.CONTENT_DIGEST,lootReplayDigest:loot.LOOT_REPLAY_DIGEST,rulesVersion:api.createMatch(42).rulesVersion,contentVersion:api.createMatch(42).contentVersion,schemaVersion:7,firstBattle:{seed:42,ticks:result.state.combat.tick,events:steps.flatMap(s=>s.events).filter(e=>'tick' in e).length,result:result.state.combat.result,stateHash:content.digestContent(result.state.combat),eventHash:content.digestContent(steps.flatMap(s=>s.events).filter(e=>'tick' in e))},previousContentDigest:previous.contentDigest,previousLootReplayDigest:previous.lootReplayDigest,traceHashes,reason:'P7-1 free Irelia, bench-board-held placement and next-preparation merges; one content digest update. Offline routes unchanged except content identity; previous baselines archived.'};
 record('tests/p7-1-content-baseline.json',JSON.stringify(baseline,null,2)+'\n');
 const golden={note:'P7 public offline routes re-recorded; exact previous commands/events and all 134 archived state fields preserved except the explicit content identity.',routes:{}},audit={baseline,previousGoldenSha256:sha(fs.readFileSync('tests/fixtures/m5/full-match-golden.g2-2.json')),identityReplacements:[[previous.contentDigest,content.CONTENT_DIGEST]],builds:{}};
 for(const build of ['cannon','sniper','mage','sniper-caitlyn']){
  const states=[];const route=await run(api,{build,seed:42,onStep(before,result,command){if(command?.type==='start')states.push(before);if(before.phase==='combat'&&result.state.phase!=='combat')states.push(result.state);}});states.push(route.final);
  assert.equal(route.summary.outcome,'victory');assert.equal(route.rounds.length,33);assert.equal(route.summary.round,38);assert.deepEqual(route.actions.map(a=>a.command),oldGolden.routes[build].commands);assert.deepEqual(route.rounds.map(r=>r.eventsHash),oldGolden.routes[build].rounds.map(r=>r.eventsHash));
  let comparedStates=0,recording=null;
  if(['cannon','sniper'].includes(build)){
   const bytes=fs.readFileSync(`tests/fixtures/g2-2-recorded-states/${build}.json.gz`),prior=JSON.parse(zlib.gunzipSync(bytes)).states;
   assert.deepEqual(states,normalize(prior),'Every archived field, only explicit digest replacement');assert.equal(states.length,67);comparedStates=states.length;
   for(const state of states){const serialized=ser.serializeMatch(state);assert.deepEqual(ser.restoreMatch(serialized),state);assert.deepEqual(ser.restoreMatch(JSON.parse(serialized)),state);assert.equal(ser.serializeMatch(ser.restoreMatch(serialized)),serialized);}
   recording={...byteEvidence(zlib.gunzipSync(bytes),JSON.stringify({states})),normalizedBytesEqual:JSON.stringify({states})===JSON.stringify(normalize(JSON.parse(zlib.gunzipSync(bytes)))),textAndObjectRestoreEqual:true};
   fs.mkdirSync('tests/fixtures/p7-1-recorded-states',{recursive:true});record(`tests/fixtures/p7-1-recorded-states/${build}.json.gz`,zlib.gzipSync(JSON.stringify({states})));
  }
  golden.routes[build]={versions:Object.fromEntries(['schemaVersion','rulesVersion','contentVersion','contentDigest','commandProtocolVersion','rngAlgorithm','tickMs'].map(k=>[k,route.initial[k]])),seed:42,commands:route.actions.map(a=>a.command),rounds:route.rounds.map(r=>({round:r.round,stateHash:r.stateHash,eventsHash:r.eventsHash}))};
  audit.builds[build]={comparedStates,recording,commandsUnchanged:true,eventsUnchanged:true,recordedRounds:route.rounds.length,previousRecordingSha256:comparedStates?sha(fs.readFileSync(`tests/fixtures/g2-2-recorded-states/${build}.json.gz`)):null};console.log(JSON.stringify({build,comparedStates,passed:true}));
 }
 const bytes=JSON.stringify(golden,null,2)+'\n';audit.goldenBytes=byteEvidence(fs.readFileSync('tests/fixtures/m5/full-match-golden.g2-2.json'),bytes);record('tests/fixtures/m5/full-match-golden.p7-1.json',bytes);audit.candidateSha256=sha(bytes);fs.mkdirSync('docs/evidence/p7-1',{recursive:true});record('docs/evidence/p7-1/release-audit.json',JSON.stringify(audit,null,2)+'\n');
 const prior=JSON.parse(fs.readFileSync('tests/fixtures/g2-2-c19-seed-9-minimal.json'));const battle=await server.ssrLoadModule('/src/simulation/two-sided-battle.ts');
 const compiled=battle.compileBattle({...prior.a,contentDigest:content.CONTENT_DIGEST},{...prior.b,contentDigest:content.CONTENT_DIGEST},prior.battleSeed,{battleId:prior.battleId,mirrorOfSeatId:prior.mirrorOfSeatId??undefined});assert.deepEqual(compiled,normalize(prior),'C19 recompilation changes only identity');record('tests/fixtures/p7-1-c19-seed-9-minimal.json',JSON.stringify(compiled,null,2)+'\n');
 console.log(JSON.stringify({passed:true,contentDigest:content.CONTENT_DIGEST,traceHashes}));
}finally{await server.close();}}
main().catch(e=>{console.error(e);process.exitCode=1;});

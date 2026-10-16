/* G2 public-command re-recording. Historical P7 and earlier artifacts remain byte-for-byte intact. */
const fs=require('node:fs'),assert=require('node:assert/strict'),zlib=require('node:zlib'),{createHash}=require('node:crypto');
const {run}=require('./generate-m5-route.cjs');
const sha=x=>createHash('sha256').update(typeof x==='string'||Buffer.isBuffer(x)?x:JSON.stringify(x)).digest('hex');
const pending=new Map();
const record=(p,s)=>pending.set(p,Buffer.from(s));
const writeRecord=(p,s)=>{fs.mkdirSync(require('node:path').dirname(p),{recursive:true});if(process.argv.includes('--check'))assert.deepEqual(fs.readFileSync(p),Buffer.from(s),p);else fs.writeFileSync(p,s);};
const evidence=(a,b)=>{a=Buffer.from(a);b=Buffer.from(b);let first=0;while(first<Math.min(a.length,b.length)&&a[first]===b[first])first++;return {previousBytes:a.length,currentBytes:b.length,previousSha256:sha(a),currentSha256:sha(b),firstDifferentByte:first===a.length&&first===b.length?null:first};};
const sourceFiles=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?sourceFiles(`${dir}/${e.name}`):[`${dir}/${e.name}`]);
const randomState=s=>({seed:s.seed,mechanics:s.seatMechanics?{state:s.seatMechanics.hidden.progress.rngState,draws:s.seatMechanics.hidden.progress.rngDraws}:null,shop:s.rngState,choice:s.choiceRngState,reward:s.rewardRngState,battleSeed:s.battleSeedRngState,equipment:s.equipmentState.equipment,reforge:s.reforgeState,layout:s.m8.loot.layoutBinding.mode==='solo'?s.m8.loot.layoutBinding.layout.rng:null,loot:s.m8.loot.frozen.rng,combat:s.combat?{state:s.combat.rngState,draws:s.combat.rngDraws}:null});
async function main(){
 const {createServer}=await import('vite');const server=await createServer({configFile:false,server:{middlewareMode:true,ws:false},appType:'custom',logLevel:'error'});
 try{
  const sourceDigests=Object.fromEntries(sourceFiles('src/simulation').sort().map(p=>[p,sha(fs.readFileSync(p))]));
  const api=await server.ssrLoadModule('/src/simulation/match.ts'),ser=await server.ssrLoadModule('/src/simulation/serialization.ts');
  const {CONTENT_DIGEST,digestContent}=await server.ssrLoadModule('/src/simulation/content/index.ts'),{LOOT_REPLAY_DIGEST}=await server.ssrLoadModule('/src/simulation/loot-freeze.ts');
  const oldPath='tests/fixtures/m5/full-match-golden.opening-random.json',priorBytes=fs.readFileSync(oldPath),prior=JSON.parse(priorBytes),previous=require('../tests/opening-random-content-baseline.json');
  const initial=api.createMatch(42),steps=[];let r=api.startMatchCombat(initial);steps.push(r);while(r.state.phase==='combat'){r=api.stepMatch(r.state);steps.push(r);}
  const traceHashes={state:sha(steps.map(r=>r.state)),events:sha(steps.map(r=>r.events)),rng:sha(steps.map(r=>randomState(r.state)))};
  const baseline={contentDigest:CONTENT_DIGEST,lootReplayDigest:LOOT_REPLAY_DIGEST,rulesVersion:initial.rulesVersion,contentVersion:initial.contentVersion,schemaVersion:7,previousContentDigest:previous.contentDigest,previousLootReplayDigest:previous.lootReplayDigest,traceHashes,firstBattle:{seed:42,ticks:r.state.combat.tick,events:steps.flatMap(s=>s.events).filter(e=>'tick' in e).length,result:r.state.combat.result,stateHash:digestContent(r.state.combat),eventHash:digestContent(steps.flatMap(s=>s.events).filter(e=>'tick' in e))},reason:'G2-3: 60 canonical heroes, four fixed ranged forms,25 enabled origins and30 anomalies; baseline multiplayer38747c5 includes random1cost opening; integrated PR134 at19aa9f1.'};
  const audit={sourceDigests,integrationBaseCommit:'19aa9f1',baseCommit:'38747c595b7f4900133ca6e85c63b1bb48e83e2d',baseline,previousGoldenSha256:sha(priorBytes),driverSha256:sha(fs.readFileSync('scripts/generate-m5-route.cjs')),oracleSha256:sha(fs.readFileSync('tests/fixtures/m5/oracle.g2.cjs')),builds:{}};
  const golden={note:'G2-3 public commands rerun; no identity normalization or historical trajectory replacement.',routes:{}};
  for(const build of ['cannon','sniper','mage','sniper-caitlyn']){
   const states=[];const route=await run(api,{build,seed:42,onStep:(before,result,command)=>{if(command?.type==='start')states.push(before);if(before.phase==='combat'&&result.state.phase!=='combat')states.push(result.state);}});states.push(route.final);
   assert.equal(route.summary.outcome,'victory');assert.equal(route.summary.round,38);assert.equal(route.rounds.length,33);
   let recording=null;
   if(['cannon','sniper'].includes(build)){
    assert.equal(states.length,67);const texts=states.map(s=>JSON.stringify(s));
    for(const [n,s] of states.entries()){
     const serialized=ser.serializeMatch(s),fromText=ser.restoreMatch(serialized),fromObject=ser.restoreMatch(JSON.parse(serialized));
     assert.deepEqual(fromText,s,'restore original fields');
     assert.deepEqual(Buffer.from(JSON.stringify(fromText)),Buffer.from(JSON.stringify(fromObject)),'text/object restore bytes');
     assert.equal(ser.serializeMatch(fromText),serialized,'serialize/restore bytes');
    }
    const bytes=zlib.gzipSync(JSON.stringify({states}));record(`tests/fixtures/g2-3-recorded-states/${build}.json.gz`,bytes);
    recording={byteEvidence:evidence(fs.readFileSync(`tests/fixtures/opening-random-recorded-states/${build}.json.gz`),bytes),states:states.length,gzipSha256:sha(bytes),stateUtf8Sha256:sha(texts),textAndObjectRestoreBytesEqual:true,previousGzipSha256:sha(fs.readFileSync(`tests/fixtures/opening-random-recorded-states/${build}.json.gz`))};
   }
   const commands=route.actions.map(a=>a.command),old=prior.routes[build];
   const firstCommandDifference=commands.findIndex((c,n)=>JSON.stringify(c)!==JSON.stringify(old.commands[n]));
   const firstEventDifference=route.rounds.findIndex((r,n)=>r.eventsHash!==old.rounds[n]?.eventsHash);
   const summary={...route.summary};delete summary.tickTimingMs;delete summary.durationSeconds;
   golden.routes[build]={versions:Object.fromEntries(['schemaVersion','rulesVersion','contentVersion','contentDigest','commandProtocolVersion','rngAlgorithm','tickMs'].map(k=>[k,route.initial[k]])),seed:42,commands,rounds:route.rounds.map(r=>({round:r.round,stateHash:r.stateHash,eventsHash:r.eventsHash}))};
   audit.builds[build]={summary,recording,firstCommandDifference:firstCommandDifference<0?null:{index:firstCommandDifference,previous:old.commands[firstCommandDifference],current:commands[firstCommandDifference]},firstEventDifference:firstEventDifference<0?null:{round:route.rounds[firstEventDifference].round,previous:old.rounds[firstEventDifference].eventsHash,current:route.rounds[firstEventDifference].eventsHash},ledger:route.ledger};
   console.log(JSON.stringify({build,states:recording?.states??0,commands:commands.length,rounds:route.rounds.length}));
  }
  assert.equal(sha(fs.readFileSync(oldPath)),audit.previousGoldenSha256);
  const output=JSON.stringify(golden,null,2)+'\n';audit.candidateSha256=sha(output);audit.goldenByteEvidence=evidence(priorBytes,output);
  record('tests/fixtures/m5/full-match-golden.g2-3.json',output);record('tests/g2-3-content-baseline.json',JSON.stringify(baseline,null,2)+'\n');record('docs/evidence/g2-3/release-audit.json',JSON.stringify(audit,null,2)+'\n');for(const [p,hash] of Object.entries(sourceDigests))assert.equal(sha(fs.readFileSync(p)),hash,`Source changed during recording: ${p}`);for(const [p,b] of pending)writeRecord(p,b);console.log(JSON.stringify(baseline));
 }finally{await server.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});

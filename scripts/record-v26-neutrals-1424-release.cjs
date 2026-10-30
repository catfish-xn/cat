/* v26-neutrals-1424 public-command recording. All v25-online-rules and earlier epoch artifacts remain immutable. */
const fs=require('node:fs'),assert=require('node:assert/strict'),zlib=require('node:zlib'),{createHash}=require('node:crypto');
const {run}=require('./generate-m5-route.cjs');
const {routeOptions}=require('./v26-neutrals-1424-route.cjs');
const migration=require('./v26-neutrals-1424-fixture-audit.cjs'),baseCommit=migration.baselineCommit();
const sha=x=>createHash('sha256').update(typeof x==='string'||Buffer.isBuffer(x)?x:JSON.stringify(x)).digest('hex');
const pending=new Map();
const record=(p,s)=>pending.set(p,Buffer.from(s));
const writeRecord=(p,s)=>{fs.mkdirSync(require('node:path').dirname(p),{recursive:true});if(process.argv.includes('--check'))assert.deepEqual(fs.readFileSync(p),Buffer.from(s),p);else fs.writeFileSync(p,s);};
const evidence=(a,b)=>{a=Buffer.from(a);b=Buffer.from(b);let first=0;while(first<Math.min(a.length,b.length)&&a[first]===b[first])first++;return {previousBytes:a.length,currentBytes:b.length,previousSha256:sha(a),currentSha256:sha(b),firstDifferentByte:first===a.length&&first===b.length?null:first};};
const sourceFiles=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?sourceFiles(`${dir}/${e.name}`):[`${dir}/${e.name}`]);
const randomState=s=>({seed:s.seed,mechanics:s.seatMechanics?{state:s.seatMechanics.hidden.progress.rngState,draws:s.seatMechanics.hidden.progress.rngDraws}:null,shop:s.rngState,choice:s.choiceRngState,reward:s.rewardRngState,battleSeed:s.battleSeedRngState,equipment:s.equipmentState.equipment,reforge:s.reforgeState,layout:s.m8.loot.layoutBinding.mode==='solo'?s.m8.loot.layoutBinding.layout.rng:null,loot:s.m8.loot.frozen.rng,combat:s.combat?{state:s.combat.rngState,draws:s.combat.rngDraws,items:s.combat.itemRandomStreams??null}:null});
async function main(){
 const {createServer}=await import('vite');const server=await createServer({configFile:false,...migration.viteOptions(),server:{middlewareMode:true,ws:false},appType:'custom',logLevel:'error'});
 try{
  const sourceDigests=migration.sourceDigests();
  const api=await server.ssrLoadModule('/src/simulation/match.ts'),ser=await server.ssrLoadModule('/src/simulation/serialization.ts');
  const {CONTENT_DIGEST,digestContent}=await server.ssrLoadModule('/src/simulation/content/index.ts'),{LOOT_REPLAY_DIGEST}=await server.ssrLoadModule('/src/simulation/loot-freeze.ts');
  const oldPath='tests/fixtures/m5/full-match-golden.v25-online-rules.json',priorBytes=migration.archivedBytes(baseCommit,oldPath),prior=JSON.parse(priorBytes),previous=JSON.parse(migration.archivedBytes(baseCommit,'tests/v25-online-rules-content-baseline.json'));
  const {M8_VERSION}=await server.ssrLoadModule('/src/simulation/m8/version.ts'),{NET_PROTOCOL_VERSION}=await server.ssrLoadModule('/src/server/net/messages.ts');
  assert.equal(NET_PROTOCOL_VERSION,6);assert.deepEqual([M8_VERSION.schemaVersion,M8_VERSION.saveFormatVersion,M8_VERSION.replayFormatVersion,M8_VERSION.commandProtocolVersion],[12,8,8,7]);
  const initial=api.createMatch(42),steps=[];assert.notEqual(initial.contentDigest,previous.contentDigest,'Finalize new content identity before recording');assert.equal(initial.rulesVersion,'s13-g2-3-v26-neutrals-1424','v26 neutrals-1424 rules have an independent epoch');assert.equal(initial.contentVersion,'s13-14.24b-g2-3-v26-neutrals-1424');assert.notEqual(initial.rulesVersion,previous.rulesVersion);assert.notEqual(initial.contentVersion,previous.contentVersion);let r=api.startMatchCombat(initial);steps.push(r);while(r.state.phase==='combat'){r=api.stepMatch(r.state);steps.push(r);}
  const traceHashes={state:sha(steps.map(r=>r.state)),events:sha(steps.map(r=>r.events)),rng:sha(steps.map(r=>randomState(r.state)))};
  const baseline={parentEpoch:'v25-online-rules',contentDigest:CONTENT_DIGEST,lootReplayDigest:LOOT_REPLAY_DIGEST,rulesVersion:initial.rulesVersion,contentVersion:initial.contentVersion,schemaVersion:initial.schemaVersion,saveFormatVersion:M8_VERSION.saveFormatVersion,replayFormatVersion:M8_VERSION.replayFormatVersion,commandProtocolVersion:M8_VERSION.commandProtocolVersion,netProtocolVersion:NET_PROTOCOL_VERSION,previousContentDigest:previous.contentDigest,previousLootReplayDigest:previous.lootReplayDigest,traceHashes,firstBattle:{seed:42,ticks:r.state.combat.tick,events:steps.flatMap(s=>s.events).filter(e=>'tick' in e).length,result:r.state.combat.result,stateHash:digestContent(r.state.combat),eventHash:digestContent(steps.flatMap(s=>s.events).filter(e=>'tick' in e))},reason:'v26 integrates the 14.24 neutral restore, targeting-p0/p1, melee pathing, anomaly-ui and d5-register on v25; schema/save/replay/command 12/8/8/7, NET6. Old identities are rejected without migration.'};
  const audit={sourceDigests,baseCommit,baseline,previousGoldenSha256:sha(priorBytes),driverSha256:sha(fs.readFileSync('scripts/generate-m5-route.cjs')),oracleSha256:sha(fs.readFileSync('tests/fixtures/m5/oracle.g2.cjs')),builds:{}};
  const golden={note:'v26-neutrals-1424 public commands recorded in the independent v26-neutrals-1424 epoch; no identity normalization or historical trajectory replacement.',routes:{}};
  for(const build of ['cannon','sniper','mage','sniper-caitlyn']){
   const states=[];const route=await run(api,{build,seed:42,...routeOptions(build,42),onStep:(before,result,command)=>{if(command?.type==='start')states.push(before);if(before.phase==='combat'&&result.state.phase!=='combat')states.push(result.state);}});states.push(route.final);
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
    const bytes=zlib.gzipSync(JSON.stringify({states}));record(`tests/fixtures/v26-neutrals-1424-recorded-states/${build}.json.gz`,bytes);
    recording={byteEvidence:evidence(migration.archivedBytes(baseCommit,`tests/fixtures/v25-online-rules-recorded-states/${build}.json.gz`),bytes),states:states.length,gzipSha256:sha(bytes),stateUtf8Sha256:sha(texts),textAndObjectRestoreBytesEqual:true,previousGzipSha256:sha(migration.archivedBytes(baseCommit,`tests/fixtures/v25-online-rules-recorded-states/${build}.json.gz`))};
   }
   const commands=route.actions.map(a=>a.command),old=prior.routes[build];
   const firstCommandDifference=commands.findIndex((c,n)=>JSON.stringify(c)!==JSON.stringify(old.commands[n]));
   const firstEventDifference=route.rounds.findIndex((r,n)=>r.eventsHash!==old.rounds[n]?.eventsHash);
   // v26 changes neutral stats, targeting and melee pathing, so the inherited command/event ledgers legitimately diverge; the first difference is recorded below.
   const summary={...route.summary};delete summary.tickTimingMs;delete summary.durationSeconds;
   golden.routes[build]={versions:Object.fromEntries(['schemaVersion','rulesVersion','contentVersion','contentDigest','commandProtocolVersion','rngAlgorithm','tickMs'].map(k=>[k,route.initial[k]])),seed:42,commands,rounds:route.rounds.map(r=>({round:r.round,stateHash:r.stateHash,eventsHash:r.eventsHash}))};
   audit.builds[build]={summary,recording,firstCommandDifference:firstCommandDifference<0?null:{index:firstCommandDifference,previous:old.commands[firstCommandDifference],current:commands[firstCommandDifference]},firstEventDifference:firstEventDifference<0?null:{round:route.rounds[firstEventDifference].round,previous:old.rounds[firstEventDifference].eventsHash,current:route.rounds[firstEventDifference].eventsHash},ledger:route.ledger};
   console.log(JSON.stringify({build,states:recording?.states??0,commands:commands.length,rounds:route.rounds.length}));
  }
  // Old audit hashes refer to the canonical blob; checkout immutability is a
  // separate filtered-byte check (Windows may retain CRLF in the old JSON).
  assert.equal(sha(migration.archivedBytes(baseCommit,oldPath)),audit.previousGoldenSha256);
  const output=JSON.stringify(golden,null,2)+'\n';audit.candidateSha256=sha(output);audit.goldenByteEvidence=evidence(priorBytes,output);
  record('tests/fixtures/m5/full-match-golden.v26-neutrals-1424.json',output);record('tests/v26-neutrals-1424-content-baseline.json',JSON.stringify(baseline,null,2)+'\n');record('docs/evidence/v26-neutrals-1424/release-audit.json',JSON.stringify(audit,null,2)+'\n');for(const [p,hash] of Object.entries(sourceDigests))assert.equal(sha(fs.readFileSync(p)),hash,`Source changed during recording: ${p}`);for(const [p,b] of pending)writeRecord(p,b);console.log(JSON.stringify(baseline));
 }finally{await server.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});

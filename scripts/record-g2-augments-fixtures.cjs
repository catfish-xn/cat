/* Independently rerun baseline and current public routes. Default verifies;
 * --write records NEW W4 fixtures only. Never patch an old raw state to restore it. */
const fs = require('node:fs'), path = require('node:path'), zlib = require('node:zlib');
const assert = require('node:assert/strict'), {createHash} = require('node:crypto');
const {execFileSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const BASE = '80b893ac66c01b79ec6606b493e141eca3bf00cb';
const args = process.argv.slice(2), baseArg = args.find(a => a.startsWith('--baseline-root='));
assert(baseArg && args.every(a => a === baseArg || a === '--write'), '--baseline-root=<unmodified baseline export> [--write]');
const baselineRoot = path.resolve(baseArg.slice(16)), write = args.includes('--write');
const sha = b => createHash('sha256').update(b).digest('hex');
const json = x => Buffer.from(JSON.stringify(x));
const read = (dir, file) => JSON.parse(fs.readFileSync(path.join(dir, file)));
function first(a, b, p = '$') {
  if (JSON.stringify(a) === JSON.stringify(b)) return null;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return {path:p, previous:a ?? null, current:b ?? null};
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) { const d = first(a[key], b[key], `${p}.${key}`); if (d) return d; }
  return null;
}
function byteEvidence(a, b) {
  a = Buffer.from(a); b = Buffer.from(b); let offset = 0;
  while (offset < Math.min(a.length,b.length) && a[offset] === b[offset]) offset++;
  return {previousBytes:a.length,currentBytes:b.length,previousSha256:sha(a),currentSha256:sha(b),byteEqual:a.equals(b),firstByteOffset:a.equals(b)?null:offset};
}
const identityKeys = new Set(['rulesVersion','contentVersion','contentDigest']);
const gameplay = x => JSON.parse(JSON.stringify(x), (k,v) => identityKeys.has(k) ? undefined : v);
const compare = (a,b) => ({...byteEvidence(json(a),json(b)),firstDifference:first(a,b),firstGameplayDifference:first(gameplay(a),gameplay(b))});
const pending = new Map();
const walk = directory => fs.readdirSync(path.join(root,directory),{withFileTypes:true}).flatMap(entry => entry.isDirectory()?walk(`${directory}/${entry.name}`):[`${directory}/${entry.name}`]);
const record = (file, bytes) => pending.set(file, Buffer.from(bytes));
const recordJson = (file, value) => record(file, JSON.stringify(value,null,2)+'\n');
const randomState = s => ({seed:s.seed,shop:s.rngState,choice:s.choiceRngState,reward:s.rewardRngState,battleSeed:s.battleSeedRngState,equipment:s.equipmentState.equipment,reforge:s.reforgeState,layout:s.m8.loot.layoutBinding.mode==='solo'?s.m8.loot.layoutBinding.layout.rng:null,loot:s.m8.loot.frozen.rng,combat:s.combat?{state:s.combat.rngState,draws:s.combat.rngDraws}:null});
async function main() {
  const git = (...a) => execFileSync('git',a,{cwd:root,maxBuffer:64*1024*1024});
  const baselineFiles = git('ls-tree','-r','--name-only',BASE,'src/simulation','src/server-entry','scripts/generate-m5-route.cjs','scripts/m4-evidence.cjs','tests/fixtures').toString().trim().split('\n');
  const baselineSources = {};
  for (const file of baselineFiles) { const bytes=fs.readFileSync(path.join(baselineRoot,file)); assert(bytes.equals(git('show',`${BASE}:${file}`)),`Unmodified baseline ${file}`); baselineSources[file]=sha(bytes); }
  const currentFiles=[...walk('src/simulation'),...walk('src/server-entry'),'scripts/generate-m5-route.cjs','scripts/m4-evidence.cjs','tests/fixtures/m5/oracle.g2.cjs','scripts/record-g2-augments-fixtures.cjs'].sort();
  const currentSources=Object.fromEntries(currentFiles.map(file=>[file,sha(fs.readFileSync(path.join(root,file)))]));
  const {createServer}=await import('vite'),servers=[];
  try {
    for (const directory of [baselineRoot,root]) servers.push(await createServer({root:directory,configFile:false,server:{middlewareMode:true,ws:false},appType:'custom',logLevel:'error'}));
    const engines=[];
    for (const [i,s] of servers.entries()) engines.push({api:await s.ssrLoadModule(i?'/tests/fixtures/recorded-match.ts':'/src/simulation/match.ts'),ser:await s.ssrLoadModule(i?'/tests/fixtures/history-evidence.ts':'/src/simulation/serialization.ts'),content:await s.ssrLoadModule('/src/simulation/content/index.ts'),loot:await s.ssrLoadModule('/src/simulation/loot-freeze.ts'),battle:await s.ssrLoadModule('/src/server-entry/index.ts'),rounds:(await s.ssrLoadModule('/src/simulation/content/round-catalog.ts')).ROUND_CATALOG});
    const [old,now]=engines,previous=old.api.createMatch(42),current=now.api.createMatch(42);
    assert.notEqual(previous.contentDigest,current.contentDigest,'W4 must change content identity');
    assert.notEqual(previous.rulesVersion,current.rulesVersion);assert.notEqual(previous.contentVersion,current.contentVersion);
    assert.equal(old.loot.LOOT_REPLAY_DIGEST,now.loot.LOOT_REPLAY_DIGEST,'W4 does not change LOOT_REPLAY_DIGEST');
    assert.throws(()=>now.ser.restoreMatch(previous),'Old identity remains rejected');
    const audit={baselineCommit:BASE,baselineFilesVerified:baselineFiles.length,baselineSourceSha256:sha(json(baselineSources)),baselineSources,currentSourceSha256:sha(json(currentSources)),currentSources,identityReplacements:['contentDigest','rulesVersion','contentVersion'].map(k=>[previous[k],current[k]]),lootReplayDigestUnchanged:now.loot.LOOT_REPLAY_DIGEST,builds:{},c19:{},b8:{},herald:{}};
    let result=now.api.startMatchCombat(current); const steps=[result];
    while(result.state.phase==='combat'){result=now.api.stepMatch(result.state);steps.push(result);}
    const traceHashes={state:sha(json(steps.map(s=>s.state))),events:sha(json(steps.map(s=>s.events))),rng:sha(json(steps.map(s=>randomState(s.state))))};
    const firstEvents=steps.flatMap(s=>s.events).filter(e=>'tick' in e);
    const baseline={contentDigest:current.contentDigest,lootReplayDigest:now.loot.LOOT_REPLAY_DIGEST,rulesVersion:current.rulesVersion,contentVersion:current.contentVersion,schemaVersion:current.schemaVersion,firstBattle:{seed:42,ticks:result.state.combat.tick,events:firstEvents.length,result:result.state.combat.result,stateHash:now.content.digestContent(result.state.combat),eventHash:now.content.digestContent(firstEvents)},previousContentDigest:previous.contentDigest,previousLootReplayDigest:old.loot.LOOT_REPLAY_DIGEST,traceHashes,reason:'W4 augment pool 6 to 30; public routes independently re-recorded; previous fixtures preserved.'};
    recordJson('tests/g2-augments-content-baseline.json',baseline);
    const golden={note:'W4 public routes regenerated from seed 42; gameplay changes recorded against the unmodified baseline.',routes:{}};
    for(const build of ['cannon','sniper','mage','sniper-caitlyn']) {
      const captures=[];
      for(const [i,e] of engines.entries()) {
        const states=[];const run=require(path.join(i?root:baselineRoot,'scripts/generate-m5-route.cjs')).run;
        const route=await run(e.api,{build,seed:42,onStep(before,res,command){if(command?.type==='start')states.push(before);if(before.phase==='combat'&&res.state.phase!=='combat')states.push(res.state);}}); states.push(route.final);
        assert.equal(route.final.phase,'gameOver');assert.equal(route.rounds.length,33);assert.equal(route.summary.outcome,'victory');
        const frozen={versions:Object.fromEntries(['schemaVersion','rulesVersion','contentVersion','contentDigest','commandProtocolVersion','rngAlgorithm','tickMs'].map(k=>[k,route.initial[k]])),seed:42,commands:route.actions.map(a=>a.command),rounds:route.rounds.map(r=>({round:r.round,stateHash:r.stateHash,eventsHash:r.eventsHash}))};
        if(!i) assert.deepEqual(frozen,read(baselineRoot,'tests/fixtures/m5/full-match-golden.p7-1.json').routes[build],'Re-executed baseline golden');
        captures.push({route,states,frozen});
      }
      const [a,b]=captures;
      audit.builds[build]={commands:compare(a.frozen.commands,b.frozen.commands),commandEvents:compare(a.route.actions.map(r=>r.events),b.route.actions.map(r=>r.events)),battleEvents:compare(a.route.rounds.map(r=>r.events),b.route.rounds.map(r=>r.events)),states:compare(a.states,b.states),roundResults:compare(a.route.rounds.map(r=>r.result),b.route.rounds.map(r=>r.result)),previousTicks:a.route.summary.ticks,currentTicks:b.route.summary.ticks};
      golden.routes[build]=b.frozen;
      if(['cannon','sniper'].includes(build)) {
        const original=fs.readFileSync(path.join(baselineRoot,`tests/fixtures/p7-1-recorded-states/${build}.json.gz`));
        assert.deepEqual(JSON.parse(zlib.gunzipSync(original)).states,a.states,'Re-executed baseline states');
        assert.equal(b.states.length,67);
        for(const state of b.states){const serialized=now.ser.serializeMatch(state);assert.deepEqual(now.ser.restoreMatch(serialized),state);assert.deepEqual(now.ser.restoreMatch(JSON.parse(serialized)),state);assert.equal(now.ser.serializeMatch(now.ser.restoreMatch(serialized)),serialized);}
        const bytes=zlib.gzipSync(JSON.stringify({states:b.states}));record(`tests/fixtures/g2-augments-recorded-states/${build}.json.gz`,bytes);
        audit.builds[build].archivedRecording=byteEvidence(original,bytes);
      }
      console.log(JSON.stringify({build,firstCommandDifference:audit.builds[build].commands.firstDifference,firstGameplayDifference:audit.builds[build].states.firstGameplayDifference}));
    }
    const goldenBytes=JSON.stringify(golden,null,2)+'\n';record('tests/fixtures/m5/full-match-golden.g2-augments.json',goldenBytes);
    audit.goldenBytes=byteEvidence(fs.readFileSync(path.join(baselineRoot,'tests/fixtures/m5/full-match-golden.p7-1.json')),goldenBytes);
    const prior=read(baselineRoot,'tests/fixtures/p7-1-c19-seed-9-minimal.json');
    const compiled=now.battle.compileBattle({...prior.a,contentDigest:current.contentDigest},{...prior.b,contentDigest:current.contentDigest},prior.battleSeed,{battleId:prior.battleId,mirrorOfSeatId:prior.mirrorOfSeatId??undefined});
    const before=old.battle.resolveTwoSidedBattle(prior,5000),after=now.battle.resolveTwoSidedBattle(compiled,5000);
    const pulses=r=>r.events.filter(e=>e.type==='packetDamage'&&e.outcome.context.damageType==='true');
    audit.c19={compiled:compare(prior,compiled),terminal:compare(before.terminal,after.terminal),events:compare(before.events,after.events),pulses:compare(pulses(before),pulses(after))};
    assert.deepEqual(before.terminal,after.terminal);assert.deepEqual(before.events,after.events);
    recordJson('tests/fixtures/g2-augments-c19-seed-9-minimal.json',compiled);
    const fingerprints={};
    for(const count of [0,1,9]) {
      const captures=[];
      for(const e of engines){const base=e.api.createMatch(42),round=e.rounds.find(r=>r.roundId==='2-1'),names=['irelia','leona','tristana','maddie','lux','darius','irelia','leona','lux'];
        const state={...base,level:9,round:round.ordinal,roundDefinitionId:round.roundId,m8:{...base.m8,round},items:[],preparation:{...base.preparation,units:names.slice(0,count).map((definitionId,i)=>({id:`unit-${i+1}`,definitionId,team:'player',starLevel:1,location:{kind:'board',cell:{col:i%7,row:4+Math.floor(i/7)}}}))}};
        const battle=e.battle.resolveTwoSidedBattle(e.battle.compileBattle(e.battle.snapshotForBattle(state,'A'),e.battle.snapshotForBattle(state,'B'),42,{battleId:'resumable'}),1201),replay=e.battle.toCombatReplay(battle);captures.push({battle,replay});}
      audit.b8[count]={battle:compare(captures[0].battle,captures[1].battle),replay:compare(captures[0].replay,captures[1].replay)};
      const {battle,replay}=captures[1],legacyReplay={...replay,ticks:replay.ticks.map(frame=>({...frame,events:frame.events.map(event=>{if(event.type!=='heal')return event;const{shares,...legacy}=event;return legacy;})}))};
      fingerprints[count]=[sha(json(battle)),sha(json(legacyReplay))];
    }
    recordJson('tests/fixtures/g2-augments-b8-fingerprints.json',fingerprints);
    // The original Herald recorder must have independently exported these raw bytes first.
    const dir='tests/fixtures/g2-augments-herald-raw',manifest=read(root,`${dir}/manifest.json`);
    assert.equal(manifest.contentDigest,current.contentDigest);
    for(const entry of manifest.cases){const file=`${entry.name}.json`,aBytes=fs.readFileSync(path.join(baselineRoot,'tests/fixtures/p7-1-herald-raw',file)),bBytes=fs.readFileSync(path.join(root,dir,file));assert.equal(sha(bBytes),entry.rawSha256);
      const a=JSON.parse(aBytes),b=JSON.parse(bBytes);let x=old.api.startMatchCombat(old.ser.restoreMatch(a)),y=now.api.startMatchCombat(now.ser.restoreMatch(b));assert(x.ok&&y.ok);const start=compare(x,y),xt=[],yt=[];
      for(let i=0;i<15;i++){x=old.api.stepMatch(x.state);y=now.api.stepMatch(y.state);xt.push(x);yt.push(y);}
      audit.herald[entry.name]={fileBytes:byteEvidence(aBytes,bBytes),raw:compare(a,b),start,firstFifteenSteps:compare(xt,yt)};
    }
    audit.herald.trajectory=compare(read(baselineRoot,'tests/fixtures/p7-1-herald-raw/trajectory.json'),read(root,`${dir}/trajectory.json`));
    recordJson('docs/evidence/g2-augments/fixture-migration.json',audit);
    // Validate everything before writing any candidate output.
    for(const [file,digest] of Object.entries(currentSources))assert.equal(sha(fs.readFileSync(path.join(root,file))),digest,`Source changed during recording: ${file}`);
    for(const [file,bytes] of pending){const target=path.join(root,file);if(write){fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes);}else assert(fs.readFileSync(target).equals(bytes),`Regenerated ${file}`);}
    console.log(JSON.stringify({passed:true,mode:write?'write':'verify',files:pending.size,contentDigest:current.contentDigest}));
  } finally {for(const s of servers)await s.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});

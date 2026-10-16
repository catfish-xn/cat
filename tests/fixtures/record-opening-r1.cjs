/* R1: regenerate only reward-dependent fixtures. Supply an unmodified multiplayer
 * export. Prior PR bytes come directly from Git; no saved state is patched. */
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const {execFile}=require('node:child_process');
const git=async args=>(await require('node:util').promisify(execFile)('git',args,{cwd:root,maxBuffer:128*1024*1024,encoding:'buffer'})).stdout;
const root=path.resolve(__dirname,'../..'),base=process.argv[2];
assert(base,'node tests/fixtures/record-opening-r1.cjs <multiplayer export>');
const previous='2e21f18ad9c7f035b1595b6626bbdd919b79f26f';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const json=x=>Buffer.from(JSON.stringify(x));
function bytes(a,b){let i=0;while(i<Math.min(a.length,b.length)&&a[i]===b[i])i++;return {previousBytes:a.length,currentBytes:b.length,previousSha256:sha(a),currentSha256:sha(b),firstByteOffset:a.equals(b)?null:i};}
const original=f=>git(['show',`${previous}:${f}`]);
const audit={previousHead:previous,baselineCommit:'94eecbcbfbce72d4740923b8c793c66c483bfd51',decision:'按用户 2026-10-16 决定维持随机',files:{},builds:{}};
async function record(file,value){const next=Buffer.isBuffer(value)?value:Buffer.from(JSON.stringify(value,null,2)+'\n');audit.files[file]=bytes(await original(file),next);if(audit.files[file].firstByteOffset!==null)fs.writeFileSync(path.join(root,file),next);}
async function main(){if(process.argv[3]==='--equipment-only')return equipment();const {createServer}=await import('vite'),servers=[];
 try{
  for(const dir of [path.resolve(base),root])servers.push(await createServer({root:dir,configFile:false,server:{middlewareMode:true,ws:false},appType:'custom',logLevel:'error'}));
  const [old,now]=await Promise.all(servers.map(async s=>({api:await s.ssrLoadModule('/src/simulation/match.ts'),ser:await s.ssrLoadModule('/src/simulation/serialization.ts'),loot:await s.ssrLoadModule('/src/simulation/loot-freeze.ts')})));
  const source='src/simulation/loot-freeze.ts',baselineSource=await git(['show',`${audit.baselineCommit}:${source}`]);assert(baselineSource.equals(fs.readFileSync(path.join(base,source))));assert(baselineSource.equals(fs.readFileSync(path.join(root,source))),'production loot implementation byte-identical to multiplayer');
  const seeds=[...Array.from({length:256},(_,i)=>i),3328,3150966028,4166519247,0xffffffff];const comparisons=[];
  for(const seed of seeds)for(const ordinal of [1,2,38]){
   const a=old.loot.freezeLootThroughRound(seed,ordinal),b=now.loot.freezeLootThroughRound(seed,ordinal);
   // Only the existing release identity differs from multiplayer; plans and RNG are exact.
   const omit=({replayDigest,...ledger})=>ledger;assert.deepEqual(omit(a),omit(b));
   comparisons.push({seed,ordinal,rng:b.rng,ledgerSha256:sha(json(omit(b)))});
  }
  audit.baselineLoot={sourceSha256:sha(baselineSource),comparisonCount:comparisons.length,comparisonSha256:sha(json(comparisons)),seeds,ordinals:[1,2,38],sameFullLedgerExceptReleaseIdentity:true};
  const initial=now.api.createMatch(42),priorInitial=JSON.parse(await original('tests/opening-random-content-baseline.json'));
  assert.equal(initial.contentDigest,priorInitial.contentDigest);assert.equal(initial.rulesVersion,priorInitial.rulesVersion);assert.equal(initial.contentVersion,priorInitial.contentVersion);assert.equal(now.loot.LOOT_REPLAY_DIGEST,priorInitial.lootReplayDigest);
  audit.identity={contentDigest:initial.contentDigest,lootReplayDigest:now.loot.LOOT_REPLAY_DIGEST,rulesVersion:initial.rulesVersion,contentVersion:initial.contentVersion,unchangedFromPreviousHead:true};
  let r=now.api.startMatchCombat(initial);assert(r.ok);const steps=[r];while(r.state.phase==='combat'){r=now.api.stepMatch(r.state);steps.push(r);}
  const random=s=>({seed:s.seed,shop:s.rngState,choice:s.choiceRngState,reward:s.rewardRngState,battleSeed:s.battleSeedRngState,equipment:s.equipmentState.equipment,reforge:s.reforgeState,layout:s.m8.loot.layoutBinding.mode==='solo'?s.m8.loot.layoutBinding.layout.rng:null,loot:s.m8.loot.frozen.rng,combat:s.combat?{state:s.combat.rngState,draws:s.combat.rngDraws}:null});
  const traceHashes={state:sha(json(steps.map(s=>s.state))),events:sha(json(steps.map(s=>s.events))),rng:sha(json(steps.map(s=>random(s.state))))};
  await record('tests/opening-random-content-baseline.json',{...priorInitial,traceHashes});
  const golden=JSON.parse(await original('tests/fixtures/m5/full-match-golden.opening-random.json'));
  for(const build of ['cannon','sniper','mage','sniper-caitlyn']){
   const states=[];const route=await require('../../scripts/generate-m5-route.cjs').run(now.api,{build,seed:42,onStep(before,res,command){if(command?.type==='start')states.push(before);if(before.phase==='combat'&&res.state.phase!=='combat')states.push(res.state);}});states.push(route.final);
   assert.equal(route.final.phase,'gameOver');assert.equal(route.summary.outcome,'victory');assert.equal(route.rounds.length,33);
   const frozen={versions:Object.fromEntries(['schemaVersion','rulesVersion','contentVersion','contentDigest','commandProtocolVersion','rngAlgorithm','tickMs'].map(k=>[k,route.initial[k]])),seed:42,commands:route.actions.map(a=>a.command),rounds:route.rounds.map(r=>({round:r.round,stateHash:r.stateHash,eventsHash:r.eventsHash}))};
   audit.builds[build]={previousCommandsSha256:sha(json(golden.routes[build].commands)),currentCommandsSha256:sha(json(frozen.commands)),ticks:route.summary.ticks,battles:route.rounds.length,outcome:route.summary.outcome};
   golden.routes[build]=frozen;
   if(['cannon','sniper'].includes(build)){
    assert.equal(states.length,67);for(const state of states){const raw=now.ser.serializeMatch(state);assert.deepEqual(now.ser.restoreMatch(raw),state);assert.deepEqual(now.ser.restoreMatch(JSON.parse(raw)),state);}
    await record(`tests/fixtures/opening-random-recorded-states/${build}.json.gz`,zlib.gzipSync(JSON.stringify({states})));audit.builds[build].strictTextAndObjectCheckpoints=67;
   }
   console.log(JSON.stringify({build,...audit.builds[build]}));
  }
  await record('tests/fixtures/m5/full-match-golden.opening-random.json',golden);
  // Herald's public-command recorder runs separately before this recorder.
  for(const name of fs.readdirSync(path.join(root,'tests/fixtures/opening-random-herald-raw'))){const file=`tests/fixtures/opening-random-herald-raw/${name}`;await record(file,fs.readFileSync(path.join(root,file)));}
  audit.unchangedFixtures={};for(const file of ['tests/fixtures/opening-random-c19-seed-9-minimal.json','tests/fixtures/opening-random-b8-fingerprints.json']){const b=fs.readFileSync(path.join(root,file));assert(b.equals(await original(file)));audit.unchangedFixtures[file]=sha(b);}
  fs.writeFileSync(path.join(root,'docs/evidence/opening-random/r1-random-rewards.json'),JSON.stringify(audit,null,2)+'\n');
  console.log(JSON.stringify({passed:true,files:Object.keys(audit.files).length,baselineComparisons:comparisons.length}));
 }finally{for(const s of servers)await s.close();}}
// Preserve the original independent equipment vectors through genuine random rewards.
async function equipment(){const {createServer}=await import('vite'),servers=[];
 const evidence={previousHead:previous,previousSeed:145424,currentSeed:3151248,cases:[]};
 try{
  for(const dir of [path.resolve(base),root])servers.push(await createServer({root:dir,configFile:false,server:{middlewareMode:true,ws:false},optimizeDeps:{noDiscovery:true,include:[]},appType:'custom',logLevel:'error'}));
  const engines=[];for(const server of servers)engines.push({fixtures:await server.ssrLoadModule('/tests/fixtures/m8-b4-match.ts'),ser:await server.ssrLoadModule('/src/simulation/serialization.ts'),api:await server.ssrLoadModule('/src/simulation/match.ts')});
  for(const [items,holder] of [['bloodthirster','unit-1'],['hand-of-justice','unit-3'],[['bloodthirster','bloodthirster'],'unit-1']]){
   const states=engines.map(e=>e.fixtures.itemMatch(items,holder));
   for(let i=0;i<2;i++){const text=engines[i].ser.serializeMatch(states[i]);assert.deepEqual(engines[i].ser.restoreMatch(text),states[i]);assert.deepEqual(engines[i].ser.restoreMatch(JSON.parse(text)),states[i]);}
   const vector=s=>({holder:s.preparation.units.find(u=>u.id===holder),items:s.items.map(i=>[i.id,i.definitionId]),augments:s.augments.map(a=>a.definitionId),stats:s.combat.units.filter(u=>u.team==='player').map(u=>({id:u.id,definitionId:u.definitionId,star:u.starLevel,maxHp:u.maxHp,attackDamage:u.attackDamage,armor:u.armor,magicResist:u.magicResist,maxMana:u.maxMana}))});
   assert.deepEqual(vector(states[0]),vector(states[1]),'original independent equipment vector preserved');
   const next=states.map((s,i)=>engines[i].api.stepMatch(s));
   evidence.cases.push({items,holder,state:bytes(...states.map((s,i)=>Buffer.from(engines[i].ser.serializeMatch(s)))),nextStepEvents:bytes(...next.map(s=>json(s.events))),vector:vector(states[1]),strictTextAndObjectRestore:true});
  }
  fs.writeFileSync(path.join(root,'docs/evidence/opening-random/r1-equipment-rewards.json'),JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify({passed:true,cases:evidence.cases.length,seed:evidence.currentSeed}));
 }finally{for(const server of servers)await server.close();}}
main().catch(e=>{console.error(e);process.exitCode=1;});

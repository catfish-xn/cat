/* T13-A unchanged-route digest-only audit: regenerate baseline and candidate through the unchanged
 * public command driver and independent economy oracle. Fail before writing any
 * golden unless every full command/tick result matches after digest normalization.
 * Usage: node scripts/update-t13-a-golden.cjs <baseline-worktree> <capture-directory>
 */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createHash}=require('node:crypto'),{execFileSync}=require('node:child_process');
const ROOT=path.resolve(__dirname,'..'), BUILDS=['cannon','sniper','mage','sniper-caitlyn'];
const previous=require('../tests/t12-content-baseline.json');
const sha=x=>createHash('sha256').update(x).digest('hex');
const read=p=>JSON.parse(fs.readFileSync(p));
const write=(p,x)=>fs.writeFileSync(p,JSON.stringify(x,null,2)+'\n');
async function child(root,build,out){
 const {createServer}=await import('vite');
 const server=await createServer({root,configFile:false,server:{middlewareMode:true,ws:false},optimizeDeps:{noDiscovery:true,include:[]},appType:'custom',logLevel:'error'});
 try{
  const api=await server.ssrLoadModule('/src/simulation/match.ts');
  const initial=api.createMatch(42),digest=initial.contentDigest;
  const normalize=(k,v)=>k==='contentDigest'&&v===digest?previous.contentDigest:v;
  const trace=createHash('sha256');let steps=0;
  const route=await require(path.join(root,'scripts/generate-m5-route.cjs')).run(api,{build,seed:42,onStep:(before,result,command)=>{
   trace.update(JSON.stringify({before,result,command},normalize)+'\n');steps++;
  }});
  const first=api.startMatchCombat(initial);assert(first.ok);const states=[first.state];let s=first.state;
  while(s.phase==='combat'){s=api.stepMatch(s).state;states.push(s);}
  write(out,{trace:trace.digest('hex'),steps,firstStates:states,lootReplayDigest:initial.m8.loot.frozen.replayDigest,
   ledger:route.ledger,checkpoints:route.checkpoints,
   frozen:{versions:Object.fromEntries(['schemaVersion','rulesVersion','contentVersion','contentDigest','commandProtocolVersion','rngAlgorithm','tickMs'].map(k=>[k,initial[k]])),seed:42,commands:route.actions.map(a=>a.command),rounds:route.rounds.map(r=>({round:r.round,stateHash:r.stateHash,eventsHash:r.eventsHash}))}});
 }finally{await server.close();}
}
function main(oldRoot,folder){
 fs.mkdirSync(folder,{recursive:true});
 const golden={note:'T13-A unchanged-route digest-only revision; complete command/tick trace audited against T12. Historical goldens retained.',routes:{}};
 const audit={base:'297143ec54ab5873e7eac6aa85ab7464f477b7e8',builds:{}};let baseline;
 for(const build of BUILDS){
  for(const [kind,root]of [['old',oldRoot],['new',ROOT]])execFileSync(process.execPath,[__filename,'--child',root,build,path.join(folder,`${kind}-${build}.json`)],{cwd:ROOT,stdio:'inherit'});
  const old=read(path.join(folder,`old-${build}.json`)),now=read(path.join(folder,`new-${build}.json`));
  assert.equal(old.frozen.versions.contentDigest,previous.contentDigest);
  assert.equal(old.trace,now.trace,'All complete command/tick results, not only final hashes, must remain unchanged');
  assert.equal(old.steps,now.steps);assert.deepEqual(old.ledger,now.ledger);assert.deepEqual(old.checkpoints,now.checkpoints);
  assert.deepEqual(old.frozen.commands,now.frozen.commands);assert.deepEqual(old.frozen.rounds.map(r=>r.eventsHash),now.frozen.rounds.map(r=>r.eventsHash));
  assert.equal(old.lootReplayDigest,now.lootReplayDigest);
  const normalized=JSON.stringify(now.firstStates,(k,v)=>k==='contentDigest'&&v===now.frozen.versions.contentDigest?previous.contentDigest:v);
  assert.equal(normalized,JSON.stringify(old.firstStates));assert.equal(sha(normalized),previous.stateTraceHash);
  baseline={equipmentRulesVersion:'m8-b5-instances-v4',previousContentDigest:previous.contentDigest,contentDigest:now.frozen.versions.contentDigest,lootReplayDigest:now.lootReplayDigest,stateTraceHash:sha(JSON.stringify(now.firstStates)),previousStateTraceHash:sha(normalized)};
  golden.routes[build]=now.frozen;
  audit.builds[build]={steps:now.steps,normalizedFullTraceSha256:now.trace,commandsUnchanged:true,eventHashesUnchanged:true,ledgerUnchanged:true,checkpointsUnchanged:true,changedStateRounds:now.frozen.rounds.filter((r,i)=>r.stateHash!==old.frozen.rounds[i].stateHash).map(r=>r.round)};
 }
 write(path.join(ROOT,'tests/fixtures/m5/full-match-golden.t13-a.json'),golden);
 write(path.join(ROOT,'tests/t13-a-content-baseline.json'),baseline);
 write(path.join(ROOT,'docs/evidence/t13-a/golden-audit.json'),{...audit,candidateSha256:sha(fs.readFileSync(path.join(ROOT,'tests/fixtures/m5/full-match-golden.t13-a.json'))),baselineSha256:sha(fs.readFileSync(path.join(ROOT,'tests/t13-a-content-baseline.json'))),updaterSha256:sha(fs.readFileSync(__filename))});
 console.log(JSON.stringify(baseline));
}
const [a,b,c,d]=process.argv.slice(2);
Promise.resolve().then(()=>a==='--child'?child(b,c,d):main(path.resolve(a),path.resolve(b))).catch(e=>{console.error(e);process.exitCode=1;});

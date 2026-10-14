/* T13 changes real loot and command trajectories. Retain T12 bytes unchanged;
 * record only after independent per-step economic/RNG/loot conservation and
 * full-route behavioral gates pass. This is trajectory evidence, not a rules oracle. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {run}=require('./generate-m5-route.cjs');
const {ROUNDS}=require('../tests/fixtures/m5/oracle.cjs');
const sha=x=>createHash('sha256').update(x).digest('hex');
async function main(){
 const {createServer}=await import('vite');
 const server=await createServer({configFile:false,server:{middlewareMode:true,ws:false},appType:'custom',logLevel:'error'});
 try {
  const api=await server.ssrLoadModule('/src/simulation/match.ts');
  const oldPath='tests/fixtures/m5/full-match-golden.t12.json',oldBytes=fs.readFileSync(oldPath),old=JSON.parse(oldBytes);
  const golden={note:'T13 unified auto-combine + R3/R4 release. T12 remains historical; real random loot changes commands and battles. Independent literal-table oracle validates every step.',routes:{}};
  const audit={previousSha256:sha(oldBytes),driverSha256:sha(fs.readFileSync('scripts/generate-m5-route.cjs')),oracleSha256:sha(fs.readFileSync('tests/fixtures/m5/oracle.cjs')),builds:{}};
  for(const build of ['cannon','sniper','mage','sniper-caitlyn']) {
   const states=[];
   const route=await run(api,{build,seed:42,onStep:(before,result,command)=>{
    if(command?.type==='start')states.push(before);
    if(before.phase==='combat'&&result.state.phase!=='combat')states.push(result.state);
   }});
   states.push(route.final);
   console.log(JSON.stringify(route.summary));
   assert.equal(route.summary.outcome,'victory');assert.equal(route.summary.round,38);
   assert.equal(route.rounds.length,33);assert.equal(route.ledger.rounds.length,ROUNDS.length);
   assert(route.summary.formedBattles>=3,'three genuinely formed battles');
   assert(route.summary.boundBattles>=2,'two bound battles');
   if(build==='sniper-caitlyn'){assert(route.summary.caitlynBattles>=2);assert(route.summary.caitlynCasts>=2);}
   if(['cannon','sniper'].includes(build)){assert.equal(states.length,67);fs.mkdirSync('tests/fixtures/t13-recorded-states',{recursive:true});fs.writeFileSync(`tests/fixtures/t13-recorded-states/${build}.json.gz`,require('node:zlib').gzipSync(JSON.stringify({states})));}
   const initial=route.initial;
   golden.routes[build]={versions:Object.fromEntries(['schemaVersion','rulesVersion','contentVersion','contentDigest','commandProtocolVersion','rngAlgorithm','tickMs'].map(k=>[k,initial[k]])),seed:42,commands:route.actions.map(a=>a.command),rounds:route.rounds.map(r=>({round:r.round,stateHash:r.stateHash,eventsHash:r.eventsHash}))};
   const summary={...route.summary};delete summary.tickTimingMs;delete summary.durationSeconds;
   audit.builds[build]={summary,ledger:route.ledger,checkpoints:route.checkpoints,
     previousCommands:old.routes[build].commands.length,newCommands:route.actions.length,
     changedEventRounds:route.rounds.filter((r,i)=>r.eventsHash!==old.routes[build].rounds[i].eventsHash).map(r=>r.round),
     loot:route.final.m8.loot.receipts.map(r=>r.payload)};
  }
  assert.equal(sha(fs.readFileSync(oldPath)),audit.previousSha256);
  const output=JSON.stringify(golden,null,2)+'\n';audit.candidateSha256=sha(output);
  fs.writeFileSync('tests/fixtures/m5/full-match-golden.t13.json',output);
  fs.mkdirSync('docs/evidence/t13',{recursive:true});fs.writeFileSync('docs/evidence/t13/golden-audit.json',JSON.stringify(audit,null,2)+'\n');
 } finally {await server.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});

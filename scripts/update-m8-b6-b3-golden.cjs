/* Strict integration update only. Preserve the accepted B6 33-battle campaigns;
 * B3 may change contentDigest/state hashes, never commands or event trajectories.
 * All four routes must pass before any new golden is written. */
const fs=require('node:fs'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const generate=require('./generate-m5-route.cjs'),{hash}=require('./m4-evidence.cjs');
const previousSha='9e0b35465bab14b5adc8d1446a1bb2d045018286';
const b3BaselineSha='0411ad65c1933e87df840042f38cfe1ce834d127';
(async()=>{
 const source='tests/fixtures/m5/full-match-golden.pre-b6-b3-sync.json',file='tests/fixtures/m5/full-match-golden.json';
 const input=fs.readFileSync(source,'utf8');
 assert.equal(createHash('sha256').update(input).digest('hex'),'1adf09af7b7508277599703677a9d3fdc7d87b46799384671fbbcd7694204395',`${previousSha}: exact archived B6 golden`);
 const old=JSON.parse(input),next=structuredClone(old),verified=[];
 for(const [build,expected] of Object.entries(old.routes)){
  const normalizedStates=new Map();
  const route=await generate({build,seed:expected.seed,onStep(before,result){
   if(before.phase==='combat'&&result.state.phase!=='combat')normalizedStates.set(before.round,hash({...result.state,contentDigest:expected.versions.contentDigest}));
  }});
  assert.deepEqual(route.actions.map(entry=>entry.command),expected.commands,`${build}: unchanged complete command transcript`);
  assert.deepEqual(route.rounds.map(round=>({round:round.round,stateHash:normalizedStates.get(round.round),eventsHash:round.eventsHash})),expected.rounds,
   `${build}: all complete states normalized only for contentDigest and every complete event hash must match`);
  for(const [key,value] of Object.entries(expected.versions))if(key!=='contentDigest')assert.equal(route.initial[key],value,`${build}: unchanged ${key}`);
  const observed={outcome:route.summary.outcome,roundId:route.final.roundDefinitionId,battles:route.rounds.length,formedBattles:route.summary.formedBattles,
   componentGrants:route.final.scheduleReceipts.reduce((count,receipt)=>count+receipt.itemIds.length,0)};
  assert.deepEqual(observed,old.b6ObservedOutcomes[build],`${build}: unchanged B6 acquisition/outcome observations`);
  next.routes[build].versions.contentDigest=route.initial.contentDigest;
  next.routes[build].rounds=route.rounds.map(round=>({round:round.round,stateHash:round.stateHash,eventsHash:round.eventsHash}));
  const result={build,commands:route.actions.length,battles:route.rounds.length,commandsUnchanged:true,completeEventsUnchanged:true,
   completeStatesUnchangedExceptContentDigest:true,oldDigest:expected.versions.contentDigest,newDigest:route.initial.contentDigest};
  verified.push(result);console.log(JSON.stringify(result));
 }
 next.note=(old.note??'')+` B6+B3 sync ${b3BaselineSha}: preserve the ${previousSha} B6 38-round/33-battle campaigns. The guarded updater verifies every command, all 132 complete event hashes and every complete state hash normalized only for contentDigest before writing new digest/state hashes. B3 packet-bound opening damage/control semantics and independent regressions are retained; no B7/B8 content or B9 capacity is signed off.`;
 fs.writeFileSync(file,JSON.stringify(next,null,2)+'\n');
 const directory='docs/evidence/m8-b6/b3-sync';fs.mkdirSync(directory,{recursive:true});
 fs.writeFileSync(`${directory}/guarded-golden.json`,JSON.stringify({previousSha,b3BaselineSha,archiveSha256:createHash('sha256').update(input).digest('hex'),verified},null,2)+'\n');
})().catch(error=>{console.error(error);process.exitCode=1;});

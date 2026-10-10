/* Independent review witness: replay only the unchanged command policy over captured
 * transaction states. No production API is loaded and no replacement trajectory is made.
 * Commands, transaction boundaries and complete round hashes must match every record.
 * Fixed Node22 invocation: node .../verify-driver-decisions.cjs [capture-directory]
 */
const fs=require('node:fs'),z=require('node:zlib'),a=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'../../../../..'),{run}=require(path.join(root,'scripts/generate-m5-route.cjs'));
const directory=process.argv[2]??__dirname;
(async()=>{for(const build of ['cannon','sniper','mage','sniper-caitlyn']){
 const route=JSON.parse(z.gunzipSync(fs.readFileSync(path.join(directory,`new-${build}.json.gz`))));
 let i=0,steps=0,state=route.initial;
 const command=(s,c)=>{a.deepEqual(s,state);const r=route.actions[i];a.deepEqual(c,r.command,`driver decision ${build} ${s.roundDefinitionId} action ${i}`);a.deepEqual(s,r.before);i++;state=r.after;return {ok:true,state,events:r.events};};
 const api={
  createMatch(seed){a.equal(seed,42);return route.initial;},
  buyUnit(s,slot,generation){return command(s,{type:'buy',slot,generation});},
  sellUnit(s,id){return command(s,{type:'sell',id});},
  deployMatchUnit(s,id,target){return command(s,{type:'deploy',id,target});},
  rerollShop(s){return command(s,{type:'reroll'});},
  buyXp(s){return command(s,{type:'buyXp'});},
  combineItems(s,...ids){return command(s,{type:'combine',ids});},
  equipItem(s,itemId,unitId,slot){return command(s,{type:'equip',itemId,unitId,slot});},
  selectChoice(s,choiceId,generation,definitionId){return command(s,{type:'select',choiceId,generation,definitionId});},
  selectAnomalyTarget(s,choiceId,generation,unitId){return command(s,{type:'target',choiceId,generation,unitId});},
  rerollAnomaly(s,choiceId,generation){return command(s,{type:'anomalyReroll',choiceId,generation});},
  setShopLock(s,locked,generation){return command(s,{type:'lock',locked,generation});},
  startMatchCombat(s){return command(s,{type:'start'});},
  nextRound(s,round){return command(s,{type:'continue',round});},
  stepMatch(s){a.deepEqual(s,state);const round=route.rounds.find(r=>r.round===s.round),start=route.actions[i-1];a.equal(start.command.type,'start');state=round.after;steps++;return {state,events:round.events.slice(start.events.length)};},
 };
 const output=await run(api,{build,seed:42,retainStates:true});
 a.equal(i,route.actions.length);a.equal(steps,33);
 a.deepEqual(output.actions.map(x=>x.command),route.actions.map(x=>x.command));
 a.deepEqual(output.rounds.map(x=>[x.round,x.stateHash,x.eventsHash]),route.rounds.map(x=>[x.round,x.stateHash,x.eventsHash]));
 console.log(JSON.stringify({node:process.version,build,commands:i,battles:steps,exactUnmodifiedDriverDecisionReplay:'passed'}));
}})().catch(e=>{console.error(e);process.exitCode=1;});

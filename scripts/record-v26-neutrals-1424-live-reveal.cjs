/* Public-command proof of the current mage route's neutral source death identities.
 * v26: the v25 seed-2634 route no longer applies. On the identical v25 prepared 4-7 board the
 * order drifts through the 14.24 neutral restore (568eeea4: six birds become five, new stats),
 * targeting-p0 (28fd974a), targeting-p1 (8106acee) and its dead-unit RNG fix (927d3045);
 * see docs/V26_EPOCH_REPORT.md. The obligations below are the ones tests/m8-b8-live-reveal.test.ts
 * now asserts on seed 15972 (simultaneous), seed 54239 (equipped Loris partial defeats) and the
 * public 1-4 minions (unloaded carrier), recorded from public commands only. */
const fs=require('node:fs'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const migration=require('./v26-neutrals-1424-fixture-audit.cjs'),baseCommit=migration.baselineCommit();
const sourceDigests=migration.sourceDigests();
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const bird=slot=>JSON.stringify(['pve','4-7','razorbeaks-v1',slot]);
async function main(){
 const {createServer}=await import('vite');const server=await createServer({configFile:false,...migration.viteOptions(),server:{middlewareMode:true,ws:false},appType:'custom',logLevel:'error'});
 try{
 const api=await server.ssrLoadModule('/src/simulation/match.ts');
 const helpers=await server.ssrLoadModule('/tests/fixtures/g2-3-b8-public.ts');
 const routes=await server.ssrLoadModule('/tests/fixtures/b8-live-reveal-routes.ts');
 // Same public routes as tests/m8-b8-live-reveal.test.ts, loaded from the shared fixtures.
 const prefix=await routes.simultaneousPrefix();
 const lorisPrefix=await routes.barePartialPrefix('loris',routes.PARTIAL_REVEAL_SEEDS.loris,['visionary-crest','building-a-collection-iii','enforcer-crown']);
 assert.deepEqual(lorisPrefix.augments.map(a=>a.definitionId),['visionary-crest','building-a-collection-iii','enforcer-crown']);
 const accept=r=>{assert(r.ok!==false,r.reason);return r.state;};
 function resolve(state,base=prefix){
 state=accept(api.startMatchCombat(state));const events=[],batches=[];
 while(state.phase==='combat'){const step=api.stepMatch(state);state=step.state;events.push(...step.events);
  const deaths=step.events.filter(e=>e.type==='death').map(e=>({unitId:e.unitId,tick:e.tick,eventSeq:e.eventSeq}));
  if(deaths.length)batches.push({terminal:state.phase!=='combat',deaths,reveals:step.events.filter(e=>e.type==='lootRevealed').map(e=>e.death.eventSeq)});}
 return {deaths:state.combat.neutralReceipts.deaths,reveals:events.filter(e=>e.type==='lootRevealed').map(e=>({dropId:e.dropId,death:e.death})),batches,result:state.combat.result,phase:state.phase,eventHash:sha(events),terminalHash:sha(state),receipts:state.m8.loot.receipts.length-base.m8.loot.receipts.length,unitSerialDelta:state.nextUnitSerial-base.nextUnitSerial,itemSerialDelta:state.nextItemSerial-base.nextItemSerial};
 }
 const branches={full:resolve(prefix),simultaneous:resolve(helpers.simultaneousB8Preparation(prefix))};
 // Seed 15972 after the lawful Leona/Loris swap: r04 alone at tick 40, r02/r03 in the live
 // tick-127 batch, then r00/r01 in the terminal batch (tests/m8-b8-live-reveal.test.ts).
 const expectedDeaths=[{unitId:bird('r04'),tick:40,eventSeq:446},{unitId:bird('r02'),tick:127,eventSeq:1226},{unitId:bird('r03'),tick:127,eventSeq:1227},{unitId:bird('r00'),tick:165,eventSeq:1504},{unitId:bird('r01'),tick:165,eventSeq:1505}];
 assert.deepEqual(branches.simultaneous.deaths,expectedDeaths);
 const sameTick=branches.simultaneous.deaths.slice(1,3),terminalBatch=branches.simultaneous.deaths.slice(3);
 const batches=branches.simultaneous.batches;
 assert.deepEqual(batches.map(b=>b.deaths),[expectedDeaths.slice(0,1),sameTick,terminalBatch]);
 assert.deepEqual(batches.map(b=>b.terminal),[false,false,true]);
 assert.deepEqual(batches[1].reveals,[1226,1226,1227]);assert.deepEqual(batches[2].reveals,[1504,1504,1505]);
 assert.equal(branches.simultaneous.phase,'settlement');
 // Seed 54239 inventory Shojin/Gargoyle/Crownguard on bare two-star Loris: (6,7) kills only r04, (0,6) only r01.
 for(const [source,cell,deathTick,directReceipts,itemBirths,unitBirths] of [['r04',{col:6,row:7},520,2,0,1],['r01',{col:0,row:6},353,1,1,0]]){
  let prepared=helpers.partialB8Preparation(lorisPrefix,'loris');
  const holder=prepared.preparation.units.find(u=>u.team==='player'&&u.definitionId==='loris');assert(holder);
  for(const [slot,definitionId] of ['shojin','gargoyle','crownguard'].entries()){
   const item=prepared.items.find(i=>i.location.kind==='inventory'&&i.definitionId===definitionId);assert(item,definitionId);
   prepared=accept(api.equipItem(prepared,item.id,holder.id,slot));
  }
  prepared=accept(api.deployMatchUnit(prepared,holder.id,{kind:'board',cell}));
  const branch=resolve(prepared,prepared);
  assert.equal(branch.result,'enemyWin');assert.equal(branch.phase,'settlement');
  assert.deepEqual(branch.deaths.map(d=>[d.unitId,d.tick]),[[bird(source),deathTick]]);
  assert.equal(branch.receipts,directReceipts);assert.equal(branch.itemSerialDelta,itemBirths);assert.equal(branch.unitSerialDelta,unitBirths);
  branches['loris-'+source]={...branch,star:holder.starLevel,cell,prefixHash:sha(lorisPrefix)};
 }
 // Every 4-7 bird now carries an orb; the unloaded-source obligation uses the real 1-4 minions.
 // Same command-only seed-65 sniper route and capture rule as tests/fixtures/m8-neutral-public-route.ts
 // (publicNeutralPreparation), run here directly because that module also imports the Herald raw files.
 const ser=await server.ssrLoadModule('/src/simulation/serialization.ts'),preparations=new Map();
 const neutralRoute=await require('./generate-m5-route.cjs').run(api,{build:'sniper',seed:65,...require('./v26-neutrals-1424-route.cjs').routeOptions('sniper',65),onStep(before,result,command){
  if(command?.type==='start'||command?.type==='continue'&&before.m8.round.kind==='supply')preparations.set(before.roundDefinitionId,before);
  if(result.state.phase==='preparation')preparations.set(result.state.roundDefinitionId,result.state);}});
 assert(neutralRoute.final.phase==='gameOver'&&neutralRoute.final.roundDefinitionId==='6-7'&&neutralRoute.final.outcome==='victory','Public neutral route completes');
 assert(preparations.has('1-4'));const minions=ser.restoreMatch(ser.serializeMatch(preparations.get('1-4')));
 const loaded=new Set(minions.m8.loot.frozen.rounds.at(-1).encounterPlan.drops.map(d=>d.sourceUnitId));
 let state=accept(api.startMatchCombat(minions)),before=state,last=api.stepMatch(state);
 while(state.phase==='combat'){before=state;last=api.stepMatch(state);state=last.state;}
 const unloadedDeaths=last.events.filter(e=>e.type==='death');
 assert.equal(state.combat.result,'playerWin');assert.equal(unloadedDeaths.length,1);assert(!loaded.has(unloadedDeaths[0].unitId));
 assert.equal(last.events.filter(e=>e.type==='lootRevealed').length,0);assert.deepEqual(last.state.m8.loot.earnedEvidence,before.m8.loot.earnedEvidence);
 branches.unloadedCarrier={roundId:'1-4',unitId:unloadedDeaths[0].unitId,tick:unloadedDeaths[0].tick,eventSeq:unloadedDeaths[0].eventSeq,newReveals:0,newEarnedEvidence:0,terminalReceipts:last.state.m8.loot.receipts.length-before.m8.loot.receipts.length};
 const previousAudit=JSON.parse(migration.archivedBytes(baseCommit,'docs/evidence/v25-online-rules/live-reveal-audit.json'));
 const previousAssertions=previousAudit.currentAssertions;
 const currentAssertions={simultaneous:sameTick,terminal:terminalBatch,partialDrops:[{definitionId:'loris',source:'r04',tick:520,receipts:2},{definitionId:'loris',source:'r01',tick:353,receipts:1}],unloadedCarrier:branches.unloadedCarrier};
 const drift={source:'Same v25 prepared 4-7 board (seed 2634, v25 Lux/Nami swap) replayed with regenerated current enemies; see docs/V26_EPOCH_REPORT.md',
  v25:'e9384c02 r00@52 r01@55 r02@94 r03@110 r04@110 r05@127',neutrals1424:'795ca7f9 (568eeea4) five birds: r00@110 r01@110 r02@137 r03@178 r04@195',
  targetingP0:'d6a75a4e (28fd974a) r02@102 r01@110 r03@137 r04@140 r00@178',targetingP1:'8106acee r02@76 r01@137 r03@137 r04@140 r00@178',
  deadUnitRng:'927d3045 r02@76 r03@137 r01@140 r04@140 r00@178 (= c64a756a and bb9c02a0)',meleePathing:'34cfbfbb/cc10a365 no change on this board'};
 const evidence=(value)=>({bytes:Buffer.byteLength(JSON.stringify(value)),sha256:sha(value)});
 const oldTest=require('./offline-process-output.cjs').readProcessOutput('git',['cat-file','--filters',`${baseCommit}:tests/m8-b8-live-reveal.test.ts`]);
 const newTest=fs.readFileSync('tests/m8-b8-live-reveal.test.ts');let first=0;
 while(first<Math.min(oldTest?.length??0,newTest.length)&&oldTest[first]===newTest[first])first++;
 const byteEvidence={previousCommit:baseCommit,previousBytes:oldTest.length,currentBytes:newTest.length,previousSha256:createHash('sha256').update(oldTest).digest('hex'),currentSha256:createHash('sha256').update(newTest).digest('hex'),firstDifferentByte:oldTest.equals(newTest)?null:first};
 const fileSha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
 const audit={baseCommit,sourceDigests,contentDigest:prefix.contentDigest,route:'mage',seed:routes.SIMULTANEOUS_REVEAL_SEED,partialSeed:routes.PARTIAL_REVEAL_SEEDS.loris,roundId:'4-7',prefixHash:sha(prefix),previousAssertions,currentAssertions,assertionBytes:{previous:evidence(previousAssertions),current:evidence(currentAssertions)},drift,byteEvidence,helperSha256:fileSha('tests/fixtures/g2-3-b8-public.ts'),routesSha256:fileSha('tests/fixtures/b8-live-reveal-routes.ts'),neutralRouteSha256:fileSha('tests/fixtures/m8-neutral-public-route.ts'),driverSha256:fileSha('scripts/generate-m5-route.cjs'),branches};
 migration.verifySources(sourceDigests);const output=JSON.stringify(audit,null,2)+'\n',destination='docs/evidence/v26-neutrals-1424/live-reveal-audit.json';if(process.argv.includes('--check'))assert.equal(fs.readFileSync(destination,'utf8'),output);else{fs.mkdirSync('docs/evidence/v26-neutrals-1424',{recursive:true});fs.writeFileSync(destination,output);}console.log(JSON.stringify({contentDigest:prefix.contentDigest,branches:Object.keys(branches),sameTick127:true,terminalTick165:true,partialReceipts:[branches['loris-r04'].receipts,branches['loris-r01'].receipts],unloadedCarrierReveals:branches.unloadedCarrier.newReveals}));
 }finally{await server.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});

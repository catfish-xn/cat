/* Public-command proof of the current mage route's neutral source death identities. */
const fs=require('node:fs'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const migration=require('./v17-fixture-audit.cjs'),baseCommit=migration.baselineCommit();
const sourceDigests=migration.sourceDigests();
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
async function main(){
 const {createServer}=await import('vite');const server=await createServer({configFile:false,...migration.viteOptions(),server:{middlewareMode:true,ws:false},appType:'custom',logLevel:'error'});
 try{
 const api=await server.ssrLoadModule('/src/simulation/match.ts');
 const helpers=await server.ssrLoadModule('/tests/fixtures/g2-3-b8-public.ts');
 const routes=await server.ssrLoadModule('/tests/fixtures/b8-live-reveal-routes.ts');
 // Same three public routes as tests/m8-b8-live-reveal.test.ts, loaded from the shared fixture.
 const prefix=await routes.simultaneousPrefix();
 const partialPrefixes={loris:await routes.barePartialPrefix('loris',routes.PARTIAL_REVEAL_SEEDS.loris,['bronze-for-life-i','pumping-up-ii','bronze-for-life-ii']),
  zyra:await routes.barePartialPrefix('zyra',routes.PARTIAL_REVEAL_SEEDS.zyra,['blistering-strikes','pumping-up-ii','bronze-for-life-ii'])};
 const accept=r=>{assert(r.ok!==false,r.reason);return r.state;};
 function resolve(state,base=prefix){
 state=accept(api.startMatchCombat(state));const events=[];
 while(state.phase==='combat'){const step=api.stepMatch(state);state=step.state;events.push(...step.events);}
 return {deaths:state.combat.neutralReceipts.deaths,reveals:events.filter(e=>e.type==='lootRevealed').map(e=>({dropId:e.dropId,death:e.death})),result:state.combat.result,phase:state.phase,eventHash:sha(events),terminalHash:sha(state),receipts:state.m8.loot.receipts.length-base.m8.loot.receipts.length,unitSerialDelta:state.nextUnitSerial-base.nextUnitSerial,itemSerialDelta:state.nextItemSerial-base.nextItemSerial};
 }
 const branches={full:resolve(prefix),simultaneous:resolve(helpers.simultaneousB8Preparation(prefix))};
 assert.deepEqual(branches.simultaneous.deaths.slice(0,2),[{unitId:'["pve","4-7","razorbeaks-v1","r00"]',tick:44,eventSeq:382},{unitId:'["pve","4-7","razorbeaks-v1","r01"]',tick:44,eventSeq:383}]);
 for(const definitionId of ['loris','zyra']){
 const base=partialPrefixes[definitionId],target=base.preparation.units.find(u=>u.team==='player'&&u.definitionId===definitionId);assert(target);
 branches[definitionId]={...resolve(helpers.partialB8Preparation(base,definitionId),base),star:target.starLevel,prefixHash:sha(base)};
 }
 assert.equal(branches.loris.deaths.length,1);assert.equal(branches.loris.deaths[0].tick,381);assert.equal(branches.loris.receipts,4);assert.equal(branches.loris.unitSerialDelta,0);assert.equal(branches.loris.itemSerialDelta,2);
 assert.equal(branches.zyra.deaths.length,1);assert.equal(branches.zyra.deaths[0].tick,152);assert.equal(branches.zyra.receipts,0);assert.equal(branches.zyra.unitSerialDelta,0);assert.equal(branches.zyra.itemSerialDelta,0);
 const previousAudit=JSON.parse(migration.archivedBytes(baseCommit,'docs/evidence/v16/live-reveal-audit.json'));
 const previousAssertions=previousAudit.currentAssertions;
 const currentAssertions={simultaneous:branches.simultaneous.deaths.slice(0,2),partialWithoutDrops:{definitionId:'zyra',tick:152}};
 const evidence=(value)=>({bytes:Buffer.byteLength(JSON.stringify(value)),sha256:sha(value)});
 const oldTest=require('node:child_process').execFileSync('git',['cat-file','--filters',`${baseCommit}:tests/m8-b8-live-reveal.test.ts`]);
 const newTest=fs.readFileSync('tests/m8-b8-live-reveal.test.ts');let first=0;
 while(first<Math.min(oldTest?.length??0,newTest.length)&&oldTest[first]===newTest[first])first++;
 const byteEvidence={previousCommit:baseCommit,previousBytes:oldTest.length,currentBytes:newTest.length,previousSha256:createHash('sha256').update(oldTest).digest('hex'),currentSha256:createHash('sha256').update(newTest).digest('hex'),firstDifferentByte:oldTest.equals(newTest)?null:first};
 const audit={baseCommit,sourceDigests,contentDigest:prefix.contentDigest,route:'mage',seed:routes.SIMULTANEOUS_REVEAL_SEED,roundId:'4-7',prefixHash:sha(prefix),previousAssertions,currentAssertions,assertionBytes:{previous:evidence(previousAssertions),current:evidence(currentAssertions)},byteEvidence,helperSha256:createHash('sha256').update(fs.readFileSync('tests/fixtures/g2-3-b8-public.ts')).digest('hex'),routesSha256:createHash('sha256').update(fs.readFileSync('tests/fixtures/b8-live-reveal-routes.ts')).digest('hex'),driverSha256:createHash('sha256').update(fs.readFileSync('scripts/generate-m5-route.cjs')).digest('hex'),branches};
 migration.verifySources(sourceDigests);const output=JSON.stringify(audit,null,2)+'\n',destination='docs/evidence/v17/live-reveal-audit.json';if(process.argv.includes('--check'))assert.equal(fs.readFileSync(destination,'utf8'),output);else{fs.mkdirSync('docs/evidence/v17',{recursive:true});fs.writeFileSync(destination,output);}console.log(JSON.stringify({contentDigest:prefix.contentDigest,branches:Object.keys(branches),sameTick44:true,partialReceipts:[branches.loris.receipts,branches.zyra.receipts]}));
 }finally{await server.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});

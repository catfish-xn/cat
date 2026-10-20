/* Recompile independent archived minimal side assets; rerun current resolver.
 * Fingerprints are generated from the same explicit public inputs as B8.
 * Historical inputs stay byte-for-byte unchanged. No version-string patching. */
const fs=require('node:fs'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const migration=require('./v16-fixture-audit.cjs'),baseCommit=migration.baselineCommit();
const sha=x=>createHash('sha256').update(typeof x==='string'||Buffer.isBuffer(x)?x:JSON.stringify(x)).digest('hex');
const evidence=(a,b)=>{a=Buffer.from(a);b=Buffer.from(b);let first=0;while(first<Math.min(a.length,b.length)&&a[first]===b[first])first++;return {previousBytes:a.length,currentBytes:b.length,previousSha256:sha(a),currentSha256:sha(b),firstDifferentByte:first===a.length&&first===b.length?null:first};};
async function main(){
 const {createServer}=await import('vite');const server=await createServer({configFile:false,...migration.viteOptions(),server:{middlewareMode:true,ws:false},appType:'custom',logLevel:'error'});
 try{
 const {toCombatReplay}=await server.ssrLoadModule('/src/simulation/combat-replay-view.ts');
 const {snapshotForBattle}=await server.ssrLoadModule('/src/simulation/two-sided-snapshot.ts');
 const api=await server.ssrLoadModule('/src/simulation/match.ts'),battle=await server.ssrLoadModule('/src/simulation/two-sided-battle.ts'),{CONTENT_DIGEST}=await server.ssrLoadModule('/src/simulation/content/index.ts'),{ROUND_CATALOG}=await server.ssrLoadModule('/src/simulation/content/round-catalog.ts');
 const outputs=new Map(),audit={baseCommit,sourceDigests:migration.sourceDigests(),contentDigest:CONTENT_DIGEST,files:{}};
 const record=(p,value,prior)=>{const b=Buffer.from(JSON.stringify(value,null,2)+'\n');outputs.set(p,b);audit.files[p]=evidence(migration.archivedBytes(baseCommit,prior),b);};
 const old='tests/fixtures/v15-c19-seed-9-minimal.json',prior=JSON.parse(migration.archivedBytes(baseCommit,old));
 const compiled=battle.compileBattle({...prior.a,contentDigest:CONTENT_DIGEST},{...prior.b,contentDigest:CONTENT_DIGEST},prior.battleSeed,{battleId:prior.battleId,mirrorOfSeatId:prior.mirrorOfSeatId??undefined});
 const result=battle.resolveTwoSidedBattle(compiled,5000),pulses=result.events.filter(e=>e.type==='packetDamage'&&e.outcome.context.damageType==='true');
 assert.equal(result.terminal.tick,273);assert.equal(result.terminal.result,'enemyWin');
 for(const [unitId,deathTick,count] of [['unit-42',148,5],['unit-48',273,11]]){
  const id=JSON.stringify(['t2','s3','unit',unitId]);assert.equal(result.events.find(e=>e.type==='death'&&e.unitId===id)?.tick,deathTick);
  assert.deepEqual(pulses.filter(e=>e.outcome.context.targetId===id).map(e=>e.tick),Array.from({length:count},(_,i)=>60+i*20));
 }
 audit.c19={terminalHash:sha(result.terminal),eventsHash:sha(result.events),truePulseHash:sha(pulses),independentBurnIntervalChecks:true};
 record('tests/fixtures/v16-c19-seed-9-minimal.json',compiled,old);
 const fingerprints={};
 for(const count of [0,1,9]){
  const base=api.createMatch(42),round=ROUND_CATALOG.find(r=>r.roundId==='2-1'),names=['irelia','leona','tristana','maddie','lux','darius','irelia','leona','lux'];
  const state={...base,level:9,round:round.ordinal,roundDefinitionId:round.roundId,m8:{...base.m8,round},items:[],preparation:{...base.preparation,units:names.slice(0,count).map((definitionId,i)=>({id:`unit-${i+1}`,definitionId,team:'player',starLevel:1,location:{kind:'board',cell:{col:i%7,row:4+Math.floor(i/7)}}}))}};
  const resolved=battle.resolveTwoSidedBattle(battle.compileBattle(snapshotForBattle(state,'A'),snapshotForBattle(state,'B'),42,{battleId:'resumable'}),1201),replay=toCombatReplay(resolved),legacy={...replay,ticks:replay.ticks.map(frame=>({...frame,events:frame.events.map(event=>{if(event.type!=='heal')return event;const {shares,...rest}=event;return rest;})}))};
  fingerprints[count]=[sha(resolved),sha(legacy)];
 }
 record('tests/fixtures/v16-b8-fingerprints.json',fingerprints,'tests/fixtures/v15-b8-fingerprints.json');
 // Final fixture generation records these independently generated Herald bytes too.
 const dir='tests/fixtures/v16-herald-raw';
 const manifest=JSON.parse(fs.readFileSync(dir+'/manifest.json'));assert.equal(manifest.contentDigest,CONTENT_DIGEST,'Generate Herald first at final identity');assert.equal(manifest.cases.length,5);
 assert.equal(sha(fs.readFileSync(dir+'/trajectory.json')),manifest.traceSha256);
 for(const entry of manifest.cases)assert.equal(sha(fs.readFileSync(dir+'/'+entry.file)),entry.rawSha256);
 for(const name of [...manifest.cases.map(e=>e.file),'manifest.json','trajectory.json'])audit.files[dir+'/'+name]=evidence(migration.archivedBytes(baseCommit,'tests/fixtures/v15-herald-raw/'+name),fs.readFileSync(dir+'/'+name));
 migration.verifySources(audit.sourceDigests);
 for(const [p,b] of outputs)if(process.argv.includes('--check'))assert.deepEqual(fs.readFileSync(p),b);else fs.writeFileSync(p,b);
 const path='docs/evidence/v16/input-fixture-audit.json',bytes=JSON.stringify(audit,null,2)+'\n';if(process.argv.includes('--check'))assert.equal(fs.readFileSync(path,'utf8'),bytes);else{fs.mkdirSync('docs/evidence/v16',{recursive:true});fs.writeFileSync(path,bytes);}
 console.log(JSON.stringify({contentDigest:CONTENT_DIGEST,cases:Object.keys(audit.files).length}));
 }finally{await server.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});

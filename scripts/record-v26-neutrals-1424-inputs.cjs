/* Recompile independent archived minimal side assets; rerun current resolver.
 * Fingerprints are generated from the same explicit public inputs as B8.
 * Historical inputs stay byte-for-byte unchanged. No version-string patching. */
const fs=require('node:fs'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const migration=require('./v26-neutrals-1424-fixture-audit.cjs'),baseCommit=migration.baselineCommit();
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
 const old='tests/fixtures/v25-online-rules-c19-seed-9-minimal.json',prior=JSON.parse(migration.archivedBytes(baseCommit,old));
 // v26: targeting-p1 (8106acee) keeps the archived Ezreal (unit-42, cell 4,7) out of the Sunfire radius
 // until tick 200, so the archived placement no longer attaches both burns on the same tick 40. Only
 // Ezreal's board cell is re-picked: the nearest cell (|dcol|+|drow|, then row, col) whose battle keeps
 // the SR-C19-01 obligations, one pulse per live 20-tick interval from 60 until death with Ezreal's 6
 // and Garen's 15 pulses. All other compiled bytes and the battle seed come from the archived input.
 const compile=a=>battle.compileBattle({...a,contentDigest:CONTENT_DIGEST},{...prior.b,contentDigest:CONTENT_DIGEST},prior.battleSeed,{battleId:prior.battleId,mirrorOfSeatId:prior.mirrorOfSeatId??undefined});
 const truePulses=r=>r.events.filter(e=>e.type==='packetDamage'&&e.outcome.context.damageType==='true');
 const intervals=(r,unitId)=>{const id=JSON.stringify(['t2','s3','unit',unitId]),deathTick=r.events.find(e=>e.type==='death'&&e.unitId===id)?.tick,paid=truePulses(r).filter(e=>e.outcome.context.targetId===id).map(e=>e.tick);
  return Number.isSafeInteger(deathTick)&&deathTick>=60&&JSON.stringify(paid)===JSON.stringify(Array.from({length:Math.floor((deathTick-60)/20)+1},(_,i)=>60+i*20))?paid.length:null;};
 const original=prior.a.units.find(u=>u.id==='unit-42').location.cell,occupied=new Set(prior.a.units.filter(u=>u.id!=='unit-42').map(u=>u.location.cell.col+','+u.location.cell.row));
 const cells=[];for(let row=4;row<8;row++)for(let col=0;col<7;col++)if(!occupied.has(col+','+row))cells.push({col,row});
 cells.sort((x,y)=>(Math.abs(x.col-original.col)+Math.abs(x.row-original.row))-(Math.abs(y.col-original.col)+Math.abs(y.row-original.row))||x.row-y.row||x.col-y.col);
 const placementSearch=[];let compiled,result;
 for(const cell of cells){
  const a={...prior.a,units:prior.a.units.map(u=>u.id==='unit-42'?{...u,location:{...u.location,cell}}:u)},c=compile(a),r=battle.resolveTwoSidedBattle(c,5000);
  const counts={ezreal:intervals(r,'unit-42'),garen:intervals(r,'unit-48')},accepted=counts.ezreal===6&&counts.garen===15;
  placementSearch.push({cell,terminalTick:r.terminal.tick,...counts,accepted});
  if(accepted){compiled=c;result=r;break;}
 }
 assert(compiled,'No Ezreal placement keeps the SR-C19-01 same-tick burn obligations');
 const pulses=truePulses(result);
 // v22 combat moves the death ticks; the invariant is one burn pulse per live 20-tick interval from tick 60 until death.
 const deaths={};
 for(const unitId of ['unit-42','unit-48']){
  const id=JSON.stringify(['t2','s3','unit',unitId]),deathTick=result.events.find(e=>e.type==='death'&&e.unitId===id)?.tick;
  assert(Number.isSafeInteger(deathTick)&&deathTick>=60,unitId+' dies after its first pulse');
  assert.deepEqual(pulses.filter(e=>e.outcome.context.targetId===id).map(e=>e.tick),Array.from({length:Math.floor((deathTick-60)/20)+1},(_,i)=>60+i*20));
  deaths[unitId]=deathTick;
 }
 console.log(JSON.stringify({c19:{terminal:result.terminal.tick,result:result.terminal.result,deaths}}));
 audit.c19={archivedEzrealCell:original,placementSearch,terminalTick:result.terminal.tick,result:result.terminal.result,deaths,terminalHash:sha(result.terminal),eventsHash:sha(result.events),truePulseHash:sha(pulses),independentBurnIntervalChecks:true};
 record('tests/fixtures/v26-neutrals-1424-c19-seed-9-minimal.json',compiled,old);
 const fingerprints={};
 for(const count of [0,1,9]){
  const base=api.createMatch(42),round=ROUND_CATALOG.find(r=>r.roundId==='2-1'),names=['irelia','leona','tristana','maddie','lux','darius','irelia','leona','lux'];
  const state={...base,level:9,round:round.ordinal,roundDefinitionId:round.roundId,m8:{...base.m8,round},items:[],preparation:{...base.preparation,units:names.slice(0,count).map((definitionId,i)=>({id:`unit-${i+1}`,definitionId,team:'player',starLevel:1,location:{kind:'board',cell:{col:i%7,row:4+Math.floor(i/7)}}}))}};
  const resolved=battle.resolveTwoSidedBattle(battle.compileBattle(snapshotForBattle(state,'A'),snapshotForBattle(state,'B'),42,{battleId:'resumable'}),1201),replay=toCombatReplay(resolved),legacy={...replay,ticks:replay.ticks.map(frame=>({...frame,events:frame.events.map(event=>{if(event.type!=='heal')return event;const {shares,...rest}=event;return rest;})}))};
  fingerprints[count]=[sha(resolved),sha(legacy)];
 }
 record('tests/fixtures/v26-neutrals-1424-b8-fingerprints.json',fingerprints,'tests/fixtures/v25-online-rules-b8-fingerprints.json');
 // Final fixture generation records these independently generated Herald bytes too.
 const dir='tests/fixtures/v26-neutrals-1424-herald-raw';
 const manifest=JSON.parse(fs.readFileSync(dir+'/manifest.json'));assert.equal(manifest.contentDigest,CONTENT_DIGEST,'Generate Herald first at final identity');assert.equal(manifest.cases.length,5);
 assert.equal(sha(fs.readFileSync(dir+'/trajectory.json')),manifest.traceSha256);
 for(const entry of manifest.cases)assert.equal(sha(fs.readFileSync(dir+'/'+entry.file)),entry.rawSha256);
 for(const name of [...manifest.cases.map(e=>e.file),'manifest.json','trajectory.json'])audit.files[dir+'/'+name]=evidence(migration.archivedBytes(baseCommit,'tests/fixtures/v25-online-rules-herald-raw/'+name),fs.readFileSync(dir+'/'+name));
 migration.verifySources(audit.sourceDigests);
 for(const [p,b] of outputs)if(process.argv.includes('--check'))assert.deepEqual(fs.readFileSync(p),b);else fs.writeFileSync(p,b);
 const path='docs/evidence/v26-neutrals-1424/input-fixture-audit.json',bytes=JSON.stringify(audit,null,2)+'\n';if(process.argv.includes('--check'))assert.equal(fs.readFileSync(path,'utf8'),bytes);else{fs.mkdirSync('docs/evidence/v26-neutrals-1424',{recursive:true});fs.writeFileSync(path,bytes);}
 console.log(JSON.stringify({contentDigest:CONTENT_DIGEST,cases:Object.keys(audit.files).length}));
 }finally{await server.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});

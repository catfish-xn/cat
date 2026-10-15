/* Recompile the historical C19 input with the current compiler and retain real byte/first-difference evidence. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{createHash}=require('node:crypto'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),base=process.argv.find(a=>a.startsWith('--baseline-root='))?.slice(16);
assert(base,'--baseline-root=<unmodified a159fbb export> required');
const sha=b=>createHash('sha256').update(b).digest('hex');
function first(a,b,p='$'){if(JSON.stringify(a)===JSON.stringify(b))return null;if(!a||!b||typeof a!=='object'||typeof b!=='object')return {path:p,previous:a,current:b};for(const k of new Set([...Object.keys(a),...Object.keys(b)])){const d=first(a[k],b[k],`${p}.${k}`);if(d)return d;}return null;}
function compare(a,b){const x=Buffer.from(JSON.stringify(a)),y=Buffer.from(JSON.stringify(b));let i=0;while(i<Math.min(x.length,y.length)&&x[i]===y[i])i++;return {previousBytes:x.length,currentBytes:y.length,previousSha256:sha(x),currentSha256:sha(y),byteEqual:x.equals(y),firstByteOffset:x.equals(y)?null:i,firstDifference:first(a,b)};}
(async()=>{const {createServer}=await import('vite');const servers=[];try{
const files=execFileSync('git',['ls-tree','-r','--name-only','a159fbb','src/simulation'],{cwd:root,encoding:'utf8'}).trim().split('\n');
for(const f of files)assert(fs.readFileSync(path.join(base,f)).equals(execFileSync('git',['show',`a159fbb:${f}`],{cwd:root,maxBuffer:30*1024*1024})),`baseline source ${f}`);
for(const dir of [base,root])servers.push(await createServer({root:dir,configFile:false,server:{middlewareMode:true,ws:false},appType:'custom',logLevel:'error'}));
const [old,now]=await Promise.all(servers.map(s=>s.ssrLoadModule('/src/simulation/two-sided-battle.ts'))),content=await servers[1].ssrLoadModule('/src/simulation/content/index.ts');
const file='tests/fixtures/c19-seed-9-minimal.json',prior=JSON.parse(fs.readFileSync(path.join(base,file))),current=now.compileBattle({...prior.a,contentDigest:content.CONTENT_DIGEST},{...prior.b,contentDigest:content.CONTENT_DIGEST},prior.battleSeed,{battleId:prior.battleId,mirrorOfSeatId:prior.mirrorOfSeatId??undefined});
const before=old.resolveTwoSidedBattle(prior,5000),after=now.resolveTwoSidedBattle(current,5000);
const pulse=r=>r.events.filter(e=>e.type==='packetDamage'&&e.outcome.context.damageType==='true');
const report={baseline:'a159fbb',c19:{compiled:compare(prior,current),terminal:compare(before.terminal,after.terminal),events:compare(before.events,after.events),pulses:compare(pulse(before),pulse(after)),terminalTick:after.terminal.tick,result:after.terminal.result,pulseCount:pulse(after).length},herald:{}};
for(const name of ['ionic-spark','evenshroud','ionic-spark--evenshroud','quicksilver','edge-of-night','trajectory','manifest'])report.herald[name]=compare(JSON.parse(fs.readFileSync(path.join(base,`tests/fixtures/t13-herald-raw/${name}.json`))),JSON.parse(fs.readFileSync(path.join(root,`tests/fixtures/g2-1-herald-raw/${name}.json`))));
const fingerprints={};report.b8={};
for(const count of [0,1,9]){const results=[];for(const [i,server]of servers.entries()){
 const api=await server.ssrLoadModule('/src/server-entry/index.ts');
 const baseState=api.createMatch(42),round=(await server.ssrLoadModule('/src/simulation/content/round-catalog.ts')).ROUND_CATALOG.find(r=>r.roundId==='2-1');
 const names=['irelia','leona','tristana','maddie','lux','darius','irelia','leona','lux'];
 const state={...baseState,level:9,round:round.ordinal,roundDefinitionId:round.roundId,m8:{...baseState.m8,round},items:[],preparation:{...baseState.preparation,units:names.slice(0,count).map((definitionId,n)=>({id:`unit-${n+1}`,definitionId,team:'player',starLevel:1,location:{kind:'board',cell:{col:n%7,row:4+Math.floor(n/7)}}}))}};
 const compiled=api.compileBattle(api.snapshotForBattle(state,'A'),api.snapshotForBattle(state,'B'),42,{battleId:'resumable'});
 const battle=api.resolveTwoSidedBattle(compiled,1201);results.push({battle,replay:api.toCombatReplay(battle)});
 }report.b8[count]={battle:compare(results[0].battle,results[1].battle),replay:compare(results[0].replay,results[1].replay)};fingerprints[count]=[sha(Buffer.from(JSON.stringify(results[1].battle))),sha(Buffer.from(JSON.stringify(results[1].replay)))];}
const fingerprintBytes=JSON.stringify(fingerprints,null,2)+'\n';
if(process.argv.includes('--write'))fs.writeFileSync(path.join(root,'tests/fixtures/g2-1-b8-fingerprints.json'),fingerprintBytes);else assert.equal(fs.readFileSync(path.join(root,'tests/fixtures/g2-1-b8-fingerprints.json'),'utf8'),fingerprintBytes);
const out=JSON.stringify(current,null,2)+'\n',evidence=JSON.stringify(report,null,2)+'\n';
if(process.argv.includes('--write')){fs.writeFileSync(path.join(root,file),out);fs.writeFileSync(path.join(root,'docs/evidence/g2-1/fixture-migration.json'),evidence);}else{assert.equal(fs.readFileSync(path.join(root,file),'utf8'),out);assert.equal(fs.readFileSync(path.join(root,'docs/evidence/g2-1/fixture-migration.json'),'utf8'),evidence);}
console.log(JSON.stringify(report.c19));
}finally{for(const s of servers)await s.close();}})().catch(e=>{console.error(e);process.exitCode=1});

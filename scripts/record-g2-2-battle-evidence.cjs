const fs=require('node:fs'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
function compare(a,b){const x=Buffer.from(JSON.stringify(a)),y=Buffer.from(JSON.stringify(b));let n=0;while(n<Math.min(x.length,y.length)&&x[n]===y[n])n++;return{previousBytes:x.length,currentBytes:y.length,previousSha256:sha(a),currentSha256:sha(b),byteEqual:x.equals(y),firstByteOffset:x.equals(y)?null:n};}
const write=(p,x)=>{const s=JSON.stringify(x,null,2)+'\n';if(process.argv.includes('--check'))assert.equal(fs.readFileSync(p,'utf8'),s);else fs.writeFileSync(p,s);};
(async()=>{const {createServer}=await import('vite');const s=await createServer({configFile:false,server:{middlewareMode:true,ws:false},appType:'custom',logLevel:'error'});try{
 const api=await s.ssrLoadModule('/src/server-entry/index.ts');const content=await s.ssrLoadModule('/src/simulation/content/index.ts');
 const prior=JSON.parse(fs.readFileSync('tests/fixtures/p7-c19-seed-9-minimal.json'));
 const compiled=api.compileBattle({...prior.a,contentDigest:content.CONTENT_DIGEST},{...prior.b,contentDigest:content.CONTENT_DIGEST},prior.battleSeed,{battleId:prior.battleId,mirrorOfSeatId:prior.mirrorOfSeatId??undefined});
 const result=api.resolveTwoSidedBattle(compiled,5000);write('tests/fixtures/g2-2-c19-seed-9-minimal.json',compiled);
 const evidence={contentDigest:content.CONTENT_DIGEST,c19:{compiled:compare(prior,compiled),terminalSha256:sha(result.terminal),eventsSha256:sha(result.events),result:result.terminal.result,tick:result.terminal.tick},b8:{}};const fingerprints={};
 for(const count of [0,1,9]){
  const base=api.createMatch(42),round=(await s.ssrLoadModule('/src/simulation/content/round-catalog.ts')).ROUND_CATALOG.find(r=>r.roundId==='2-1');
  const names=['irelia','leona','tristana','maddie','lux','darius','irelia','leona','lux'];
  const state={...base,level:9,round:round.ordinal,roundDefinitionId:round.roundId,m8:{...base.m8,round},items:[],preparation:{...base.preparation,units:names.slice(0,count).map((definitionId,i)=>({id:`unit-${i+1}`,definitionId,team:'player',starLevel:1,location:{kind:'board',cell:{col:i%7,row:4+Math.floor(i/7)}}}))}};
  const battle=api.resolveTwoSidedBattle(api.compileBattle(api.snapshotForBattle(state,'A'),api.snapshotForBattle(state,'B'),42,{battleId:'resumable'}),1201),replay=api.toCombatReplay(battle);
  const legacyReplay={...replay,ticks:replay.ticks.map(frame=>({...frame,events:frame.events.map(event=>{if(event.type!=='heal')return event;const{shares,...legacy}=event;return legacy;})}))};
  fingerprints[count]=[sha(battle),sha(legacyReplay)];evidence.b8[count]={previous:JSON.parse(fs.readFileSync('tests/fixtures/g2-1-b8-fingerprints.json'))[count],current:fingerprints[count],tick:battle.terminal.tick,result:battle.terminal.result};
 }
 write('tests/fixtures/g2-2-b8-fingerprints.json',fingerprints);write('docs/evidence/g2-2/battle-byte-evidence.json',evidence);console.log(JSON.stringify(evidence));
}finally{await s.close();}})().catch(e=>{console.error(e);process.exitCode=1});

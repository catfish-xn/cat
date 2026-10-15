/* Execute both unmodified historical and current public fixtures; record full-byte
 * hashes and the first structural gameplay difference separately from identity. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{createHash}=require('node:crypto'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),baseline=process.argv.find(a=>a.startsWith('--baseline-root='))?.slice(16);assert(baseline);
const sha=x=>createHash('sha256').update(x).digest('hex');
const first=(a,b,p='$')=>{if(JSON.stringify(a)===JSON.stringify(b))return null;if(!a||!b||typeof a!=='object'||typeof b!=='object')return {path:p,previous:a,current:b};for(const k of new Set([...Object.keys(a),...Object.keys(b)])){const r=first(a[k],b[k],p+'.'+k);if(r)return r;}return null};
const gameplay=x=>JSON.parse(JSON.stringify(x),(k,v)=>['rulesVersion','contentVersion','contentDigest','lootReplayDigest','rulesDigest','digest'].includes(k)?undefined:v);
const compare=(a,b)=>{const x=Buffer.from(JSON.stringify(a)),y=Buffer.from(JSON.stringify(b));let n=0;while(n<Math.min(x.length,y.length)&&x[n]===y[n])n++;return {previousBytes:x.length,currentBytes:y.length,previousSha256:sha(x),currentSha256:sha(y),byteEqual:x.equals(y),firstByteOffset:x.equals(y)?null:n,firstDifference:first(a,b),firstGameplayDifference:first(gameplay(a),gameplay(b))};};
(async()=>{const {createServer}=await import('vite'),servers=[];try{
const files=execFileSync('git',['ls-tree','-r','--name-only','a159fbb','src/simulation'],{cwd:root,encoding:'utf8'}).trim().split('\n');
for(const f of files)assert(fs.readFileSync(path.join(baseline,f)).equals(execFileSync('git',['show',`a159fbb:${f}`],{cwd:root,maxBuffer:30*1024*1024})),`baseline source ${f}`);
const report={baseline:execFileSync('git',['rev-parse','a159fbb'],{cwd:root,encoding:'utf8'}).trim(),baselineSimulationFilesVerified:files.length,cases:{}};
for(const dir of [baseline,root])servers.push(await createServer({root:dir,configFile:false,server:{middlewareMode:true,ws:false},appType:'custom',logLevel:'error'}));
const all=[];
for(const [i,server]of servers.entries()){
 const h=await server.ssrLoadModule('/tests/fixtures/t13-loot-public.ts'),api=await server.ssrLoadModule('/src/simulation/match.ts');
 const cases={};
 const scenarios={transfer:()=>h.transferPreparation(),growth:()=>h.configuredPrefix('3-7',{seed:i?48:74,build:'cannon',copyLimits:{tristana:2},fieldCopies:['tristana']}),capacity:async()=>h.fillBench(await h.publicPrefix('3-7',36),['tristana']),terminalTwoCarriers:()=>h.terminalPreparation(i?'unit-7':'unit-12'),terminalOneCarrier:()=>h.terminalPreparation(i?'unit-6':'unit-11')};
 for(const [name,fn]of Object.entries(scenarios)){const prepared=await fn(),live=h.battle(prepared);cases[name]={prepared,events:live.events,ended:live.ended};console.log(JSON.stringify({engine:i?'G2':'historical',case:name,tick:live.ended.combat.tick}));}
 const mage=await h.publicPrefix('4-7',42,'mage');for(const [name,id]of [['partialCarrier',i?'unit-11':'unit-12'],['partialNonCarrier',i?'unit-15':'unit-16']]){const prepared=h.reserveExcept(mage,[id]),live=h.battle(prepared);cases[name]={prepared,events:live.events,ended:live.ended};}
 all.push(cases);
}
for(const name of Object.keys(all[0]))report.cases[name]=Object.fromEntries(['prepared','events','ended'].map(k=>[k,compare(all[0][name][k],all[1][name][k])]));
report.recordingCommand='node scripts/record-g2-1-public-fixtures.cjs --baseline-root=<a159fbb-export> --write';
const output=JSON.stringify(report,null,2)+'\n',file=path.join(root,'docs/evidence/g2-1/public-fixture-migration.json');if(process.argv.includes('--write'))fs.writeFileSync(file,output);else assert.equal(fs.readFileSync(file,'utf8'),output);
}finally{for(const s of servers)await s.close()}})().catch(e=>{console.error(e);process.exitCode=1});

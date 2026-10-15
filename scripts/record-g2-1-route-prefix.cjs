/* Compare the first changed battle using each tree's own public route driver. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{createHash}=require('node:crypto'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),base=process.argv.find(x=>x.startsWith('--baseline-root='))?.slice(16);assert(base);
const sha=b=>createHash('sha256').update(b).digest('hex');
const first=(a,b,p='$')=>{if(JSON.stringify(a)===JSON.stringify(b))return null;if(!a||!b||typeof a!=='object'||typeof b!=='object')return {path:p,previous:a,current:b};for(const k of new Set([...Object.keys(a),...Object.keys(b)])){const d=first(a[k],b[k],p+'.'+k);if(d)return d;}return null;};
function compare(a,b){const x=Buffer.from(JSON.stringify(a)),y=Buffer.from(JSON.stringify(b));let i=0;while(i<Math.min(x.length,y.length)&&x[i]===y[i])i++;return {previousBytes:x.length,currentBytes:y.length,previousSha256:sha(x),currentSha256:sha(y),firstByteOffset:x.equals(y)?null:i,firstDifference:first(a,b)};}
(async()=>{const {createServer}=await import('vite'),servers=[];try{
 const report={baseline:execFileSync('git',['rev-parse','a159fbb'],{cwd:root,encoding:'utf8'}).trim(),builds:{}};
 const oldDriver=fs.readFileSync(path.join(base,'scripts/generate-m5-route.cjs'));
 assert(oldDriver.equals(execFileSync('git',['show','a159fbb:scripts/generate-m5-route.cjs'],{cwd:root})));report.previousDriverSha256=sha(oldDriver);report.currentDriverSha256=sha(fs.readFileSync(path.join(root,'scripts/generate-m5-route.cjs')));
 for(const dir of [base,root])servers.push(await createServer({root:dir,configFile:false,server:{middlewareMode:true,ws:false},appType:'custom',logLevel:'error'}));
 for(const build of ['cannon','sniper','mage','sniper-caitlyn']){
  const pair=[];
  for(const [i,dir]of [base,root].entries()){
   const api=await servers[i].ssrLoadModule('/src/simulation/match.ts'),{run}=require(path.join(dir,'scripts/generate-m5-route.cjs'));
   const done=Symbol('round-two-complete'),events=[],commands=[];let terminal;
   try{await run(api,{build,seed:42,onStep:(before,result,command)=>{if(command)commands.push(command);if(before.round===2){events.push(...result.events);if(before.phase==='combat'&&result.state.phase!=='combat'){terminal=result.state;throw done;}}}});}catch(e){if(e!==done)throw e;}
   assert(terminal);pair.push({commands,events,terminal});
  }
  report.builds[build]=Object.fromEntries(['commands','events','terminal'].map(k=>[k,compare(pair[0][k],pair[1][k])]));
 }
 const text=JSON.stringify(report,null,2)+'\n',target=path.join(root,'docs/evidence/g2-1/route-prefix-migration.json');if(process.argv.includes('--write'))fs.writeFileSync(target,text);else assert.equal(fs.readFileSync(target,'utf8'),text);
 console.log('Verified first two public battles for four old/new routes');
}finally{for(const s of servers)await s.close();}})().catch(e=>{console.error(e);process.exitCode=1});

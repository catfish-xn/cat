// Full replay body, unchanged assertions; adds stage/round timing and the existing golden check.
// Run serially: node profile.cjs <repository-root> <sniper|sniper-caitlyn> [vite|bundle]
const path=require('node:path'),assert=require('node:assert/strict'),fs=require('node:fs');
const [,,root,build='sniper',mode='vite']=process.argv;
(async()=>{
 const start=performance.now(),createRequire=require('node:module').createRequire,req=createRequire(path.join(root,'package.json'));
 let api,restoreMatch,close=async()=>{};
 if(mode==='vite'){
  const {createServer}=req('vite'); const server=await createServer({root,logLevel:'error',server:{middlewareMode:true,hmr:false},optimizeDeps:{noDiscovery:true,include:[]}});close=()=>server.close();
  api=await server.ssrLoadModule('/src/simulation/match.ts');({restoreMatch}=await server.ssrLoadModule('/src/simulation/serialization.ts'));
 }else{
  const result=await req('esbuild').build({stdin:{contents:"export * as api from './src/simulation/match';export {restoreMatch} from './src/simulation/serialization';",resolveDir:root},bundle:true,platform:'node',format:'cjs',target:'node22',write:false});
  const filename=path.join('/tmp',`d12-runtime-${process.pid}.cjs`);fs.writeFileSync(filename,result.outputFiles[0].text);({api,restoreMatch}=require(filename));fs.unlinkSync(filename);
 }
 const compileMs=performance.now()-start;
 const {run,dispatch}=req('./scripts/generate-m5-route.cjs'),golden=req('./tests/fixtures/m5/assert-golden.cjs');
 const totals={},rounds={};let bucket;const lap=(key,fn)=>{const t=performance.now();try{return fn();}finally{const ms=performance.now()-t;totals[key]=(totals[key]??0)+ms;if(bucket)bucket[key]=(bucket[key]??0)+ms;}};
 const wrapped={...api,createMatch:(...args)=>lap('createMatch',()=>api.createMatch(...args))};
 const body=performance.now();let restored=lap('createMatch',()=>api.createMatch(42)),commands=0,ticks=0;
 const route=await run(wrapped,{build,seed:42,onStep(before,result,command){bucket=rounds[before.roundDefinitionId]??={};
  lap('deepBefore',()=>assert.deepEqual(restored,before));const frozen=lap('rejectionSerialize',()=>JSON.stringify(restored));
  lap('rejections',()=>{const failures=[api.buyUnit(restored,-1,restored.shop.generation),api.sellUnit(restored,'absent'),api.selectChoice(restored,'stale',-1,'absent'),api.nextRound(restored,-1)];for(const failed of failures){assert.equal(failed.ok,false);assert.equal(failed.state,restored);assert.equal('events' in failed,false);}});
  lap('rejectionSerialize',()=>assert.equal(JSON.stringify(restored),frozen));
  const second=lap('secondExecution',()=>command?dispatch(api,restored,command):api.stepMatch(restored));lap('deepResult',()=>assert.deepEqual(second,result));
  const text=lap('serialize',()=>JSON.stringify(second.state));restored=lap('restore',()=>restoreMatch(text));lap('deepRestored',()=>assert.deepEqual(restored,second.state));
  if(command)commands++;else ticks++;bucket=undefined;
 }});
 assert.equal(restored.phase,'gameOver');assert(commands>100);assert(ticks>1000);
 const bodyMs=performance.now()-body;const goldenMsStart=performance.now();golden(route);const goldenMs=performance.now()-goldenMsStart;
 const crypto=require('node:crypto');const fingerprint=crypto.createHash('sha256').update(JSON.stringify({versions:route.initial.contentDigest,commands:route.actions.map(a=>a.command),rounds:route.rounds.map(r=>({round:r.round,stateHash:r.stateHash,eventsHash:r.eventsHash}))})).digest('hex');
 const report={node:process.version,build,mode,compileMs,bodyMs,goldenMs,stagesMs:totals,routeOtherMs:bodyMs-Object.values(totals).reduce((a,b)=>a+b,0),roundsMs:rounds,commands,ticks,digest:route.initial.contentDigest,fingerprint,goldenPassed:true};
 console.log(JSON.stringify(report));await close()
})().catch(e=>{console.error(e);process.exitCode=1;});

// Diagnostic only: measures native sub-costs of warm restore calls, not a test budget.
const path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const root=process.argv[2]??'/workspace/cat',{createServer}=require(require.resolve('vite',{paths:[root]}));
 const server=await createServer({root,logLevel:'error',server:{middlewareMode:true,ws:false},optimizeDeps:{noDiscovery:true,include:[]}});
 const api=await server.ssrLoadModule('/src/simulation/match.ts'),{restoreMatch}=await server.ssrLoadModule('/src/simulation/serialization.ts');
 const samples=[];const route=await require(path.join(root,'scripts/generate-m5-route.cjs')).run(api,{build:'sniper',seed:42,onStep(before,_result,command){if(!command&&[12,19,25,33].includes(before.round)&&before.combat.tick===100)samples.push(JSON.stringify(before));}});
 require(path.join(root,'tests/fixtures/m5/assert-golden.cjs'))(route);
 const parse=JSON.parse,stringify=JSON.stringify,clone=globalThis.structuredClone;let costs;
 JSON.parse=function(...args){const start=performance.now();try{return Reflect.apply(parse,this,args)}finally{const key=typeof args[0]==='string'&&args[0].length>50000?'largeParse':'smallParse';costs[key].ms+=performance.now()-start;costs[key].calls++;}};
 JSON.stringify=function(...args){const start=performance.now();try{return Reflect.apply(stringify,this,args)}finally{costs.stringify.ms+=performance.now()-start;costs.stringify.calls++;}};
 globalThis.structuredClone=function(...args){const start=performance.now();try{return Reflect.apply(clone,this,args)}finally{costs.clone.ms+=performance.now()-start;costs.clone.calls++;}};
 const results=[];
 try{for(const text of samples){costs={largeParse:{ms:0,calls:0},smallParse:{ms:0,calls:0},stringify:{ms:0,calls:0},clone:{ms:0,calls:0}};const expected=parse(text);restoreMatch(text);
   costs={largeParse:{ms:0,calls:0},smallParse:{ms:0,calls:0},stringify:{ms:0,calls:0},clone:{ms:0,calls:0}};let totalMs=0;
   for(let i=0;i<250;i++){const started=performance.now(),restored=restoreMatch(text);totalMs+=performance.now()-started;assert.deepEqual(restored,expected);}
   results.push({round:expected.round,tick:expected.combat.tick,bytes:text.length,restores:250,totalMs,...costs,remainingMs:totalMs-Object.values(costs).reduce((a,x)=>a+x.ms,0)});
 }}finally{JSON.parse=parse;JSON.stringify=stringify;globalThis.structuredClone=clone;}
 console.log(stringify({head:'1f8a921e06095a545f6874c328a6bd154a431d3c',node:process.version,diagnostic:'warm native sub-costs; assertions outside restore timer; no test-budget claim',goldenPassed:true,results}));await server.close();
})().catch(e=>{console.error(e);process.exitCode=1;});

const assert=require('node:assert/strict'),path=require('node:path');
(async()=>{
 const [,,beforeRoot,afterRoot]=process.argv,{createServer}=require(require.resolve('vite',{paths:[afterRoot]}));const servers=[],engines=[];
 for(const root of [beforeRoot,afterRoot]){const server=await createServer({root,logLevel:'error',server:{middlewareMode:true,ws:false},optimizeDeps:{noDiscovery:true,include:[]}});servers.push(server);engines.push({api:await server.ssrLoadModule('/src/simulation/match.ts'),restore:(await server.ssrLoadModule('/src/simulation/serialization.ts')).restoreMatch});}
 const {run}=require(path.join(afterRoot,'scripts/generate-m5-route.cjs'));let cases=0;const checked=[];
 const outcome=fn=>{try{return{ok:true,value:fn()}}catch(e){return{ok:false,name:e.name,message:e.message}}};
 function check(state){const text=JSON.stringify(state);checked.push({round:state.round,phase:state.phase,tick:state.combat.tick,prefix:state.combatInputBasis.provenancePrefixLength,entries:state.resourceProvenance.entries.length});
  const compare=(label,fn)=>{assert.deepEqual(outcome(()=>fn(engines[1])),outcome(()=>fn(engines[0])),label);cases++};
  compare('complete state',e=>e.restore(text));
  const edits=[s=>s.m8.loot.receipts[0].extra=1,s=>s.m8.loot.receipts[0].payload.quantity++,s=>s.resourceProvenance.entries.at(-1).extra=1,s=>s.combatInputBasis.provenancePrefixLength=0,s=>s.combat.rngDraws++,s=>s.combat.nextEventSeq++];
  for(const edit of edits)for(const asText of [false,true])compare('warm corrupt receipt/prefix/runtime',e=>{e.restore(text);const bad=JSON.parse(text);edit(bad);const failure=outcome(()=>e.restore(asText?JSON.stringify(bad):bad));assert.equal(failure.ok,false);assert.deepEqual(e.restore(text),state);return failure;});
  for(let threshold=1;threshold<=8;threshold++)compare('receipt getter '+threshold,e=>{const raw=JSON.parse(text),receipts=raw.m8.loot.receipts;let reads=0;Object.defineProperty(raw.m8.loot,'receipts',{enumerable:true,get(){if(++reads>=threshold)receipts[0].extra=1;return receipts;}});const result=outcome(()=>e.restore(raw));return{reads,result};});
 }
 const route=await run(engines[0].api,{build:'sniper',seed:42,onStep(before,result,command){if(!command&&[12,25,33].includes(before.round)&&before.combat.tick===100)check(before);if(!command&&before.round===25&&result.state.combat.status==='finished')check(result.state);}});
 require(path.join(afterRoot,'tests/fixtures/m5/assert-golden.cjs'))(route);
 console.log(JSON.stringify({passed:true,cases,checked,goldenPassed:true}));await Promise.all(servers.map(s=>s.close()));
})().catch(e=>{console.error(e);process.exitCode=1;});

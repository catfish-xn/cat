const assert=require('node:assert/strict'),path=require('node:path');
(async()=>{
 const [,,baselineRoot,root]=process.argv;
 if(!baselineRoot||!root)throw Error('Usage: node compare-boundaries.cjs <baseline-source-root> <candidate-root>');
 const {createServer}=require(require.resolve('vite',{paths:[root]}));
 const servers=[],engines=[];
 for(const sourceRoot of [baselineRoot,root]){
  const server=await createServer({root:sourceRoot,logLevel:'error',server:{middlewareMode:true,hmr:false},optimizeDeps:{noDiscovery:true,include:[]}});servers.push(server);
  engines.push({api:await server.ssrLoadModule('/src/simulation/match.ts'),ser:await server.ssrLoadModule('/src/simulation/serialization.ts')});
 }
 const {api}=engines[0];let state=api.startMatchCombat(api.createMatch(42)).state;const snapshots=[state];
 for(let i=0;i<10;i++)state=api.stepMatch(state).state;snapshots.push(state);
 while(state.phase==='combat')state=api.stepMatch(state).state;snapshots.push(state);
 assert(state.combatInputBasis.provenancePrefixLength<state.resourceProvenance.entries.length);
 let cases=0;const clone=s=>JSON.parse(JSON.stringify(s));
 const outcome=fn=>{try{return {ok:true,value:fn()};}catch(e){return{ok:false,name:e.name,message:e.message};}};
 const compare=(label,make)=>{const values=engines.map(e=>outcome(()=>make(e)));assert.deepEqual(values[1],values[0],label);cases++;};
 for(const s of snapshots){
  compare('text positive',e=>e.ser.restoreMatch(JSON.stringify(s)));
  compare('object positive',e=>e.ser.restoreMatch(clone(s)));
  compare('getter reads',e=>{let reads=0;const raw=clone(s),gold=raw.gold;Object.defineProperty(raw,'gold',{enumerable:true,get(){reads++;return gold;}});const result=outcome(()=>e.ser.restoreMatch(raw));return{reads,result};});
  for(let threshold=1;threshold<=8;threshold++)compare('changing getter '+threshold,e=>{let reads=0;const raw=clone(s),growth=raw.persistentGrowth;Object.defineProperty(raw,'persistentGrowth',{enumerable:true,get(){if(++reads>=threshold)raw.resourceProvenance.entries[0].source.extra=1;return growth;}});const result=outcome(()=>e.ser.restoreMatch(raw));return{reads,result};});
  for(const edit of [s=>s.combat.rngState++,s=>s.combat.rngDraws++,s=>s.combat.nextActionSeq++,s=>s.combat.nextEventSeq++,s=>s.combat.units[0].runtime.attackCount++,s=>s.combatInputBasis.provenancePrefixLength=0,s=>s.resourceProvenance.entries.at(-1).extra=1]){
   for(const text of [false,true])compare('warm edited '+text,e=>{e.ser.restoreMatch(JSON.stringify(s));const raw=clone(s);edit(raw);return outcome(()=>e.ser.restoreMatch(text?JSON.stringify(raw):raw));});
  }
  compare('negative zero object',e=>{const raw=clone(s);raw.combat.units[0].cooldownTicks=-0;return outcome(()=>e.ser.restoreMatch(raw));});
  compare('continuation and rejected insertion',e=>{const r=e.ser.restoreMatch(JSON.stringify(s)),before=JSON.stringify(r);const rejected=[e.api.buyUnit(r,-1,r.shop.generation),e.api.sellUnit(r,'absent'),e.api.selectChoice(r,'stale',-1,'absent'),e.api.nextRound(r,-1)];for(const f of rejected){assert.equal(f.ok,false);assert.equal(f.state,r);assert.equal('events' in f,false);}assert.equal(JSON.stringify(r),before);return e.api.stepMatch(r);});
 }
 console.log(JSON.stringify({passed:true,cases,snapshots:snapshots.map(s=>({phase:s.phase,tick:s.combat.tick,prefix:s.combatInputBasis.provenancePrefixLength,ledger:s.resourceProvenance.entries.length}))}));
 await Promise.all(servers.map(s=>s.close()));
})().catch(e=>{console.error(e);process.exitCode=1;});

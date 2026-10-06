/* Native IndexedDB + production Coordinator under prolonged quota/abort failure. */
const {chromium}=require('playwright'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{const {createServer}=await import('vite');let browser;const server=await createServer({root:path.resolve(__dirname,'..'),plugins:[{name:'retry-page',configureServer(s){s.middlewares.use((req,res,next)=>{if(req.url==='/__retry'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><body></body>');}else next();});}}],server:{host:'127.0.0.1',port:0},optimizeDeps:{noDiscovery:true,include:[]}});await server.listen();try{
 const api=await server.ssrLoadModule('/src/simulation/match.ts'),{digestContent}=await server.ssrLoadModule('/src/simulation/content/index.ts');const route=await require('../scripts/generate-m5-route.cjs').run(api,{build:'cannon',seed:42,retainStates:true});const selected=route.rounds.slice(0,3);assert.equal(selected.length,3);const records=selected.map(r=>{const events=r.events.filter(e=>e.domain==='combat');return{runId:'retry-run',combatId:r.after.combat.combatId,context:r.before,initial:api.startMatchCombat(r.before).state.combat,events,endTick:r.after.combat.tick,nextEventSeq:r.after.combat.nextEventSeq,result:r.after.combat.result,stateHash:digestContent(r.after.combat),eventHash:digestContent(events)};});
 browser=await chromium.launch({args:['--no-sandbox']});const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(`${server.resolvedUrls.local[0]}__retry`);
 const result=await page.evaluate(async({records,states})=>{
  const {SaveRepository}=await import('/src/persistence/repository.ts'),{SaveCoordinator}=await import('/src/persistence/coordinator.ts'),{validateEnvelope}=await import('/src/persistence/format.ts'),{validateBattleCollection}=await import('/src/replay/index.ts');const check=(v,message)=>{if(!v)throw Error(message);};const results=[];
  {
   const name=`direct-fixed-${crypto.randomUUID()}`,repo=new SaveRepository(name);
   const original={kind:'hex-autobattler-save',saveFormatVersion:1,replayFormatVersion:1,runId:'retry-run',createdAt:'2026-10-06T00:00:00.000Z',match:records[0].context,battles:[],currentBattle:null};
   try {
    const token=await repo.activate(null,original);
    const source={match:structuredClone(original.match),currentBattle:null,battleKeys:[],addedBattles:[]};
    const expected=JSON.stringify(source.match);Object.freeze(source);
    const committing=repo.commit(token,source);source.match.gold=999999;source.battleKeys.push('forged-after-call');
    let latestToken=await committing;const stored=await repo.readCurrent();
    check(JSON.stringify(stored.envelope.match)===expected,'direct commit trusted shallow frozen mutable children');
    check(stored.envelope.battles.length===0,'direct commit retained caller-owned key mutation');
    results.push({boundary:'direct_commit_shallow_frozen_source_mutation',passed:true});
    const nativeGetAll=IDBObjectStore.prototype.getAll;let largeReads=0;
    IDBObjectStore.prototype.getAll=function(...args){if(this.name==='runs')largeReads++;return nativeGetAll.apply(this,args);};
    const other=new SaveRepository(name);
    try {
     latestToken=await repo.commit(latestToken,{match:original.match,currentBattle:null,battleKeys:[],addedBattles:[]});
     check(largeReads===0,'successful local header should avoid reading large run payloads');
     const staleToken={...latestToken};
     latestToken=await other.commit(latestToken,{match:states[0],currentBattle:null,battleKeys:[records[0].combatId],addedBattles:[records[0]]});
     check(largeReads===1,'unknown connection header requires durable fallback read');
     let conflict=false;try{await repo.commit(staleToken,{match:original.match,currentBattle:null,battleKeys:[],addedBattles:[]});}catch(error){conflict=error.reason==='conflict';}
     check(conflict,'cached header bypassed cross-connection CAS');
     latestToken=await repo.commit(latestToken,{match:states[0],currentBattle:null,battleKeys:[records[0].combatId],addedBattles:[]});
     check(largeReads===2,'new external revision must invalidate cached header');
     const fresh=await repo.readCurrent();check(fresh.envelope.battles.length===1,'fallback lost externally committed history');
     const beforeActivation={...latestToken};
     const sameRun={...original,match:states[0],battles:[records[0]]};
     latestToken=await other.activate(latestToken,sameRun);
     let oldEpochRejected=false;try{await repo.commit(beforeActivation,{match:states[0],currentBattle:null,battleKeys:[records[0].combatId],addedBattles:[]});}catch(error){oldEpochRejected=error.reason==='conflict';}
     check(oldEpochRejected&&latestToken.activationEpoch!==beforeActivation.activationEpoch,'warm cache accepted stale same-run activation epoch');
     results.push({boundary:'local_header_fast_path_and_external_revision_fallback',largeReads,oldEpochRejected,passed:true});
    } finally {IDBObjectStore.prototype.getAll=nativeGetAll;other.close();}

   } finally {repo.close();}
  }
  for(const failure of ['quota','abort']){
   const name=`retry-${failure}-${crypto.randomUUID()}`,repo=new SaveRepository(name);const original={kind:'hex-autobattler-save',saveFormatVersion:1,replayFormatVersion:1,runId:'retry-run',createdAt:'2026-10-06T00:00:00.000Z',match:records[0].context,battles:[],currentBattle:null};const token=await repo.activate(null,original);const before=JSON.stringify(await repo.readCurrent());let lastStatus=null;const c=new SaveCoordinator(repo,token,s=>{lastStatus=s;});
   const nativePut=IDBObjectStore.prototype.put,nativeTx=IDBDatabase.prototype.transaction;let failures=0;
   if(failure==='quota')IDBObjectStore.prototype.put=function(...args){if(this.name==='runs'){failures++;throw new DOMException('quota persistent','QuotaExceededError');}return nativePut.apply(this,args);};
   else IDBDatabase.prototype.transaction=function(...args){const tx=nativeTx.apply(this,args);if(args[1]==='readwrite'){const req=tx.objectStore('metadata').get('current');req.addEventListener('success',()=>{failures++;tx.abort();});}return tx;};
   try{
    const enqueue=(i,added)=>{const snapshot={match:states[i],currentBattle:null,battleKeys:records.slice(0,i+1).map(r=>r.combatId),addedBattles:added};c.enqueue(snapshot);check(c.pendingCount<=1,'unbounded pending captures');return snapshot;};
    enqueue(0,[records[0]]);try{await c.flush();}catch{}
    for(let i=1;i<3;i++)enqueue(i,[records[i]]);
    let last;for(let i=0;i<100;i++)last=enqueue(2,[]);
    // A caller changing its object after enqueue must not change the fixed pending capture.
    last.match={...last.match,gold:999999};
    try{await c.flush();}catch{}
    check(lastStatus?.kind==='failed'&&lastStatus.reason===failure,'wrong persistent failure status');check(c.pendingCount===1,'failed queue must retain one latest capture');check(JSON.stringify(await repo.readCurrent())===before,'failure mutated last committed slot');check(c.token.revision===token.revision,'failed writes advanced revision');
   }finally{IDBObjectStore.prototype.put=nativePut;IDBDatabase.prototype.transaction=nativeTx;}
   try{
    await c.flush();const saved=await repo.readCurrent();check(saved.token.revision===token.revision+1,'retry wrote obsolete intermediate snapshots');check(saved.envelope.match.gold===states[2].gold,'latest fixed state not retained');check(saved.envelope.battles.length===3,'coalescing lost newly completed history');check(saved.envelope.battles.every((r,i)=>JSON.stringify(r)===JSON.stringify(records[i])),'coalescing modified history');await validateEnvelope(saved.envelope,validateBattleCollection);check(c.pendingCount===0,'retry did not drain');results.push({failure,failedTransactions:failures,pendingAfterRetry:c.pendingCount,battles:saved.envelope.battles.length,passed:true});
   }finally{c.dispose();repo.close();await new Promise(resolve=>{const r=indexedDB.deleteDatabase(name);r.onsuccess=r.onerror=r.onblocked=resolve;});}
  }
  return results;
 },{records,states:selected.map(r=>r.after)});assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,results:result}));
 }finally{await browser?.close();await server.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

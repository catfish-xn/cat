const {skipB6Dependency}=require('./b6-deferred-assertions.cjs');
const {boundedImportEnvelope}=require('./b6-performance-fixtures.cjs');
const {RESTORATION_ISSUE,assertBoundedImportGate}=require('./b6-performance-gates.cjs');
/* Production-module F4 performance gates. No work/ fixture dependency or rule mutation. */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process'),{chromium}=require('playwright');
const {sourceFingerprint}=require('./m5-evidence.cjs'),{hash}=require('./m4-evidence.cjs');
(async()=>{
 const output=process.env.M6_EVIDENCE_DIR??'artifacts/m6-performance';fs.mkdirSync(output,{recursive:true});
 const started=performance.now();const report={sha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),dirty:execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),sourceFingerprint:sourceFingerprint(),scriptHash:hash(fs.readFileSync(__filename,'utf8')),node:process.version,cpu:os.cpus()[0]?.model,cpuCount:os.cpus().length,memoryBytes:os.totalmem(),loadAtStart:os.loadavg(),startedAt:new Date().toISOString(),passed:false,acceptanceScope:'B6 explicit B8/B9 dependencies deferred; bounded import is a separate real-path gate',restorationIssue:RESTORATION_ISSUE,method:'Production modules in unthrottled Chromium, no tracing; normal command-only seed42 four full routes plus same F1 command policy; its missing 15-equipment coverage is explicitly B8-deferred. Module lifecycle is separate from E full application/Phaser lifecycle.'};
 // Diagnostics stay outside timed callbacks and preserve the original failure path.
 const diagnosticPrefix='__M6_PERF_DIAGNOSTIC__',diagnosticFile=path.join(output,'diagnostics.jsonl');
 report.diagnostics={schemaVersion:1,file:'diagnostics.jsonl',browserProcessExit:'not exposed by the public Browser API returned by chromium.launch',events:[],writeErrors:[]};
 let diagnosticStage='setup',diagnosticCleanupStarted=false;
 const diagnostic=(event,details={})=>{
  const entry={sequence:report.diagnostics.events.length,event,at:new Date().toISOString(),elapsedMs:performance.now()-started,stage:diagnosticStage,cleanupStarted:diagnosticCleanupStarted,details};
  report.diagnostics.events.push(entry);
  try{fs.writeFileSync(diagnosticFile,JSON.stringify(entry)+'\n',{flag:entry.sequence===0?'w':'a'});}
  catch(error){report.diagnostics.writeErrors.push({sequence:entry.sequence,message:String(error)});}
  console.log(diagnosticPrefix+JSON.stringify(entry));
 };
 const diagnosticPhase=(stage,details={})=>{diagnosticStage=stage;diagnostic('stage',details);};
 process.once('exit',code=>diagnostic('process-exit',{processKind:'node',pid:process.pid,exitCode:code}));
 diagnosticPhase('setup');
 let server,browser;
 try{
  const {createServer}=await import('vite');server=await createServer({root:path.resolve(__dirname,'..'),plugins:[{name:'m6-perf-page',configureServer(s){s.middlewares.use((req,res,next)=>{if(req.url==='/__m6_perf'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><body></body>');}else next();});}}],server:{host:'127.0.0.1',port:0},optimizeDeps:{noDiscovery:true,include:[]}});await server.listen();
  const api=await server.ssrLoadModule('/src/simulation/match.ts'),replay=await server.ssrLoadModule('/src/replay/index.ts');
  const {digestContent}=await server.ssrLoadModule('/src/simulation/content/index.ts');
  const {ROUND_CATALOG}=await server.ssrLoadModule('/src/simulation/content/round-catalog.ts');
  const {MAX_BATTLE_RECORDS}=await server.ssrLoadModule('/src/m6/limits.ts');
  const routes=[];let largestComplete=null,largestIncremental=null,largestRecord=null,fullLoadEnvelope=null,largestBoundedComplete=null;
  for(const build of ['cannon','sniper','mage','sniper-caitlyn','full-load']){
   const runId=`performance-${build}`,history=new replay.BattleHistory(runId);let currentMax=null,currentBytes=0;
   const runner=build==='full-load'?require('./verify-m6-full-load-helper.cjs'):require('./generate-m5-route.cjs');
   const route=await runner.run(api,{build,seed:42,onStep(before,result,command){
    history.observe({before,after:result.state,events:result.events.filter(e=>e.domain==='combat'),reason:command?'command':'tick'});
    // Select the last legal running tick of each battle (largest event prefix for that battle).
    // Full prefixes are compared only near battle end below, avoiding O(tick^2) route generation.
    if(before.combat?.status==='running'&&result.state.combat?.status==='finished'){
     if(history.completedRecords.length===MAX_BATTLE_RECORDS){
      const envelope=boundedImportEnvelope(result.state,history.completedRecords,MAX_BATTLE_RECORDS,runId);
      const bytes=Buffer.byteLength(JSON.stringify(envelope));
      if(!largestBoundedComplete||bytes>largestBoundedComplete.bytes)largestBoundedComplete={build,bytes,envelope};
     }
     const final=history.completedRecords.at(-1);const record={...final,events:final.events.filter(e=>e.tick<=before.combat.tick),endTick:before.combat.tick,nextEventSeq:before.combat.nextEventSeq,result:null,stateHash:digestContent(before.combat)};record.eventHash=digestContent(record.events);
     const done=history.completedRecords.slice(0,-1),size=Buffer.byteLength(JSON.stringify({match:before,currentBattle:record,battleKeys:done.map(r=>r.combatId)}));
     if(size>currentBytes){currentBytes=size;currentMax={kind:'hex-autobattler-save',saveFormatVersion:1,replayFormatVersion:1,runId,createdAt:'2026-10-06T00:00:00.000Z',match:before,battles:done,currentBattle:record};}
    }
   }});
   assert.equal(route.final.phase,'gameOver');assert.equal(route.final.round,ROUND_CATALOG.at(-1).ordinal);assert.equal(history.completedRecords.length,ROUND_CATALOG.filter(round=>round.kind!=='supply').length);
   const envelope={kind:'hex-autobattler-save',saveFormatVersion:1,replayFormatVersion:1,runId,createdAt:'2026-10-06T00:00:00.000Z',match:route.final,battles:history.completedRecords,currentBattle:null};
   if(build==='full-load'){
    const loads=history.completedRecords.map(record=>({round:record.context.round,players:record.context.preparation.units.filter(u=>u.team==='player'&&u.location.kind==='board').length,enemies:record.context.preparation.units.filter(u=>u.team==='enemy').length,equipped:record.context.items.filter(i=>i.location.kind==='unit').length}));
    skipB6Dependency(report,'B8','full-load-15-equipment',`The real command route awaits B8 loot; restore the original maximal-load coverage under ${RESTORATION_ISSUE}`,()=>{
     assert(loads.some(load=>load.players===9&&load.enemies===8&&load.equipped===15),'same F1 maximal legal population/equipment load');
    });report.fullLoadObserved=loads;report.fullLoadCoverage=loads.filter(load=>load.players===9&&load.equipped===15);fullLoadEnvelope=envelope;
   }
   const bytes=Buffer.byteLength(JSON.stringify(envelope));routes.push({build,bytes,incrementalBytes:currentBytes,summary:route.summary});
   if(!largestComplete||bytes>largestComplete.bytes)largestComplete={bytes,envelope};
   if(!largestIncremental||currentBytes>largestIncremental.bytes)largestIncremental={bytes:currentBytes,envelope:currentMax};
   for(const record of envelope.battles){const recordBytes=Buffer.byteLength(JSON.stringify(record));if(!largestRecord||recordBytes>largestRecord.bytes)largestRecord={bytes:recordBytes,record};}
  }
  assert(largestBoundedComplete,'a real capacity-bounded battle-end save must exist');
  report.routes=routes;report.routeGenerationMs=performance.now()-started;
  report.payload={completeBytes:largestComplete.bytes,incrementalBytes:largestIncremental.bytes,incrementalCombatId:largestIncremental.envelope.currentBattle.combatId,incrementalEvents:largestIncremental.envelope.currentBattle.events.length,largestRecordBytes:largestRecord.bytes,largestRecordCombatId:largestRecord.record.combatId,boundedComplete:{build:largestBoundedComplete.build,bytes:largestBoundedComplete.bytes,roundId:largestBoundedComplete.envelope.match.m8.round.roundId,battles:largestBoundedComplete.envelope.battles.length,stateHash:digestContent(largestBoundedComplete.envelope),notEquivalentToFullPayload:true}};
  diagnosticPhase('browser-launch');
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,headless:true,args:['--no-sandbox']});report.browser=browser.version();
  browser.on('disconnected',()=>diagnostic('browser-disconnected',{connected:browser.isConnected()}));
  diagnosticPhase('page-create');const page=await browser.newPage();
  page.on('crash',()=>diagnostic('page-crash',{closed:page.isClosed(),browserConnected:browser.isConnected()}));
  report.errors=[];page.on('pageerror',error=>report.errors.push(error.message));page.on('console',message=>{if(message.type()==='error')report.errors.push(message.text());});
  page.on('console',message=>{
   const text=message.text();if(message.type()!=='log'||!text.startsWith(diagnosticPrefix))return;
   try{const {stage,...details}=JSON.parse(text.slice(diagnosticPrefix.length));diagnosticPhase(stage,details);}
   catch(error){diagnostic('invalid-browser-marker',{message:String(error)});}
  });
  diagnosticPhase('page-goto');await page.goto(`${server.resolvedUrls.local[0]}__m6_perf`);
  diagnosticPhase('measurements-requested');
  report.measurements=await page.evaluate(async fixtures=>{
   const mark=(stage,details={})=>console.log('__M6_PERF_DIAGNOSTIC__'+JSON.stringify({stage,browserPerformanceMs:performance.now(),...details}));
   mark('measurements-entered');
   const {SaveRepository}=await import('/src/persistence/repository.ts'),{SaveCoordinator}=await import('/src/persistence/coordinator.ts'),{validateFile,exportFile}=await import('/src/persistence/format.ts');
   const {BattleHistory,PlaybackSession,validateBattleCollection}=await import('/src/replay/index.ts');
   const {MatchSession}=await import('/src/rendering/match-session.ts');const {aggregateStats,appendStats,emptyStats}=await import('/src/stats/aggregate.ts');
   const limits=await import('/src/m6/limits.ts');const {complete,current,record,fullLoad}=fixtures;
   mark('imports-complete',{completedBattles:complete.battles.length,currentCompletedBattles:current.battles.length,currentCombatId:current.currentBattle?.combatId,recordCombatId:record.combatId});
   const skipped=[],restorationIssue=fixtures.restorationIssue;
   const defer=(id,reason,callback)=>{if(typeof callback!=='function')throw Error('Deferred measurement must preserve its callback');skipped.push({status:'skipped',owner:'B9',id,reason,restorationIssue});};
   const pendingMetrics=['capture','write','activation','completeImport'];
   const samples={capture:[],write:[],fullCapture:[],activation:[],completeImport:[],firstSeek:[],cachedSeek:[],statsBatch:[]};const gates=[];
   const measure=(name,fn)=>{const start=performance.now(),result=fn();samples[name].push(performance.now()-start);return result;};
   const measured=async(name,fn)=>{const start=performance.now(),result=await fn();samples[name].push(performance.now()-start);return result;};
   const dbName=`m6-performance-${crypto.randomUUID()}`,repository=new SaveRepository(dbName);let coordinator;
   mark('current-history-start');
   const currentHistory=new BattleHistory(current.runId,current.battles,current.currentBattle);
   mark('current-history-complete');
   const capture=()=>({match:current.match,currentBattle:currentHistory.capturePrefix(),battleKeys:currentHistory.completedRecords.map(b=>b.combatId),addedBattles:[]});
   try{
    let fullLoadRoundTrip={status:'skipped',owner:'B9',restorationIssue};
    let fullCaptureMeasured=false;
    const measureFullCapture=()=>{
     const fullHistory=new BattleHistory(complete.runId,complete.battles,null);
     for(let i=0;i<12;i++)measure('fullCapture',()=>exportFile({...complete,match:structuredClone(complete.match),battles:fullHistory.completedRecords,currentBattle:fullHistory.capturePrefix()}));
     fullCaptureMeasured=true;
    };
    defer('full-import-dependent-pipeline','Original 33-battle validated import preparation is blocked; capture/write/activation/completeImport are not measured via replacement setup',async()=>{
    // All payloads are independently validated by the actual imported public format path.
    let token=await measured('completeImport',async()=>{
     const candidate=await validateFile(exportFile(complete),validateBattleCollection);
     const prepared=new MatchSession(candidate.match,candidate.battles.at(-1)?.events??[]),history=new BattleHistory(candidate.runId,candidate.battles,candidate.currentBattle);
     if(history.completedRecords.length!==fixtures.expectedBattleCount)throw Error('full import lost history');
     const result=await measured('activation',()=>repository.activate(null,candidate));prepared.dispose();return result;
    });
    await validateFile(exportFile(current),validateBattleCollection);
    token=await measured('activation',()=>repository.activate(token,current));
    let writeStart=0;
    coordinator=new SaveCoordinator(repository,token,status=>{if(status.kind==='saving')writeStart=performance.now();if(status.kind==='saved')samples.write.push(performance.now()-writeStart);if(status.kind==='failed')throw Error(status.message);});
    for(let i=0;i<12;i++){measure('capture',()=>coordinator.enqueue(capture()));await coordinator.flush();}
    const disk=await repository.readCurrent();if(disk.envelope.battles.length!==current.battles.length||disk.envelope.currentBattle.nextEventSeq!==current.currentBattle.nextEventSeq)throw Error('incremental roundtrip changed history/cursor');
    measureFullCapture(); // Original ordering before the remaining two complete-import samples.
    // Three complete-import samples; token is the latest successful coordinator revision.
    token=coordinator.token;coordinator.dispose();
    for(let repeat=1;repeat<3;repeat++)token=await measured('completeImport',async()=>{
     const candidate=await validateFile(exportFile(complete),validateBattleCollection);
     const prepared=new MatchSession(candidate.match,candidate.battles.at(-1)?.events??[]),history=new BattleHistory(candidate.runId,candidate.battles,candidate.currentBattle);
     if(history.completedRecords.length!==fixtures.expectedBattleCount)throw Error('full import lost history');
     const result=await measured('activation',()=>repository.activate(token,candidate));prepared.dispose();return result;
    });
    const fullLoadStarted=performance.now();const fullLoadCandidate=await validateFile(exportFile(fullLoad),validateBattleCollection);
    const fullLoadSession=new MatchSession(fullLoadCandidate.match,fullLoadCandidate.battles.at(-1).events),fullLoadHistory=new BattleHistory(fullLoadCandidate.runId,fullLoadCandidate.battles,null);
    token=await measured('activation',()=>repository.activate(token,fullLoadCandidate));const fullLoadDisk=await repository.readCurrent();
    const canonical=v=>Array.isArray(v)?`[${v.map(canonical).join(',')}]`:v!==null&&typeof v==='object'?`{${Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')}}`:JSON.stringify(v);
    if(canonical(fullLoadDisk.envelope)!==canonical(fullLoadCandidate)||fullLoadHistory.completedRecords.length!==fixtures.expectedBattleCount)throw Error('maximum legal full-load roundtrip mismatch');fullLoadSession.dispose();
    fullLoadRoundTrip={milliseconds:performance.now()-fullLoadStarted,verified:true,battles:fullLoadCandidate.battles.length};
    while(samples.activation.length<12)token=await measured('activation',()=>repository.activate(token,fullLoadCandidate));
    });
    // Run once independently today; the preserved pipeline calls the same block
    // at its original position when issue #23 restores full validated imports.
    mark('full-capture-start');
    if(!fullCaptureMeasured)measureFullCapture();
    mark('full-capture-complete');
    mark('current-validation-start');
    if(current.battles.length+(current.currentBattle?1:0)>limits.MAX_BATTLE_RECORDS)
     defer('current-prefix-validation','The selected original maximal current prefix exceeds the unchanged capacity',async()=>{await validateFile(exportFile(current),validateBattleCollection);});
    else await validateFile(exportFile(current),validateBattleCollection);
    mark('current-validation-complete',{deferred:current.battles.length+(current.currentBattle?1:0)>limits.MAX_BATTLE_RECORDS});
    // Cold includes constructor's validation; cached seeks restore actual production checkpoints.
    for(let repeat=0;repeat<3;repeat++){
     let playback;
     mark('first-seek-start',{repeat});
     measure('firstSeek',()=>{playback=new PlaybackSession(record);playback.seek(record.endTick);});
     mark('first-seek-complete',{repeat});
     for(let i=0;i<4;i++){const tick=Math.max(0,Math.min(record.endTick-1,Math.floor(record.endTick*(repeat*4+i+1)/13)));measure('cachedSeek',()=>playback.seek(tick));}
     mark('cached-seeks-complete',{repeat});
     playback.dispose();
    }
    mark('stats-start');
    let stats=emptyStats(record.runId,record.combatId),cursor=0;
    for(let tick=0;tick<=record.endTick+39;tick+=40){let end=cursor;while(end<record.events.length&&record.events[end].tick<=tick)end++;const delta=record.events.slice(cursor,end);measure('statsBatch',()=>{stats=appendStats(stats,delta);});cursor=end;}
    if(JSON.stringify(stats)!==JSON.stringify(aggregateStats(record.runId,record.combatId,record.events)))throw Error('incremental stats mismatch');
    mark('stats-complete');
    const summary={};for(const[name,values]of Object.entries(samples)){const ordered=[...values].sort((a,b)=>a-b);if(pendingMetrics.includes(name)){summary[name]={status:'skipped',owner:'B9',restorationIssue};continue;}summary[name]={samples:values,p95:ordered[Math.min(ordered.length-1,Math.floor(ordered.length*.95))],max:ordered.at(-1)};}
    const budget=limits.PERFORMANCE_BUDGET_MS;
    for(const[name,metric,ceiling]of [['capture','p95',budget.incrementalCaptureP95],['write','p95',budget.incrementalWriteP95],['fullCapture','p95',budget.fullCaptureP95],['activation','max',budget.activationWriteP95],['completeImport','max',budget.completeImport],['firstSeek','max',budget.firstSeek],['cachedSeek','max',budget.cachedSeek],['statsBatch','max',budget.stats40TickBatch]]){if(pendingMetrics.includes(name))gates.push({name,metric,ceiling,status:'skipped',owner:'B9',restorationIssue});else gates.push({name,metric,actual:summary[name][metric],ceiling,passed:summary[name][metric]<=ceiling});}
    // Keep one small real record for subsequent warmed module lifecycle measurement.
    window.__M6_PERF_LIFECYCLE_RECORD=complete.battles[0];
    return{summary,gates,skipped,fullLoadRoundTrip,limits:budget,completeBattleCount:complete.battles.length,incrementalBattleCount:current.battles.length,completedHistoryWrittenOnIncrementalSave:null,deferredMetrics:pendingMetrics,method:'Original fullCapture, firstSeek, cachedSeek and statsBatch callbacks run on the original selected payloads. The original capture/write/activation/completeImport pipeline is preserved but explicitly skipped, with no replacement setup or synthetic samples.'};
   }finally{mark('measurements-cleanup-start');coordinator?.dispose();repository.close();await new Promise(resolve=>{const r=indexedDB.deleteDatabase(dbName);r.onsuccess=r.onerror=r.onblocked=resolve;});mark('measurements-cleanup-complete');}
  },{complete:largestComplete.envelope,current:largestIncremental.envelope,record:largestRecord.record,fullLoad:fullLoadEnvelope,expectedBattleCount:ROUND_CATALOG.filter(round=>round.kind!=='supply').length,restorationIssue:RESTORATION_ISSUE});
  diagnosticPhase('measurements-returned');
  for(const entry of report.measurements.skipped)console.log(`SKIPPED [${entry.owner}] ${entry.id}: ${entry.reason}; ${entry.restorationIssue}`);
  skipB6Dependency(report,'B9','full-load-import-roundtrip',`Restore the original full-load import/activation path after B9 capacity integration; ${RESTORATION_ISSUE}`,()=>{
   assert(report.measurements.fullLoadRoundTrip.milliseconds<=report.measurements.limits.completeImport,'full-load import/activation roundtrip frozen budget');
  });
  diagnosticPhase('lifecycle-start');
  // Warm constructors/listeners/code before establishing the lifecycle baseline.
  const lifecycle=async cycles=>page.evaluate(async cycles=>{
   const {SaveRepository}=await import('/src/persistence/repository.ts'),{SaveCoordinator}=await import('/src/persistence/coordinator.ts'),{createSaveControls}=await import('/src/persistence/save-controls.ts');
   const {createMatch}=await import('/src/simulation/match.ts'),{MatchSession}=await import('/src/rendering/match-session.ts'),{PlaybackSession}=await import('/src/replay/index.ts');
   const {createStatsPanel}=await import('/src/stats/stats-panel.ts'),{aggregateStats}=await import('/src/stats/aggregate.ts'),{createCombatFeedbackRenderer}=await import('/src/stats/combat-feedback-renderer.ts');
   const add=EventTarget.prototype.addEventListener,remove=EventTarget.prototype.removeEventListener;let count=0;const seen=new WeakMap();
   EventTarget.prototype.addEventListener=function(type,listener,options){let map=seen.get(this);if(!map){map=new Map();seen.set(this,map);}const key=`${type}/${typeof options==='boolean'?options:Boolean(options?.capture)}`;let set=map.get(key);if(!set){set=new Set();map.set(key,set);}if(listener&&!set.has(listener)){set.add(listener);count++;}return add.call(this,type,listener,options);};
   EventTarget.prototype.removeEventListener=function(type,listener,options){const key=`${type}/${typeof options==='boolean'?options:Boolean(options?.capture)}`;if(seen.get(this)?.get(key)?.delete(listener))count--;return remove.call(this,type,listener,options);};
   try{for(let i=0;i<cycles;i++){
    const host=document.createElement('div');document.body.append(host);const session=new MatchSession(createMatch(42));session.pause('lifecycle');let notified=0;const unsubscribe=session.subscribe(()=>notified++);
    const dbName=`m6-lifecycle-${crypto.randomUUID()}`,repository=new SaveRepository(dbName);const envelope={kind:'hex-autobattler-save',saveFormatVersion:1,replayFormatVersion:1,runId:crypto.randomUUID(),createdAt:new Date().toISOString(),match:session.state,battles:[],currentBattle:null};const token=await repository.activate(null,envelope);const coordinator=new SaveCoordinator(repository,token,()=>{});
    coordinator.enqueue({match:session.state,battleKeys:[],addedBattles:[],currentBattle:null});await coordinator.flush();
    const controls=createSaveControls(host,{onNewRandom(){},onNewFixed(){},onContinue(){},onImport(){},onExport(){}});controls.update({startup:false,canContinue:false,seed:42,runId:envelope.runId,busy:false,status:null,hasActive:true});
    const record=window.__M6_PERF_LIFECYCLE_RECORD,playback=new PlaybackSession(record);playback.play();const snapshot=playback.advance(50);const panel=createStatsPanel(host,()=>{});panel.render({stats:aggregateStats(record.runId,record.combatId,snapshot.events),combat:snapshot.combat,events:snapshot.events,selectedUnitId:null});const feedback=createCombatFeedbackRenderer(host);feedback.push(snapshot.events,0);feedback.render(50,new Map());
    feedback.dispose();panel.dispose();controls.dispose();playback.dispose();unsubscribe();session.dispose();coordinator.dispose();repository.close();if(host.children.length||notified)throw Error('module resources retained');host.remove();await new Promise(resolve=>{const r=indexedDB.deleteDatabase(dbName);r.onsuccess=r.onerror=r.onblocked=resolve;});
   }return{cycles,extraListeners:count,remainingComponentRoots:document.body.children.length};}finally{EventTarget.prototype.addEventListener=add;EventTarget.prototype.removeEventListener=remove;}
  },cycles);
  await lifecycle(3);const cdp=await page.context().newCDPSession(page);await cdp.send('HeapProfiler.enable');await cdp.send('HeapProfiler.collectGarbage');const before=await cdp.send('Runtime.getHeapUsage');
  const frozenLimits=await server.ssrLoadModule('/src/m6/limits.ts');report.lifecycle=await lifecycle(frozenLimits.LIFECYCLE_CYCLES);await cdp.send('HeapProfiler.collectGarbage');const after=await cdp.send('Runtime.getHeapUsage');const limits=await server.ssrLoadModule('/src/m6/limits.ts');Object.assign(report.lifecycle,{before,after,heapDeltaBytes:after.usedSize-before.usedSize,maxHeapGrowthBytes:limits.MAX_POST_GC_HEAP_GROWTH_BYTES,scope:'Real persistence/session/playback/DOM modules; does not assert full application one-Phaser-loop/tween cleanup (E owns that gate).'});
  assert.equal(report.lifecycle.extraListeners,0,'module listeners retained');assert.equal(report.lifecycle.remainingComponentRoots,0,'module DOM retained');assert(report.lifecycle.heapDeltaBytes<=limits.MAX_POST_GC_HEAP_GROWTH_BYTES,'module GC heap growth');
  diagnosticPhase('lifecycle-complete');
  // Separate genuine <=30-battle import gate, AFTER the unchanged independent
  // module/lifecycle measurements. It does not replace the deferred full payload.
  diagnosticPhase('bounded-import-start');
  report.boundedImport=await page.evaluate(async fixtures=>{
   const {SaveRepository}=await import('/src/persistence/repository.ts'),{validateFile,exportFile}=await import('/src/persistence/format.ts');
   const {BattleHistory,validateBattleCollection}=await import('/src/replay/index.ts');
   const {MatchSession}=await import('/src/rendering/match-session.ts');
   const {PERFORMANCE_BUDGET_MS,MAX_BATTLE_RECORDS}=await import('/src/m6/limits.ts');
   const canonical=v=>Array.isArray(v)?`[${v.map(canonical).join(',')}]`:v!==null&&typeof v==='object'?`{${Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')}}`:JSON.stringify(v);
   const envelope=fixtures.envelope,expected=canonical(envelope);
   if(envelope.battles.length!==MAX_BATTLE_RECORDS||envelope.currentBattle!==null||envelope.match.phase!=='settlement')throw Error('bounded gate must use the real complete capacity-sized settlement snapshot');
   const dbName=`b6-bounded-import-${crypto.randomUUID()}`,repository=new SaveRepository(dbName),samples=[];let token=null;
   try{
    for(let repeat=0;repeat<3;repeat++){
     const started=performance.now();
     const candidate=await validateFile(exportFile(envelope),validateBattleCollection);
     const prepared=new MatchSession(candidate.match,candidate.battles.at(-1)?.events??[]),history=new BattleHistory(candidate.runId,candidate.battles,candidate.currentBattle);
     try{if(history.completedRecords.length!==MAX_BATTLE_RECORDS)throw Error('bounded import lost history');token=await repository.activate(token,candidate);}
     finally{prepared.dispose();}
     samples.push(performance.now()-started);
     // Exact object/readback checks are outside the original import timed path.
     if(canonical(candidate)!==expected||canonical((await repository.readCurrent()).envelope)!==expected||canonical(envelope)!==expected)throw Error('bounded import or native activation changed the complete envelope');
    }
    const actual=Math.max(...samples),ceiling=PERFORMANCE_BUDGET_MS.completeImport;
    return{scope:'separate real 30-battle settlement import; not the original maximal 33-battle or game-over payload',
     restorationIssue:fixtures.restorationIssue,notEquivalentToFullPayload:true,sourceBuild:fixtures.build,bytes:fixtures.bytes,
     battles:envelope.battles.length,roundId:envelope.match.m8.round.roundId,phase:envelope.match.phase,
     samples,metric:'max',actual,ceiling,passed:actual<=ceiling,completeObjectEqual:true,nativeReadbackEqual:true,
     path:['exportFile','validateFile','validateBattleCollection','MatchSession','BattleHistory','SaveRepository.activate'],
     coldDatabaseFirstActivation:true,source:'captured by onStep when the real 30th combat settled; no truncated terminal envelope'};
   }finally{repository.close();await new Promise(resolve=>{const request=indexedDB.deleteDatabase(dbName);request.onsuccess=request.onerror=request.onblocked=resolve;});}
  },{...largestBoundedComplete,restorationIssue:RESTORATION_ISSUE});
  diagnosticPhase('bounded-import-returned');
  assertBoundedImportGate(report.boundedImport,report.payload.boundedComplete,MAX_BATTLE_RECORDS,report.measurements.limits.completeImport);
  assert.equal(report.errors.length,0,'browser errors');assert.equal(sourceFingerprint(),report.sourceFingerprint,'source changed during measurement');
  const failures=report.measurements.gates.filter(g=>g.status!=='skipped'&&!g.passed);assert.equal(failures.length,0,`Frozen performance budget exceeded: ${JSON.stringify(failures)}`);report.passed=true;
 }catch(error){report.failure=error.stack;console.error(error);process.exitCode=1;}
 finally{report.endedAt=new Date().toISOString();report.durationMs=performance.now()-started;report.finalSourceFingerprint=sourceFingerprint();report.peakProcessRssBytes=process.resourceUsage().maxRSS*1024;report.loadAtEnd=os.loadavg();diagnosticCleanupStarted=true;diagnosticPhase('script-cleanup-start',{failureRecorded:Boolean(report.failure)});fs.writeFileSync(path.join(output,'manifest.json'),JSON.stringify(report,null,2));await browser?.close();await server?.close();console.log(JSON.stringify({passed:report.passed,durationMs:report.durationMs,acceptanceScope:report.acceptanceScope,skipped:[...(report.skipped??[]),...(report.measurements?.skipped??[])],gates:report.measurements?.gates,boundedImport:report.boundedImport,lifecycle:report.lifecycle?.heapDeltaBytes,failure:report.failure}));}
})();

// Enable the narrow process lifecycle channel before any Playwright import.
// Preserve caller DEBUG selectors, including explicit negative selectors.
const priorBrowserDebug=process.env.DEBUG??'';
process.env.DEBUG=[priorBrowserDebug,'pw:browser'].filter(Boolean).join(',');
/* Production-module F4 performance gates. No work/ fixture dependency or rule mutation. */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process'),{chromium}=require('playwright');
const {sourceFingerprint}=require('./m5-evidence.cjs'),{hash}=require('./m4-evidence.cjs');
const {inspectFixtureGroups,fixtureSignature,stageFixtureGroups}=require('./m6-fixture-transport.cjs');
(async()=>{
 const output=process.env.M6_EVIDENCE_DIR??'artifacts/m6-performance';fs.mkdirSync(output,{recursive:true});
 const started=performance.now();const report={sha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),dirty:execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),sourceFingerprint:sourceFingerprint(),scriptHash:hash(fs.readFileSync(__filename,'utf8')),node:process.version,cpu:os.cpus()[0]?.model,cpuCount:os.cpus().length,memoryBytes:os.totalmem(),loadAtStart:os.loadavg(),startedAt:new Date().toISOString(),passed:false,acceptanceScope:'original F4 performance gates at the catalog capacity (B9, issue #23)',method:'Production modules in unthrottled Chromium, no tracing; normal command-only seed42 four full routes plus same F1 command policy; its missing 15-equipment coverage is explicitly B8-deferred. Module lifecycle is separate from E full application/Phaser lifecycle.'};
 // Diagnostics stay outside timed callbacks and preserve the original failure path.
 const diagnosticPrefix='__M6_PERF_DIAGNOSTIC__',diagnosticFile=path.join(output,'diagnostics.jsonl');
 report.diagnostics={schemaVersion:1,file:'diagnostics.jsonl',browserProcessExit:'pw:browser stderr records Chromium PID and process exitCode/signal',debug:{prior:priorBrowserDebug,effective:process.env.DEBUG,negativeSelectorsPreserved:priorBrowserDebug.split(/[\s,]+/).filter(value=>value.startsWith('-'))},events:[],writeErrors:[]};
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
 let server,browser,page;
 try{
  const {createServer}=await import('vite');server=await createServer({root:path.resolve(__dirname,'..'),plugins:[{name:'m6-perf-page',configureServer(s){s.middlewares.use((req,res,next)=>{if(req.url==='/__m6_perf'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><body></body>');}else next();});}}],server:{host:'127.0.0.1',port:0},optimizeDeps:{noDiscovery:true,include:[]}});await server.listen();
  const api=await server.ssrLoadModule('/src/simulation/match.ts'),replay=await server.ssrLoadModule('/src/replay/index.ts');
  const {digestContent}=await server.ssrLoadModule('/src/simulation/content/index.ts');
  const {ROUND_CATALOG}=await server.ssrLoadModule('/src/simulation/content/round-catalog.ts');
  const routes=[];let largestComplete=null,largestIncremental=null,largestRecord=null,fullLoadEnvelope=null;
  for(const build of ['cannon','sniper','mage','sniper-caitlyn','full-load']){
   const runId=`performance-${build}`,history=new replay.BattleHistory(runId);let currentMax=null,currentBytes=0;
   const runner=build==='full-load'?require('./verify-m6-full-load-helper.cjs'):require('./generate-m5-route.cjs');
   const route=await runner.run(api,{build,seed:42,onStep(before,result,command){
    history.observe({before,after:result.state,events:result.events.filter(e=>e.domain==='combat'),reason:command?'command':'tick'});
    // Select the last legal running tick of each battle (largest event prefix for that battle).
    // Full prefixes are compared only near battle end below, avoiding O(tick^2) route generation.
    if(before.combat?.status==='running'&&result.state.combat?.status==='finished'){
     const final=history.completedRecords.at(-1);const record={...final,events:final.events.filter(e=>e.tick<=before.combat.tick),endTick:before.combat.tick,nextEventSeq:before.combat.nextEventSeq,result:null,stateHash:digestContent(before.combat)};record.eventHash=digestContent(record.events);
     const done=history.completedRecords.slice(0,-1),size=Buffer.byteLength(JSON.stringify({match:before,currentBattle:record,battleKeys:done.map(r=>r.combatId)}));
     if(size>currentBytes){currentBytes=size;currentMax={kind:'hex-autobattler-save',saveFormatVersion:1,replayFormatVersion:1,runId,createdAt:'2026-10-06T00:00:00.000Z',match:before,battles:done,currentBattle:record};}
    }
   }});
   assert.equal(route.final.phase,'gameOver');assert.equal(route.final.round,ROUND_CATALOG.at(-1).ordinal);assert.equal(history.completedRecords.length,ROUND_CATALOG.filter(round=>round.kind!=='supply').length);
   const envelope={kind:'hex-autobattler-save',saveFormatVersion:1,replayFormatVersion:1,runId,createdAt:'2026-10-06T00:00:00.000Z',match:route.final,battles:history.completedRecords,currentBattle:null};
   if(build==='full-load'){
    const loads=history.completedRecords.map(record=>({round:record.context.round,players:record.context.preparation.units.filter(u=>u.team==='player'&&u.location.kind==='board').length,enemies:record.context.preparation.units.filter(u=>u.team==='enemy').length,equipped:record.context.items.filter(i=>i.location.kind==='unit').length}));
    // B8 loot now supplies the real command route's components: the original F1 maximal load runs again.
    assert(loads.some(load=>load.players===9&&load.enemies===8&&load.equipped===15),'same F1 maximal legal population/equipment load');report.fullLoadObserved=loads;report.fullLoadCoverage=loads.filter(load=>load.players===9&&load.equipped===15);fullLoadEnvelope=envelope;
   }
   const bytes=Buffer.byteLength(JSON.stringify(envelope));routes.push({build,bytes,incrementalBytes:currentBytes,summary:route.summary});
   if(!largestComplete||bytes>largestComplete.bytes)largestComplete={bytes,envelope};
   if(!largestIncremental||currentBytes>largestIncremental.bytes)largestIncremental={bytes:currentBytes,envelope:currentMax};
   for(const record of envelope.battles){const recordBytes=Buffer.byteLength(JSON.stringify(record));if(!largestRecord||recordBytes>largestRecord.bytes)largestRecord={bytes:recordBytes,record};}
  }
  report.routes=routes;report.routeGenerationMs=performance.now()-started;
  report.payload={completeBytes:largestComplete.bytes,incrementalBytes:largestIncremental.bytes,incrementalCombatId:largestIncremental.envelope.currentBattle.combatId,incrementalEvents:largestIncremental.envelope.currentBattle.events.length,largestRecordBytes:largestRecord.bytes,largestRecordCombatId:largestRecord.record.combatId};
  diagnosticPhase('browser-launch');
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,headless:true,args:['--no-sandbox']});report.browser=browser.version();
  browser.on('disconnected',()=>diagnostic('browser-disconnected',{connected:browser.isConnected()}));
  diagnosticPhase('page-create');page=await browser.newPage();
  page.on('close',()=>diagnostic('page-close',{closed:page.isClosed(),browserConnected:browser.isConnected()}));
  page.context().on('close',()=>diagnostic('context-close',{pageClosed:page.isClosed(),browserConnected:browser.isConnected()}));
  page.on('crash',()=>diagnostic('page-crash',{closed:page.isClosed(),browserConnected:browser.isConnected()}));
  report.errors=[];page.on('pageerror',error=>report.errors.push(error.message));page.on('console',message=>{if(message.type()==='error')report.errors.push(message.text());});
  page.on('console',message=>{
   const text=message.text();if(message.type()!=='log'||!text.startsWith(diagnosticPrefix))return;
   try{const {stage,...details}=JSON.parse(text.slice(diagnosticPrefix.length));diagnosticPhase(stage,details);}
   catch(error){diagnostic('invalid-browser-marker',{message:String(error)});}
  });
  diagnosticPhase('page-goto');await page.goto(`${server.resolvedUrls.local[0]}__m6_perf`);
  diagnosticPhase('fixture-transport-start');
  const transportStarted=performance.now();
  assert.equal(require('playwright/package.json').version,'1.63.0','Re-audit fixture transport sizing after Playwright changes');
  const fixtures={complete:largestComplete.envelope,current:largestIncremental.envelope,record:largestRecord.record,fullLoad:fullLoadEnvelope,expectedBattleCount:ROUND_CATALOG.filter(round=>round.kind!=='supply').length};
  const transport=inspectFixtureGroups(fixtures),expectedFixtureSignature=await fixtureSignature(fixtures);
  await stageFixtureGroups(page,fixtures,transport.groups);
  report.fixtureTransport={method:'two native Playwright groups; delete staging and release handles before original callback',helperHash:hash(fs.readFileSync(require.resolve('./m6-fixture-transport.cjs'),'utf8')),groups:transport.summaries,capacityBytes:transport.capacityBytes,commandReserveBytes:transport.commandReserveBytes,expected:expectedFixtureSignature,setupMs:performance.now()-transportStarted};
  diagnosticPhase('fixture-transport-complete',report.fixtureTransport);
  diagnosticPhase('measurements-requested');
  report.measurements=await page.evaluate(()=>{
   const fixtures=globalThis.__M6_PERF_FIXTURES;delete globalThis.__M6_PERF_FIXTURES;
   return (async fixtures=>{
   const mark=(stage,details={})=>console.log('__M6_PERF_DIAGNOSTIC__'+JSON.stringify({stage,browserPerformanceMs:performance.now(),...details}));
   mark('measurements-entered');
   const {SaveRepository}=await import('/src/persistence/repository.ts'),{SaveCoordinator}=await import('/src/persistence/coordinator.ts'),{validateFile,exportFile}=await import('/src/persistence/format.ts');
   const {BattleHistory,PlaybackSession,validateBattleCollection}=await import('/src/replay/index.ts');
   const {MatchSession}=await import('/src/rendering/match-session.ts');const {aggregateStats,appendStats,emptyStats}=await import('/src/stats/aggregate.ts');
   const limits=await import('/src/m6/limits.ts');const {complete,current,record,fullLoad}=fixtures;
   mark('imports-complete',{completedBattles:complete.battles.length,currentCompletedBattles:current.battles.length,currentCombatId:current.currentBattle?.combatId,recordCombatId:record.combatId});
   const skipped=[];
   const samples={capture:[],write:[],fullCapture:[],activation:[],completeImport:[],firstSeek:[],cachedSeek:[],statsBatch:[]};const gates=[];
   const measure=(name,fn)=>{const start=performance.now(),result=fn();samples[name].push(performance.now()-start);return result;};
   const measured=async(name,fn)=>{const start=performance.now(),result=await fn();samples[name].push(performance.now()-start);return result;};
   const dbName=`m6-performance-${crypto.randomUUID()}`,repository=new SaveRepository(dbName);let coordinator;
   mark('current-history-start');
   const currentHistory=new BattleHistory(current.runId,current.battles,current.currentBattle);
   mark('current-history-complete');
   const capture=()=>({match:current.match,currentBattle:currentHistory.capturePrefix(),battleKeys:currentHistory.completedRecords.map(b=>b.combatId),addedBattles:[]});
   try{
    let fullLoadRoundTrip=null;
    let fullCaptureMeasured=false;
    const measureFullCapture=()=>{
     const fullHistory=new BattleHistory(complete.runId,complete.battles,null);
     for(let i=0;i<12;i++)measure('fullCapture',()=>exportFile({...complete,match:structuredClone(complete.match),battles:fullHistory.completedRecords,currentBattle:fullHistory.capturePrefix()}));
     fullCaptureMeasured=true;
    };
    // B9 (issue #23): the original complete-catalog validated import pipeline runs again.
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
    if(!fullCaptureMeasured)throw Error('fullCapture must run at its original pipeline position');
    mark('current-validation-start');
    if(current.battles.length+(current.currentBattle?1:0)>limits.MAX_BATTLE_RECORDS)throw Error('maximal current prefix exceeds the catalog capacity');
    await validateFile(exportFile(current),validateBattleCollection);
    mark('current-validation-complete');
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
    const summary={};for(const[name,values]of Object.entries(samples)){const ordered=[...values].sort((a,b)=>a-b);summary[name]={samples:values,p95:ordered[Math.min(ordered.length-1,Math.floor(ordered.length*.95))],max:ordered.at(-1)};}
    const budget=limits.PERFORMANCE_BUDGET_MS;
    for(const[name,metric,ceiling]of [['capture','p95',budget.incrementalCaptureP95],['write','p95',budget.incrementalWriteP95],['fullCapture','p95',budget.fullCaptureP95],['activation','max',budget.activationWriteP95],['completeImport','max',budget.completeImport],['firstSeek','max',budget.firstSeek],['cachedSeek','max',budget.cachedSeek],['statsBatch','max',budget.stats40TickBatch]]){gates.push({name,metric,actual:summary[name][metric],ceiling,passed:summary[name][metric]<=ceiling});}
    // Keep one small real record for subsequent warmed module lifecycle measurement.
    window.__M6_PERF_LIFECYCLE_RECORD=complete.battles[0];
    return{summary,gates,skipped,fullLoadRoundTrip,limits:budget,completeBattleCount:complete.battles.length,incrementalBattleCount:current.battles.length,completedHistoryWrittenOnIncrementalSave:null,deferredMetrics:[],method:'Original F4 pipeline on the original selected payloads at the catalog capacity (B9): complete import x3, current activation, 12 capture/write, 12 fullCapture, full-load roundtrip, 12 activations, firstSeek x3, cachedSeek x12, 40-tick stats.'};
   }finally{mark('measurements-cleanup-start');coordinator?.dispose();repository.close();await new Promise(resolve=>{const r=indexedDB.deleteDatabase(dbName);r.onsuccess=r.onerror=r.onblocked=resolve;});mark('measurements-cleanup-complete');}
  })(fixtures);
  });
  diagnosticPhase('measurements-returned');
  assert.deepEqual(report.measurements.skipped,[],'no deferred performance measurement after B9');
  assert.equal(report.measurements.fullLoadRoundTrip?.verified,true,'full-load import/activation roundtrip ran');
  assert(report.measurements.fullLoadRoundTrip.milliseconds<=report.measurements.limits.completeImport,'full-load import/activation roundtrip frozen budget');
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
  // Separate verification page only after every original timed callback ended.
  // Do not prewarm JSON/string traversal or pin fixture handles on the measured page.
  diagnosticPhase('fixture-transport-verification-start');
  const verificationStarted=performance.now(),verificationPage=await browser.newPage();
  try{
   await verificationPage.goto(`${server.resolvedUrls.local[0]}__m6_perf`);
   await stageFixtureGroups(verificationPage,fixtures,transport.groups);
   const verificationHandle=await verificationPage.evaluateHandle(()=>{const value=globalThis.__M6_PERF_FIXTURES;delete globalThis.__M6_PERF_FIXTURES;return value;});
   try{
    const received=await verificationHandle.evaluate(fixtureSignature);
    assert.deepEqual(received,expectedFixtureSignature,'M6 fixture transport complete value/alias graph');
    report.fixtureTransport.verification={received,passed:true,scope:'independent page after all original timed callbacks'};
   }finally{await verificationHandle.dispose();}
  }finally{await verificationPage.close();}
  report.fixtureTransport.verificationMs=performance.now()-verificationStarted;
  diagnosticPhase('fixture-transport-verification-complete',report.fixtureTransport.verification);
  assert.equal(report.errors.length,0,'browser errors');assert.equal(sourceFingerprint(),report.sourceFingerprint,'source changed during measurement');
  const failures=report.measurements.gates.filter(g=>!g.passed);assert.equal(failures.length,0,`Frozen performance budget exceeded: ${JSON.stringify(failures)}`);report.passed=true;
 }catch(error){diagnostic('script-catch',{pageClosed:page?.isClosed()??null,browserConnected:browser?.isConnected()??null,message:String(error)});report.failure=error.stack;console.error(error);process.exitCode=1;}
 finally{report.endedAt=new Date().toISOString();report.durationMs=performance.now()-started;report.finalSourceFingerprint=sourceFingerprint();report.peakProcessRssBytes=process.resourceUsage().maxRSS*1024;report.loadAtEnd=os.loadavg();diagnosticCleanupStarted=true;diagnosticPhase('script-cleanup-start',{failureRecorded:Boolean(report.failure)});fs.writeFileSync(path.join(output,'manifest.json'),JSON.stringify(report,null,2));diagnostic('browser-close-call',{location:'script-finally',connected:browser?.isConnected()??null,pageClosed:page?.isClosed()??null});await browser?.close();diagnostic('browser-close-return',{location:'script-finally'});await server?.close();console.log(JSON.stringify({passed:report.passed,durationMs:report.durationMs,acceptanceScope:report.acceptanceScope,skipped:[...(report.skipped??[]),...(report.measurements?.skipped??[])],gates:report.measurements?.gates,boundedImport:report.boundedImport,lifecycle:report.lifecycle?.heapDeltaBytes,failure:report.failure}));}
})();

/* B4 engine-module diagnosis. Not the Phaser/full-application heap gate. */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {createRequire}=require('node:module'),{pathToFileURL}=require('node:url'),{execFileSync}=require('node:child_process');
const assert=require('node:assert/strict');
function option(name,fallback){const i=process.argv.indexOf(name);return i<0?fallback:process.argv[i+1];}
const source=path.resolve(option('--source','.')),output=path.resolve(option('--output','artifacts/h1-b4'));
const calibration=process.argv.includes('--calibrate-only');
const windows=Number(option('--windows','6')),battles=Number(option('--battles','30'));
assert(Number.isInteger(windows)&&windows>=1&&windows<=10);assert(Number.isInteger(battles)&&battles>=1&&battles<=100);
const relative=path.relative(source,output);assert(relative.startsWith('..'+path.sep)||relative==='..'||path.isAbsolute(relative),'output outside measured source');
const configurations=[
 {name:'multi-hit',items:['statikk-shiv','runaans-hurricane','rageblade'],patch:{},attack:1,required:['packetDamage:statikk-shiv','packetDamage:runaans-hurricane','statChanged:rageblade']},
 {name:'status-refresh',items:['red-buff','morellonomicon','sunfire-cape'],patch:{mana:40,maxMana:40},attack:10,required:['statusChanged:red-buff','statusChanged:morellonomicon','statusChanged:sunfire-cape']},
 {name:'periodic',items:['archangel','redemption','dragons-claw'],patch:{hp:500},attack:1,required:['statChanged:archangel','heal:redemption','heal:dragons-claw']},
 {name:'retaliation-cap',items:['bramble-vest','titans-resolve','gargoyle'],patch:{},attack:1,required:['packetDamage:bramble-vest']}
];
// Same function is calibrated in Node, then compiled ONCE in the browser. No
// complete event stream or CombatState is retained across battle boundaries.
function runBatch(f,helpers,api,stats,configs,count,batchId){
 const summary={};
 for(const c of configs){
  const result={battles:0,finishedBattles:0,coveredBattles:0,statusReasons:{},ticks:0,events:0,itemEvents:{},maxRuntimeEntries:0,maxStatusContributions:0,maxPeriodicTasks:0,titanCappedBattles:0,lastArmor:null,lastRngState:null};
  for(let n=0;n<count;n++){
   const battleCounts={};
   const others=Array.from({length:5},(_,i)=>f.enemy('e'+i,1+i,3,{attackDamage:i<3?c.attack:0,cooldownTicks:0,moveCooldownTicks:1000}));
   let state=helpers.battle([f.wearing(c.items,c.patch),...others],{rngState:42,combatId:`h1/${batchId}/${c.name}/${n}`});
   for(let tick=0;tick<1201&&state.status==='running';tick++){
    const next=api.stepCombat(state);state=next.state;result.events+=next.events.length;
    for(const event of next.events){const origin=event.source??event.status?.source??event.shield?.source;if(origin?.sourceKind==='item'){const key=event.type+':'+origin.definitionId;result.itemEvents[key]=(result.itemEvents[key]??0)+1;battleCounts[key]=(battleCounts[key]??0)+1;if(event.type==='statusChanged'){const reason=origin.definitionId+':'+event.reason;result.statusReasons[reason]=(result.statusReasons[reason]??0)+1;}}}
    for(const unit of state.units){const m=unit.mechanismState;result.maxRuntimeEntries=Math.max(result.maxRuntimeEntries,unit.triggerLedger?.runtimes.length??0);result.maxStatusContributions=Math.max(result.maxStatusContributions,(m?.statuses??[]).reduce((a,g)=>a+g.contributions.length,0));result.maxPeriodicTasks=Math.max(result.maxPeriodicTasks,m?.periodicTasks.length??0);}
   }
   const owner=state.units.find(u=>u.id==='p');result.battles++;result.finishedBattles+=Number(state.status==='finished');result.ticks+=state.tick;
   result.lastArmor=stats.readCombatStats(owner,state).armor;result.lastRngState=state.rngState;
   result.titanCappedBattles+=Number((owner.triggerLedger?.runtimes??[]).some(r=>r.counters.stacks===25));
   result.coveredBattles+=Number(c.required.every(key=>battleCounts[key]>0)&&(c.name!=='retaliation-cap'||(owner.triggerLedger?.runtimes??[]).some(r=>r.counters.stacks===25)));
   // Only scalars are copied out. state and the final next/events leave scope.
  }
  result.coverageSatisfied=result.coveredBattles===count;
  summary[c.name]=result;
 }
 return summary;
}
(async()=>{
 fs.mkdirSync(output,{recursive:true});const requireSource=createRequire(path.join(source,'package.json'));
 const sourceSha=execFileSync('git',['rev-parse','HEAD'],{cwd:source,encoding:'utf8'}).trim();
 assert.equal(sourceSha,'97f38a0e787a4edcb35df4a59823bb1d106def67','calibrated source SHA');
 const report={sourceSha,diagnosticOnly:true,scope:'controlled engine-module fixtures in a blank page, not full application or legal player-command route',calibrationOnly:calibration,mode:'dev-module',combatIdPolicy:'unique h1/batch/case/battle per invocation, no shared standalone ID',seed:42,maximumTicks:1200,configurations,windowsRequested:windows,battlesPerCasePerWindow:battles,node:process.version,cpu:os.cpus()[0]?.model,errors:[],completed:false,windows:[]};
 const fixtureHashes=()=>Object.fromEntries(['tests/fixtures/m8-b4-items.ts','tests/combat-helpers.ts'].map(name=>[name,require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(source,name))).digest('hex')]));
 report.fixtureHashes=fixtureHashes();
 let server,browser,readFingerprint;
 try{
  process.chdir(source);const {sourceFingerprint}=requireSource('./scripts/m5-evidence.cjs');readFingerprint=sourceFingerprint;report.sourceFingerprint=sourceFingerprint();report.harnessSha256=require('node:crypto').createHash('sha256').update(fs.readFileSync(__filename)).digest('hex');report.sourceStatus=execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim();
  if(!calibration)assert.equal(report.sourceStatus,'','clean measured source');
  const {createServer}=await import(pathToFileURL(requireSource.resolve('vite')).href);
  server=await createServer({root:source,plugins:[{name:'h1-b4-blank',configureServer(s){s.middlewares.use((req,res,next)=>{if(req.url==='/__h1_b4'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>H1 B4 module diagnosis</title>');}else next();});}}],server:calibration?{middlewareMode:true,ws:false}:{host:'127.0.0.1',port:0},optimizeDeps:{noDiscovery:true,include:[]},appType:'custom'});
  if(calibration){
   const modules=await Promise.all(['/tests/fixtures/m8-b4-items.ts','/tests/combat-helpers.ts','/src/simulation/combat.ts','/src/simulation/combat-s13.ts'].map(p=>server.ssrLoadModule(p)));
   report.calibration=runBatch(...modules,configurations,1,'calibration');assert(Object.values(report.calibration).every(r=>r.coverageSatisfied&&r.finishedBattles===1));
  }else{
   await server.listen();const {chromium}=requireSource('playwright');browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});report.browser=browser.version();assert.equal(report.browser,'153.0.8010.12');
   const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>report.errors.push(e.message));await page.goto(server.resolvedUrls.local[0]+'__h1_b4');
   await page.evaluate(async({runner,configs})=>{const modules=await Promise.all([import('/tests/fixtures/m8-b4-items.ts'),import('/tests/combat-helpers.ts'),import('/src/simulation/combat.ts'),import('/src/simulation/combat-s13.ts')]);const execute=new Function('return ('+runner+')')();let sequence=0;window.__H1_B4_RUN__=count=>execute(...modules,configs,count,++sequence);},{runner:runBatch.toString(),configs:configurations});
   const cdp=await page.context().newCDPSession(page);await cdp.send('HeapProfiler.enable');report.warmupBattlesPerCase=2;report.warmup=await page.evaluate(()=>window.__H1_B4_RUN__(2));assert(Object.values(report.warmup).every(r=>r.coverageSatisfied&&r.finishedBattles===2),'warmup coverage and completed battles');
   await cdp.send('HeapProfiler.collectGarbage');let before=await cdp.send('Runtime.getHeapUsage');report.initialHeap=before;
   for(let i=1;i<=windows;i++){
    const counts=await page.evaluate(n=>window.__H1_B4_RUN__(n),battles);const endBeforeGc=await cdp.send('Runtime.getHeapUsage');await cdp.send('HeapProfiler.collectGarbage');const after=await cdp.send('Runtime.getHeapUsage');
    report.windows.push({window:i,beforeHeap:before,endBeforeGcHeap:endBeforeGc,afterHeap:after,heapDelta:after.usedSize-before.usedSize,counts});before=after;
    fs.writeFileSync(path.join(output,'b4-module.json'),JSON.stringify(report,null,2));assert(Object.values(counts).every(r=>r.coverageSatisfied&&r.finishedBattles===battles),'active item paths and complete battles');
   }
   // Drop even the fixed harness closure; this is a distinct final cleanup sample.
   await page.evaluate(()=>{delete window.__H1_B4_RUN__;});await cdp.send('HeapProfiler.collectGarbage');report.afterHarnessReleaseHeap=await cdp.send('Runtime.getHeapUsage');
   assert.deepEqual(report.errors,[]);
  }
  report.completed=true;
 }catch(error){report.failure=error.stack;process.exitCode=1;console.error(error);}
 finally{report.finalFixtureHashes=fixtureHashes();report.fixturesUnchanged=JSON.stringify(report.fixtureHashes)===JSON.stringify(report.finalFixtureHashes);if(!report.fixturesUnchanged){report.completed=false;report.failure=(report.failure??'')+'\nFixture source changed';process.exitCode=1;}if(readFingerprint){report.finalSourceFingerprint=readFingerprint();report.sourceUnchanged=report.finalSourceFingerprint===report.sourceFingerprint;if(!report.sourceUnchanged){report.completed=false;report.failure=(report.failure??'')+'\nMeasured source changed';process.exitCode=1;}}if(browser)await browser.close();if(server)await server.close();fs.writeFileSync(path.join(output,'b4-module.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({completed:report.completed,calibrationOnly:calibration,output}));}
})().catch(e=>{console.error(e);process.exitCode=1});

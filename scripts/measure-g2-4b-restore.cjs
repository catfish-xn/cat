// Diagnostic only: production rule functions, no mocks, no new/relaxed budget.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {performance}=require('node:perf_hooks');
const {spawnSync,execFileSync}=require('node:child_process');
const esbuild=require('esbuild');
const assert=require('node:assert/strict');
const small={baseline:[],collector:['TFT4_Item_OrnnTheCollector'],gambler:['TFT7_Item_ShimmerscaleGamblersBlade'],mogul:['TFT7_Item_ShimmerscaleMogulsMail'],zephyr:['TFT_Item_Zephyr'],gamblerZephyr:['TFT7_Item_ShimmerscaleGamblersBlade','TFT_Item_Zephyr']};
const large={largeGoldMix:{roundId:'3-5',zephyr:false},lateGoldMixZephyr:{roundId:'4-1',zephyr:true}};
const args=process.argv.slice(2),flag=name=>args.find(a=>a.startsWith(name+'='))?.slice(name.length+1);
const selected=flag('--scenario'),validateOnly=args.includes('--validate-only'),fixturesDir=flag('--fixtures-dir');
const output=args.find(a=>!a.startsWith('--'));
for(const arg of args.filter(a=>a.startsWith('--')))if(arg!=='--validate-only'&&!['--scenario=','--fixtures-dir='].some(p=>arg.startsWith(p)))throw Error(`Unknown argument ${arg}`);
if(selected&&!Object.hasOwn(small,selected)&&!Object.hasOwn(large,selected))throw Error(`Unknown scenario ${selected}`);
if(validateOnly&&!selected)throw Error('--validate-only requires one explicit --scenario');
if(output&&fs.existsSync(output))throw Error(`Refusing to overwrite existing report: ${output}`);
const median=a=>[...a].sort((a,b)=>a-b)[Math.floor(a.length/2)];
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'g24-restore-'));
 try{
  const bundle=path.join(dir,'rules.mjs');
  await esbuild.build({stdin:{contents:`export * from './src/simulation/match';export * from './src/simulation/serialization';export * from './src/simulation/seat-mechanics';`,resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',target:'node22.12',format:'esm',outfile:bundle,logLevel:'silent'});
  const api=await import('node:url').then(u=>import(u.pathToFileURL(bundle).href));
  const accepted=(r,command)=>{if(!r.ok)throw Error(`${command}: ${r.reason} at ${r.state.roundDefinitionId}/${r.state.phase}`);return r.state;};
  const choose=initial=>{
   let state=initial;
   while(state.phase==='choice'){
    const c=state.pendingChoice;
    const result=c.step==='target'?api.selectAnomalyTarget(state,c.choiceId,c.generation,state.preparation.units.find(u=>u.team==='player').id)
     :api.selectChoice(state,c.choiceId,c.generation,c.kind==='augment'?c.offers.find(id=>id!=='placebo'&&id!=='glass-cannon-i')??c.offers[0]:c.offers[0]);
    state=accepted(result,`select ${c.kind}/${c.step}`);
   }
   return state;
  };
  const equip=(state,owner,definitionId,slot,receiptId)=>{
   state=accepted(api.grantMechanicItem(state,{receiptId,source:'restore-measurement',definitionId}),'grantMechanicItem');
   return accepted(api.equipItem(state,state.items.at(-1).id,owner,slot),'equipItem');
  };
  const preparation=(name,config)=>{
   let state=api.createMatch(42);const trace=[];
   if(!config){const owner=state.preparation.units.find(u=>u.team==='player').id;for(const [slot,id] of small[name].entries())state=equip(state,owner,id,slot,`measure-${slot}`);return {state,trace};}
   state=choose(state);
   state=accepted(api.grantMechanicGold(state,{receiptId:'measure-army-budget',source:'restore-measurement',amount:1000}),'grantMechanicGold');
   while(state.level<9)state=accepted(api.buyXp(state),'buyXp');
   const starter=state.preparation.units.find(u=>u.team==='player');
   state=accepted(api.deployMatchUnit(state,starter.id,{kind:'bench',slot:0}),'bench opening hero');
   const names=['drmundo','garen','illaoi','elise','jayce','twitch','heimerdinger','tristana','vi'];
   const holders={};
   for(const [index,definitionId] of names.entries()){
    // Three legal grants create one two-star unit through the normal merge path.
    for(let n=0;n<3;n++)state=accepted(api.grantMechanicUnit(state,{receiptId:`measure-${definitionId}-${n}`,source:'restore-measurement',definitionId}),`grantMechanicUnit ${definitionId}/${n}`);
    const unit=state.preparation.units.find(u=>u.team==='player'&&u.definitionId===definitionId&&u.starLevel===2);
    assert.ok(unit,`Missing naturally merged ${definitionId}`);holders[definitionId]=unit.id;
    state=accepted(api.deployMatchUnit(state,unit.id,{kind:'board',cell:{col:index%7,row:index<5?4:6}}),'deployMatchUnit');
   }
   for(const [hero,item] of [['tristana','TFT4_Item_OrnnTheCollector'],['twitch','TFT4_Item_OrnnTheCollector'],['jayce','TFT7_Item_ShimmerscaleGamblersBlade'],['heimerdinger','TFT7_Item_ShimmerscaleGamblersBlade'],['drmundo','TFT7_Item_ShimmerscaleMogulsMail'],['garen','TFT7_Item_ShimmerscaleMogulsMail']])state=equip(state,holders[hero],item,0,`measure-gold-${hero}`);
   if(config.zephyr)state=equip(state,holders.illaoi,'TFT_Item_Zephyr',0,'measure-large-zephyr');
   while(state.roundDefinitionId!==config.roundId){
    state=choose(state);
    if(state.phase==='settlement'&&state.m8.round.kind==='supply'){trace.push({roundId:state.roundDefinitionId,phase:state.phase,hp:state.playerHp,tick:0,result:'supply'});state=accepted(api.nextRound(state,state.round),'nextRound after supply');continue;}
    if(state.phase!=='preparation')throw Error(`Cannot reach ${config.roundId}: actual ${state.roundDefinitionId}/${state.phase}, HP ${state.playerHp}`);
    const roundId=state.roundDefinitionId;state=accepted(api.startMatchCombat(state),'startMatchCombat');
    while(state.phase==='combat')state=api.stepMatch(state).state;
    trace.push({roundId,phase:state.phase,hp:state.playerHp,tick:state.combat?.tick??0,result:state.combat?.result??null});
    state=choose(state);
    state=accepted(api.nextRound(state,state.round),'nextRound');
   }
   state=choose(state);assert.equal(state.phase,'preparation');
   // Fail rather than silently bench, delete, or replace any requested army unit.
   for(const id of Object.values(holders))assert.equal(state.preparation.units.find(u=>u.id===id)?.location.kind,'board');
   assert.deepEqual(api.restoreMatch(api.serializeMatch(state)),state);
   return {state,trace};
  };
  const rows=[],routes=[];
  for(const name of Object.keys({...small,...large}).filter(n=>!selected||n===selected)){
   const config=large[name],prepared=preparation(name,config);let state=accepted(api.startMatchCombat(prepared.state),'startMatchCombat');
   const snapshots=new Map(),all=config?[state]:null;
   while(true){
    if(!config&&([0,1,50,99,100].includes(state.combat.tick)||state.phase!=='combat'))snapshots.set(state.combat.tick,state);
    if(state.phase!=='combat')break;state=api.stepMatch(state).state;if(all)all.push(state);
   }
   if(all){for(const snapshot of [all[0],all[Math.floor((all.length-1)/2)],all.at(-1)])snapshots.set(snapshot.combat.tick,snapshot);}
   routes.push({name,requestedRound:config?.roundId??prepared.state.roundDefinitionId,actualRound:prepared.state.roundDefinitionId,preparationLevel:prepared.state.level,preparationPlayerUnits:prepared.state.preparation.units.filter(u=>u.team==='player'&&u.location.kind==='board').length,trace:prepared.trace});
   for(const [tick,snapshot] of snapshots){
    const text=api.serializeMatch(snapshot),before=JSON.stringify(snapshot),measurements={};
    const fixtureName=`${name}-tick-${tick}.json`,fixture=path.join(dir,fixtureName);fs.writeFileSync(fixture,text);
    if(fixturesDir){fs.mkdirSync(fixturesDir,{recursive:true});fs.writeFileSync(path.join(fixturesDir,fixtureName),text,{flag:'wx'});}
    for(const mode of ['json','object']){
     const input=mode==='json'?text:snapshot;assert.deepEqual(api.restoreMatch(input),snapshot);
     if(!validateOnly){const samples=[];for(let i=0;i<7;i++){const t=performance.now();const restored=api.restoreMatch(input);samples.push(performance.now()-t);assert.deepEqual(restored,snapshot);}measurements[mode]={samplesMs:samples,medianMs:median(samples),maxMs:Math.max(...samples)};}
    }
    assert.equal(JSON.stringify(snapshot),before);
    let invalidTickMs=null,coldJsonMs=null,coldObjectMs=null;
    if(!validateOnly){
     const forged=JSON.parse(text);forged.combat.tick=1201;const t=performance.now();assert.throws(()=>api.restoreMatch(JSON.stringify(forged)));invalidTickMs=performance.now()-t;
     for(const mode of config?['json','object']:snapshot.phase!=='combat'?['json']:[]){
      const child=spawnSync(process.execPath,['--input-type=module','-e',`import {readFileSync} from 'node:fs';import {performance} from 'node:perf_hooks';import {pathToFileURL} from 'node:url';import assert from 'node:assert/strict';const a=await import(pathToFileURL(process.argv[1]).href);const text=readFileSync(process.argv[2],'utf8'),expected=JSON.parse(text),input=process.argv[3]==='json'?text:expected;const before=JSON.stringify(expected),t=performance.now();const restored=a.restoreMatch(input);const ms=performance.now()-t;assert.deepEqual(restored,expected);assert.equal(JSON.stringify(expected),before);console.log(JSON.stringify({ms,tick:restored.combat.tick,verified:true}));`,bundle,fixture,mode],{encoding:'utf8'});
      assert.equal(child.status,0,child.stderr);const result=JSON.parse(child.stdout);assert.equal(result.tick,tick);assert.equal(result.verified,true);if(mode==='json')coldJsonMs=result.ms;else coldObjectMs=result.ms;
     }
    }
    rows.push({name,roundId:snapshot.roundDefinitionId,tick,terminal:snapshot.phase!=='combat',units:snapshot.combat.units.length,playerUnits:snapshot.combat.units.filter(u=>u.team==='player').length,enemyUnits:snapshot.combat.units.filter(u=>u.team==='enemy').length,itemGoldReceipts:snapshot.combat.itemGoldReceipts?.length??0,jsonBytes:Buffer.byteLength(text),fixture:fixturesDir?path.join(fixturesDir,fixtureName):null,coldJsonMs,coldObjectMs,invalidTickMs,...measurements});
   }
  }
  const report={codeHead:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),dirty:execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim().split('\n').filter(Boolean),node:process.version,npm:execFileSync('npm',['--version'],{encoding:'utf8'}).trim(),esbuild:esbuild.version,cpu:os.cpus()[0]?.model,cpuCount:os.cpus().length,platform:process.platform,arch:process.arch,validateOnly,
   method:'Diagnostic only, no acceptance threshold changed. Production restoreMatch bundled for Node22.12. Public create/grant/buyXp/deploy/equip/start/step/choice/nextRound only; no Match or combat state editing to prepare samples. Old six small scenarios and checkpoints preserved; old cold policy is terminal JSON only. New nine-hero two-star gold scenarios use actual opening/midpoint/terminal, each with fresh-process JSON and object restores. Seven warm calls after one untimed equality-checked warmup per input form. Every restore, including cold, checks whole-state equality; assertions/import/preparation excluded from timings. validate-only performs untimed equality checks and no benchmark samples. No assumed 1200-tick, browser responsiveness, or typical-player distribution claim.',routes,rows};
  if(output)fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify(validateOnly?{validateOnly,routes,rows}:rows.filter(r=>r.terminal).map(r=>({name:r.name,roundId:r.roundId,tick:r.tick,units:r.units,cold:r.coldJsonMs,warmJSON:r.json.medianMs,warmObject:r.object.medianMs,maxWarm:Math.max(r.json.maxMs,r.object.maxMs)})),null,2));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});

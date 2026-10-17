// Diagnostic only: production rule functions, no mocks, no new/relaxed budget.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {performance}=require('node:perf_hooks');
const {spawnSync}=require('node:child_process');
const {build}=require('esbuild');
const assert=require('node:assert/strict');
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'g24-restore-'));
 try{
  const bundle=path.join(dir,'rules.mjs');
  await build({stdin:{contents:`export * from './src/simulation/match';export * from './src/simulation/serialization';export * from './src/simulation/seat-mechanics';`,resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',target:'node22.12',format:'esm',outfile:bundle,logLevel:'silent'});
  const api=await import('node:url').then(u=>import(u.pathToFileURL(bundle).href));
  const accepted=r=>{if(!r.ok)throw Error(r.reason);return r.state;};
  const median=a=>[...a].sort((a,b)=>a-b)[Math.floor(a.length/2)];
  const rows=[];
  for(const [name,items] of Object.entries({baseline:[],collector:['TFT4_Item_OrnnTheCollector'],gambler:['TFT7_Item_ShimmerscaleGamblersBlade'],mogul:['TFT7_Item_ShimmerscaleMogulsMail'],zephyr:['TFT_Item_Zephyr'],gamblerZephyr:['TFT7_Item_ShimmerscaleGamblersBlade','TFT_Item_Zephyr']})){
   let state=api.createMatch(42);const owner=state.preparation.units.find(u=>u.team==='player').id;
   for(const [slot,definitionId] of items.entries()){
    state=accepted(api.grantMechanicItem(state,{receiptId:`measure-${slot}`,source:'restore-measurement',definitionId}));
    state=accepted(api.equipItem(state,state.items.at(-1).id,owner,slot));
   }
   state=accepted(api.startMatchCombat(state));const snapshots=new Map();
   while(true){
    if([0,1,50,99,100].includes(state.combat.tick)||state.phase!=='combat')snapshots.set(state.combat.tick,state);
    if(state.phase!=='combat')break;state=api.stepMatch(state).state;
   }
   for(const [tick,snapshot] of snapshots){
    const text=api.serializeMatch(snapshot),before=JSON.stringify(snapshot),measurements={};
    for(const mode of ['json','object']){
     const input=mode==='json'?text:snapshot;
     assert.deepEqual(api.restoreMatch(input),snapshot);
     const samples=[];
     for(let i=0;i<7;i++){const t=performance.now();const restored=api.restoreMatch(input);samples.push(performance.now()-t);assert.deepEqual(restored,snapshot);}
     measurements[mode]={samplesMs:samples,medianMs:median(samples),maxMs:Math.max(...samples)};
    }
    assert.equal(JSON.stringify(snapshot),before);
    const forged=JSON.parse(text);forged.combat.tick=1201;
    const t=performance.now();assert.throws(()=>api.restoreMatch(JSON.stringify(forged)));const invalidTickMs=performance.now()-t;
    let coldMs=null;
    if(snapshot.phase!=='combat'){
     const fixture=path.join(dir,name+'.json');fs.writeFileSync(fixture,text);
     const child=spawnSync(process.execPath,['--input-type=module','-e',`import {readFileSync} from 'node:fs';import {performance} from 'node:perf_hooks';import {pathToFileURL} from 'node:url';const a=await import(pathToFileURL(process.argv[1]).href);const text=readFileSync(process.argv[2],'utf8');const t=performance.now();const s=a.restoreMatch(text);console.log(JSON.stringify({ms:performance.now()-t,tick:s.combat.tick}));`,bundle,fixture],{encoding:'utf8'});
     assert.equal(child.status,0,child.stderr);const result=JSON.parse(child.stdout);assert.equal(result.tick,tick);coldMs=result.ms;
    }
    rows.push({name,tick,terminal:snapshot.phase!=='combat',units:snapshot.combat.units.length,jsonBytes:Buffer.byteLength(text),coldJsonMs:coldMs,invalidTickMs,...measurements});
   }
  }
  const report={codeHead:require('node:child_process').execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),node:process.version,cpu:os.cpus()[0]?.model,platform:process.platform,method:'Production restoreMatch bundled with esbuild Node target, no mocks. Legal create/grant/equip/start/step commands. Seven warm restores per checkpoint/input form, one fresh-process terminal JSON restore. Import, fixture generation and equality assertions excluded from timing. No measured 1200-tick legal battle or browser responsiveness claim. No acceptance threshold changed.',rows};
  const output=process.argv[2];if(output)fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(rows.filter(r=>r.terminal).map(r=>({name:r.name,tick:r.tick,units:r.units,cold:r.coldJsonMs,warmJSON:r.json.medianMs,warmObject:r.object.medianMs,maxWarm:Math.max(r.json.maxMs,r.object.maxMs)})),null,2));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});

// Compare the same legitimate public-combat snapshots in two isolated bundles.
// Usage: node scripts/measure-task-mechanism-restore.cjs [base-ref=d9cf582]
const {buildSync}=require('esbuild');
const {execFileSync}=require('node:child_process');
const {mkdtempSync,mkdirSync,rmSync}=require('node:fs');
const {tmpdir}=require('node:os');
const {join,resolve}=require('node:path');
const {pathToFileURL}=require('node:url');
const {performance}=require('node:perf_hooks');
const {deepStrictEqual}=require('node:assert');
const median=values=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)];
(async()=>{
 const directory=mkdtempSync(join(tmpdir(),'pr166-timing-'));
 try{
  const baseRef=process.argv[2]??'d9cf582',baseRoot=join(directory,'base');mkdirSync(baseRoot);
  const archive=join(directory,'base.tar');
  execFileSync('git',['archive',`--output=${archive}`,baseRef]);execFileSync('tar',['-xf',archive,'-C',baseRoot]);
  const bundle=(root,name)=>{
   const entry=join(directory,`${name}.mjs`);
   buildSync({stdin:{contents:`export * as match from './src/simulation/match';
    export {serializeMatch,restoreMatch} from './src/simulation/serialization';
    export * as mechanics from './src/simulation/seat-mechanics';
    export {publicEquipmentPreparation} from './tests/fixtures/m8-b4-match';
    export {CONTENT_DIGEST} from './src/simulation/content';`,resolveDir:root},bundle:true,platform:'node',format:'esm',outfile:entry});
   return import(pathToFileURL(entry).href);
  };
  const baseline=await bundle(baseRoot,'baseline'),candidate=await bundle(resolve('.'),'candidate');
  deepStrictEqual(candidate.CONTENT_DIGEST,baseline.CONTENT_DIGEST,'no content change');
  const accept=r=>{if(!r.ok)throw Error(r.reason);return r.state;};
  const checkpoints=[];
  for(const rose of [false,true]){
   let state=candidate.publicEquipmentPreparation(['rod']);
   for(const [i,definitionId] of (rose?['morgana','cassiopeia','vladimir']:['morgana']).entries()){
    state=accept(candidate.mechanics.grantMechanicUnit(state,{receiptId:`timing-${definitionId}`,source:'test',definitionId}));
    const unit=state.preparation.units.find(u=>u.definitionId===definitionId&&u.team==='player');
    state=accept(candidate.match.deployMatchUnit(state,unit.id,{kind:'board',cell:{col:[0,6,5][i],row:4}}));
   }
   state=accept(candidate.match.startMatchCombat(state));
   const label=rose?'Morgana+Sion':'Morgana';let curse=false,release=false;
   checkpoints.push({label:label+' tick0',state});
   while(state.phase==='combat'){
    const before=state;state=candidate.match.stepMatch(state).state;
    if(state.combat.tick===20)checkpoints.push({label:label+' tick20',state});
    if(!curse&&state.combat.units.some(u=>u.tasks?.some(t=>t.kind==='g22Curse'))){
     checkpoints.push({label:label+' before curse',state:before},{label:label+' active curse',state});curse=true;
    }
    if(rose&&!release&&state.combat.units.some(u=>u.definitionId==='g23-sion'&&u.runtime.buddyTriggered)){
     checkpoints.push({label:label+' released',state});release=true;
    }
    if(curse&&(!rose||release))break;
   }
  }
  const rows=[];
  for(const {label,state} of checkpoints){
   const saved=candidate.serializeMatch(state),row={label,tick:state.combat.tick};
   for(const operation of ['serialize','restoreObject','restoreJSON']){
    const action=api=>operation==='serialize'?()=>api.serializeMatch(state):operation==='restoreObject'?()=>api.restoreMatch(state):()=>api.restoreMatch(saved);
    const samples={baseline:[],candidate:[]},errors={};
    // Warm each API independently; never use candidate runtime data as evidence.
    for(const [name,api] of [['baseline',baseline],['candidate',candidate]]){
     try{action(api)();}catch(error){errors[name]=error.message;}
    }
    for(let run=0;run<9;run++)for(const name of run%2?['candidate','baseline']:['baseline','candidate']){
     if(errors[name])continue;
     const fn=action(name==='baseline'?baseline:candidate),start=performance.now();fn();samples[name].push(performance.now()-start);
    }
    row[operation]=Object.fromEntries(['baseline','candidate'].map(name=>[name,errors[name]?{error:errors[name]}:{medianMs:median(samples[name])}]));
    if(!errors.baseline&&!errors.candidate){
     row[operation].deltaMs=median(samples.candidate)-median(samples.baseline);
     row[operation].ratio=median(samples.candidate)/median(samples.baseline);
    }
   }
   rows.push(row);
  }
  console.log(JSON.stringify({baseRef,node:process.version,samples:9,statistic:'median milliseconds; alternating baseline/candidate',contentDigest:candidate.CONTENT_DIGEST,rows},null,2));
 }finally{rmSync(directory,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});

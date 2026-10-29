/* Parallel runner for scripts/verify-v25-online-rules-epoch.cjs: same steps, same arguments,
 * same logs and evidence file, but each step starts as soon as the steps it reads from finish.
 * The step list is read from the serial script itself, so the two can never drift apart.
 * This file's name must not contain "v25-online-rules": those scripts are hashed into the evidence. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),os=require('node:os'),{spawn}=require('node:child_process');
const {createEpochReport}=require('./v25-epoch-report.cjs');
process.env.GIT_OPTIONAL_LOCKS='0';
const serial='scripts/verify-v25-online-rules-epoch.cjs';
const usage='Usage: verify-v25-epoch-parallel.cjs [--write] [--jobs=N]';
const argv=process.argv.slice(2),write=argv.includes('--write'),jobsArg=argv.find(x=>x.startsWith('--jobs='));
if(argv.some(x=>x!=='--write'&&x!==jobsArg))throw Error(usage);
const jobs=jobsArg?Number(jobsArg.slice(7)):os.availableParallelism();
if(!Number.isSafeInteger(jobs)||jobs<1)throw Error(usage);
const source=fs.readFileSync(serial,'utf8');
const base=/const base='([0-9a-f]{40})'/.exec(source)?.[1],list=/\nconst steps=(\[[\s\S]*?\n\]);\n/.exec(source)?.[1];
if(!base||!list)throw Error('Cannot read the step list from '+serial);
const steps=vm.runInNewContext(list,{arg:'--baseline-commit='+base,check:write?[]:['--check'],write});
// Write mode: a step waits for every earlier step whose outputs it reads.
// herald-raw -> inputs/check-herald; each record -> its own --check; consumer-byte-audit diffs all of tests/.
const testsWriters=['record-battle-start','record-release','record-herald','record-inputs','record-transfer','record-chest-trial'];
const writeDeps={
 'check-identities':[],'record-battle-start':[],'record-release':[],'record-herald':[],
 'record-inputs':['record-herald'],'record-live-reveal':[],'record-transfer':[],
 'check-transfer':['record-transfer'],'check-inputs':['record-inputs'],'check-herald':['record-herald'],
 'check-history':[],'check-live-reveal':['record-live-reveal'],'record-chest-trial':[],
 'consumer-byte-audit':testsWriters,'compare-digests':[],
};
const names=steps.map(([name])=>name);
if(names.length!==Object.keys(writeDeps).length||names.some(n=>!writeDeps[n]))throw Error('Step list changed in '+serial+'; update writeDeps');
// Check mode writes nothing that another step reads, so every step is independent.
const deps=Object.fromEntries(names.map(n=>[n,write?writeDeps[n]:[]]));
const directory='artifacts/v25-online-rules-recording';fs.mkdirSync(directory,{recursive:true});
const finishReport=createEpochReport({base,write,directory,totalSteps:steps.length});
const results=new Map(),running=new Set(),started=performance.now();let failed=false;
const launch=([name,...args])=>new Promise(resolve=>{
 console.log(JSON.stringify({phase:'start',name,args}));
 const start=performance.now(),log=path.join(directory,name+'.log'),fd=fs.openSync(log,'w');
 let finished=false;
 const finish=(exitCode,signal,error)=>{
  if(finished)return;finished=true;
  fs.closeSync(fd);
  results.set(name,{name,args,exitCode,signal,elapsedMs:Math.round(performance.now()-start),log,...(error?{error:String(error)}:{})});
  console.log(JSON.stringify(results.get(name)));resolve();
 };
 const child=spawn(process.execPath,args,{stdio:['ignore',fd,fd]});
 child.on('error',error=>finish(null,null,error));
 child.on('exit',(code,signal)=>finish(code,signal));
});
(async()=>{
 const pending=new Set(names),waiters=new Set();
 // On the first failure nothing new starts; steps already running finish and are recorded.
 const ready=()=>failed?[]:steps.filter(([n])=>pending.has(n)&&deps[n].every(d=>results.get(d)?.exitCode===0));
 for(;;){
  for(const step of ready()){
   if(running.size>=jobs)break;
   pending.delete(step[0]);running.add(step[0]);
   const p=launch(step).then(()=>{running.delete(step[0]);waiters.delete(p);if(results.get(step[0]).exitCode!==0)failed=true;});
   waiters.add(p);
  }
  if(!waiters.size)break;
  await Promise.race(waiters);
 }
 // Finalize once, after all running children settle, in serial step order.
 const ok=finishReport(names.filter(n=>results.has(n)).map(n=>results.get(n)));
 console.log(JSON.stringify({phase:'done',mode:write?'write':'check',jobs,complete:ok,wallMs:Math.round(performance.now()-started)}));
 if(!ok)process.exitCode=1;
})();

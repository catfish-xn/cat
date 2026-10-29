/* Run the recording/verification steps sequentially, offline, without Git writes. */
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const {createEpochReport}=require('./v25-epoch-report.cjs');
process.env.GIT_OPTIONAL_LOCKS='0';
const base='100589ca41d78a4671c8675ec30057a9ea5ea684',arg='--baseline-commit='+base;
const write=process.argv.includes('--write');
if(process.argv.slice(2).some(x=>x!=='--write'))throw Error('Usage: verify-v25-online-rules-epoch.cjs [--write]');
const check=write?[]:['--check'];
const steps=[
 ['check-identities','scripts/update-content-identities.cjs','--check'],
 ['record-battle-start','scripts/record-v25-online-rules-battle-start.cjs',...check],
 ['record-release','scripts/record-v25-online-rules-release.cjs',arg,...check],
 ['record-herald','tests/fixtures/record-v25-online-rules-herald.cjs',...(write?['--write']:[])],
 ['record-inputs','scripts/record-v25-online-rules-inputs.cjs',arg,...check],
 ['record-live-reveal','scripts/record-v25-online-rules-live-reveal.cjs',arg,...check],
 ['record-transfer','scripts/record-v25-online-rules-transfer.cjs',...check],
 ['check-transfer','scripts/record-v25-online-rules-transfer.cjs','--check'],
 ['check-inputs','scripts/record-v25-online-rules-inputs.cjs',arg,'--check'],
 ['check-herald','scripts/verify-m8-herald-fixtures.cjs'],
 ['check-history','scripts/v25-online-rules-fixture-audit.cjs',arg,...check],
 ['check-live-reveal','scripts/record-v25-online-rules-live-reveal.cjs',arg,'--check'],
 ['record-chest-trial','scripts/record-chest-trial-v25.cjs',...check],
 ['consumer-byte-audit','scripts/audit-v25-online-rules-adaptations.cjs',...check],
 ['compare-digests','scripts/compare-v25-online-rules-digests.cjs',...check],
];
const directory='artifacts/v25-online-rules-recording';fs.mkdirSync(directory,{recursive:true});
const finishReport=createEpochReport({base,write,directory,totalSteps:steps.length});
const results=[];
for(const [name,...args] of steps){
 console.log(JSON.stringify({phase:'start',name,args}));
 const start=performance.now(),log=path.join(directory,name+'.log'),fd=fs.openSync(log,'w');
 let run;try{run=spawnSync(process.execPath,args,{stdio:['ignore',fd,fd]});}finally{fs.closeSync(fd);}
 results.push({name,args,exitCode:run.status,signal:run.signal,elapsedMs:Math.round(performance.now()-start),log,...(run.error?{error:String(run.error)}:{})});
 console.log(JSON.stringify(results.at(-1)));
 if(run.status!==0){process.exitCode=1;break;}
}
if(!finishReport(results))process.exitCode=1;

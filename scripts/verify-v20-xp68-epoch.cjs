/* Run the eleven recording/verification steps sequentially, offline, without Git writes. */
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
process.env.GIT_OPTIONAL_LOCKS='0';
const base='2de5e26d088e4e86032bf571d51941c9b0ecd12f',arg='--baseline-commit='+base;
const steps=[
 ['record-release','scripts/record-v20-xp68-release.cjs',arg],
 ['record-herald','tests/fixtures/record-v20-xp68-herald.cjs','--write'],
 ['record-inputs','scripts/record-v20-xp68-inputs.cjs',arg],
 ['record-live-reveal','scripts/record-v20-xp68-live-reveal.cjs',arg],
 ['record-transfer','scripts/record-v20-xp68-transfer.cjs'],
 ['check-transfer','scripts/record-v20-xp68-transfer.cjs','--check'],
 ['check-inputs','scripts/record-v20-xp68-inputs.cjs',arg,'--check'],
 ['check-herald','scripts/verify-m8-herald-fixtures.cjs'],
 ['check-history','scripts/v20-xp68-fixture-audit.cjs',arg],
 ['check-live-reveal','scripts/record-v20-xp68-live-reveal.cjs',arg,'--check'],
 ['compare-digests','scripts/compare-v20-xp68-digests.cjs'],
];
const directory='artifacts/v20-xp68-recording';fs.mkdirSync(directory,{recursive:true});
const results=[];
for(const [name,...args] of steps){
 console.log(JSON.stringify({phase:'start',name,args}));
 const start=performance.now(),log=path.join(directory,name+'.log'),fd=fs.openSync(log,'w');
 let run;try{run=spawnSync(process.execPath,args,{stdio:['ignore',fd,fd]});}finally{fs.closeSync(fd);}
 results.push({name,args,exitCode:run.status,signal:run.signal,elapsedMs:Math.round(performance.now()-start),log,...(run.error?{error:String(run.error)}:{})});
 fs.mkdirSync('docs/evidence/v20-xp68',{recursive:true});
 fs.writeFileSync('docs/evidence/v20-xp68/epoch-verification.json',JSON.stringify({baseCommit:base,steps:results,complete:results.length===steps.length&&results.every(r=>r.exitCode===0)},null,2)+'\n');
 console.log(JSON.stringify(results.at(-1)));
 if(run.status!==0){process.exitCode=1;break;}
}

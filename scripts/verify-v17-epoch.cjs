/* Run the nine recording/verification steps sequentially, offline, without Git writes. */
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const base='30cf934446719a0da0d3cea1667bf84a3df5296c',arg='--baseline-commit='+base;
const steps=[
 ['record-release','scripts/record-v17-release.cjs',arg],
 ['record-herald','tests/fixtures/record-v17-herald.cjs','--write'],
 ['record-inputs','scripts/record-v17-inputs.cjs',arg],
 ['record-live-reveal','scripts/record-v17-live-reveal.cjs',arg],
 ['check-inputs','scripts/record-v17-inputs.cjs',arg,'--check'],
 ['check-herald','scripts/verify-m8-herald-fixtures.cjs'],
 ['check-history','scripts/v17-fixture-audit.cjs',arg],
 ['check-live-reveal','scripts/record-v17-live-reveal.cjs',arg,'--check'],
 ['compare-digests','scripts/compare-v17-digests.cjs'],
];
const directory='artifacts/v17-recording';fs.mkdirSync(directory,{recursive:true});
const results=[];
for(const [name,...args] of steps){
 console.log(JSON.stringify({phase:'start',name,args}));
 const start=performance.now(),run=spawnSync(process.execPath,args,{encoding:'utf8',maxBuffer:64*1024*1024});
 const log=path.join(directory,name+'.log');fs.writeFileSync(log,(run.stdout??'')+(run.stderr??''));
 results.push({name,args,exitCode:run.status,signal:run.signal,elapsedMs:Math.round(performance.now()-start),log,...(run.error?{error:String(run.error)}:{})});
 fs.mkdirSync('docs/evidence/v17',{recursive:true});
 fs.writeFileSync('docs/evidence/v17/epoch-verification.json',JSON.stringify({baseCommit:base,steps:results,complete:results.length===steps.length&&results.every(r=>r.exitCode===0)},null,2)+'\n');
 console.log(JSON.stringify(results.at(-1)));
 if(run.status!==0){process.exitCode=1;break;}
}

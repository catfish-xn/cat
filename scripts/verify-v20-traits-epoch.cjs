/* Run the recording/verification steps sequentially, offline, without Git writes. */
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
process.env.GIT_OPTIONAL_LOCKS='0';
const base='14006984600a08f8dd96fa776bf9ba1d1048ff24',arg='--baseline-commit='+base;
const steps=[
 ['check-identities','scripts/update-content-identities.cjs','--check'],
 ['record-release','scripts/record-v20-traits-release.cjs',arg],
 ['record-herald','tests/fixtures/record-v20-traits-herald.cjs','--write'],
 ['record-inputs','scripts/record-v20-traits-inputs.cjs',arg],
 ['record-transfer','scripts/record-v20-traits-transfer.cjs'],
 ['check-transfer','scripts/record-v20-traits-transfer.cjs','--check'],
 ['record-live-reveal','scripts/record-v20-traits-live-reveal.cjs',arg],
 ['check-inputs','scripts/record-v20-traits-inputs.cjs',arg,'--check'],
 ['check-herald','scripts/verify-m8-herald-fixtures.cjs'],
 ['check-history','scripts/v20-traits-fixture-audit.cjs',arg],
 ['check-live-reveal','scripts/record-v20-traits-live-reveal.cjs',arg,'--check'],
 ['compare-digests','scripts/compare-v20-traits-digests.cjs'],
];
const directory='artifacts/v20-traits-recording';fs.mkdirSync(directory,{recursive:true});
const results=[];
for(const [name,...args] of steps){
 console.log(JSON.stringify({phase:'start',name,args}));
 const start=performance.now(),run=spawnSync(process.execPath,args,{encoding:'utf8',maxBuffer:64*1024*1024});
 const log=path.join(directory,name+'.log');fs.writeFileSync(log,(run.stdout??'')+(run.stderr??''));
 results.push({name,args,exitCode:run.status,signal:run.signal,elapsedMs:Math.round(performance.now()-start),log,...(run.error?{error:String(run.error)}:{})});
 fs.mkdirSync('docs/evidence/v20-traits',{recursive:true});
 fs.writeFileSync('docs/evidence/v20-traits/epoch-verification.json',JSON.stringify({baseCommit:base,steps:results,complete:results.length===steps.length&&results.every(r=>r.exitCode===0)},null,2)+'\n');
 console.log(JSON.stringify(results.at(-1)));
 if(run.status!==0){process.exitCode=1;break;}
}

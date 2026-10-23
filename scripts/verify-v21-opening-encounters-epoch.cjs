/* Run the recording/verification steps sequentially, offline, without Git writes. */
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
process.env.GIT_OPTIONAL_LOCKS='0';
const base='83fd7fa58fc7c935229c8f8866b14ec9d716accd',arg='--baseline-commit='+base;
const write=process.argv.includes('--write');
if(process.argv.slice(2).some(x=>x!=='--write'))throw Error('Usage: verify-v21-opening-encounters-epoch.cjs [--write]');
const check=write?[]:['--check'];
const steps=[
 ['check-identities','scripts/update-content-identities.cjs','--check'],
 ['record-battle-start','scripts/record-v21-opening-encounters-battle-start.cjs',...check],
 ['record-release','scripts/record-v21-opening-encounters-release.cjs',arg,...check],
 ['record-herald','tests/fixtures/record-v21-opening-encounters-herald.cjs',...(write?['--write']:[])],
 ['record-inputs','scripts/record-v21-opening-encounters-inputs.cjs',arg,...check],
 ['record-live-reveal','scripts/record-v21-opening-encounters-live-reveal.cjs',arg,...check],
 ['record-transfer','scripts/record-v21-opening-encounters-transfer.cjs',...check],
 ['check-transfer','scripts/record-v21-opening-encounters-transfer.cjs','--check'],
 ['check-inputs','scripts/record-v21-opening-encounters-inputs.cjs',arg,'--check'],
 ['check-herald','scripts/verify-m8-herald-fixtures.cjs'],
 ['check-history','scripts/v21-opening-encounters-fixture-audit.cjs',arg,...check],
 ['check-live-reveal','scripts/record-v21-opening-encounters-live-reveal.cjs',arg,'--check'],
 ['record-chest-trial','scripts/record-opening-encounters-pr9-trials.cjs',...check],
 ['consumer-byte-audit','scripts/audit-encounters-pr9-adaptations.cjs',...check],
 ['compare-digests','scripts/compare-v21-opening-encounters-digests.cjs',...check],
];
const directory='artifacts/v21-opening-encounters-recording';fs.mkdirSync(directory,{recursive:true});
const results=[];
for(const [name,...args] of steps){
 console.log(JSON.stringify({phase:'start',name,args}));
 const start=performance.now(),log=path.join(directory,name+'.log'),fd=fs.openSync(log,'w');
 let run;try{run=spawnSync(process.execPath,args,{stdio:['ignore',fd,fd]});}finally{fs.closeSync(fd);}
 results.push({name,args,exitCode:run.status,signal:run.signal,elapsedMs:Math.round(performance.now()-start),log,...(run.error?{error:String(run.error)}:{})});
 fs.mkdirSync('docs/evidence/v21-opening-encounters',{recursive:true});
 fs.writeFileSync('docs/evidence/v21-opening-encounters/epoch-verification.json',JSON.stringify({baseCommit:base,steps:results,complete:results.length===steps.length&&results.every(r=>r.exitCode===0)},null,2)+'\n');
 console.log(JSON.stringify(results.at(-1)));
 if(run.status!==0){process.exitCode=1;break;}
}

/* Run the eleven recording/verification steps sequentially, offline, without Git writes. */
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
process.env.GIT_OPTIONAL_LOCKS='0';
const base='db04d196e4a12933624add7d61be9081a639607f',arg='--baseline-commit='+base;
const write=process.argv.includes('--write');
if(process.argv.slice(2).some(x=>x!=='--write'))throw Error('Usage: verify-v20-live-combat-epoch.cjs [--write]');
const check=write?[]:['--check'];
const steps=[
 ['record-release','scripts/record-v20-live-combat-release.cjs',arg,...check],
 ['record-herald','tests/fixtures/record-v20-live-combat-herald.cjs',...(write?['--write']:[])],
 ['record-inputs','scripts/record-v20-live-combat-inputs.cjs',arg,...check],
 ['record-live-reveal','scripts/record-v20-live-combat-live-reveal.cjs',arg,...check],
 ['record-transfer','scripts/record-v20-live-combat-transfer.cjs',...check],
 ['check-transfer','scripts/record-v20-live-combat-transfer.cjs','--check'],
 ['check-inputs','scripts/record-v20-live-combat-inputs.cjs',arg,'--check'],
 ['check-herald','scripts/verify-m8-herald-fixtures.cjs'],
 ['check-history','scripts/v20-live-combat-fixture-audit.cjs',arg],
 ['check-live-reveal','scripts/record-v20-live-combat-live-reveal.cjs',arg,'--check'],
 ['compare-digests','scripts/compare-v20-live-combat-digests.cjs'],
];
const directory='artifacts/v20-live-combat-recording';fs.mkdirSync(directory,{recursive:true});
const results=[];
for(const [name,...args] of steps){
 console.log(JSON.stringify({phase:'start',name,args}));
 const start=performance.now(),log=path.join(directory,name+'.log'),fd=fs.openSync(log,'w');
 let run;try{run=spawnSync(process.execPath,args,{stdio:['ignore',fd,fd]});}finally{fs.closeSync(fd);}
 results.push({name,args,exitCode:run.status,signal:run.signal,elapsedMs:Math.round(performance.now()-start),log,...(run.error?{error:String(run.error)}:{})});
 fs.mkdirSync('docs/evidence/v20-live-combat',{recursive:true});
 fs.writeFileSync('docs/evidence/v20-live-combat/epoch-verification.json',JSON.stringify({baseCommit:base,steps:results,complete:results.length===steps.length&&results.every(r=>r.exitCode===0)},null,2)+'\n');
 console.log(JSON.stringify(results.at(-1)));
 if(run.status!==0){process.exitCode=1;break;}
}

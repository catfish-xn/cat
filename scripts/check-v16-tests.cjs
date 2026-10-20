/* Sequential, offline v16 verification. Every file retains its own configured time limits. */
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const out='artifacts/v16-tests';fs.mkdirSync(out,{recursive:true});
const files=process.argv.slice(2);if(!files.length)throw Error('Supply explicit test file paths');
const results=[];
for(const file of files){
 const name=path.basename(file,'.test.ts'),json=path.join(out,name+'.json'),log=path.join(out,name+'.log');
 const run=spawnSync(process.execPath,['node_modules/vitest/vitest.mjs','run',file,'--configLoader','runner','--reporter=json','--outputFile='+json],{encoding:'utf8',maxBuffer:32*1024*1024});fs.writeFileSync(log,(run.stdout??'')+(run.stderr??''));
 let r={file,exitCode:run.status,passed:0,failed:0,pending:0};if(fs.existsSync(json)){const j=JSON.parse(fs.readFileSync(json,'utf8'));r={...r,passed:j.numPassedTests,failed:j.numFailedTests,pending:j.numPendingTests};}
 results.push(r);fs.writeFileSync(path.join(out,'latest.json'),JSON.stringify(results,null,2)+'\n');console.log(JSON.stringify(r));
}
if(results.some(r=>r.exitCode!==0||r.failed||r.pending))process.exitCode=1;

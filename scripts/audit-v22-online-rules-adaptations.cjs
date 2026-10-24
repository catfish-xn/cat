/* Read-only Git baseline; exact byte evidence for current consumer/test adapters. */
const fs=require('node:fs'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const {readProcessOutput:git}=require('./offline-process-output.cjs');
const base='8715a2c15912788a56d4ed4a0788177defe38037';
const sha=x=>createHash('sha256').update(x).digest('hex');
const files=git('git',['diff','--name-only',base,'--','tests','scripts/verify-m8-herald-fixtures.cjs']).toString().trim().split('\n').filter(Boolean);
const existing=new Set(git('git',['ls-tree','-r','--name-only',base]).toString().trim().split('\n'));
const evidence=Object.fromEntries(files.map(p=>{
 const previous=existing.has(p)?git('git',['show',`${base}:${p}`]):Buffer.alloc(0),current=fs.readFileSync(p);let first=0;
 while(first<Math.min(previous.length,current.length)&&previous[first]===current[first])first++;
 return [p,{...(!existing.has(p)?{previousExists:false}:{}),previousBytes:previous.length,currentBytes:current.length,previousSha256:sha(previous),currentSha256:sha(current),firstDifferentByte:first===previous.length&&first===current.length?null:first}];
}));
const report={baseCommit:base,files:evidence};
const text=JSON.stringify(report,null,2)+'\n',target='docs/evidence/v22-online-rules/consumer-byte-audit.json';
if(process.argv.includes('--check'))assert.equal(fs.readFileSync(target,'utf8'),text);else fs.writeFileSync(target,text);
console.log(JSON.stringify({files:files.length,sha256:sha(text)}));

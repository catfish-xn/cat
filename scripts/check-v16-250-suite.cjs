/* Serial batches share only Vitest's existing bounded caches. No timeout overrides. */
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root='artifacts/v16-250-tests';fs.mkdirSync(root,{recursive:true});
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(d+'/'+e.name):[d+'/'+e.name]);
const files=walk('tests').filter(p=>p.endsWith('.test.ts')&&!p.startsWith('tests/server/')).sort();
const part=process.argv[2]??'all';
const groups=[];for(let i=0;i<files.length;i+=30)groups.push(files.slice(i,i+30));
const results=[];
for(let i=0;i<groups.length;i++){
 if(part!=='all'&&Number(part)!==i)continue;
 const json=path.join(root,`batch-${i}.json`),log=path.join(root,`batch-${i}.log`);
 const r=spawnSync(process.execPath,['node_modules/vitest/vitest.mjs','run',...groups[i],'--configLoader','runner','--maxWorkers=1','--no-file-parallelism','--reporter=json','--outputFile='+json],{encoding:'utf8',maxBuffer:64*1024*1024});
 fs.writeFileSync(log,(r.stdout??'')+(r.stderr??''));
 const j=fs.existsSync(json)?JSON.parse(fs.readFileSync(json)):{};
 const out={batch:i,files:groups[i],exitCode:r.status,passed:j.numPassedTests??0,failed:j.numFailedTests??0,pending:j.numPendingTests??0};
 results.push(out);fs.writeFileSync(path.join(root,`result-${i}.json`),JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify(out));
}
if(results.some(r=>r.exitCode!==0||r.failed||r.pending))process.exitCode=1;

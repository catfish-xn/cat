/* Independent live-combat epoch. Previous evidence, raw archives and archive mirrors stay immutable. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {readProcessOutput:execFileSync}=require('./offline-process-output.cjs'),{createHash}=require('node:crypto');
// Released v25 on multiplayer: merge of PR #483 (e9384c02), the last v25 re-record
// (e39def9a) and the parent of the v26 integration merge 795ca7f9. Preserve those bytes.
const BASELINE='e9384c02fe352c7da3e672d2f1a2eb61754e1f5b';
const git=(...args)=>execFileSync('git',args,{maxBuffer:128*1024*1024,env:{...process.env,GIT_OPTIONAL_LOCKS:'0'}});
const sha=b=>createHash('sha256').update(b).digest('hex');
exports.baselineCommit=()=>{
 const args=process.argv.slice(2),arg=args.find(x=>x.startsWith('--baseline-commit='));
 assert(arg&&args.every(x=>x===arg||x==='--check'),'--baseline-commit=<integration base> [--check] required');
 const commit=git('rev-parse','--verify',arg.slice(18)+'^{commit}').toString().trim();
 assert.equal(commit,BASELINE);return commit;
};
exports.archivedBytes=(commit,file)=>{
 assert.equal(commit,BASELINE);const blob=git('show',commit+':'+file);
 assert.deepEqual(fs.readFileSync(file),blob,'Historical bytes changed: '+file);return blob;
};
exports.sourceDigests=()=>{
 const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(dir+'/'+e.name):[dir+'/'+e.name]);
 const files=[...walk('src/simulation'),...fs.readdirSync('scripts').filter(p=>p.includes('v26-neutrals-1424')&&p.endsWith('.cjs')).map(p=>'scripts/'+p),
 ...walk('tests/fixtures/m5').filter(p=>p.endsWith('.cjs')),
 ...fs.readdirSync('tests').filter(p=>/^augment-.*-oracle-data\.cjs$/.test(p)).map(p=>'tests/'+p),
 'tests/fixtures/m5/oracle.g2.cjs','scripts/content-digest.ts','scripts/loot-replay-digest.ts','scripts/generate-m5-route.cjs','scripts/m5-route-hash.cjs','scripts/verify-m8-herald-fixtures.cjs','scripts/offline-process-output.cjs',
 'tests/fixtures/record-v26-neutrals-1424-herald.cjs','tests/fixtures/v26-neutrals-1424-herald-support/generate.ts'];
 return Object.fromEntries([...new Set(files)].sort().map(p=>[p,sha(fs.readFileSync(p))]));
};
exports.verifySources=digests=>{for(const [p,hash]of Object.entries(digests))assert.equal(sha(fs.readFileSync(p)),hash,'Source changed: '+p);};
exports.viteOptions=()=>({cacheDir:path.resolve('artifacts/v26-neutrals-1424-recording/vite-cache'),optimizeDeps:{noDiscovery:true,include:[]}});
exports.verifyHistory=()=>{
 const files=git('ls-tree','-r','--name-only',BASELINE).toString().trim().split('\n').filter(p=>
 /^docs\/evidence\/v\d+[^/]*\//.test(p)||/^tests\/fixtures\/v\d+[-/]/.test(p)||/^tests\/v\d+[^/]*-content-baseline\.json$/.test(p)||
 /^tests\/fixtures\/m5\/full-match-golden\.v\d+[^/]*\.json$/.test(p)||/^scripts\/.*v\d+.*\.cjs$/.test(p)||/^tests\/fixtures\/record-v\d+[^/]*-herald\.cjs$/.test(p)||
 p.startsWith('src/simulation/content/source/')||/^src\/simulation\/content\/.*-archive\.ts$/.test(p));
 for(const p of files)exports.archivedBytes(BASELINE,p);
 const protectedManifest='tests/fixtures/g2-4b-herald-raw/manifest.json';exports.archivedBytes(BASELINE,protectedManifest);
 assert.equal(sha(fs.readFileSync(protectedManifest)),'b39c443bedb12f205230ce0ffbf6a93c2184d73d73cb92ee46eaadf08e086a22');
 const report={epoch:'v26-neutrals-1424',baseCommit:BASELINE,historicalFiles:files.length,byteIdentical:true,protectedManifestByteIdentical:true,
  files:Object.fromEntries([...files,protectedManifest].map(p=>[p,{bytes:fs.statSync(p).size,sha256:sha(fs.readFileSync(p))}]))};
 const output=JSON.stringify(report,null,2)+'\n',target='docs/evidence/v26-neutrals-1424/history-preservation.json';
 if(process.argv.includes('--check'))assert.equal(fs.readFileSync(target,'utf8'),output);else{fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,output);}
 console.log(JSON.stringify({epoch:report.epoch,historicalFiles:files.length,byteIdentical:true,protectedManifestByteIdentical:true}));
};
if(require.main===module){exports.baselineCommit();exports.verifyHistory();}

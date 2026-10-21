/* v19 owns its recordings; v15/v16/v17/v18 remain immutable at the local integration baseline. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process'),{createHash}=require('node:crypto');
const previous=require('./v18-fixture-audit.cjs');
const BASELINE='9fb94704c5f0c59ec975c6f0de4dd188207129fa';
const git=(...args)=>execFileSync('git',args,{maxBuffer:128*1024*1024,env:{...process.env,GIT_OPTIONAL_LOCKS:'0'}});
const sha=b=>createHash('sha256').update(b).digest('hex');
exports.baselineCommit=()=>{
 const args=process.argv.slice(2),arg=args.find(x=>x.startsWith('--baseline-commit='));
 assert(arg&&args.every(x=>x===arg||x==='--check'),'--baseline-commit=<v19 integration base> [--check] required');
 const commit=git('rev-parse','--verify',arg.slice(18)+'^{commit}').toString().trim();
 assert.equal(commit,BASELINE);return commit;
};
exports.archivedBytes=(commit,file)=>{
 assert.equal(commit,BASELINE);
 const blob=git('show',commit+':'+file);
 assert.deepEqual(fs.readFileSync(file),blob,'Historical LF bytes changed: '+file);
 return blob;
};
exports.sourceDigests=()=>{
 const files=[...Object.keys(previous.sourceDigests()),...fs.readdirSync('scripts').filter(p=>p.includes('v19')&&p.endsWith('.cjs')).map(p=>'scripts/'+p),
  'tests/fixtures/record-v19-herald.cjs','tests/fixtures/v19-herald-support/generate.ts'];
 return Object.fromEntries([...new Set(files)].sort().map(p=>[p,sha(fs.readFileSync(p))]));
};
exports.verifySources=previous.verifySources;
exports.viteOptions=()=>({cacheDir:path.resolve(process.env.V19_CACHE_DIR??'artifacts/v19-recording/vite-cache'),optimizeDeps:{noDiscovery:true,include:[]}});
exports.verifyHistory=()=>{
 const files=git('ls-tree','-r','--name-only',BASELINE).toString().trim().split('\n').filter(p=>
  /^docs\/evidence\/v1[5678]\//.test(p)||/^tests\/fixtures\/v1[5678][-/]/.test(p)||/^tests\/v1[5678]-content-baseline\.json$/.test(p)||
  /^tests\/fixtures\/m5\/full-match-golden\.v1[5678]\.json$/.test(p)||/^scripts\/.*v1[5678].*\.cjs$/.test(p)||/^tests\/fixtures\/record-v1[5678]-herald\.cjs$/.test(p));
 for(const p of files)exports.archivedBytes(BASELINE,p);
 const file='tests/opening-random-identity.test.ts';
 const assertions=s=>Buffer.from(s.slice(0,s.includes("it('binds v18")?s.indexOf("it('binds v18"):s.indexOf("it('rejects each old")).split('\n').filter(line=>line.includes('expect(')).join('\n'));
 assert.deepEqual(assertions(fs.readFileSync(file,'utf8')),assertions(git('show',BASELINE+':'+file).toString()),'Historical identity assertions changed');
 const protectedManifest='tests/fixtures/g2-4b-herald-raw/manifest.json';
 exports.archivedBytes(BASELINE,protectedManifest);
 assert.equal(sha(fs.readFileSync(protectedManifest)),'b39c443bedb12f205230ce0ffbf6a93c2184d73d73cb92ee46eaadf08e086a22');
 console.log(JSON.stringify({epoch:'v19',baseCommit:BASELINE,historicalV15V16V17V18Files:files.length,byteIdentical:true,commitComparison:'git-show-LF-blobs',historicalAssertionsByteIdentical:true,protectedManifestByteIdentical:true}));
};
if(require.main===module){exports.baselineCommit();exports.verifyHistory();}

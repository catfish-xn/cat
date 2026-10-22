/* v20 owns its recordings; v15/v16/v17/v18/v19 remain immutable at the local integration baseline. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process'),{createHash}=require('node:crypto');
const previous=require('./v19-fixture-audit.cjs');
const BASELINE='14006984600a08f8dd96fa776bf9ba1d1048ff24';
const git=(...args)=>execFileSync('git',args,{maxBuffer:128*1024*1024,env:{...process.env,GIT_OPTIONAL_LOCKS:'0'}});
const sha=b=>createHash('sha256').update(b).digest('hex');
exports.baselineCommit=()=>{
 const args=process.argv.slice(2),arg=args.find(x=>x.startsWith('--baseline-commit='));
 assert(arg&&args.every(x=>x===arg||x==='--check'),'--baseline-commit=<v20 integration base> [--check] required');
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
 const files=[...Object.keys(previous.sourceDigests()),...fs.readdirSync('scripts').filter(p=>p.includes('v20')&&p.endsWith('.cjs')).map(p=>'scripts/'+p),
  'tests/fixtures/record-v20-herald.cjs','tests/fixtures/v20-herald-support/generate.ts'];
 return Object.fromEntries([...new Set(files)].sort().map(p=>[p,sha(fs.readFileSync(p))]));
};
exports.verifySources=previous.verifySources;
exports.viteOptions=()=>({cacheDir:path.resolve(process.env.V20_CACHE_DIR??'artifacts/v20-recording/vite-cache'),optimizeDeps:{noDiscovery:true,include:[]}});
exports.verifyHistory=()=>{
 const files=git('ls-tree','-r','--name-only',BASELINE).toString().trim().split('\n').filter(p=>
  /^docs\/evidence\/v1[56789]\//.test(p)||/^tests\/fixtures\/v1[56789][-/]/.test(p)||/^tests\/v1[56789]-content-baseline\.json$/.test(p)||
  /^tests\/fixtures\/m5\/full-match-golden\.v1[56789]\.json$/.test(p)||/^scripts\/.*v1[56789].*\.cjs$/.test(p)||/^tests\/fixtures\/record-v1[56789]-herald\.cjs$/.test(p));
 for(const p of files)exports.archivedBytes(BASELINE,p);
 const protectedManifest='tests/fixtures/g2-4b-herald-raw/manifest.json';
 exports.archivedBytes(BASELINE,protectedManifest);
 assert.equal(sha(fs.readFileSync(protectedManifest)),'b39c443bedb12f205230ce0ffbf6a93c2184d73d73cb92ee46eaadf08e086a22');
 console.log(JSON.stringify({epoch:'v20',baseCommit:BASELINE,historicalV15V16V17V18Files:files.length,byteIdentical:true,commitComparison:'git-show-LF-blobs',protectedManifestByteIdentical:true}));
};
if(require.main===module){exports.baselineCommit();exports.verifyHistory();}

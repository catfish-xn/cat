/* v17 records a separate epoch; v15/v16 bytes stay at the integration baseline. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process'),{createHash}=require('node:crypto');
const previous=require('./v16-fixture-audit.cjs');
const BASELINE='30cf934446719a0da0d3cea1667bf84a3df5296c';
const sha=b=>createHash('sha256').update(b).digest('hex');
exports.baselineCommit=()=>{
 const args=process.argv.slice(2),arg=args.find(x=>x.startsWith('--baseline-commit='));
 assert(arg&&args.every(x=>x===arg||x==='--check'),'--baseline-commit=<v17 integration base> [--check] required');
 const commit=execFileSync('git',['rev-parse','--verify',arg.slice(18)+'^{commit}'],{encoding:'utf8'}).trim();
 assert.equal(commit,BASELINE);return commit;
};
exports.archivedBytes=(commit,file)=>{
 assert.equal(commit,BASELINE);
 // Compare checkout bytes (including Git's Windows EOL filter), never rewrite history.
 const checkout=execFileSync('git',['cat-file','--filters',commit+':'+file],{maxBuffer:100*1024*1024});
 assert.deepEqual(fs.readFileSync(file),checkout,'Historical bytes changed: '+file);
 // Prior audit hashes refer to canonical Git blob bytes, before checkout EOL filters.
 return execFileSync('git',['show',commit+':'+file],{maxBuffer:100*1024*1024});
};
exports.sourceDigests=()=>{
 const files=[...Object.keys(previous.sourceDigests()),...fs.readdirSync('scripts').filter(p=>p.includes('v17')&&p.endsWith('.cjs')).map(p=>'scripts/'+p),
  'scripts/verify-m8-herald-fixtures.cjs','tests/fixtures/record-v17-herald.cjs','tests/fixtures/v17-herald-support/generate.ts'];
 return Object.fromEntries([...new Set(files)].sort().map(p=>[p,sha(fs.readFileSync(p))]));
};
exports.verifySources=previous.verifySources;
exports.viteOptions=()=>({cacheDir:path.resolve(process.env.V17_CACHE_DIR??'artifacts/v17-recording/vite-cache'),optimizeDeps:{noDiscovery:true,include:[]}});
exports.verifyHistory=()=>{
 const files=execFileSync('git',['ls-tree','-r','--name-only',BASELINE],{encoding:'utf8'}).trim().split('\n').filter(p=>
  /^docs\/evidence\/v1[56]\//.test(p)||/^tests\/fixtures\/v1[56][-/]/.test(p)||/^tests\/v1[56]-content-baseline\.json$/.test(p)||
  /^tests\/fixtures\/m5\/full-match-golden\.v1[56]\.json$/.test(p)||/^scripts\/.*v1[56].*\.cjs$/.test(p)||/^tests\/fixtures\/record-v1[56]-herald\.cjs$/.test(p));
 for(const p of files)exports.archivedBytes(BASELINE,p);
 const file='tests/opening-random-identity.test.ts';
 const assertions=s=>Buffer.from(s.slice(s.indexOf("it('binds v16"),s.includes("it('binds v17")?s.indexOf("it('binds v17"):s.indexOf("it('rejects each old")).split('\n').filter(line=>line.includes('expect(')).join('\n'));
 const before=execFileSync('git',['cat-file','--filters',BASELINE+':'+file],{encoding:'utf8'}),after=fs.readFileSync(file,'utf8');
 assert.deepEqual(assertions(after),assertions(before));
 const older=s=>Buffer.from(s.slice(0,s.indexOf("it('binds v16")).split('\n').filter(line=>line.includes('expect(')).join('\n'));
 assert.deepEqual(older(after),older(before),'Historical pre-v16 assertions changed');
 const sessionPath='artifacts/v17-recording/history-start.json';
 if(fs.existsSync(sessionPath))for(const [p,hash] of Object.entries(JSON.parse(fs.readFileSync(sessionPath,'utf8'))))assert.equal(sha(fs.readFileSync(p)),hash,p);
 console.log(JSON.stringify({epoch:'v17',baseCommit:BASELINE,historicalV15V16Files:files.length,byteIdentical:true,commitComparison:'git-cat-file--filters',historicalV16AssertionsByteIdentical:true}));
};
if(require.main===module){exports.baselineCommit();exports.verifyHistory();}

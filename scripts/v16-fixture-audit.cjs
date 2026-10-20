/* v16 records only a new epoch; v15 and earlier remain immutable. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),cp=require('node:child_process'),{createHash}=require('node:crypto');
const previous=require('./v15-fixture-audit.cjs');
const BASELINE='46454b77348c86b70a4fec57869f95c22ecf9682',sha=b=>createHash('sha256').update(b).digest('hex');
// Explicit offline mode for a merge workspace where even read-only Git is forbidden.
// This proves session-local historical immutability, not commit provenance.
const localSnapshot=process.env.V16_HISTORY_SNAPSHOT
 ? JSON.parse(fs.readFileSync(process.env.V16_HISTORY_SNAPSHOT,'utf8')):null;
exports.baselineCommit=()=>{const args=process.argv.slice(2),arg=args.find(x=>x.startsWith('--baseline-commit='));assert(arg&&args.every(x=>x===arg||x==='--check'),'--baseline-commit=<v16 base> [--check] required');const c=cp.execFileSync('git',['rev-parse','--verify',arg.slice(18)+'^{commit}'],{encoding:'utf8'}).trim();assert.equal(c,BASELINE);return c;};
exports.archivedBytes=(commit,file)=>{
 if(localSnapshot){assert.equal(commit,BASELINE);assert(localSnapshot[file],'Missing offline historical pin: '+file);const bytes=fs.readFileSync(file);assert.equal(sha(bytes),localSnapshot[file],'Historical bytes changed: '+file);return bytes;}
 const before=cp.execFileSync('git',['show',commit+':'+file],{maxBuffer:100*1024*1024});assert.deepEqual(fs.readFileSync(file),before,'Historical bytes changed: '+file);return before;
};
if(localSnapshot)exports.baselineCommit=()=>{assert(process.argv.includes('--baseline-commit='+BASELINE));return BASELINE;};
exports.sourceDigests=()=>{const files=[...Object.keys(previous.sourceDigests()),...fs.readdirSync('scripts').filter(p=>p.includes('v16')&&p.endsWith('.cjs')).map(p=>'scripts/'+p),'tests/fixtures/epic-loot-oracle.cjs','tests/fixtures/epic-loot-oracle.d.cts','tests/epic-loot-reforger.test.ts','tests/fixtures/m8-golden-states.cjs','tests/fixtures/record-v16-herald.cjs','tests/fixtures/v16-herald-support/generate.ts'];return Object.fromEntries([...new Set(files)].sort().map(p=>[p,sha(fs.readFileSync(p))]));};
exports.verifySources=previous.verifySources;
exports.viteOptions=()=>({...(process.env.V16_CACHE_DIR?{cacheDir:path.resolve(process.env.V16_CACHE_DIR)}:{}),optimizeDeps:{noDiscovery:true,include:[]}});
exports.verifyHistory=()=>{previous.verifyHistory();const files=cp.execFileSync('git',['ls-tree','-r','--name-only',BASELINE],{encoding:'utf8'}).trim().split('\n').filter(p=>/^docs\/evidence\/v15\//.test(p)||/^tests\/fixtures\/v15[-/]/.test(p)||p==='tests/v15-content-baseline.json'||p==='tests/fixtures/m5/full-match-golden.v15.json'||/^scripts\/(record-v15-.+|v15-fixture-audit)\.cjs$/.test(p)||p==='tests/fixtures/record-v15-herald.cjs');for(const p of files)exports.archivedBytes(BASELINE,p);const auditTest='tests/opening-random-identity.test.ts';const assertions=text=>{const end=text.includes("it('binds v16")?text.indexOf("it('binds v16"):text.indexOf("it('rejects each old");assert(end>0);return Buffer.from(text.slice(0,end).split('\n').filter(line=>line.includes('expect(')).join('\n'));};const before=cp.execFileSync('git',['show',BASELINE+':'+auditTest],{encoding:'utf8'});assert.deepEqual(assertions(fs.readFileSync(auditTest,'utf8')),assertions(before),'Historical audit assertion bytes changed');console.log(JSON.stringify({epoch:'v16',historicalV15Files:files.length,byteIdentical:true,historicalAuditAssertionsByteIdentical:true}));};
if(localSnapshot)exports.verifyHistory=()=>{
 for(const [file,hash] of Object.entries(localSnapshot))assert.equal(sha(fs.readFileSync(file)),hash,file);
 console.log(JSON.stringify({epoch:'v16',historicalFiles:Object.keys(localSnapshot).length,
  byteIdenticalSinceSessionStart:true,commitProvenance:'not-rechecked;Git-prohibited'}));
};
if(require.main===module){exports.baselineCommit();exports.verifyHistory();}

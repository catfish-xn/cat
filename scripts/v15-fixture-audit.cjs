/* v15 starts from the retained v14 epoch. Never rewrite or normalize history. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process'),{createHash}=require('node:crypto');
const previous=require('./g2-4b-fixture-audit.cjs');
const BASELINE='915439176f9990fe1846a506d6477cfe81640a7a';
const sha=b=>createHash('sha256').update(b).digest('hex');
exports.baselineCommit=()=>{
 const args=process.argv.slice(2),arg=args.find(x=>x.startsWith('--baseline-commit='));
 assert(arg&&args.every(x=>x===arg||x==='--check'),'--baseline-commit=<v15 integration revision> [--check] required');
 const commit=execFileSync('git',['rev-parse','--verify',arg.slice(18)+'^{commit}'],{encoding:'utf8'}).trim();
 assert.equal(commit,BASELINE,'v15 baseline is the combined integration HEAD, not the historical G2-3 migration base');
 return commit;
};
// User-authorized repair: 6392f319 refreshed a historical manifest's source hashes.
// Only that file returns to its exact pre-refresh bytes; all other history stays at BASELINE.
const restoredManifest='tests/fixtures/g2-4b-herald-raw/manifest.json';
exports.archivedBytes=(commit,file)=>{
 if(file===restoredManifest){
  assert.equal(sha(fs.readFileSync(file)),'b39c443bedb12f205230ce0ffbf6a93c2184d73d73cb92ee46eaadf08e086a22');
  return previous.archivedBytes('6392f319^',file);
 }
 return previous.archivedBytes(commit,file);
};
exports.sourceDigests=()=>{
 const files=[...Object.keys(previous.sourceDigests()),...fs.readdirSync('scripts').filter(p=>p.includes('v15')&&p.endsWith('.cjs')).map(p=>'scripts/'+p),'tests/fixtures/record-v15-herald.cjs','tests/fixtures/v15-herald-support/generate.ts','tests/fixtures/b8-live-reveal-routes.ts','tests/m8-b8-live-reveal.test.ts'];
 return Object.fromEntries([...new Set(files)].sort().map(p=>[p,sha(fs.readFileSync(p))]));
};
exports.verifySources=previous.verifySources;
/** Caller supplies a writable cache directory; no machine-specific path enters evidence. */
exports.viteOptions=()=>({...(process.env.V15_CACHE_DIR?{cacheDir:path.resolve(process.env.V15_CACHE_DIR)}:{}),optimizeDeps:{noDiscovery:true,include:[]}});
exports.verifyHistory=()=>{
 const files=execFileSync('git',['ls-tree','-r','--name-only',BASELINE],{encoding:'utf8'}).trim().split('\n').filter(p=>
  /^docs\/evidence\/(g2-3|g2-4b)\//.test(p)||(/^tests\/fixtures\/g2-(3|4b)[-/]/.test(p)&&/\.(json|gz)$/.test(p))||/^tests\/g2-(3|4b)-content-baseline\.json$/.test(p)||
  /^tests\/fixtures\/m5\/full-match-golden\.g2-(3|4b)\.json$/.test(p)||
  /^scripts\/(record-g2-4b-.+|g2-4b-fixture-audit)\.cjs$/.test(p)||p==='tests/fixtures/record-g2-4b-herald.cjs');
 for(const p of files)exports.archivedBytes(BASELINE,p);
 // Retain the original G2-3 -> G2-4b base and its exact migration evidence.
 const historical=JSON.parse(fs.readFileSync('docs/evidence/g2-4b/release-audit.json'));
 assert.equal(historical.baseCommit,'430017516a18fb38ee028cec000a44fb94bb638f');
 for(const [p,e] of Object.entries(JSON.parse(fs.readFileSync('docs/evidence/g2-4b/input-fixture-audit.json')).files)){
  assert.equal(sha(fs.readFileSync(p)),e.currentSha256,p);
  assert.equal(sha(previous.archivedBytes(historical.baseCommit,p.replace('g2-4b-','g2-3-'))),e.previousSha256,p);
 }
 console.log(JSON.stringify({historicalFiles:files.length,byteIdentical:true,manifestReference:'6392f319^',g24Baseline:historical.baseCommit}));
};
if(require.main===module){exports.baselineCommit();exports.verifyHistory();}

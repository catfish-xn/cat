const fs=require('node:fs'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const {createHash}=require('node:crypto');
const sha=b=>createHash('sha256').update(b).digest('hex');
exports.baselineCommit=()=>{
 const args=process.argv.slice(2),arg=args.find(x=>x.startsWith('--baseline-commit='));
 assert(arg&&args.every(x=>x===arg||x==='--check'),'--baseline-commit=<retained G2-3 revision> [--check] required');
 return execFileSync('git',['rev-parse','--verify',arg.slice(18)+'^{commit}'],{encoding:'utf8'}).trim();
};
exports.archivedBytes=(commit,file)=>{
 const original=execFileSync('git',['show',`${commit}:${file}`],{maxBuffer:128*1024*1024});
 assert(fs.readFileSync(file).equals(original),`Historical bytes changed: ${file}`);return original;
};
exports.sourceDigests=()=>{
 const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(`${d}/${e.name}`):[`${d}/${e.name}`]);
 const files=[...walk('src/simulation'),...walk('src/server-entry'),'scripts/generate-m5-route.cjs','scripts/m4-evidence.cjs','tests/fixtures/m5/oracle.g2.cjs',...fs.readdirSync('scripts').filter(p=>p.includes('g2-4b')&&p.endsWith('.cjs')).map(p=>'scripts/'+p),'tests/fixtures/record-g2-4b-herald.cjs'];
 return Object.fromEntries([...new Set(files)].sort().map(p=>[p,sha(fs.readFileSync(p))]));
};
exports.verifySources=digests=>{for(const [p,hash] of Object.entries(digests))assert.equal(sha(fs.readFileSync(p)),hash,`Source changed during recording: ${p}`);};

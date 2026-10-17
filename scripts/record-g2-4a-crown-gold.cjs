/* Freeze sources, rerun the original recorders, and preserve old/new byte evidence. */
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto'),cp=require('node:child_process');
const base='148d6a2d87a438f580a41bf55f1651c2d5a9d8a3';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const measure=b=>({bytes:b.length,sha256:sha(b)});
const files=cp.execFileSync('git',['ls-files','src/simulation','scripts','tests/fixtures'],{encoding:'utf8'}).trim().split('\n');
const sources=files.filter(p=>/\.(ts|js|cjs|py)$/.test(p)).concat('scripts/record-g2-4a-crown-gold.cjs').sort();
const unique=[...new Set(sources)];
const frozen=Object.fromEntries(unique.map(p=>[p,measure(fs.readFileSync(p))]));
const outputs=[...files.filter(p=>p.startsWith('tests/fixtures/g2-3')&&!p.endsWith('.ts')),
 'tests/fixtures/m5/full-match-golden.g2-3.json','tests/g2-3-content-baseline.json',
 'docs/evidence/g2-3/release-audit.json','docs/evidence/g2-3/input-fixture-audit.json','docs/evidence/g2-3/live-reveal-audit.json'];
const previous=Object.fromEntries(outputs.map(p=>[p,cp.execFileSync('git',['show',`${base}:${p}`],{maxBuffer:64*1024*1024})]));
const commands=[['scripts/record-g2-3-release.cjs'],['scripts/record-g2-3-inputs.cjs'],['scripts/record-g2-3-live-reveal.cjs'],['tests/fixtures/record-g2-3-herald.cjs','--write']];
for(const args of commands){
 console.log(`Recording: node ${args.join(' ')}`);
 const result=cp.spawnSync(process.execPath,args,{stdio:'inherit'});
 assert.equal(result.status,0,`Recorder failed: ${args.join(' ')}`);
 for(const p of unique)assert.deepEqual(measure(fs.readFileSync(p)),frozen[p],`Source changed while recording: ${p}`);
}
const evidence=Object.fromEntries(outputs.sort().map(p=>{
 const a=previous[p],b=fs.readFileSync(p);let first=0;
 while(first<Math.min(a.length,b.length)&&a[first]===b[first])first++;
 return [p,{previous:measure(a),current:measure(b),firstDifferentByte:first===a.length&&first===b.length?null:first}];
}));
const oldSources=Object.fromEntries(unique.map(p=>{
 const old=cp.spawnSync('git',['show',`${base}:${p}`],{maxBuffer:64*1024*1024});
 return [p,old.status===0?measure(old.stdout):null];
}));
const audit={baselineCommit:base,baselineParents:cp.execFileSync('git',['show','-s','--format=%P',base],{encoding:'utf8'}).trim().split(' '),
 node:process.version,commands:commands.map(args=>({command:`node ${args.join(' ')}`,exitCode:0})),
 ...JSON.parse(fs.readFileSync('tests/g2-3-content-baseline.json','utf8')),
 sourceFreezeVerifiedAfterEveryRecorder:true,previousSources:oldSources,currentSources:frozen,outputs:evidence};
fs.writeFileSync('docs/evidence/g2-3/crown-gold-recording-audit.json',JSON.stringify(audit,null,2)+'\n');
console.log(JSON.stringify({contentDigest:audit.contentDigest,outputs:outputs.length,sources:unique.length,sourceFreezeVerified:true}));

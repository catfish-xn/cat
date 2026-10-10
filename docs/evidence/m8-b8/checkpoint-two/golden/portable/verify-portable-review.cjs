/* Read-only verification of this narrowly scoped portability repair. It does not
 * re-generate a trajectory or apply a golden. The original audit remains immutable. */
const fs=require('node:fs'),path=require('node:path'),z=require('node:zlib'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'../../../../../..'),source=path.dirname(__dirname);
const output=process.argv[2];assert(output?.startsWith('/tmp/'),'new temporary output directory required');fs.mkdirSync(output,{recursive:true});
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const auditBytes=fs.readFileSync(path.join(source,'audit.json'));
assert.equal(sha(auditBytes),'f574c9ed982abd75668134921431efbe77c4d63c46bb1f45e583e709e32fe863');
const originalAudit=JSON.parse(auditBytes),guards=require(path.join(root,'scripts/update-m8-b8-golden.cjs'));
const {hash}=require(path.join(root,'scripts/m4-evidence.cjs'));
assert.equal(process.version,'v22.23.3');
assert.equal(sha(fs.readFileSync(path.join(__dirname,'update-m8-b8-golden.original.cjs'))),'ca53ebd5f6c9f0f23478aca8db5ecd6659fbfe6b7a8239bd9e4a7ff8b371dcc9');
assert.equal(sha(fs.readFileSync(path.join(__dirname,'golden-guard.original.mjs'))),'57d55f7711274adcb71e26292171f76c26136197fc68c6f5b0606683defe7daa');
guards.guardInputs('new',guards.manifest());
for(const [file,digest]of Object.entries(originalAudit.protectedValidationInputs))assert.equal(sha(fs.readFileSync(path.join(root,file))),digest);
const oldBytes=fs.readFileSync(path.join(root,'tests/fixtures/m5/full-match-golden.pre-m8-b8.json'));guards.guardBaseline(oldBytes);
const candidateBytes=fs.readFileSync(path.join(root,'tests/fixtures/m5/full-match-golden.json'));
assert.equal(sha(candidateBytes),'8d129f70c093a63b339543f65814232f3cfb6daa13d95168aac3b06bdc39ac28');
assert.equal(sha(candidateBytes),originalAudit.candidateSha256);
const old=JSON.parse(oldBytes),candidate=JSON.parse(candidateBytes),routes=[];
for(const build of ['cannon','sniper','mage','sniper-caitlyn']){
 const raw={};for(const kind of ['old','new']){const file=`${kind}-${build}.json.gz`,bytes=fs.readFileSync(path.join(source,file));assert.equal(sha(bytes),originalAudit.files[file]);raw[kind]=JSON.parse(z.gunzipSync(bytes));guards.originalChecks(raw[kind],kind==='old');}
 assert.deepEqual(guards.frozen(raw.old),old.routes[build]);assert.deepEqual(guards.frozen(raw.new),candidate.routes[build]);
 const resources=guards.resourceAudit(raw.new);
 for(const kind of ['old','new'])for(const action of raw[kind].actions)guards.driverDecision(action,build);
 const diffName=`diff-${build}.json.gz`,diffBytes=fs.readFileSync(path.join(source,diffName));assert.equal(sha(diffBytes),originalAudit.files[diffName]);assert.equal(sha(z.gunzipSync(diffBytes)),originalAudit.files[`diff-${build}.json`]);guards.guardReviewedDiff(build,JSON.parse(z.gunzipSync(diffBytes)));
 routes.push({build,oldCompleteFrozenRouteHash:hash(guards.frozen(raw.old)),newCompleteFrozenRouteHash:hash(guards.frozen(raw.new)),oldCommands:raw.old.actions.length,newCommands:raw.new.actions.length,originalCompleteHashesRevalidated:true,originalReviewedDiffUnchanged:true,resources});
 console.log('portable read-only capture/candidate verification passed',build);
}
// The CLI remains a one-shot updater. Exercise only its read-only audit command:
// on the already-migrated working tree it MUST reject the live old-hash guard.
let refusal='';try{execFileSync(process.execPath,[path.join(root,'scripts/update-m8-b8-golden.cjs'),'--audit',output],{cwd:root,encoding:'utf8'});assert.fail('already-migrated golden unexpectedly admitted');}catch(error){refusal=String(error.stderr??error.message);assert(refusal.includes('refuse unknown or already-migrated golden'));}
fs.writeFileSync(path.join(output,'already-migrated-audit-refusal.log'),refusal);
fs.writeFileSync(path.join(output,'candidate-byte-copy.json'),candidateBytes);
const result={kind:'m8-b8-portable-tool-review-v1',node:process.version,scope:'Only fixed source-ref resolution changed. Original captures are revalidated read-only; no simulation rerun and no golden apply.',originalAuditSha256:sha(auditBytes),originalUpdaterSha256:sha(fs.readFileSync(path.join(__dirname,'update-m8-b8-golden.original.cjs'))),portableUpdaterSha256:sha(fs.readFileSync(path.join(root,'scripts/update-m8-b8-golden.cjs'))),originalGuardTestSha256:sha(fs.readFileSync(path.join(__dirname,'golden-guard.original.mjs'))),portableGuardTestSha256:sha(fs.readFileSync(path.join(root,'tests/m8-b8-golden-guard.test.mjs'))),approvedSourceRefs:guards.SOURCE_REFS,actualLocalResolvedSource:guards.selectSourceRef(),publishedRefPriority:'Covered by pure selection unit test; this workspace actually resolves the captured local object. A remote clone must have/fetch the exact published object.',original183InputFingerprint:hash(guards.manifest()),protectedValidationInputsUnchanged:true,oldGoldenSha256:sha(oldBytes),candidateSha256:sha(candidateBytes),alreadyMigratedLiveGoldenStillRejected:true,routes};
fs.writeFileSync(path.join(output,'portable-audit.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({portableAuditSha256:sha(fs.readFileSync(path.join(output,'portable-audit.json'))),candidateSha256:sha(candidateBytes),actualSource:result.actualLocalResolvedSource},null,2));

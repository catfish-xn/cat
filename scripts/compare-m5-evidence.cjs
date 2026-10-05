const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
const {hash}=require('./m4-evidence.cjs');
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const finalGate=process.argv.includes('--final');
const currentSha=finalGate?require('node:child_process').execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim():null;
const requiredVersions=['schemaVersion','rulesVersion','contentVersion','contentDigest','commandProtocolVersion','rngAlgorithm','tickMs'];
function validateManifest(manifest){
 assert.match(manifest.sha??'',/^[a-f0-9]{40}$/,'valid commit SHA required');
 assert.equal(typeof manifest.status,'string','worktree status required');
 assert.equal(manifest.passed,true);
 assert.equal(typeof manifest.sourceFingerprint,'string');assert(manifest.sourceFingerprint.length>0);
 assert.equal(manifest.finalSourceFingerprint,manifest.sourceFingerprint);
 assert(Array.isArray(manifest.errors));assert.deepEqual(manifest.errors,[]);
 for(const key of requiredVersions){const value=manifest.versions?.[key];assert(value!==undefined&&value!==null&&value!=='',`missing version ${key}`);}
 if(finalGate)assert.equal(manifest.sha,currentSha,'evidence HEAD must equal current HEAD');
}
const comparisons=[];
let sharedSha,sharedFingerprint,sharedVersions;
for(const build of ['cannon','sniper','mage']){
 const folders=['dev','preview'].map(mode=>`artifacts/m5-${mode}-${build}`),manifests=folders.map(folder=>read(path.join(folder,'manifest.json')));
 for(const manifest of manifests){assert.equal(manifest.passed,true,`${build} ${manifest.mode} gate failed`);assert.equal(manifest.sourceFingerprint,manifest.finalSourceFingerprint,'source drift');assert.deepEqual(manifest.errors,[]);}
 for(const manifest of manifests){
  validateManifest(manifest);
  sharedSha??=manifest.sha;sharedFingerprint??=manifest.sourceFingerprint;sharedVersions??=manifest.versions;
  assert.equal(manifest.sha,sharedSha,'all browser jobs must use the same HEAD');
  assert.equal(manifest.sourceFingerprint,sharedFingerprint,'all browser jobs must use identical sources');
  assert.deepEqual(manifest.versions,sharedVersions,'all rules/content/schema/digest versions must match');
  if(finalGate)assert.equal(manifest.status,'','F4 requires clean committed sources at job start');
 }
 assert.equal(manifests[0].sourceFingerprint,manifests[1].sourceFingerprint);assert.deepEqual(manifests[0].versions,manifests[1].versions);assert.deepEqual(manifests[0].checkpoints,manifests[1].checkpoints,'all operation checkpoints');
 const routes=folders.map(folder=>read(path.join(folder,'route.json')));
 for(const key of ['initial','final','ledger','actions','rounds'])assert.deepEqual(routes[0][key],routes[1][key],`${build} complete ${key}`);
 for(const round of routes[0].rounds){const snapshots=folders.map(folder=>read(path.join(folder,`round-${round.round}.json`)));assert.deepEqual(snapshots[0].state,snapshots[1].state,'browser observed complete state');assert.deepEqual(snapshots[0].combatEvents,snapshots[1].combatEvents,'browser observed full events');}
 comparisons.push({build,evidenceClass:finalGate?'final-clean-commit':'development-validation',sha:sharedSha,sourceFingerprint:manifests[0].sourceFingerprint,checkpoints:manifests[0].checkpoints.length,rounds:routes[0].rounds.length,finalHash:hash(routes[0].final),passed:true});
}
if(finalGate){
 for(const mode of ['dev','preview'])for(const name of [`m5-input-${mode}`,`m5-${mode}-cannon-touch`]){
  const manifest=read(`artifacts/${name}/manifest.json`);
  validateManifest(manifest);
  assert.equal(manifest.passed,true,`${name} required gate failed`);
  assert.equal(manifest.sha,sharedSha,`${name} HEAD mismatch`);
  assert.equal(manifest.status,'',`${name} requires clean committed sources`);
  assert.equal(manifest.sourceFingerprint,sharedFingerprint,`${name} source mismatch`);
  assert.equal(manifest.finalSourceFingerprint,sharedFingerprint,`${name} source drift`);
  assert.deepEqual(manifest.errors,[]);
  assert.deepEqual(manifest.versions,sharedVersions);
  if(name.startsWith('m5-input-'))assert.equal(manifest.coverage,'full-input-gate','observation-only is not the required input gate');
 }
 for(const {round} of read('artifacts/m5-dev-cannon-touch/route.json').rounds){
  const snapshots=['dev','preview'].map(mode=>read(`artifacts/m5-${mode}-cannon-touch/round-${round}.json`));
  assert.deepEqual(snapshots[0].state,snapshots[1].state,`touch R${round} complete state`);
  assert.deepEqual(snapshots[0].combatEvents,snapshots[1].combatEvents,`touch R${round} events`);
 }
}
fs.writeFileSync('artifacts/m5-cross-mode-comparison.json',JSON.stringify(comparisons,null,2));console.log(JSON.stringify(comparisons));

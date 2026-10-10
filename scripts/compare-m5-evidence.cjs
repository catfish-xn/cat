const {skipB6Dependency,validateB6BrowserBoundary}=require('./b6-deferred-assertions.cjs');
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
const comparisons=[],deferredComparisons={};
function compareBrowserRound(folderA,folderB,round,label){
 const snapshots=[folderA,folderB].map(folder=>read(path.join(folder,`round-${round}.json`)));
 assert.deepEqual(snapshots[0].state,snapshots[1].state,`${label} complete state`);
 assert.deepEqual(snapshots[0].combatEvents,snapshots[1].combatEvents,`${label} full events`);
}

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
 const skippedRounds=validateB6BrowserBoundary(manifests[0],routes[0]);validateB6BrowserBoundary(manifests[1],routes[1]);
 assert.deepEqual(manifests[0].deferredBrowserRounds,manifests[1].deferredBrowserRounds,'both modes must disclose the same omissions');
 for(const round of routes[0].rounds){const compare=()=>compareBrowserRound(folders[0],folders[1],round.round,'browser observed');
  if(skippedRounds.has(round.round))skipB6Dependency(deferredComparisons,'B9',`${build}-browser-snapshot-${round.roundDefinitionId}`,'Both browser jobs explicitly omitted this application-capacity tail; complete domain route comparison above still executed',compare);else compare();}

 comparisons.push({build,evidenceClass:finalGate?'final-clean-commit':'development-validation',sha:sharedSha,sourceFingerprint:manifests[0].sourceFingerprint,checkpoints:manifests[0].checkpoints.length,rounds:routes[0].rounds.length,finalHash:hash(routes[0].final),fullApplicationRoutePassed:false,browserBattlesCompared:routes[0].rounds.length-skippedRounds.size,skippedBrowserRoundIds:manifests[0].deferredBrowserRounds,domainRouteComparedInFull:true,passed:true});
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
  if(name.startsWith('m5-input-')){
   assert.equal(manifest.coverage,'full-input-gate','observation-only is not the required input gate');
   assert.equal(manifest.fullOpeningItemScenarioPassed,false);
   // B8 restored the three Rageblade checks on the real 2-1 chain; the two back-to-back opening
   // checks are user-approved archives (not applicable under the frozen schedule, not verified).
   assert.deepEqual(manifest.skipped??[],[],'input gate may no longer defer any B8 case');
   assert.deepEqual((manifest.archived??[]).map(entry=>[entry.status,entry.id,entry.verifiedConsecutiveDialogs]),
    ['mouse','touch'].map(method=>['archived-not-applicable',`${method}-back-to-back-opening-components`,false]),'only the two approved archives');
   assert.equal(manifest.b8RagebladeChain?.roundId,'2-1','B8 Rageblade chain executed');
   assert(manifest.b8RagebladeChain.currentAttackIntervalTicks<manifest.b8RagebladeChain.frozenAttackIntervalTicks,'dynamic AS observed');
  }
 }
 const touchRoutes=['dev','preview'].map(mode=>read(`artifacts/m5-${mode}-cannon-touch/route.json`));
 for(const key of ['initial','final','ledger','actions','rounds'])assert.deepEqual(touchRoutes[0][key],touchRoutes[1][key],`touch complete domain ${key}`);
 const touchManifests=['dev','preview'].map(mode=>read(`artifacts/m5-${mode}-cannon-touch/manifest.json`));
 const touchSkipped=validateB6BrowserBoundary(touchManifests[0],touchRoutes[0]);validateB6BrowserBoundary(touchManifests[1],touchRoutes[1]);
 for(const {round,roundDefinitionId} of touchRoutes[0].rounds){
  const compare=()=>compareBrowserRound('artifacts/m5-dev-cannon-touch','artifacts/m5-preview-cannon-touch',round,`touch R${round}`);
  if(touchSkipped.has(round))skipB6Dependency(deferredComparisons,'B9',`touch-browser-snapshot-${roundDefinitionId}`,'Both touch jobs explicitly omitted the same B9 application-capacity tail',compare);else compare();
 }

}
fs.writeFileSync('artifacts/m5-cross-mode-deferred-assertions.json',JSON.stringify(deferredComparisons,null,2));
fs.writeFileSync('artifacts/m5-cross-mode-comparison.json',JSON.stringify(comparisons,null,2));console.log(JSON.stringify(comparisons));

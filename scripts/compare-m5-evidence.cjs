const {validateFullBrowserRoute}=require('./b6-deferred-assertions.cjs');
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
const comparisons=[],deferredComparisons={},b8InputEvidence=[];
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
 validateFullBrowserRoute(manifests[0],routes[0]);validateFullBrowserRoute(manifests[1],routes[1]);
 for(const round of routes[0].rounds)compareBrowserRound(folders[0],folders[1],round.round,'browser observed');

 comparisons.push({build,evidenceClass:finalGate?'final-clean-commit':'development-validation',sha:sharedSha,sourceFingerprint:manifests[0].sourceFingerprint,checkpoints:manifests[0].checkpoints.length,rounds:routes[0].rounds.length,finalHash:hash(routes[0].final),fullApplicationRoutePassed:true,browserBattlesCompared:routes[0].rounds.length,skippedBrowserRoundIds:[],domainRouteComparedInFull:true,passed:true});
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
   // Audit P2-2: the Rageblade summary must be bound to its recorded artifacts (validated below).
   b8InputEvidence.push({name,manifest});
  }
 }
 const touchRoutes=['dev','preview'].map(mode=>read(`artifacts/m5-${mode}-cannon-touch/route.json`));
 for(const key of ['initial','final','ledger','actions','rounds'])assert.deepEqual(touchRoutes[0][key],touchRoutes[1][key],`touch complete domain ${key}`);
 const touchManifests=['dev','preview'].map(mode=>read(`artifacts/m5-${mode}-cannon-touch/manifest.json`));
 validateFullBrowserRoute(touchManifests[0],touchRoutes[0]);validateFullBrowserRoute(touchManifests[1],touchRoutes[1]);
 for(const {round} of touchRoutes[0].rounds)compareBrowserRound('artifacts/m5-dev-cannon-touch','artifacts/m5-preview-cannon-touch',round,`touch R${round}`);

}
// The U6 job is part of the final evidence: its report must exist, match this commit and contain
// every expected checkpoint, so a green comparison cannot silently omit U6.
const U6_CHECKS=['1-2 preparation','1-2: mid-combat reveal','1-2 settlement','1-3: mid-combat reveal','1-3 loot choice pending','1-3 after real choice',
 '2-7 capacity: mid-combat reveal','2-7 choice with full bench','2-7 capacity blocks Continue','2-7 after real sale','3-1 preparation after Continue',
 '4-7 terminal: mid-combat reveal','4-7 game over'];
function validateU6Report(report){
 assert.equal(report.passed,true,'U6 loot gate failed');
 if(finalGate)assert.equal(report.sha,currentSha,'U6 evidence HEAD must equal current HEAD');
 assert.deepEqual(report.errors,[],'U6 gate errors');
 assert.deepEqual(report.checks.map(check=>check.label),U6_CHECKS,'U6 gate checkpoints');
 for(const check of report.checks)assert.equal(typeof check.continueDisabled,'boolean',`U6 ${check.label}: Continue state recorded`);
 assert.deepEqual(report.checks.map(check=>check.continueDisabled),[true,true,false,true,true,false,true,true,true,false,true,true,true],'U6 Continue availability');
 assert(report.fixtures?.capacity?.battles>0&&report.fixtures?.terminal?.battles>0,'U6 imported public-route fixtures');
}
(async()=>{
 if(finalGate){
  // CI downloads the U6 artifact outside artifacts/ so its timing folder is not counted as a tenth M6 execution job.
  const u6Dir=process.env.M8_U6_EVIDENCE_DIR||'artifacts';
  validateU6Report(read(path.join(u6Dir,'m8-u6-loot/report.json')));
  if(process.env.M8_U6_EVIDENCE_DIR){
   const timing=path.join(u6Dir,'m5-ci-timing-m8-u6-loot');
   const steps=fs.readdirSync(timing).filter(name=>name.endsWith('.json')).map(name=>read(path.join(timing,name)));
   assert(steps.some(step=>step.step==='m8-u6-loot'),'U6 gate timing recorded');
   for(const step of steps){assert.equal(step.sha,currentSha,'U6 timing commit');assert.equal(step.exitCode,0,`U6 ${step.step} failed`);assert.equal(step.signal,null,`U6 ${step.step} interrupted`);}
  }
  const {validateB8RagebladeEvidence}=require('./b8-input-evidence.cjs');
  const {createServer}=await import('vite');
  const server=await createServer({root:path.resolve(__dirname,'..'),server:{middlewareMode:true,ws:false},optimizeDeps:{noDiscovery:true,include:[]},appType:'custom',logLevel:'error'});
  try{const {readCombatStats}=await server.ssrLoadModule('/src/simulation/combat-s13.ts');
   const api=await server.ssrLoadModule('/src/simulation/match.ts');
   assert.equal(b8InputEvidence.length,2,'both input modes carry B8 Rageblade evidence');
   for(const {name,manifest} of b8InputEvidence)validateB8RagebladeEvidence(manifest,`artifacts/${name}`,{api,readCombatStats});
  }finally{await server.close();}
 }
 fs.writeFileSync('artifacts/m5-cross-mode-deferred-assertions.json',JSON.stringify(deferredComparisons,null,2));
 fs.writeFileSync('artifacts/m5-cross-mode-comparison.json',JSON.stringify(comparisons,null,2));console.log(JSON.stringify(comparisons));
})().catch(error=>{console.error(error);process.exit(1);});

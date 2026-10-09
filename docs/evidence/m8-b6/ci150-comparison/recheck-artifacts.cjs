/* Diagnostic only: corrected validator against original fixed-ac76255 CI150
 * artifacts. Run from any checkout with the extracted artifacts root as argv[2].
 * This does not run Chromium or produce new fixed-SHA acceptance evidence. */
const fs=require('node:fs'),assert=require('node:assert/strict');
const {hash}=require('../../../../scripts/m4-evidence.cjs');
const {validateB6BrowserBoundary}=require('../../../../scripts/b6-deferred-assertions.cjs');
const root=process.argv[2];assert(root,'Pass the extracted CI150 artifacts root');
let total=0,starts=0,others=0,negative=0;
for(const folder of ['m5-dev-cannon','m5-preview-cannon','m5-dev-sniper','m5-preview-sniper','m5-dev-mage','m5-preview-mage','m5-dev-cannon-touch','m5-preview-cannon-touch']){
 const route=JSON.parse(fs.readFileSync(`${root}/${folder}/route.json`)),manifest=JSON.parse(fs.readFileSync(`${root}/${folder}/manifest.json`));
 assert.equal(manifest.sha,'ac76255df7876f2dfa47deaa4a4475a0beaf81b8');validateB6BrowserBoundary(manifest,route);
 const prefix=route.actions.slice(0,manifest.checkpoints.length),start=prefix.findIndex(e=>e.command.type==='start'),ordinary=prefix.findIndex(e=>e.command.type!=='start');assert(start>=0&&ordinary>=0);
 const count=prefix.filter(e=>e.command.type==='start').length;total+=prefix.length;starts+=count;others+=prefix.length-count;
 for(const [name,mutate]of [ ['start-settlement',v=>v.checkpoints[start].stateHash='tampered-settlement'],['start-tick0-substitution',v=>v.checkpoints[start].stateHash=prefix[start].afterHash],['ordinary-command',v=>v.checkpoints[ordinary].stateHash='tampered-command'],['missing-checkpoint',v=>v.checkpoints.splice(ordinary,1)] ]){
  const bad=structuredClone(manifest);mutate(bad);assert.throws(()=>validateB6BrowserBoundary(bad,route),name);negative++;
 }
 const firstRound=route.rounds.find(r=>r.round===prefix[start].round);
 assert.equal(manifest.checkpoints[start].stateHash,hash(firstRound.after));
 console.log(JSON.stringify({folder,checkpoints:prefix.length,startSettlements:count,nonStart:prefix.length-count,negativeCasesRejected:4}));
}
console.log(JSON.stringify({scope:'corrected comparator against original fixed-ac76255 CI150 artifacts; no new browser run or fixed-new-SHA acceptance',totalCheckpoints:total,startSettlements:starts,nonStart:others,negativeCasesRejected:negative}));

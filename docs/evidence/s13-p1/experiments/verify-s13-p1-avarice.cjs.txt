/* Public-command integration evidence. No saved fixture, injected resource or skipped restore. */
const assert=require('node:assert/strict');
const {run}=require('./generate-m5-route.cjs');
(async()=>{const {createServer}=await import('vite');const server=await createServer({configFile:false,server:{middlewareMode:true,ws:false},appType:'custom',logLevel:'error'});
try{
 const api=await server.ssrLoadModule('/src/simulation/match.ts'),ser=await server.ssrLoadModule('/src/simulation/serialization.ts');let state;const stop={};
 try{await run(api,{build:'cannon',seed:23,anomalyDefinitionId:'avarice-incarnate',onStep:(before,result)=>{
  if(!before.anomalyBinding&&result.state.anomalyBinding){assert.equal(result.state.anomalyBinding.definitionId,'avarice-incarnate');assert.equal(result.state.gold,before.gold+5);state=result.state;throw stop;}
 }});}catch(error){if(error!==stop)throw error;}
 assert(state);assert.deepEqual(ser.restoreMatch(state),state);assert.deepEqual(ser.restoreMatch(ser.serializeMatch(state)),state);
 const original=state;const selected=original.scheduleReceipts.find(r=>r.kind==='anomaly');
 assert.equal(api.selectChoice(state,state.anomalyBinding.choiceId,0,'avarice-incarnate').state,state);
 let started=api.startMatchCombat(state);assert(started.ok);state=started.state;
 for(let i=0;i<20&&state.phase==='combat';i++)state=api.stepMatch(state).state;
 assert.deepEqual(ser.restoreMatch(state),state);assert.deepEqual(ser.restoreMatch(ser.serializeMatch(state)),state);
 const bad=structuredClone(state),holder=bad.combat.units.find(u=>u.id===bad.anomalyBinding.unitId);assert(holder);holder.currentAnomalyBankGold++;
 assert.throws(()=>ser.restoreMatch(bad),/anomaly bank replay/);
 let restored=ser.restoreMatch(state);for(let i=0;i<20&&state.phase==='combat';i++){const a=api.stepMatch(state),b=api.stepMatch(restored);assert.deepEqual(b,a);state=a.state;restored=b.state;}
 console.log(JSON.stringify({ok:true,seed:23,round:original.roundDefinitionId,acquisitionGold:selected.gold,bank:holder.openingAnomalyBankGold,checks:['public-acquisition','duplicate','object-json-restore','forged-bank-rejected','state-and-event-continuation']}));
}finally{await server.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

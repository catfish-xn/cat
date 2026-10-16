/* Public-command proof of the current mage route's neutral source death identities. */
const fs=require('node:fs'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
async function main(){
 const {createServer}=await import('vite');const server=await createServer({configFile:false,server:{middlewareMode:true,ws:false},appType:'custom',logLevel:'error'});
 try{
 const api=await server.ssrLoadModule('/src/simulation/match.ts');
 let prefix;const reached=new Error('public route reached4-7');
 try{await require('./generate-m5-route.cjs').run(api,{build:'mage',seed:42,onStep(before,_result,command){if(command?.type==='start'&&before.roundDefinitionId==='4-7'){prefix=before;throw reached;}}});}catch(e){if(e!==reached)throw e;}
 assert(prefix);
 const accept=r=>{assert(r.ok!==false,r.reason);return r.state;};
 function resolve(state){
 state=accept(api.startMatchCombat(state));const events=[];
 while(state.phase==='combat'){const step=api.stepMatch(state);state=step.state;events.push(...step.events);}
 return {deaths:state.combat.neutralReceipts.deaths,reveals:events.filter(e=>e.type==='lootRevealed').map(e=>({dropId:e.dropId,death:e.death})),result:state.combat.result,phase:state.phase,eventHash:sha(events),terminalHash:sha(state),receipts:state.m8.loot.receipts.length-prefix.m8.loot.receipts.length};
 }
 const branches={full:resolve(prefix)};
 for(const definitionId of ['loris','lux']){
 let state=prefix,slot=0;const target=state.preparation.units.find(u=>u.team==='player'&&u.definitionId===definitionId);assert(target);
 for(const unit of state.preparation.units.filter(u=>u.team==='player'&&u.id!==target.id))state=accept(api.deployMatchUnit(state,unit.id,{kind:'bench',slot:slot++}));
 branches[definitionId]={...resolve(state),star:target.starLevel};
 }
 const audit={contentDigest:prefix.contentDigest,route:'mage',seed:42,roundId:'4-7',prefixHash:sha(prefix),driverSha256:createHash('sha256').update(fs.readFileSync('scripts/generate-m5-route.cjs')).digest('hex'),branches};
 fs.writeFileSync('docs/evidence/g2-3/live-reveal-audit.json',JSON.stringify(audit,null,2)+'\n');console.log(JSON.stringify(audit));
 }finally{await server.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});

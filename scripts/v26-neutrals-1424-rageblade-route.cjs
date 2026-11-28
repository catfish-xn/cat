/* v26 command-only input recipe (fork of the history-protected v17 recipe; only SEED differs). Rod (1-2) and bow (2-7) come from distinct
 * earned orb receipts; the Lux is the actual 1-4 reward. No state edits. */
// v26 re-pin: 14.24 krugs (568eeea4) drop seed 27's 2-7 bow (the v17 route now earns rod x3); seed 1914 earns
// rod (1-2), its only Lux (1-4 reward, benched) and bow (2-7) from the same public route. v17 keeps SEED=27.
const SEED=1914,ROUND='3-1';
// Shared by the public-command replay and native input driver.
function openingDeployment(state){
 const held=state.preparation.units.filter(u=>u.team==='player'&&u.location.kind==='board');
 const unit=state.preparation.units.find(u=>u.team==='player'&&u.location.kind==='bench');
 if(!unit||held.length>=state.level)return null;
 const col=[1,3,5,0,6,2,4].find(col=>!held.some(u=>u.location.cell.col===col&&u.location.cell.row===7));
 return {unitId:unit.id,cell:{col,row:7}};
}
function prefix(api,onChoice=()=>{}){
 const accept=r=>{if(!r.ok)throw Error('v26 Rageblade route: '+r.reason);return r.state;};
 let state=api.createMatch(SEED);
 for(let guard=0;guard<80;guard++){
  if(state.roundDefinitionId===ROUND&&state.phase==='preparation')return state;
  if(state.phase==='choice'){
   const c=state.pendingChoice,pick=c.offers.find(id=>id!=='placebo'),next=accept(api.selectChoice(state,c.choiceId,c.generation,pick));
   onChoice(state,next,pick);state=next;continue;
  }
  if(state.phase==='settlement'){state=accept(api.nextRound(state,state.round));continue;}
  if(state.phase!=='preparation')throw Error('v26 Rageblade route ended: '+state.phase);
  for(let deployment;deployment=openingDeployment(state);){
   state=accept(api.deployMatchUnit(state,deployment.unitId,{kind:'board',cell:deployment.cell}));
  }
  state=accept(api.startMatchCombat(state));while(state.phase==='combat')state=api.stepMatch(state).state;
 }
 throw Error('v26 Rageblade route budget');
}
module.exports={SEED,ROUND,prefix,openingDeployment};

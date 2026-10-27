/* v24 command-only input recipe. Rod (1-2) and bow (2-7) come from distinct
 * earned orb receipts; the Lux is the actual 1-4 reward. No state edits.
 * Fork the v17 recipe for public augment rerolls without changing its archive. */
const SEED=27,ROUND='3-1';
// Shared by the public-command replay and native input driver.
function openingDeployment(state){
 const held=state.preparation.units.filter(u=>u.team==='player'&&u.location.kind==='board');
 const unit=state.preparation.units.find(u=>u.team==='player'&&u.location.kind==='bench');
 if(!unit||held.length>=state.level)return null;
 const col=[1,3,5,0,6,2,4].find(col=>!held.some(u=>u.location.cell.col===col&&u.location.cell.row===7));
 return {unitId:unit.id,cell:{col,row:7}};
}
function prefix(api,onChoice=()=>{},augmentPriorities=[]){
 const accept=r=>{if(!r.ok)throw Error('v24 Rageblade route: '+r.reason);return r.state;};
 let state=api.createMatch(SEED);
 for(let guard=0;guard<80;guard++){
  if(state.roundDefinitionId===ROUND&&state.phase==='preparation')return state;
  if(state.phase==='choice'){
   const c=state.pendingChoice;
   if(c.kind==='augment'&&augmentPriorities.length&&!augmentPriorities.some(id=>c.offers.includes(id))){
    const slot=c.rerolledSlots?.findIndex(used=>!used)??-1;
    if(slot>=0){state=accept(api.rerollAugment(state,c.choiceId,c.generation,slot));continue;}
   }
   const pick=(c.kind==='augment'?augmentPriorities.find(id=>c.offers.includes(id)):undefined)??c.offers.find(id=>id!=='placebo'),next=accept(api.selectChoice(state,c.choiceId,c.generation,pick));
   onChoice(state,next,pick);state=next;continue;
  }
  if(state.phase==='settlement'){state=accept(api.nextRound(state,state.round));continue;}
  if(state.phase!=='preparation')throw Error('v24 Rageblade route ended: '+state.phase);
  for(let deployment;deployment=openingDeployment(state);){
   state=accept(api.deployMatchUnit(state,deployment.unitId,{kind:'board',cell:deployment.cell}));
  }
  state=accept(api.startMatchCombat(state));while(state.phase==='combat')state=api.stepMatch(state).state;
 }
 throw Error('v24 Rageblade route budget');
}
module.exports={SEED,ROUND,prefix,openingDeployment};

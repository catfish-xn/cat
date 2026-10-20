/* v17 command-only input recipe. Rod (1-2) and bow (2-7) come from distinct
 * earned orb receipts; the Lux is the actual 1-4 reward. No state edits. */
const SEED=27,ROUND='3-1';
function prefix(api,onChoice=()=>{}){
 const accept=r=>{if(!r.ok)throw Error('v17 Rageblade route: '+r.reason);return r.state;};
 let state=api.createMatch(SEED);
 for(let guard=0;guard<80;guard++){
  if(state.roundDefinitionId===ROUND&&state.phase==='preparation')return state;
  if(state.phase==='choice'){
   const c=state.pendingChoice,pick=c.offers.find(id=>id!=='placebo'),next=accept(api.selectChoice(state,c.choiceId,c.generation,pick));
   onChoice(state,next,pick);state=next;continue;
  }
  if(state.phase==='settlement'){state=accept(api.nextRound(state,state.round));continue;}
  if(state.phase!=='preparation')throw Error('v17 Rageblade route ended: '+state.phase);
  for(const unit of state.preparation.units.filter(u=>u.team==='player'&&u.location.kind==='bench')){
   const held=state.preparation.units.filter(u=>u.team==='player'&&u.location.kind==='board');if(held.length>=state.level)break;
   const col=[1,3,5,0,6,2,4].find(col=>!held.some(u=>u.location.cell.col===col&&u.location.cell.row===7));
   state=accept(api.deployMatchUnit(state,unit.id,{kind:'board',cell:{col,row:7}}));
  }
  state=accept(api.startMatchCombat(state));while(state.phase==='combat')state=api.stepMatch(state).state;
 }
 throw Error('v17 Rageblade route budget');
}
module.exports={SEED,ROUND,prefix};

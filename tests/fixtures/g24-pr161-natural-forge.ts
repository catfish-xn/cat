import { isSellableUnit } from '../../src/simulation/seat-mechanics/forms';
import {sellUnit,createMatch,buyXp,deployMatchUnit,startMatchCombat,stepMatch,nextRound,selectChoice,selectAnomalyTarget,type MatchState} from '../../src/simulation/match';
import {grantMechanicGold,grantMechanicUnit} from '../../src/simulation/seat-mechanics';
import {readG23Progress} from '../../src/simulation/g2-3-state';
import {P2_ITEM_GRANTS} from '../../src/simulation/content/s13-augments-p2';
import {isAnvil} from '../../src/simulation/content/anvils';
import {augmentNeedsHistory} from '../../src/simulation/augment-history-owners';
import {accepted} from '../match-helpers';
import {openConquerorAnvil} from './g24-forge-anvil';

export {openConquerorAnvil};

/** Seed 24 keeps scuttle-puddle's tier-10 trajectory while avoiding the 4-2
 * prismatic offer's unrelated full-history requirement for the PR161 vectors. */
export const NATURAL_FORGE_SEED=24;
let cached:Map<number,MatchState>|undefined;
let tier4Preparation:MatchState|undefined;
export function naturalTier4Preparation():MatchState{
 naturalForgeStates();return tier4Preparation!;
}
/** Real solo combats, explicit generic grants only: no forged progress/history/settlement. */
export function naturalForgeStates():Map<number,MatchState>{
 if(cached)return cached;
 const states=new Map<number,MatchState>();let state=createMatch(NATURAL_FORGE_SEED),recruited=false;
 for(let guard=0;guard<60000;guard++){
  if(state.phase==='choice'){
   let c=state.pendingChoice!;
   if(c.kind==='anomaly'&&c.step==='target'){
    state=accepted(selectAnomalyTarget(state,c.choiceId,c.generation,state.preparation.units.find(u=>u.team==='player')!.id));c=state.pendingChoice!;
   }
   // Choose a real offer without unrelated replay history or acquisition items.
   const id=c.kind==='augment'?c.offers.find(id=>!augmentNeedsHistory(id)&&!(id in P2_ITEM_GRANTS)):c.offers[0];
   if(!id)throw Error('No history-free augment offer in PR161 route');
   state=accepted(selectChoice(state,c.choiceId,c.generation,id));continue;
  }
  if(state.phase==='combat'){
   state=stepMatch(state).state;
   if(!states.has(4)&&readG23Progress(state)!.conquest.chestsOpened>=4)states.set(4,state);
   continue;
  }
  // v22 anvil units (docs/ANVIL_UNITS.md): the 4-7 component anvil is a bench unit and selling it would open its
  // forge, so the bench clean-up only sells heroes and the anvil stays unopened on the bench.
  if(state.phase==='settlement'){
   // Earlier Conqueror anvils (tier 9) resolve through the choice branch with their first offer, as the old popup did.
   const opened=openConquerorAnvil(state);
   if(opened){if(opened.receiptId==='g23:conqueror:10:atom:0:copy:0'){states.set(10,opened.state);cached=states;return states;}state=opened.state;continue;}
   while(state.m8.loot.direct.some(d=>d.status==='pending-capacity')){const extra:MatchState['preparation']['units'][number]=state.preparation.units.find(u=>u.team==='player'&&u.location.kind==='bench'&&!isAnvil(u.definitionId)&&u.definitionId!=='training-dummy')!;state=accepted(sellUnit(state,extra.id));}state=accepted(nextRound(state,state.round));continue;}
  if(state.phase!=='preparation')throw Error(`Unexpected solo fixture phase ${state.phase} at ${state.round}, stacks ${readG23Progress(state)!.conquest.stacks}`);
  if(state.round===1&&!recruited){
   state=accepted(grantMechanicGold(state,{receiptId:'fixture:gold',source:'fixture',amount:150}));
   while(state.level<6)state=accepted(buyXp(state));
   for(const u of state.preparation.units.filter(u=>u.team==='player'))state=accepted(deployMatchUnit(state,u.id,{kind:'bench',slot:0}));
   for(const [col,definitionId] of ['darius','draven','rell','swain','ambessa','mordekaiser'].entries()){
    for(let copy=0;copy<9;copy++)state=accepted(grantMechanicUnit(state,{receiptId:`fixture:${definitionId}:${copy}`,source:'fixture',definitionId}));
    const unit=state.preparation.units.find(u=>u.team==='player'&&u.definitionId===definitionId&&u.starLevel===3)!;
    state=accepted(deployMatchUnit(state,unit.id,{kind:'board',cell:{col,row:4}}));
   }
   recruited=true;
  }
  for(const u of state.preparation.units.filter(u=>u.team==='player'&&u.location.kind==='bench'&&u.id!=='unit-1'&&!isAnvil(u.definitionId)&&isSellableUnit(u.definitionId)))state=accepted(sellUnit(state,u.id));
  if(state.round===6)tier4Preparation=state;
  state=accepted(startMatchCombat(state));
 }
 throw Error('Natural forge fixture budget');
}

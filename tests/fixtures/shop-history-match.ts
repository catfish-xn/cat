import { AUGMENT_SHOP } from '../../src/simulation/content/augment-pool-shop';
import { expect } from 'vitest';
import { createMatch, selectChoice, rerollAugment, type MatchState } from '../../src/simulation/match';
import { augmentCandidates, resolveAugmentTier } from '../../src/simulation/augment-offers';
import { generateChoices } from '../../src/simulation/choices';
import { accepted, reachRound } from '../match-helpers';

/** Keep a still-valid route; after pool expansion search bounded public routes. */
export function shopOwner(seed:number,id:string,node='2-1'):MatchState {
 for (const candidate of [seed,...Array.from({length:10000},(_,i)=>i).filter(i=>i!==seed)]) {
  if(node==='2-1'){
   const initial=createMatch(candidate);
   if(initial.preparation.units.some(u=>u.definitionId==='trainer-golem'))continue;
   const pool=augmentCandidates(resolveAugmentTier(initial,'round:2-1:augment'),[],[],null,{node,fieldedTraits:[],blocked:[]});
   if(!generateChoices(pool,initial.choiceRngState).offers.includes(id))continue;
  }
  let state:MatchState;
  try { state=reachRound(node,false,candidate,[],[...Object.keys(AUGMENT_SHOP),'dual-purpose']); }
  catch { continue; } // Skip routes whose earlier gifts cannot fit the empty-board fixture.
  if(state.pendingChoice?.kind!=='augment')continue;
  if(node!=='2-1')for(let slot=0;slot<3&&!state.pendingChoice!.offers.includes(id);slot++){
   const c=state.pendingChoice!;state=accepted(rerollAugment(state,c.choiceId,c.generation,slot));
  }
  const c=state.pendingChoice!;
  if(!c.offers.includes(id))continue;
  expect(c.offers).toContain(id);
  return accepted(selectChoice(state,c.choiceId,c.generation,id));
 }
 throw new Error(`No public ${node} shop augment offer for ${id} in 0..9999`);
}

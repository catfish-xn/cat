import { it, expect } from 'vitest';
import { makeRoom } from './server/helpers';
import { augmentCandidates, drawAugmentCard, resolveAugmentTier } from '../src/simulation/augment-offers';
import { generateChoices } from '../src/simulation/choices';
import { openingEncounterId } from '../src/simulation/opening-encounter';
import { createMatch } from '../src/simulation/match';
it.each(['no-scout-no-pivot','cooking-pot'])('find a bounded room test route for %s',id=>{
 let found:unknown;
 for(let seed=0;seed<=100&&!found;seed++){
  const {room}=makeRoom(undefined,{seed});
  for(const seat of room.state.seats.slice(0,4)){
   const m=seat.match,tier=resolveAugmentTier(m,'round:2-1:augment');
   const filter={node:'2-1',fieldedTraits:[],blocked:[]};
   const init=generateChoices(augmentCandidates(tier,[],[],openingEncounterId(m),filter),m.choiceRngState);
   let offers=init.offers,removed=[...offers],rng=init.choiceRngState;
   if(offers.includes(id))found={seed,seat:seat.seatId,rerolls:0};
   for(let slot=0;slot<3&&!found;slot++){
    const d=drawAugmentCard(augmentCandidates(tier,[],[...removed,...offers],openingEncounterId(m),filter),rng);
    rng=d.choiceRngState; offers=[...offers];offers[slot]=d.definitionId;removed.push(d.definitionId);
    if(d.definitionId===id)found={seed,seat:seat.seatId,rerolls:slot+1};
   }
   if(found)break;
  }
  room.dispose();
 }
 expect(found).toBeDefined();console.log('route',id,found);
});
it('finds the existing history fixture within the bounded solo seed range',async()=>{
 const { boundedFirstNodeOffer }=await import('./augment-stage-helpers');
 expect(()=>boundedFirstNodeOffer('starry-night')).not.toThrow();
});
it('finds bounded Heroic Grab Bag candidates',()=>{
 const candidates:number[]=[];
 for(let seed=0;seed<=100;seed++){
  const m=createMatch(seed),filter={node:'2-1',fieldedTraits:[],blocked:[]};
  const tier=resolveAugmentTier(m,'round:2-1:augment');
  const init=generateChoices(augmentCandidates(tier,[],[],openingEncounterId(m),filter),m.choiceRngState);
  let offers=init.offers,removed=[...offers],rng=init.choiceRngState;
  if(offers.includes('heroic-grab-bag'))candidates.push(seed);
  for(let slot=0;slot<3&&!candidates.includes(seed);slot++){
   const d=drawAugmentCard(augmentCandidates(tier,[],[...removed,...offers],openingEncounterId(m),filter),rng);
   rng=d.choiceRngState;offers=[...offers];offers[slot]=d.definitionId;removed.push(d.definitionId);
   if(d.definitionId==='heroic-grab-bag')candidates.push(seed);
  }
 }
 expect(candidates.length).toBeGreaterThan(0);
});

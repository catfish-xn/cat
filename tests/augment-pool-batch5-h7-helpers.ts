import { expect } from 'vitest';
import { createMatch, rerollAugment, selectChoice, type MatchState } from '../src/simulation/match';
import { augmentCandidates, drawAugmentCard, resolveAugmentTier } from '../src/simulation/augment-offers';
import { openingEncounterId } from '../src/simulation/opening-encounter';
import { generateChoices } from '../src/simulation/choices';
import { accepted, reachRound } from './match-helpers';
const offers = new Map<string, MatchState>();
export function offered(id: string): MatchState {
  const cached = offers.get(id); if (cached) return cached;
  // Bounded cheap offer scan only; no full match/seed sweeps.
  for(let seed=0;seed<=100;seed++) {
    const s=createMatch(seed),tier=resolveAugmentTier(s,'round:2-1:augment');
    if (tier !== 'silver') continue;
    const filter = {node:'2-1',fieldedTraits:[],blocked:[]}, encounter = openingEncounterId(s);
    const initial = generateChoices(augmentCandidates(tier,[],[],encounter,filter),s.choiceRngState);
    const seen = [...initial.offers]; let rng = initial.choiceRngState, rerolls = 0;
    while (!seen.includes(id) && rerolls < 3) {
      const draw = drawAugmentCard(augmentCandidates(tier,[],seen,encounter,filter),rng);
      seen.push(draw.definitionId); rng = draw.choiceRngState; rerolls++;
    }
    if (!seen.includes(id)) continue;
    let open=reachRound('2-1',false,seed);
    for (let slot=0;slot<rerolls;slot++) {
      const c=open.pendingChoice!;open=accepted(rerollAugment(open,c.choiceId,c.generation,slot));
    }
    expect(open.pendingChoice!.offers).toContain(id);offers.set(id,open);return open;
  }
  throw Error(`No first-node seed 0..100 for ${id}`);
}
export function acquire(id: string) {const s=offered(id),c=s.pendingChoice!;return accepted(selectChoice(s,c.choiceId,c.generation,id));}

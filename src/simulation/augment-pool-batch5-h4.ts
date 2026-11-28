import { bindV20Teamups, v20MembershipSources } from './v20-teamups';
import type { TraitProjectionSource } from './traits/effective-membership';
import type { MatchState } from './match-types';
import { requireAugmentFacts } from './augment-history';
import { deriveTraits } from './trait-snapshot';
import { TRAIT_DEFINITIONS } from './content/traits';
import { AUGMENT_BATCH5_H4 } from './content/augment-pool-batch5-h4';
import { grantMechanicGold } from './seat-mechanics/grants';

export const SOURCE = 'augment-pool-batch5-h4';
/** Gold for one frozen round-entry roster. Missing history throws; the display checks that itself and returns null. */
export function portfolioRoundGold(state: MatchState, owner: MatchState['augments'][number], round: number): number {
  const definitionId = owner.definitionId;
  if (definitionId !== 'diversified-portfolio' && definitionId !== 'diversified-portfolio-plus') throw new RangeError('Invalid portfolio owner');
  const facts = requireAugmentFacts(state, 'round-entry', round);
  if (facts.length !== 1) throw new RangeError('Invalid portfolio round entry');
  const roster = facts[0].roster;
  // History rosters already contain the combat bench projection, without its live capacity overlay.
  const { usableBenchSlots, overflowUnitIds, ...base } = state.preparation;
  const frozen = {...state, round, preparation:{...base, units:roster.units}, items:roster.items, augments:state.augments.filter(a => a.acquiredRound < round)};
  const sources: TraitProjectionSource[] = v20MembershipSources(frozen, bindV20Teamups(frozen));
  const sisters = frozen.augments.find(a => a.definitionId === 'sisters');
  const partners = roster.units.filter(u => u.team === 'player' && u.location.kind === 'board' && ['jinx','vi'].includes(u.definitionId));
  if (sisters && new Set(partners.map(u => u.definitionId)).size === 2) for (const unit of partners)
    sources.push({kind:'add-trait', sourceId:sisters.choiceId+':sisters:'+unit.id, unitId:unit.id, traitId:'sisters', activeFromRound:round, expiresBeforeRound:round+1});
  const traits = deriveTraits(frozen.preparation, 'player', TRAIT_DEFINITIONS, {round, sources}, roster.items);
  const count = traits.filter(t => t.tier > 0 && !(TRAIT_DEFINITIONS[t.traitId].tiers.length === 1 && TRAIT_DEFINITIONS[t.traitId].tiers[0].threshold === 1)).length;
  const { TraitsActive, GoldRate } = AUGMENT_BATCH5_H4[definitionId].values;
  return Math.floor(count / TraitsActive) * GoldRate;
}
/** The entry fact is captured after payment of the previous round's frozen income. */
export function portfolioGoldPlan(state: MatchState) {
  return state.augments.filter(a => a.definitionId === 'diversified-portfolio' || a.definitionId === 'diversified-portfolio-plus').flatMap(a => {
    const plan: {receiptId:string; source:string; round:number; amount:number}[] = [];
    for (let round=a.acquiredRound+1; round<=state.round; round++) {
      const amount = portfolioRoundGold(state, a, round);
      if (amount) plan.push({receiptId:JSON.stringify([SOURCE,a.choiceId,round]), source:SOURCE, round, amount});
    }
    return plan;
  });
}
export function drainPortfolioGold(state:MatchState):MatchState {
  for(const p of portfolioGoldPlan(state)) if(!state.seatMechanics?.receipts.some(r=>r.receiptId===p.receiptId)) {
    if(p.round!==state.round) throw new RangeError('Invalid portfolio missing prior payment');
    const result=grantMechanicGold(state,p); if(!result.ok) throw new RangeError(result.reason); state=result.state;
  }
  return state;
}


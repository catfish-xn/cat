import type { MatchState } from './match-types';
import { requireAugmentFacts } from './augment-history';
import { planAugmentGifts, type AugmentGift } from './augment-gift-plan';
import { freezeContent } from './content/freeze';

/** D2 effect; D5 registers the definition, gold tier and 2-1-only offers.
 * Source: 14.24 TFT_Augment_BRB; timing/allowed operations: approved D rules 3–5. */
export const BRB_RULES = freezeContent({ rounds: 3, anvils: 2, definitionId: 'TFT_ArmoryKeyCompleted' });

/** Natural ordinals include acquisition, PvE and carousel; no mutable countdown. */
export function brbShopDisabled(state: Pick<MatchState, 'augments' | 'round'>): boolean {
  return state.augments.some(a => a.definitionId === 'brb'
    && state.round >= a.acquiredRound && state.round < a.acquiredRound + BRB_RULES.rounds);
}

/** Entitlement survives a full bench through the existing gift retry path.
 * Elimination before maturity earns nothing. A later elimination cannot erase
 * the authenticated birth of an already earned anvil. */
export function brbGiftPlan(state: MatchState): AugmentGift[] {
  const owner = state.augments.find(a => a.definitionId === 'brb');
  if (!owner) return [];
  const acquired = requireAugmentFacts(state, 'acquire', owner.acquiredRound)
    .find(f => f.choiceId === owner.choiceId && f.definitionId === owner.definitionId);
  if (!acquired) throw new RangeError('Invalid augment history: missing BRB acquisition');
  const due = acquired.round + BRB_RULES.rounds;
  if (state.round < due || state.roundResults.some(r => r.round < due && r.hpAfter === 0)) return [];
  return planAugmentGifts(state, { ...owner, acquiredRound: due }, [
    { kind: 'unit', definitionId: BRB_RULES.definitionId, count: BRB_RULES.anvils },
  ]);
}

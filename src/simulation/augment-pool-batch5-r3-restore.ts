import type { MatchState } from './match-types';
import type { CombatState } from './combat-types';
import { isR3Augment, isR3Copy } from './augment-pool-batch5-r3';
import { validateB8Resources } from './b8-restore';
import { buildStrategySnapshot } from './strategy-snapshot';
import { canonicalContent } from './content';
import { validateDynamicCombat } from './g2-4b-gold-restore';

function hasR3Fields(combat: CombatState): boolean {
  return !!combat.strategy?.r3Original || [...combat.units, ...combat.strategy?.units ?? []]
    .some(u => u.r3Mirror !== undefined || isR3Copy(u.itemSummon));
}

/** The pool/offer/receipt checks run first. A saved compiled strategy is never opening authority. */
export function validateSharedR3Combat(state: MatchState): void {
  const combats: CombatState[] = [];
  if (state.combat) combats.push(state.combat);
  if (state.pendingCombatTerminal) combats.push(state.pendingCombatTerminal);
  if (!state.augments.some(a => isR3Augment(a.definitionId))) {
    if (combats.some(hasR3Fields)) throw new RangeError('Unexpected R3 combat origin');
    return;
  }
  if (!combats.length) return;
  // A revealed stream terminal is not yet a resource/growth settlement.
  const opening = state.pendingCombatTerminal ? { ...state, combat: state.pendingCombatTerminal } as MatchState : state;
  const { basis } = validateB8Resources(opening);
  if (!basis) throw new RangeError('Missing R3 combat input');
  const strategy = buildStrategySnapshot(basis.inputs);
  for (const combat of combats) {
    if (canonicalContent(combat.strategy) !== canonicalContent(strategy)) throw new RangeError('Invalid R3 combat strategy');
    if (!validateDynamicCombat(combat, basis, strategy) && hasR3Fields(combat)) throw new RangeError('Unexpected R3 combat origin');
  }
}

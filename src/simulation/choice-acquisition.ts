import type { ChoiceDefinition } from './strategy-types';
import { getStageRound } from './round-schedule';

/** Read the acquisition round, never the current round when validating an old receipt. */
export function choiceAcquisitionGold(definition: ChoiceDefinition, round: number): number {
  const { stage } = getStageRound(round);
  return definition.effects.reduce((sum, effect) => {
    if (effect.kind !== 'mechanic' || effect.mechanic !== 'acquisitionGold') return sum;
    const v = effect.values;
    return sum + (stage >= 4 ? v.stage4Amount ?? v.amount : stage === 3 ? v.stage3Amount ?? v.amount : v.amount);
  }, 0);
}

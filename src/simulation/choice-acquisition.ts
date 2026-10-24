import { AUGMENT_DEFINITIONS } from './content/augments';
import type { OwnedAugment } from './strategy-types';
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

/** Acquisition XP is separate from paid purchases and recurring preparation XP. */
export function choiceAcquisitionXp(definition:ChoiceDefinition):number {
  return definition.effects.reduce((sum,e)=>sum+(e.kind==='mechanic'&&e.mechanic==='acquisitionXp'?e.values.amount:0),0);
}
export function augmentAcquisitionXpAtRound(augments:readonly OwnedAugment[],round:number):number {
  return augments.filter(a=>a.acquiredRound===round).reduce((sum,a)=>sum+choiceAcquisitionXp(AUGMENT_DEFINITIONS[a.definitionId]),0);
}

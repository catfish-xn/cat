import type { ClientCommand } from '../../server/protocol';
import type { MatchState } from '../match-types';
import { openAnvil, buyUnit, buyXp, sellUnit, setShopLock, rerollShop, selectChoice, selectAnomalyTarget,
  rerollAugment, rerollAnomaly, validateMatchDeployment } from '../match';
import { previewCombine, previewEquip } from '../item-selectors';

/** Existing public rules are the authority. Speculative command results are discarded entirely:
 * no next shop, reward, choice, generated equipment or resulting resource is used to rank actions. */
export function legal(state: MatchState, action: ClientCommand): boolean {
  switch (action.type) {
    // Tool use is not part of the current bot policy; do not consume or preview RNG.
    case 'useConsumable': return false;
    case 'deploy': return validateMatchDeployment(state, action.unitId, action.target) === undefined;
    case 'combine': return previewCombine(state, action.a, action.b).allowed;
    case 'equip': return previewEquip(state, action.itemId, action.unitId, action.slot).allowed;
    case 'buy': return buyUnit(state, action.slot, action.generation).ok;
    case 'openAnvil': return openAnvil(state,action.unitId).ok;
    case 'sell': return sellUnit(state, action.unitId).ok;
    case 'buyXp': return buyXp(state).ok;
    case 'reroll': return rerollShop(state).ok;
    case 'shopLock': return setShopLock(state, action.locked, action.generation).ok;
    case 'choose': return selectChoice(state, action.choiceId, action.generation, action.definitionId).ok;
    case 'anomalyTarget': return selectAnomalyTarget(state, action.choiceId, action.generation, action.unitId).ok;
    case 'rerollAugment': return rerollAugment(state, action.choiceId, action.generation,
      (action as ClientCommand & { readonly optionIndex?: number }).optionIndex).ok;
    case 'anomalyReroll': return rerollAnomaly(state, action.choiceId, action.generation).ok;
  }
}

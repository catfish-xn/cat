import { readG23Progress } from './g2-3-state';
import type { MatchState } from './match-types';

/** Historical counters, including zero counts, require independent battle replay. */
export function needsCrownHistory(state: MatchState): boolean {
  // Acquisition + settled rounds also bind the requirement when both rows are deleted.
  if (state.augments.some(augment => augment.definitionId === 'blood-brothers'
    && state.roundResults.some(result => result.roundKind !== 'supply' && result.round >= augment.acquiredRound))) return true;
  return readG23Progress(state)!.economyReceipts.some(action =>
    action.kind === 'battle' && (action.facts.crowns !== undefined || action.crownGold !== undefined || action.facts.d11Headhunter !== undefined || action.facts.family?.eligible===true || action.facts.melCasts!==undefined || action.facts.batch2?.some(fact => fact.definitionId === 'blood-brothers' || fact.definitionId === 'blood-brothers-deaths')));
}
export function missingCrownHistory(): never {
  throw new Error('Invalid Match save: missing historical evidence / 缺少冠冕、猎头者、家人或梅尔历史证据，请提供完整 battles 回放');
}

import { needsBatch4B4xpHistory } from './augment-pool-batch4-b4xp-progress';
import { readG23Progress } from './g2-3-state';
import type { MatchState } from './match-types';

/** Historical battle conditions need replay evidence, including zero rewards and losing battles. */
export function needsCrownHistory(state: MatchState): boolean {
  return needsBatch4B4xpHistory(state) || readG23Progress(state)!.economyReceipts.some(action =>
    action.kind === 'battle' && (action.facts.crowns !== undefined || action.crownGold !== undefined || action.facts.d11Headhunter !== undefined || action.facts.family?.eligible===true || action.facts.melCasts!==undefined));
}
export function missingCrownHistory(): never {
  throw new Error('Invalid Match save: missing historical evidence / 缺少冠冕、猎头者、家人、梅尔或战后备战席经验历史证据，请提供完整 battles 回放');
}

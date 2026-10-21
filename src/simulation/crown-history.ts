import { readG23Progress } from './g2-3-state';
import type { MatchState } from './match-types';

/** Zero-hit and losing-battle crown counts still assert opening eligibility. */
export function needsCrownHistory(state: MatchState): boolean {
  return readG23Progress(state)!.economyReceipts.some(action =>
    action.kind === 'battle' && (action.facts.crowns !== undefined || action.crownGold !== undefined || action.facts.d11Headhunter !== undefined || action.facts.family?.eligible===true || action.facts.melCasts!==undefined));
}
export function missingCrownHistory(): never {
  throw new Error('Invalid Match save: missing historical evidence / 缺少冠冕、猎头者、家人或梅尔历史证据，请提供完整 battles 回放');
}

import { readG23Progress } from './g2-3-state';
import type { MatchState } from './match-types';

/** Zero-hit and losing-battle crown counts still assert opening eligibility. */
export function needsCrownHistory(state: MatchState): boolean {
  // Spoils has a continuous kill ordinal: old rounds must be replay-authenticated even
  // if their own table slot paid nothing (including a claimed zero/missing counter).
  const spoils=state.augments.filter(a=>a.definitionId.startsWith('spoils-of-war-'));
  if(!state.multiplayer&&readG23Progress(state)!.economyReceipts.some(r=>r.kind==='battle'
    &&spoils.some(a=>r.facts.round>=a.acquiredRound)
    &&!(r.facts.round===state.round&&state.combat?.status==='finished')))return true;
  return readG23Progress(state)!.economyReceipts.some(action =>
    action.kind === 'battle' && (action.facts.crowns !== undefined || action.crownGold !== undefined || action.facts.d11Headhunter !== undefined || action.facts.family?.eligible===true || action.facts.melCasts!==undefined));
}
export function missingCrownHistory(): never {
  throw new Error('Invalid Match save: missing historical evidence / 缺少冠冕、猎头者、家人或梅尔历史证据，请提供完整 battles 回放');
}

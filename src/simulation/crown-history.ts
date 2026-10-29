import { needsBatch4B4xpHistory } from './augment-pool-batch4-b4xp-progress';
import { readG23Progress } from './g2-3-state';
import type { MatchState } from './match-types';

/** Historical counters, including zero counts, require independent battle replay. */
export function needsCrownHistory(state: MatchState): boolean {
  if(!state.multiplayer&&state.augments.some(a=>a.definitionId==='salvage-bin'&&state.roundResults.some(r=>r.roundKind==='pvp'&&r.round>=a.acquiredRound&&r.round<state.round)))return true;
  // Acquisition + settled rounds also bind the requirement when both rows are deleted.
  if (state.augments.some(augment => augment.definitionId === 'blood-brothers'
    && state.roundResults.some(result => result.roundKind !== 'supply' && result.round >= augment.acquiredRound))) return true;
  // Spoils has a continuous kill ordinal: old rounds must be replay-authenticated even
  // if their own table slot paid nothing (including a claimed zero/missing counter).
  const spoils=state.augments.filter(a=>a.definitionId.startsWith('spoils-of-war-'));
  if(!state.multiplayer&&readG23Progress(state)!.economyReceipts.some(r=>r.kind==='battle'
    &&spoils.some(a=>r.facts.round>=a.acquiredRound)
    &&!(r.facts.round===state.round&&state.combat?.status==='finished')))return true;
  if(!state.multiplayer&&state.augments.some(a=>(a.definitionId==='a-change-of-fate'||a.definitionId==='pilfer')&&state.roundResults.some(r=>r.round>=a.acquiredRound)))return true;
  return needsBatch4B4xpHistory(state) || readG23Progress(state)!.economyReceipts.some(action =>
    action.kind === 'battle' && (action.facts.crowns !== undefined || action.crownGold !== undefined || action.facts.d11Headhunter !== undefined || action.facts.family?.eligible===true || action.facts.melCasts!==undefined || action.facts.batch2?.some(fact => fact.definitionId === 'blood-brothers' || fact.definitionId === 'blood-brothers-deaths')));
}
export function missingCrownHistory(): never {
  throw new Error('Invalid Match save: missing historical evidence / 缺少冠冕、猎头者、家人、梅尔、扭转命运或战后备战席经验历史证据，请提供完整 battles 回放');
}

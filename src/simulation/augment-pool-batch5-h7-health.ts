import type { MatchState } from './match-types';
import type { OwnedAugment } from './strategy-types';
import type { CarouselParticipant } from './carousel-types';
import { AUGMENT_BATCH5_H7 } from './content/augment-pool-batch5-h7';
import { findAugmentFacts, historyCheck, recordAugmentPlayerHealth, requireAugmentFacts } from './augment-history';

const HEAL = AUGMENT_BATCH5_H7['titanic-titan'].source.values.Heal;
export const MAX_SUPPORTED_PLAYER_HP = 100 + HEAL;
/** Owned acquisitions are already authenticated by the choice/history validators. No mutable max-HP counter. */
export function maximumPlayerHp(augments: readonly OwnedAugment[], round = Number.MAX_SAFE_INTEGER): number {
  return 100 + (augments.some(a => a.definitionId === 'titanic-titan' && a.acquiredRound <= round) ? HEAL : 0);
}
export function acquireTitanicTitan(state: MatchState, a: OwnedAugment): MatchState {
  if (a.definitionId !== 'titanic-titan') return state;
  const receiptId = JSON.stringify(['augment-pool-batch5-h7', a.choiceId, 'health']);
  if (findAugmentFacts(state, 'player-health', a.acquiredRound).some(f => f.receiptId === receiptId)) return state;
  const acquisition = requireAugmentFacts(state, 'acquire', a.acquiredRound).find(f => f.choiceId === a.choiceId);
  historyCheck(acquisition && acquisition.hpBefore === state.playerHp, 'Titanic Titan acquisition HP');
  return recordAugmentPlayerHealth({ ...state, playerHp: state.playerHp + HEAL }, { kind: 'player-health',
    choiceId: a.choiceId, receiptId, hpBefore: state.playerHp, hpAfter: state.playerHp + HEAL,
    maxHpBefore: maximumPlayerHp(state.augments.filter(owner => owner.choiceId !== a.choiceId)), maxHpAfter: maximumPlayerHp(state.augments) });
}
/** The choice/health receipt is the sole persistent evidence for both HP and early carousel eligibility. */
export function titanicTitanChoiceId(state: MatchState): string | undefined {
  const a = state.augments.find(a => a.definitionId === 'titanic-titan');
  if (!a) return undefined;
  const facts = requireAugmentFacts(state, 'player-health', a.acquiredRound).filter(f => f.choiceId === a.choiceId);
  historyCheck(facts.length === 1 && facts[0].receiptId === JSON.stringify(['augment-pool-batch5-h7', a.choiceId, 'health']) &&
    facts[0].hpAfter === facts[0].hpBefore + HEAL && facts[0].maxHpBefore === 100 && facts[0].maxHpAfter === MAX_SUPPORTED_PLAYER_HP,
    'Titanic Titan health receipt');
  return a.choiceId;
}
export function titanicTitanRoundGain(state: MatchState, round: number): number {
  return state.augments.some(a => a.definitionId === 'titanic-titan' && a.acquiredRound === round) && titanicTitanChoiceId(state) ? HEAL : 0;
}
export function explainedTitanicTitanGain(before: MatchState, after: MatchState): number {
  const choice = titanicTitanChoiceId(after);
  return choice && !before.augments.some(a => a.choiceId === choice) ? HEAL : 0;
}
/** P-B5-44: move one existing release batch earlier, clamped at the first batch. No movement simulation. */
export function h7CarouselRelease(participants: readonly CarouselParticipant[], first: number, interval: number) {
  const ordered = [...participants].sort((a,b) => a.hp-b.hp || a.seatIndex-b.seatIndex);
  const releaseAtMs = Object.fromEntries(ordered.map((p,i) => [p.seatId, first + Math.max(0, Math.floor(i/2) - (p.titanicTitanChoiceId ? 1 : 0)) * interval]));
  const releaseOrder = [...ordered].sort((a,b) => releaseAtMs[a.seatId]-releaseAtMs[b.seatId] || ordered.indexOf(a)-ordered.indexOf(b)).map(p=>p.seatId);
  return { releaseAtMs, releaseOrder };
}
export function h7CarouselParticipantValid(p: CarouselParticipant): boolean {
  return (p.titanicTitanChoiceId === undefined || typeof p.titanicTitanChoiceId === 'string' && /^round:(2-1|3-2):augment$/.test(p.titanicTitanChoiceId)) &&
    p.hp <= (p.titanicTitanChoiceId ? MAX_SUPPORTED_PLAYER_HP : 100);
}

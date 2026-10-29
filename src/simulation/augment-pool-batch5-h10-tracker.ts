import { appendAugmentFact, historyRoster, historyCheck } from './augment-history';
import { AUGMENT_BATCH5_H10 } from './content/augment-pool-batch5-h10';
import { EMBLEM_ITEMS } from './content/emblems';
import { TRAIT_DEFINITIONS } from './content/traits';
import { DEFAULT_BOARD } from './board';
import { deriveTraits } from './trait-snapshot';
import { nextRandom } from './rng';
import { AUGMENT_GIFT_SOURCE, planAugmentGifts } from './augment-gift-plan';
import { grantMechanicItem } from './seat-mechanics/grants';
import type { HistoryRoster } from './augment-history-types';
import type { MatchState, MatchEvent } from './match-types';

/** A multi-threshold trait such as Emissary is non-unique even though its first threshold is one. */
export function trackerActiveTraits(roster: HistoryRoster): readonly string[] {
  return deriveTraits({ board: DEFAULT_BOARD, benchSize: 9, units: roster.units }, 'player', TRAIT_DEFINITIONS, undefined, roster.items)
    .filter(t => t.tier > 0 && TRAIT_DEFINITIONS[t.traitId].tiers.some(tier => tier.threshold > 1)).map(t => t.traitId);
}
/** P-B5-61: sorted 22-emblem pool, equal draws without replacement, independent seat/choice stream.
 * Existing holdings are deliberately not filtered. Neither retry nor validation advances Match RNG. */
function trackerEmblems(state: MatchState, choiceId: string): readonly string[] {
  const pool = Object.keys(EMBLEM_ITEMS).sort();
  const namespace = JSON.stringify(['batch5-h10-tracker', state.multiplayer?.seatId ?? 'solo', choiceId]);
  let hash = 0x811c9dc5;
  for (let i = 0; i < namespace.length; i++) hash = Math.imul(hash ^ namespace.charCodeAt(i), 0x01000193) >>> 0;
  let rng = (state.seed ^ hash) >>> 0;
  const count = AUGMENT_BATCH5_H10['trait-tracker'].source.values.NumEmblems;
  for (let i = 0; i < count; i++) {
    const draw = nextRandom(rng); rng = draw.state;
    const j = i + Math.floor(draw.word * (pool.length - i) / 4294967296);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}
export function trackerGiftPlan(state: MatchState) {
  const owner = state.augments.find(a => a.definitionId === 'trait-tracker');
  if (!owner) return [];
  historyCheck(state.augmentHistory, 'missing trait tracker history');
  const rows = state.augmentHistory.facts.filter(f => f.kind === 'trait-activation' && f.choiceId === owner.choiceId);
  historyCheck(rows.length <= 1, 'duplicate trait activation');
  const fact = rows[0];
  if (!fact || fact.kind !== 'trait-activation') return [];
  historyCheck(fact.round >= owner.acquiredRound && trackerActiveTraits(fact.roster).length >= AUGMENT_BATCH5_H10['trait-tracker'].source.values.NumTraits, 'trait activation threshold');
  return planAugmentGifts(state, { ...owner, choiceId: JSON.stringify([owner.choiceId, 'trait-tracker']), acquiredRound: fact.round },
    trackerEmblems(state, owner.choiceId).map(definitionId => ({ kind: 'item', definitionId })));
}
/** Called only for the outer successful Match command. Deadline auto-deployment / combat work is not a preparation command. */
export function completeTraitTrackerCommand(name: string, state: MatchState): { state: MatchState; events: readonly MatchEvent[] } {
  const owner = state.augments.find(a => a.definitionId === 'trait-tracker');
  const preparation = state.phase === 'preparation' || state.phase === 'choice' && state.pendingChoice?.returnPhase === 'preparation';
  if (!owner || !preparation || state.multiplayer?.combatRosterLocked ||
    ['nextRound', 'advanceMultiplayerRound', 'autoDeployToCap', 'lockMatchCombatRoster', 'startMatchCombat', 'openMatchCombatStream', 'stepMatchCombatStream', 'revealMatchCombatStreamTerminal', 'settleMatchCombatStream', 'stepMatch', 'advanceAugmentPreparationTime'].includes(name)) return { state, events: [] };
  historyCheck(state.augmentHistory, 'missing trait tracker history');
  if (state.augmentHistory.facts.some(f => f.kind === 'trait-activation' && f.choiceId === owner.choiceId)) return { state, events: [] };
  const roster = historyRoster(state);
  if (trackerActiveTraits(roster).length < AUGMENT_BATCH5_H10['trait-tracker'].source.values.NumTraits) return { state, events: [] };
  let next = appendAugmentFact(state, { kind: 'trait-activation', choiceId: owner.choiceId, roster });
  const events: MatchEvent[] = [];
  for (const gift of trackerGiftPlan(next)) {
    const result = grantMechanicItem(next, { ...gift, source: AUGMENT_GIFT_SOURCE });
    historyCheck(result.ok, 'trait tracker grant'); next = result.state;
    let seq = next.nextMatchEventSeq;
    for (const event of result.events) events.push({ ...event, domain: 'match', eventSeq: seq++ } as MatchEvent);
    next = { ...next, nextMatchEventSeq: seq };
  }
  return { state: next, events };
}

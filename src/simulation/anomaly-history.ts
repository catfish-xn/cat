import type { MatchState } from './match-types';
import type { AugmentHistory, HistoryCommand } from './augment-history-types';
import { AUGMENT_HISTORY_LIMITS as LIMIT } from './augment-history-types';
import { freezeContent } from './content/freeze';

/** Quote evidence ends at confirmation/forfeit. It never enables combat/augment journaling. */
export interface AnomalyOfferHistory {
  readonly version: 'anomaly-offer-history-v1';
  readonly facts: readonly {
    readonly kind: 'anomaly-offer'; readonly choiceId: string; readonly definitionId: string;
    readonly sequence: number; readonly seatId: string; readonly round: number;
    readonly roundId: string; readonly resourcePrefix: number;
  }[];
  readonly proof: AugmentHistory['proof'] | {readonly kind:'augment-history'};
}
export function appendAnomalyOffer(state: MatchState): MatchState {
  const old = state.anomalyOfferHistory;
  const facts = old?.facts ?? [];
  if (facts.length >= LIMIT.facts) throw new RangeError('Invalid anomaly history: fact bounds');
  const choice = state.pendingChoice!;
  return { ...state, anomalyOfferHistory: {
    version: 'anomaly-offer-history-v1', proof: old?.proof ?? {kind:'server'},
    facts: [...facts, {kind:'anomaly-offer',choiceId:choice.choiceId,definitionId:choice.offers[0],
      sequence:facts.length,seatId:state.multiplayer?.seatId ?? 'solo',round:state.round,
      roundId:state.roundDefinitionId,resourcePrefix:state.resourceProvenance.entries.length}],
  } };
}
export function traceAnomalyCommand(before: MatchState, after: MatchState, name: string, args: readonly unknown[]): MatchState {
  if (!after.anomalyOfferHistory || before.multiplayer || before.openingEncounter.mode === 'shared-deferred') return after;
  // An existing full-state augment proof already replays these commands and quote facts.
  if (before.augmentHistory) return {...after,anomalyOfferHistory:{...after.anomalyOfferHistory,proof:{kind:'augment-history'}}};
  // Once the choice is resolved, the proof is immutable. Later play is authenticated by its own ledgers.
  if (before.anomalyOfferHistory && before.pendingChoice?.kind !== 'anomaly') return after;
  const old = before.anomalyOfferHistory?.proof;
  const origin = old?.kind === 'solo' ? old.origin : freezeContent(structuredClone(before));
  const commands: readonly HistoryCommand[] = [...(old?.kind === 'solo' ? old.commands : []),
    {name,args:structuredClone(args.map(a => a === undefined ? null : a)),count:1}];
  if (commands.length > LIMIT.commands) throw new RangeError('Invalid anomaly history: command bounds');
  return { ...after, anomalyOfferHistory: {...after.anomalyOfferHistory,proof:{kind:'solo',origin,commands}} };
}

import type { MatchState } from './match-types';
import type { Unit } from './unit-types';
import { UNIT_DEFINITIONS } from './units';
import { isAnvil } from './content/anvils';
import { anomalyCandidates, ANOMALY_OFFER_POLICY } from './content/anomalies';
import { eligibleD14Target } from './d14-runtime';
import { r2AnomalyAllowed } from './augment-pool-batch5-r2-anomaly';
import { nextRandom } from './rng';
import { appendAnomalyOffer } from './anomaly-history';

export type AnomalyTargetPurpose = 'manual' | 'timeout';
/** One qualification boundary for commands, automatic resolution and owner projection.
 * Permanent golems/dummies keep their existing manual policy pending stronger evidence.
 * The 14.24 timeout fix excludes every catalog summon, including a manually locked one. */
export function isEligibleAnomalyTarget(state: MatchState, unit: Unit | undefined,
  offers: readonly string[] = [], purpose: AnomalyTargetPurpose = 'manual'): boolean {
  if (!unit || unit.team !== 'player' || !UNIT_DEFINITIONS[unit.definitionId]
    || isAnvil(unit.definitionId) || state.anomalyBinding !== null || state.anomalySelection !== null
    || state.carousel?.receipts.some(r => r.unitId === unit.id && !state.carousel!.preparationReceipts.includes(r.id))) return false;
  if (purpose === 'timeout' && UNIT_DEFINITIONS[unit.definitionId].summon) return false;
  return offers.every(id => r2AnomalyAllowed(state.augments, id) && eligibleD14Target(unit, id));
}

/** Legal target submissions now, in roster order; never a replacement-target permission. */
export function readAnomalyTargetIds(state: MatchState): readonly string[] {
  const c = state.pendingChoice;
  if (state.phase !== 'choice' || c?.kind !== 'anomaly' || c.step !== 'target'
    || state.multiplayer?.status === 'eliminated' || state.multiplayer?.combatRosterLocked) return [];
  return state.preparation.units.filter(u => isEligibleAnomalyTarget(state, u, c.offers)).map(u => u.id);
}

export function readAnomalyOfferHistory(state: MatchState): readonly string[] {
  return (state.anomalyOfferHistory?.facts ?? []).flatMap(f => f.kind === 'anomaly-offer' ? [f.definitionId] : []);
}

/** First free quote counts toward twelve. After that only the immediately prior quote is blocked. */
export function drawAnomalyOffer(state: MatchState, target: Unit) {
  const seen = readAnomalyOfferHistory(state);
  const excluded = seen.length < ANOMALY_OFFER_POLICY.initialUniqueOffers ? seen : seen.slice(-1);
  const pool = anomalyCandidates(!!state.multiplayer).filter(id => r2AnomalyAllowed(state.augments, id)
    && eligibleD14Target(target, id) && !excluded.includes(id)).sort();
  if (!pool.length) throw new RangeError('Empty anomaly offer pool');
  const draw = nextRandom(state.choiceRngState);
  return { offers: [pool[Math.floor(draw.word * pool.length / 0x100000000)]], choiceRngState: draw.state };
}

export function recordAnomalyOffer(_before: MatchState, after: MatchState): MatchState {
  return appendAnomalyOffer(after);
}

import type { MatchState } from '../match-types';
import { ANOMALY_DEFINITIONS } from '../content/anomalies';
import { readAnomalyOfferHistory, isEligibleAnomalyTarget } from '../anomaly-choice';
import { nextRandom } from '../rng';

/** Structural/stream checks precede full solo command replay or independent server authority.
 * Never accept a candidate's history as its own proof of the draws. */
export function validateAnomalyOfferHistory(state: MatchState, initialRng: number): void {
  const check = (ok: unknown) => { if (!ok) throw new RangeError('Invalid anomaly offer history'); };
  const rows = state.anomalyOfferHistory?.facts.filter(f => f.kind === 'anomaly-offer') ?? [];
  const seen = readAnomalyOfferHistory(state);
  let rng = initialRng;
  for (const [i, row] of rows.entries()) {
    check(row.choiceId === 'round:4-6:anomaly' && row.roundId === '4-6'
      && Object.hasOwn(ANOMALY_DEFINITIONS, row.definitionId));
    check(i < 12 ? !seen.slice(0, i).includes(row.definitionId) : seen[i - 1] !== row.definitionId);
    rng = nextRandom(rng).state;
  }
  check(state.choiceRngState === rng);
  const c = state.pendingChoice?.kind === 'anomaly' ? state.pendingChoice : null;
  const receipt = state.scheduleReceipts.find(r => r.kind === 'anomaly');
  if (c) {
    check(seen.length === (c.offers.length ? c.rerollCount + 1 : 0));
    check(!c.offers.length || c.offers.length === 1 && c.offers[0] === seen.at(-1));
    // R1 permits benching a locked D14 target. Keep its identity/quote (R2);
    // reroll/confirm require full offer eligibility again. Replay authenticates the move.
    if (c.step === 'offer') check(isEligibleAnomalyTarget(state,
      state.preparation.units.find(u => u.id === c.targetId)));
  }
  if (receipt) check(seen.length > 0 && receipt.definitionId === seen.at(-1));
  if (seen.length) check(c || receipt || state.multiplayer?.forfeitedChoices.includes('round:4-6:anomaly'));
}

import type { MatchState, MatchEvent } from './match-types';
import { findAugmentFacts, historySeatId, requireAugmentFacts } from './augment-history';
import { AUGMENT_BATCH5_H7 } from './content/augment-pool-batch5-h7';
import { nextRandom } from './rng';
import { grantMechanicGold } from './seat-mechanics/grants';

export const BATCH5_H7_SOURCE = 'augment-pool-batch5-h7';
/** Independent explicit lcg32-v1 draw per death identity; never perturbs combat/shop/offer RNG. */
function deathWins(seed: number, seat: string, choice: string, battle: string, event: number): boolean {
  let hash = 2166136261;
  const identity = JSON.stringify([BATCH5_H7_SOURCE, seat, choice, battle, event]);
  for (let i = 0; i < identity.length; i++) hash = Math.imul(hash ^ identity.charCodeAt(i), 16777619) >>> 0;
  return nextRandom((seed ^ hash) >>> 0).word < AUGMENT_BATCH5_H7['good-for-something'].source.values.DropChance * 0x100000000;
}
export function batch5H7GoldPlan(state: MatchState) {
  const plan: { receiptId: string; source: string; round: number; amount: number }[] = [];
  for (const a of state.augments) {
    if (a.definitionId === 'lunch-money') {
      const { Damage, Gold } = AUGMENT_BATCH5_H7['lunch-money'].source.values;
      let total = 0;
      for (const result of state.roundResults.filter(r => r.round >= a.acquiredRound && r.roundKind === 'pvp')) {
        const facts = requireAugmentFacts(state, 'player-damage', result.round);
        const seen = new Set<string>();
        for (const f of facts) {
          if (seen.has(f.battleId)) continue;
          seen.add(f.battleId);
          // Solo generated opponents have no player HP account. Unknown is NOT a damage value.
          if (f.mirror || f.opponentSeatId === null || f.actualDamage === null) continue;
          const before = total;
          total += f.actualDamage;
          const amount = (Math.floor(total / Damage) - Math.floor(before / Damage)) * Gold;
          if (amount) plan.push({ receiptId: JSON.stringify([BATCH5_H7_SOURCE, a.choiceId, f.battleId]),
            source: BATCH5_H7_SOURCE, round: result.round, amount });
        }
      }
      continue;
    }
    if (a.definitionId !== 'good-for-something') continue;
    for (let round = a.acquiredRound; round <= state.round; round++) {
      // No battle yet is different from a complete battle with no deaths. Completed battles require evidence.
      if (!state.roundResults.some(r => r.round === round && r.roundKind !== 'supply') &&
        !findAugmentFacts(state, 'deaths', round).length) continue;
      const seen = new Set<string>();
      for (const f of requireAugmentFacts(state, 'deaths', round)) for (const d of f.deaths) {
        const key = JSON.stringify([d.combatId, d.eventSeq]);
        if (seen.has(key)) continue;
        seen.add(key);
        if (d.ownerSeatId !== historySeatId(state) || !d.ordinaryHero || d.equipment.length || d.combatItemGrants.length) continue;
        if (deathWins(state.seed, historySeatId(state), a.choiceId, d.combatId, d.eventSeq)) plan.push({
          receiptId: JSON.stringify([BATCH5_H7_SOURCE, a.choiceId, d.combatId, d.eventSeq]), source: BATCH5_H7_SOURCE,
          round, amount: AUGMENT_BATCH5_H7['good-for-something'].source.values.Gold,
        });
      }
    }
  }
  return plan;
}
/** Called after executed history is published by a Match command or the room's two-sided settlement. */
export function drainBatch5H7Gold(initial: MatchState): { state: MatchState; events: readonly MatchEvent[] } {
  let state = initial; const events: MatchEvent[] = [];
  for (const p of batch5H7GoldPlan(state)) {
    if (state.seatMechanics?.receipts.some(r => r.receiptId === p.receiptId)) continue;
    if (p.round !== state.round) throw new RangeError('Missing batch5 h7 historical gold receipt');
    const grant = grantMechanicGold(state, p);
    if (!grant.ok) throw new RangeError(grant.reason);
    events.push({ type: 'mechanicGranted', receipt: grant.receipt, domain: 'match', eventSeq: grant.state.nextMatchEventSeq });
    state = { ...grant.state, nextMatchEventSeq: grant.state.nextMatchEventSeq + 1 };
  }
  return { state, events };
}


import { applyRoundSettlement, ROUND_SETTLEMENT_VERSION, type RoundSettlementReceipt } from '../../src/server-entry';
import type { BattleResolver } from '../../src/server/room/battle-resolver';
import { TwoSidedBattleResolver, resolveTwoSidedPvp } from '../../src/server/room/two-sided-resolver';
import type { BattleSeatOutcome } from '../../src/server/room/types';

/**
 * pvpMode=placeholder over a whole match: PvE/supply through the real rules (pool wrapper), PvP fought once by the T2 entry and
 * each real participant settled by the T3 receipt here, then reported as a B1-shaped per-seat outcome the room checks itself.
 */
export const placeholderPvp: BattleResolver = (() => {
  const twoSided = new TwoSidedBattleResolver();
  return { resolveBattle(input, pool) {
    if (input.roundKind !== 'pvp') return twoSided.resolveBattle(input, pool);
    const fought = resolveTwoSidedPvp(input);
    const outcomes: BattleSeatOutcome[] = input.seats.map(seat => {
      const proposal = [fought.proposals.a, fought.proposals.b].find(candidate => candidate.seatId === seat.seatId)!;
      const receipt: RoundSettlementReceipt = {
        version: ROUND_SETTLEMENT_VERSION, settlementId: JSON.stringify([input.roomId, input.round, seat.seatId]), battleId: input.battleId, seatId: seat.seatId,
        round: input.round, roundId: input.roundId, settlementEligible: proposal.settlementEligible, result: proposal.result, damage: proposal.damage,
        baseDamage: proposal.baseDamage, opposingSurvivors: proposal.opposingSurvivors, growth: proposal.growth,
        combatTicks: fought.battle.terminal.tick, combatEventCount: fought.battle.events.length,
      };
      const applied = applyRoundSettlement(seat.state, receipt);
      if (!applied.ok) throw new Error(`seat ${seat.seatId}: ${applied.reason}`);
      return { seatId: seat.seatId, state: applied.state, result: null, damage: proposal.damage, combat: fought.battle };
    });
    return { kind: 'placeholder', battleId: input.battleId, round: input.round, roomRevision: input.roomRevision, outcomes };
  } };
})();


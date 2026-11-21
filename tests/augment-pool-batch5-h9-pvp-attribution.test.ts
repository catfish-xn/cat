import { describe, expect, it } from 'vitest';
import { createMatch } from '../src/simulation/match';
import type { MatchState } from '../src/simulation/match-types';
import type { AugmentDeath, AugmentHistoryFact } from '../src/simulation/augment-history-types';
import { goldenFindGoldPlan, GOLDEN_FIND_SOURCE } from '../src/simulation/augment-pool-batch5-h9';
import { ROUND_SETTLEMENT_VERSION } from '../src/simulation/round-settlement';

const seatId = 's3', round = 23, battleId = 'room-pvp-23';
const base = createMatch(42);
const holder = base.preparation.units.find(u => u.team === 'player' && u.location.kind === 'board')!;
const t2Id = JSON.stringify(['t2', seatId, 'unit', holder.id]);

/** Minimal complete history for the plan consumer, independent of combat RNG and room offers. */
function pvpState(ownCombat: boolean, killerId: string): MatchState {
  const common = { round, roundId: '4-6', seatId, sequence: 0, resourcePrefix: 0 };
  const roster = { units: base.preparation.units, items: base.items };
  // The fixed 14.24b rule pays 2G per 3 kills. All three victims are generated enemies
  // without a player HP account (ownerSeatId=null), as on the production placeholder path.
  const deaths: AugmentDeath[] = Array.from({ length: 3 }, (_, i) => ({
    combatId: 'executed-combat', eventSeq: i, tick: 1, unitId: `enemy-${i}`, originalUnitId: `enemy-${i}`,
    definitionId: 'garen', team: 'enemy', ownerSeatId: null, ordinaryHero: true, equipment: [], combatItemGrants: [],
    killer: { ownerId: killerId, sourceKind: 'attack', definitionId: holder.definitionId, instanceId: 'basic', effectIndex: 0 },
  }));
  const facts: AugmentHistoryFact[] = [
    { ...common, kind: 'combat-binding', battleId, binding: { unitId: holder.id, choiceId: 'anomaly', definitionId: 'power-up', boundRound: round } },
    { ...common, kind: 'pvp-roster', battleId, seats: [{ ...roster, seatId, index: 3, hp: 100, alive: true, rank: 1, eliminatedRound: null }], mirrorOfSeatId: null },
    ...(ownCombat ? [{ ...common, kind: 'combat-roster' as const, battleId, roster }] : []),
    { ...common, kind: 'deaths', battleId, completeThroughTick: 1, deaths },
  ];
  return {
    ...base, round, roundDefinitionId: '4-6', augments: [{ definitionId: 'a-golden-find', choiceId: 'golden', acquiredRound: 19 }],
    multiplayer: { version: ROUND_SETTLEMENT_VERSION, seatId, status: 'active', receipts: [], forfeitedChoices: [] },
    roundResults: [{
      round, roundId: '4-6', result: 'playerWin', roundKind: 'pvp', combatTicks: 1, combatEventCount: 3, settlementId: 'settlement',
      incomeBreakdown: { base: 0, win: 0, interest: 0, streak: 0 }, interestBasis: 0, streakBefore: base.streak, streakAfter: base.streak,
      xpRequested: 0, income: 0, goldBefore: base.gold, goldAfter: base.gold, xpAwarded: 0, levelBefore: base.level, levelAfter: base.level,
      xpBefore: base.xp, xpAfter: base.xp, hpBefore: 100, hpAfter: 100, baseDamage: 0, survivingEnemyCount: 0, playerDamage: 0, hpLost: 0,
    }],
    augmentHistory: { version: 'augment-history-v1', seatId, proof: { kind: 'server' }, facts },
  };
}

const payout = [{ receiptId: JSON.stringify([GOLDEN_FIND_SOURCE, 'golden', round]), source: GOLDEN_FIND_SOURCE, round, amount: 2 }];

describe('Golden Find multiplayer PvP killer identity', () => {
  it('pays for the original bound unit killing three unowned enemies when combat-roster records its own combat', () => {
    expect(goldenFindGoldPlan(pvpState(true, holder.id))).toEqual(payout);
  });
  it('does not credit a T2 killer ID in an own-combat history', () => {
    expect(goldenFindGoldPlan(pvpState(true, t2Id))).toEqual([]);
  });
  it('credits the T2 killer ID in the same PvP history without combat-roster (two-sided combat)', () => {
    expect(goldenFindGoldPlan(pvpState(false, t2Id))).toEqual(payout);
  });
  it('does not credit the original killer ID without combat-roster (two-sided combat)', () => {
    expect(goldenFindGoldPlan(pvpState(false, holder.id))).toEqual([]);
  });
});

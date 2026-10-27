import { describe, expect, it } from 'vitest';
import { createMatch } from '../src/simulation/match';
import { drainBatch1Gifts } from '../src/simulation/augment-pool-grants';
import { prepareMatchLoot } from '../src/simulation/loot-runtime';
import { getMultiplayerRoundById } from '../src/simulation/multiplayer-round';
import { readG23Progress } from '../src/simulation/g2-3-state';
import type { CombatState } from '../src/simulation/combat-types';
import type { MatchEvent, MatchState } from '../src/simulation/match-types';
import type { MechanicReceipt } from '../src/simulation/seat-mechanics/types';
import type { G23BattleFacts } from '../src/simulation/g2-3-economy';
import { Ledger, CATALOG, COST, ROUNDS, xp, entryXp, benchXp, settlement } from './fixtures/m5/oracle.g2.cjs';
import { lootExplosionPlan, validateRewards } from './fixtures/m5/augment-rewards-oracle.cjs';

const SOURCE = 'augment-pool-batch5-g7', CHOICE = 'round:2-1:augment', BATTLE = 'oracle-vector';
const env = { CATALOG, COST, ROUNDS, xp, entryXp, benchXp };
type Drop = { eventSeq: number; rewards: readonly ({ kind: 'gold'; amount: number } | { kind: 'item'; definitionId: string })[] };

// Hand-written settlement/grant vectors, not purported played or restorable matches.
// Only boilerplate loot freezing and the already-paid acquisition gifts use production.
// All death observations and expected combat drops below are literal independent vectors.
function vector(roundId: string, drops: readonly Drop[]) {
  const base = createMatch(29), round = getMultiplayerRoundById(roundId);
  let before = drainBatch1Gifts({ ...base, round: round.ordinal, roundDefinitionId: roundId,
    m8: { ...base.m8, round, loot: prepareMatchLoot(base.seed, round.ordinal, base.m8.loot) },
    augments: [{ definitionId: 'loot-explosion', choiceId: CHOICE, acquiredRound: 4 }] });
  const players = before.preparation.units.filter(u => u.team === 'player').map((u, i) => ({ ...u, location: { kind: 'board' as const, cell: { col: i, row: 4 } } }));
  const victims = drops.map((d, i) => ({ ...players[0], id: `victim-${d.eventSeq}`, definitionId: 'maddie', team: 'enemy' as const, location: { kind: 'board' as const, cell: { col: i, row: 0 } } }));
  const combat = { combatId: BATTLE, tick: 10, nextEventSeq: Math.max(...drops.map(d => d.eventSeq)) + 2, status: 'finished', result: 'playerWin',
    units: [...players.map(u => ({ ...u, alive: true })), ...victims.map(u => ({ ...u, alive: false }))],
    openingDeaths: drops.map(d => ({ unitId: `victim-${d.eventSeq}`, eventSeq: d.eventSeq })) } as unknown as CombatState;
  before = { ...before, phase: 'combat', preparation: { ...before.preparation, units: [...players, ...victims] }, combat: { ...combat, tick: 0, status: 'running', result: null } } as MatchState;
  const result = settlement(before, combat, 0);
  const facts: G23BattleFacts = { battleId: BATTLE, round: round.ordinal, roundKind: 'pvp', result: 'win', conquerorTier: 0, conquestTakedowns: [], chemBaronTier: 0,
    alliedDeaths: 0, rumbleStar: 0, highRollerGold: 0, batch3DamageDealt: (round.stage === 2 ? 2 : 10) + players.length,
    openingDeaths: drops.map(d => ({ victimId: `victim-${d.eventSeq}`, eventSeq: d.eventSeq })) };
  const progress = readG23Progress(before)!;
  let after: MatchState = { ...before, phase: 'settlement', combat: { ...combat, status: 'finished', result: 'playerWin' },
    gold: result.incomeBreakdown.win, level: result.levelAfter, xp: result.xpAfter, streak: result.streakAfter, roundResults: [result],
    augmentHistory: { version: 'augment-history-v1', seatId: 'solo', proof: { kind: 'server' }, facts: [{ kind: 'deaths', sequence: 0, seatId: 'solo', round: round.ordinal, roundId,
      resourcePrefix: before.resourceProvenance.entries.length, battleId: BATTLE, completeThroughTick: 10,
      deaths: drops.map(d => ({ combatId: BATTLE, eventSeq: d.eventSeq, tick: 10, unitId: `victim-${d.eventSeq}`, originalUnitId: `victim-${d.eventSeq}`, definitionId: 'maddie',
        team: 'enemy', ordinaryHero: true, ownerSeatId: 'opponent', equipment: [], combatItemGrants: [],
        lootExplosion: { killerSeatId: 'solo', killerUnitId: players[0].id, originalKillerUnitId: players[0].id, critChanceBps: 10000 } })) }] },
    seatMechanics: { ...before.seatMechanics!, hidden: { ...before.seatMechanics!.hidden, progress: { ...progress,
      economyReceipts: [...progress.economyReceipts, { kind: 'battle', facts, gold: 0, bundles: [] }] } } } };
  const receipts: MechanicReceipt[] = [];
  for (const d of drops) for (const [index, reward] of d.rewards.entries()) {
    const identity = { receiptId: JSON.stringify([SOURCE, 'solo', CHOICE, round.ordinal, BATTLE, d.eventSeq, index]), source: SOURCE, round: round.ordinal, roundId };
    if (reward.kind === 'gold') {
      receipts.push({ ...identity, ...reward }); after = { ...after, gold: after.gold + reward.amount };
    } else {
      const itemId: string = `item-${after.nextItemSerial}`;
      receipts.push({ ...identity, ...reward, itemId });
      after = { ...after, nextItemSerial: after.nextItemSerial + 1, items: [...after.items, { id: itemId, definitionId: reward.definitionId, location: { kind: 'inventory' } }],
        resourceProvenance: { ...after.resourceProvenance, entries: [...after.resourceProvenance.entries, { kind: 'item-acquired', sequence: after.resourceProvenance.entries.length, roundId, itemId, source: { kind: 'mechanic', receiptId: identity.receiptId } }] } };
    }
  }
  after = { ...after, seatMechanics: { ...after.seatMechanics!, receipts: [...after.seatMechanics!.receipts, ...receipts] }, nextMatchEventSeq: before.nextMatchEventSeq + receipts.length };
  const events: MatchEvent[] = [{ type: 'combatFinished', combatId: BATTLE, tick: 10, eventSeq: combat.nextEventSeq! - 1, result: 'playerWin', reason: 'elimination', domain: 'combat' },
    ...receipts.map((receipt, i) => ({ type: 'mechanicGranted' as const, receipt, domain: 'match' as const, eventSeq: before.nextMatchEventSeq + i }))];
  return { before, after, events, receipts };
}

const cases: { name: string; roundId: string; drops: Drop[] }[] = [
  { name: 'two gold', roundId: '2-1', drops: [{ eventSeq: 0, rewards: [{ kind: 'gold', amount: 2 }] }] },
  { name: 'one component', roundId: '5-1', drops: [{ eventSeq: 0, rewards: [{ kind: 'item', definitionId: 'gloves' }] }] },
  { name: 'two components', roundId: '5-1', drops: [{ eventSeq: 2, rewards: [{ kind: 'item', definitionId: 'gloves' }, { kind: 'item', definitionId: 'cloak' }] }] },
  { name: 'one completed item', roundId: '5-1', drops: [{ eventSeq: 22, rewards: [{ kind: 'item', definitionId: 'giant-slayer' }] }] },
  { name: 'gold and equipment together', roundId: '5-1', drops: [{ eventSeq: 0, rewards: [{ kind: 'item', definitionId: 'gloves' }] }, { eventSeq: 3, rewards: [{ kind: 'gold', amount: 3 }] }] },
];
for (const { name, roundId, drops } of cases) describe(`generic Loot Explosion oracle: ${name}`, () => {
  it('accepts the literal due rewards through validateRewards and the full conservation Ledger', () => {
    const { before, after, events, receipts } = vector(roundId, drops);
    const expected = lootExplosionPlan(after);
    expect(receipts.map(r => r.receiptId).sort()).toEqual([...expected.gold, ...expected.gifts].map(r => r.receiptId).sort());
    const plan = validateRewards(before, after, null, events, env);
    expect([...plan.gold.values()].reduce((n, g) => n + g.amount, 0)).toBe(drops.flatMap(d => d.rewards).reduce((n, r) => n + (r.kind === 'gold' ? r.amount : 0), 0));
    expect([...plan.gifts.values()].filter(g => g.source === SOURCE).map(g => g.definitionId)).toEqual(drops.flatMap(d => d.rewards).filter(r => r.kind === 'item').map(r => r.definitionId));
    expect(() => new Ledger(before).apply(before, after, null, events)).not.toThrow();
  });
  it('rejects missing, duplicate, forged-value, wrong-kind and wrong-identity receipts through both entries', () => {
    const { before, after, events, receipts } = vector(roundId, drops), first = receipts[0];
    const changed = first.kind === 'gold' ? { ...first, amount: first.amount + 123 } : { ...first, definitionId: 'spatula' };
    const wrongKind = first.kind === 'gold' ? { ...first, kind: 'item', definitionId: 'rod', itemId: 'item-999' } : { ...first, kind: 'gold', amount: 123 };
    for (const values of [receipts.slice(1), [...receipts, first], [changed, ...receipts.slice(1)], [wrongKind, ...receipts.slice(1)],
      [{ ...first, round: first.round + 1 }, ...receipts.slice(1)], [{ ...first, receiptId: 'invented' }, ...receipts.slice(1)]]) {
      const bad = { ...after, seatMechanics: { ...after.seatMechanics!, receipts: [...before.seatMechanics!.receipts, ...values] } } as MatchState;
      expect(() => validateRewards(before, bad, null, events, env)).toThrow();
      expect(() => new Ledger(before).apply(before, bad, null, events)).toThrow();
    }
    const forged = { ...after, gold: after.gold + 123 };
    expect(() => new Ledger(before).apply(before, forged, null, events)).toThrow(/independent gold ledger/);
    if (receipts.some(r => r.kind === 'item')) {
      const missingInventory = { ...after, items: before.items };
      expect(() => new Ledger(before).apply(before, missingInventory, null, events)).toThrow(/mechanic item exists/);
    }
  });
});

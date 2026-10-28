import { beforeAll, describe, expect, it } from 'vitest';
import { onlineOffer, chooseInPool, selfTable } from './augment-pool-batch5-r1-helpers';
import { augmentCandidates } from '../src/simulation/augment-offers';
import { AUGMENT_DEFINITIONS } from '../src/simulation/content/augments';
import { captureAugmentHistoryAuthority, prepareAugmentAcquisition, recordAugmentTable } from '../src/simulation/augment-history';
import { recordTombRaiderEliminations, tombRaiderOpportunities, TOMB_RAIDER_SOURCE } from '../src/simulation/augment-pool-batch5-r1';
import { canonicalContent } from '../src/simulation/content';
import { restoreSharedOrbSnapshot, runSharedMatchCommand, nextSharedRound, assertSharedPoolConservation } from '../src/simulation/shared-pool';
import { resolveRoundEconomy } from '../src/simulation/round-economy';
import { ROUND_SETTLEMENT_VERSION } from '../src/simulation/round-settlement';
import type { HistorySeat } from '../src/simulation/augment-history-types';
import type { MatchState } from '../src/simulation/match-types';
import type { SharedPoolState } from '../src/simulation/shared-pool-types';
import { augmentPool, tombRaiderPlan, validateTombRaiderTransition } from './fixtures/m5/oracle.g2.cjs';

describe('B5-40 online commands and authenticated saves', () => {
  let pool: SharedPoolState, state: MatchState, table: readonly HistorySeat[], acquired: string;
  const eliminated = new Set<string>();
  // This seed yields the prismatic card in the real 4-2 offer.
  beforeAll(() => { ({ pool, state } = onlineOffer(66)); });
  function roundTrip() {
    const authority = captureAugmentHistoryAuthority(state);
    for (const input of [state, JSON.stringify(state), canonicalContent(state)])
      expect(restoreSharedOrbSnapshot(pool, input, authority)).toEqual(state);
    expect(() => restoreSharedOrbSnapshot(pool, state)).toThrow('missing independent server authority');
  }
  function settle() {
    const plan = resolveRoundEconomy({ augments: state.augments, roundId: state.roundDefinitionId, result: 'playerWin', gold: state.gold,
      streak: state.streak, level: state.level, xp: state.xp, hp: state.playerHp, enemySurvivors: 0 });
    const result = runSharedMatchCommand(pool, state, { type: 'settleRound', receipt: { version: ROUND_SETTLEMENT_VERSION,
      settlementId: `tomb-II:${state.round}`, battleId: `tomb-II-battle:${state.round}`, seatId: 's0', round: state.round,
      roundId: state.roundDefinitionId, settlementEligible: true, result: 'win', damage: plan.playerDamage,
      baseDamage: plan.baseDamage, opposingSurvivors: 0, growth: [], combatTicks: 1, combatEventCount: 1 } });
    expect(result.ok).toBe(true); if (!result.ok) throw new Error(result.reason); state = result.state; pool = result.pool;
  }
  function publish(ids: readonly string[]) {
    for (const id of ids) eliminated.add(id);
    table = table.map(s => s.seatId === 's0' ? selfTable(state)[0] : eliminated.has(s.seatId)
      ? { ...s, alive: false, hp: 0, eliminatedRound: s.eliminatedRound ?? state.round } : s);
    state = recordTombRaiderEliminations(state, table).state;
  }
  function choose(timedOut = false) {
    const before = state, c = state.pendingChoice!;
    const command = timedOut ? { type: 'timeoutChoice' as const, round: state.round, choiceId: c.choiceId, generation: c.generation }
      : { type: 'choose' as const, choiceId: c.choiceId, generation: c.generation, definitionId: c.offers.at(-1)! };
    const result = runSharedMatchCommand(pool, state, command);
    expect(result.ok).toBe(true); if (!result.ok) throw new Error(result.reason); state = result.state; pool = result.pool;
    validateTombRaiderTransition(before, state, timedOut ? command : { ...command, type: 'select' }, result.events);
    expect(state.nextItemSerial).toBe(before.nextItemSerial + 1);
  }

  it('enables the prismatic 4-2 card, and both tiers exclude each other in production and the independent oracle', () => {
    expect(AUGMENT_DEFINITIONS['tomb-raider-2']).toBeDefined();
    for (const node of ['2-1', '3-2', '4-2']) {
      expect(augmentCandidates('prismatic', [], [], null, { node, fieldedTraits: [], blocked: [] }).includes('tomb-raider-2')).toBe(node === '4-2');
      expect(augmentPool('prismatic', [], [], `round:${node}:augment`).includes('tomb-raider-2')).toBe(node === '4-2');
    }
    for (const [owned, other, tier] of [['tomb-raider-1', 'tomb-raider-2', 'prismatic'], ['tomb-raider-2', 'tomb-raider-1', 'gold']] as const) {
      const augments = [{ definitionId: owned, acquiredRound: 18, choiceId: 'held' }];
      expect(augmentCandidates(tier, augments, [], null, { node: '4-2', fieldedTraits: [], blocked: [] })).not.toContain(other);
      expect(augmentPool(tier, augments, [], 'round:4-2:augment')).not.toContain(other);
    }
  });

  it('selects the real offer and records the already eliminated player without offering its item', () => {
    expect(state.pendingChoice?.offers).toContain('tomb-raider-2');
    table = [...selfTable(state), ...['old', 'empty', 'b', 'c', 'd', 'e', 'f'].map((id, n): HistorySeat => ({
      seatId: id, index: 7 - n, hp: id === 'old' ? 0 : 10, alive: id !== 'old', rank: 8 - n,
      eliminatedRound: id === 'old' ? state.round - 1 : null,
      units: [{ id: `hero-${id}`, definitionId: 'irelia', team: 'player', starLevel: 1,
        location: n % 2 ? { kind: 'bench', slot: 0 } : { kind: 'board', cell: { col: 0, row: 4 } } }],
      items: id === 'empty' ? [] : ['shojin', 'warmog', 'deathcap'].map((definitionId, slot) => ({
        id: `${id}-${slot}`, definitionId, location: { kind: 'unit', unitId: `hero-${id}`, slot } })),
    }))];
    prepareAugmentAcquisition(state, { status: 'none' }, 0, table); acquired = state.pendingChoice!.choiceId;
    const result = chooseInPool(pool, state, 'tomb-raider-2'); state = result.state; pool = result.pool;
    expect(tombRaiderOpportunities(state, acquired)).toEqual([]); roundTrip();
  });

  it('queues every later elimination, including the fourth player, in rank order', () => {
    settle(); publish(['empty', 'b', 'c', 'd']);
    expect(tombRaiderOpportunities(state, acquired).map(o => o.seatId)).toEqual(['empty', 'b', 'c', 'd']);
    expect(tombRaiderPlan(state).map(o => o.seatId)).toEqual(['empty', 'b', 'c', 'd']);
    expect(state.pendingChoice?.offers).toEqual(['shojin', 'warmog', 'deathcap']);
    roundTrip();
  });

  it('restores and continues identically, and rejects candidate/history/receipt co-forgery at all three inputs', () => {
    const authority = captureAugmentHistoryAuthority(state), c = state.pendingChoice!;
    const resumed = restoreSharedOrbSnapshot(pool, canonicalContent(state), authority);
    expect(chooseInPool(pool, resumed, c.offers[0])).toEqual(chooseInPool(pool, state, c.offers[0]));
    const edits: ((s: any) => void)[] = [
      s => { delete s.augmentHistory; },
      s => { s.augmentHistory.seatId = 'other'; },
      s => { s.augmentHistory.facts.find((f: any) => f.kind === 'table' && f.stage === 'acquire').seats.find((x: any) => x.seatId === 'old').alive = true; },
      s => { s.augmentHistory.facts.find((f: any) => f.kind === 'table' && f.stage === 'settlement').seats.find((x: any) => x.seatId === 'b').items[0].definitionId = 'rageblade'; },
      s => { s.augmentHistory.facts.find((f: any) => f.kind === 'table' && f.stage === 'settlement').seats.find((x: any) => x.seatId === 'd').rank = 8; },
      s => { s.pendingChoice.offers = ['TFT4_Item_OrnnInfinityForce']; },
      s => { s.augments.find((a: any) => a.definitionId === 'tomb-raider-2').acquiredRound--; },
      s => { s.nextItemSerial++; s.items.push({ id: `item-${s.nextItemSerial - 1}`, definitionId: 'shojin', location: { kind: 'inventory' } }); },
    ];
    for (const edit of edits) for (const form of ['object', 'json', 'canonical']) {
      const bad = structuredClone(state); edit(bad);
      expect(() => restoreSharedOrbSnapshot(pool, form === 'object' ? bad : form === 'json' ? JSON.stringify(bad) : canonicalContent(bad), authority)).toThrow();
    }
  });

  it('manual and timeout choices grant three items, so the fourth eliminated player still awards an item', () => {
    const serial = state.nextItemSerial;
    choose(); choose(true);
    expect(state.pendingChoice?.choiceId).toContain('"d"');
    choose(); expect(state.pendingChoice).toBeNull();
    expect(state.nextItemSerial).toBe(serial + 3);
    expect(state.seatMechanics?.receipts.filter(r => r.source === TOMB_RAIDER_SOURCE)).toHaveLength(3);
    roundTrip();
  });

  it('continues on the next real round and authenticates all six later opportunities', () => {
    const next = nextSharedRound(pool, [state], state.round);
    expect(next.ok).toBe(true); if (!next.ok) throw new Error(next.reason); state = next.states[0]; pool = next.pool;
    state = recordAugmentTable(state, 'entry', table.map(s => s.seatId === 's0' ? selfTable(state)[0] : s));
    settle(); publish(['e', 'f']);
    expect(tombRaiderOpportunities(state, acquired).map(o => o.seatId)).toEqual(['empty', 'b', 'c', 'd', 'e', 'f']);
    choose(); choose();
    expect(state.pendingChoice).toBeNull();
    expect(state.seatMechanics?.receipts.filter(r => r.source === TOMB_RAIDER_SOURCE)).toHaveLength(5);
    assertSharedPoolConservation(pool, [state]); roundTrip();
    const authority = captureAugmentHistoryAuthority(state), bad: any = structuredClone(state);
    const receipt = bad.seatMechanics.receipts.find((r: any) => r.source === TOMB_RAIDER_SOURCE);
    receipt.optionId = 'infinity-edge'; bad.items.find((i: any) => i.id === receipt.itemId).definitionId = 'infinity-edge';
    for (const input of [bad, JSON.stringify(bad), canonicalContent(bad)]) expect(() => restoreSharedOrbSnapshot(pool, input, authority)).toThrow();
  });
});

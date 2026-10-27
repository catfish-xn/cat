import { beforeAll, describe, expect, it } from 'vitest';
import { onlineOffer, chooseInPool, selfTable } from './augment-pool-batch5-r1-helpers';
import { AUGMENT_DEFINITIONS } from '../src/simulation/content/augments';
import { augmentCandidates } from '../src/simulation/augment-offers';
import { canonicalContent } from '../src/simulation/content';
import { captureAugmentHistoryAuthority, prepareAugmentAcquisition } from '../src/simulation/augment-history';
import { recordTombRaiderEliminations, tombRaiderOpportunities, TOMB_RAIDER_SOURCE } from '../src/simulation/augment-pool-batch5-r1';
import { restoreSharedOrbSnapshot, runSharedMatchCommand, assertSharedPoolConservation } from '../src/simulation/shared-pool';
import { resolveRoundEconomy } from '../src/simulation/round-economy';
import { ROUND_SETTLEMENT_VERSION } from '../src/simulation/round-settlement';
import type { HistorySeat } from '../src/simulation/augment-history-types';
import type { MatchState, MatchEvent } from '../src/simulation/match-types';
import type { SharedPoolState } from '../src/simulation/shared-pool-types';
import { tombRaiderPlan, validateTombRaiderTransition } from './fixtures/m5/oracle.g2.cjs';

function opponent(id: string, rank: number, items: readonly string[], alive = true): HistorySeat {
  return { seatId: id, index: rank - 1, hp: alive ? 10 : 0, alive, rank, eliminatedRound: alive ? null : 18,
    units: [{ id: `hero-${id}`, definitionId: 'irelia', team: 'player', starLevel: 1,
      location: id === 'bench' ? { kind: 'bench', slot: 0 } : { kind: 'board', cell: { col: 0, row: 4 } } }],
    items: items.map((definitionId, slot) => ({ id: `${id}-item-${slot}`, definitionId,
      location: { kind: 'unit', unitId: `hero-${id}`, slot } })) };
}
const die = (s: HistorySeat): HistorySeat => ({ ...s, alive: false, hp: 0, eliminatedRound: 19 });

function checkRoundTrip(pool: SharedPoolState, state: MatchState) {
  const authority = captureAugmentHistoryAuthority(state);
  for (const input of [state, JSON.stringify(state), canonicalContent(state)])
    expect(restoreSharedOrbSnapshot(pool, input, authority)).toEqual(state);
  expect(() => restoreSharedOrbSnapshot(pool, state)).toThrow('missing independent server authority');
  expect(() => restoreSharedOrbSnapshot(pool, state, JSON.parse(JSON.stringify(authority)))).toThrow();
}

describe('B5-39 online commands and authenticated saves', () => {
  let pool: SharedPoolState, state: MatchState, table: readonly HistorySeat[], acquired: string;
  let awaiting: MatchState, awaitingPool: SharedPoolState;
  beforeAll(() => { ({ pool, state } = onlineOffer(18)); });

  it('is enabled at 4-2 only, with the archived gold tier', () => {
    expect(AUGMENT_DEFINITIONS['tomb-raider-1']).toBeDefined();
    for (const node of ['2-1', '3-2', '4-2']) {
      const ids = augmentCandidates('gold', [], [], null, { node, fieldedTraits: [], blocked: [] });
      expect(ids.includes('tomb-raider-1')).toBe(node === '4-2');
      expect(augmentCandidates('prismatic', [], [], null, { node, fieldedTraits: [], blocked: [] })).not.toContain('tomb-raider-1');
    }
  });

  it('acquires through an authentic 4-2 offer and excludes the earlier elimination', () => {
    for (let slot = 0; slot <= 1; slot++) {
      const c = state.pendingChoice!;
      const result = runSharedMatchCommand(pool, state, { type: 'rerollAugment', choiceId: c.choiceId, generation: c.generation, optionIndex: slot });
      expect(result.ok).toBe(true); if (!result.ok) throw new Error(result.reason);
      state = result.state; pool = result.pool;
    }
    expect(state.pendingChoice?.offers).toContain('tomb-raider-1');
    table = [...selfTable(state), opponent('old', 8, ['warmog'], false), opponent('empty', 7, []),
      opponent('bench', 6, ['shojin']), opponent('board', 5, ['rageblade', 'rageblade', 'warmog', 'deathcap', 'shojin', 'bloodthirster']),
      opponent('fourth', 4, ['infinity-edge'])];
    // Valid candidate fixture has several ordinary heroes, each with at most three equipped items.
    const board = table.find(s => s.seatId === 'board')!;
    table = table.map(s => s !== board ? s : { ...s, units: [...s.units, { ...s.units[0], id: 'hero-board-2', location: { kind: 'bench', slot: 0 } }],
      items: s.items.map((item, n) => n < 3 ? item : { ...item, location: { kind: 'unit', unitId: 'hero-board-2', slot: n - 3 } }) });
    prepareAugmentAcquisition(state, { status: 'none' }, 0, table);
    acquired = state.pendingChoice!.choiceId;
    const result = chooseInPool(pool, state, 'tomb-raider-1'); state = result.state; pool = result.pool;
    expect(state.augments.at(-1)?.definitionId).toBe('tomb-raider-1');
    expect(state.augmentHistory?.facts.some(f => f.kind === 'acquire' && f.choiceId === acquired)).toBe(true);
    expect(tombRaiderOpportunities(state, acquired)).toEqual([]);
    checkRoundTrip(pool, state);
  });

  it('settles through the public command, counts an empty player and opens every candidate in rank order', () => {
    const plan = resolveRoundEconomy({ augments: state.augments, roundId: state.roundDefinitionId, result: 'playerWin', gold: state.gold,
      streak: state.streak, level: state.level, xp: state.xp, hp: state.playerHp, enemySurvivors: 0 });
    const result = runSharedMatchCommand(pool, state, { type: 'settleRound', receipt: { version: ROUND_SETTLEMENT_VERSION,
      settlementId: 'tomb-settlement', battleId: 'tomb-battle', seatId: 's0', round: state.round, roundId: state.roundDefinitionId,
      settlementEligible: true, result: 'win', damage: plan.playerDamage, baseDamage: plan.baseDamage, opposingSurvivors: 0,
      growth: [], combatTicks: 1, combatEventCount: 1 } });
    expect(result.ok).toBe(true); if (!result.ok) throw new Error(result.reason);
    state = result.state; pool = result.pool;
    table = table.map(s => ['empty', 'bench', 'board', 'fourth'].includes(s.seatId) ? die(s) : s);
    const published = recordTombRaiderEliminations(state, table); state = published.state;
    expect(published.events).toMatchObject([{ type: 'choiceOpened', domain: 'match', eventSeq: expect.any(Number) }]);
    const opportunities = tombRaiderOpportunities(state, acquired);
    expect(opportunities.map(o => o.seatId)).toEqual(['empty', 'bench', 'board']);
    expect(tombRaiderPlan(state).map((o: { seatId: string }) => o.seatId)).toEqual(['empty', 'bench', 'board']);
    expect(state.pendingChoice?.offers).toEqual(['shojin']);
    expect(recordTombRaiderEliminations(state, table)).toEqual({ state, events: [] });
    checkRoundTrip(pool, state); awaiting = state; awaitingPool = pool;
  });

  it('refuses invalid/stale answers atomically, then grants one item and opens the next player', () => {
    const c = state.pendingChoice!;
    for (const [generation, definitionId] of [[c.generation + 1, c.offers[0]], [c.generation, 'TFT4_Item_OrnnInfinityForce']] as const) {
      const bad = runSharedMatchCommand(pool, state, { type: 'choose', choiceId: c.choiceId, generation, definitionId });
      expect(bad.ok).toBe(false); expect(bad.state).toBe(state); expect(bad.pool).toBe(pool); expect('events' in bad).toBe(false);
    }
    const before = state, result = chooseInPool(pool, state, 'shojin'); state = result.state; pool = result.pool;
    expect(state.nextItemSerial).toBe(before.nextItemSerial + 1);
    expect(state.items.at(-1)).toEqual({ id: `item-${before.nextItemSerial}`, definitionId: 'shojin', location: { kind: 'inventory' } });
    expect(state.pendingChoice?.offers).toEqual(['rageblade', 'rageblade', 'warmog', 'deathcap', 'shojin', 'bloodthirster']);
    validateTombRaiderTransition(before, state, { type: 'select', choiceId: c.choiceId, generation: c.generation, definitionId: 'shojin' }, result.events);
    const retry = runSharedMatchCommand(pool, state, { type: 'choose', choiceId: c.choiceId, generation: c.generation, definitionId: 'shojin' });
    expect(retry.ok).toBe(false); expect(retry.state).toBe(state); expect(retry.pool).toBe(pool);
    checkRoundTrip(pool, state);
  });

  it('restores a pending choice and produces the identical command continuation', () => {
    const restored = restoreSharedOrbSnapshot(awaitingPool, canonicalContent(awaiting), captureAugmentHistoryAuthority(awaiting));
    const first = chooseInPool(awaitingPool, awaiting, 'shojin'), again = chooseInPool(awaitingPool, restored, 'shojin');
    expect(again).toEqual(first);
  });

  it('rejects missing/altered history, candidates, ranking and co-forged reward receipts in all save forms', () => {
    const authority = captureAugmentHistoryAuthority(state);
    const edits: ((s: any) => void)[] = [
      s => { delete s.augmentHistory; },
      s => { s.augmentHistory.version = 'augment-history-v2'; },
      s => { s.augmentHistory.facts.find((f: any) => f.kind === 'table' && f.stage === 'settlement').seats.find((x: any) => x.seatId === 'bench').items[0].definitionId = 'deathcap'; },
      s => { s.augmentHistory.facts.find((f: any) => f.kind === 'table' && f.stage === 'settlement').seats.find((x: any) => x.seatId === 'board').rank = 8; },
      s => { s.augmentHistory.facts.find((f: any) => f.kind === 'table' && f.stage === 'acquire').seats.find((x: any) => x.seatId === 'old').alive = true; },
      s => { s.augmentHistory.facts.pop(); },
      s => { s.pendingChoice.offers.pop(); },
      s => { s.pendingChoice.offers.push('TFT4_Item_OrnnInfinityForce'); },
      s => { const r = s.seatMechanics.receipts.find((r: any) => r.source === TOMB_RAIDER_SOURCE); r.optionId = 'deathcap'; s.items.find((i: any) => i.id === r.itemId).definitionId = 'deathcap'; },
      s => { s.seatMechanics.receipts.push({ ...s.seatMechanics.receipts.find((r: any) => r.source === TOMB_RAIDER_SOURCE), receiptId: 'extra-copy' }); },
      s => { s.augments = s.augments.filter((a: any) => a.definitionId !== 'tomb-raider-1'); },
    ];
    for (const edit of edits) for (const form of ['object', 'json', 'canonical']) {
      const bad = structuredClone(state); edit(bad);
      expect(() => restoreSharedOrbSnapshot(pool, form === 'object' ? bad : form === 'json' ? JSON.stringify(bad) : canonicalContent(bad), authority)).toThrow();
    }
  });

  it('the independent oracle rejects a co-forged offer, item and receipt', () => {
    const c = awaiting.pendingChoice!, result = chooseInPool(awaitingPool, awaiting, 'shojin');
    const before: any = structuredClone(awaiting), after: any = structuredClone(result.state);
    before.pendingChoice.offers = ['deathcap']; before.pendingChoice.payload.timeoutOption = 'deathcap';
    const receipt = after.seatMechanics.receipts.find((r: any) => r.source === TOMB_RAIDER_SOURCE);
    receipt.optionId = 'deathcap'; after.items.find((i: any) => i.id === receipt.itemId).definitionId = 'deathcap';
    const events = structuredClone(result.events) as MatchEvent[];
    expect(() => validateTombRaiderTransition(before, after, { type: 'select', choiceId: c.choiceId, generation: 0, definitionId: 'deathcap' }, events)).toThrow();
  });

  it('timeout selects the first of all six candidates once and finishes after the third eliminated player', () => {
    const before = state, c = state.pendingChoice!;
    const command = { type: 'timeoutChoice', round: state.round, choiceId: c.choiceId, generation: c.generation } as const;
    const result = runSharedMatchCommand(pool, state, command);
    expect(result.ok).toBe(true); if (!result.ok) throw new Error(result.reason);
    state = result.state; pool = result.pool;
    validateTombRaiderTransition(before, state, command, result.events);
    expect(state.pendingChoice).toBeNull(); expect(state.phase).toBe('settlement');
    expect(state.seatMechanics?.receipts.filter(r => r.source === TOMB_RAIDER_SOURCE)).toHaveLength(2);
    expect(tombRaiderOpportunities(state, acquired)).toHaveLength(3);
    assertSharedPoolConservation(pool, [state]); checkRoundTrip(pool, state);
  });
});

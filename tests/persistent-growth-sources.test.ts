import { describe, expect, it } from 'vitest';
import { applyRoundSettlement, claimOrDiscardLoot, enableMultiplayerSettlement, forfeitPendingChoice, nextRound, snapshotForBattle,
  startMatchCombat, stepMatch, ROUND_SETTLEMENT_VERSION, type MatchState, type MultiplayerCommandResult, type RoundSettlementReceipt } from '../src/server-entry';
import type { Unit } from '../src/simulation/unit-types';
import { createMatch } from '../src/simulation/match';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { createCombatWithEvents, stepCombat } from '../src/simulation/combat';
import { getCatalogRoundById, getCatalogRoundByOrdinal } from '../src/simulation/round-selectors';
import { UNIT_DEFINITIONS } from '../src/simulation/units';
import { FINAL_ROUND } from '../src/simulation/round-schedule';
import {
  PERSISTENT_GROWTH_SOURCES, GROWTH_TRANSFER_AUGMENTS, persistentGrowthSteps, persistentGrowthCeiling,
  growthRepresentable, validLedgerGrowth, validCombatGrowthDelta,
} from '../src/simulation/persistent-growth';
import { freeze } from './combat-helpers';

// Every step below is read from the source table (itself derived from content), never typed in.
const tristana = PERSISTENT_GROWTH_SOURCES.find(s => s.id === 'tristana-ricochet')!;
const troll = PERSISTENT_GROWTH_SOURCES.find(s => s.augmentId === 'shocking-troll')!;
const trollStep = troll.stepsBps[0]!, tristanaStep = tristana.stepsBps[0]!;

const unit = (definitionId: string, id = 'unit-1', starLevel: 1 | 2 | 3 = 1): Unit =>
  ({ id, definitionId, starLevel, team: 'player', location: { kind: 'board', cell: { col: 3, row: 4 } } });
function seat(units: readonly Unit[], extra: Partial<MatchState>, roundId = '3-1'): MatchState {
  const base = createMatch(42), round = getCatalogRoundById(roundId);
  return { ...base, round: round.ordinal, roundDefinitionId: round.roundId, m8: { ...base.m8, round }, level: 9,
    preparation: { ...base.preparation, units }, ...extra } as MatchState;
}
// Same public-command opening and receipt shape as t3-round-settlement.test.ts.
function accepted(result: MultiplayerCommandResult): MatchState { if (!result.ok) throw new Error(result.reason); return result.state; }
function opening(): MatchState {
  const timeout = (s: MatchState) => accepted(forfeitPendingChoice(s, s.round, s.pendingChoice?.choiceId ?? null, s.pendingChoice?.generation ?? null));
  let state = accepted(enableMultiplayerSettlement(createMatch(5), 'A'));
  while (state.roundDefinitionId !== '2-1') {
    if (state.phase === 'choice') state = timeout(state);
    else if (state.phase === 'preparation') state = accepted(startMatchCombat(state));
    else if (state.phase === 'combat') state = stepMatch(state).state;
    else state = accepted(nextRound(accepted(claimOrDiscardLoot(state, state.round)), state.round));
  }
  return state.phase === 'choice' ? timeout(state) : state;
}
const receipt = (state: MatchState, extra: Partial<RoundSettlementReceipt>): RoundSettlementReceipt => ({ version: ROUND_SETTLEMENT_VERSION,
  settlementId: `${state.round}:A`, battleId: `battle:${state.round}`, seatId: state.multiplayer!.seatId, round: state.round, roundId: state.roundDefinitionId,
  settlementEligible: true, result: 'win', damage: 0, baseDamage: state.m8.round.stage === 4 ? 8 : 2, opposingSurvivors: 0, growth: [], combatTicks: 88, combatEventCount: 20, ...extra });
const trollAugment = { definitionId: 'shocking-troll', choiceId: 'troll', acquiredRound: 4 };

describe('persistent growth source table', () => {
  it('lists every ledger writer, each owned by a real champion with positive integer steps', () => {
    expect(tristana).toMatchObject({ definitionId: 'tristana', augmentId: null });
    expect(troll).toMatchObject({ definitionId: 'trundle' });
    for (const source of PERSISTENT_GROWTH_SOURCES) {
      expect(Object.hasOwn(UNIT_DEFINITIONS, source.definitionId)).toBe(true);
      expect(source.stepsBps.length).toBeGreaterThan(0);
      expect(source.stepsBps.every(step => Number.isSafeInteger(step) && step > 0)).toBe(true);
    }
    expect(GROWTH_TRANSFER_AUGMENTS).toEqual(['pandoras-bench', 'recombobulator']);
  });

  it('the Shocking Troll writer emits exactly the table step', () => {
    const m = createMatch(42), u = m.preparation.units[0]!;
    const units = [{ ...u, id: 'h0', definitionId: 'trundle', starLevel: 1 as const, team: 'player' as const, location: { kind: 'board' as const, cell: { col: 2, row: 4 } } },
      ...[0, 1, 2].map(i => ({ ...u, id: 'e' + i, definitionId: 'training-dummy', starLevel: 1 as const, team: 'enemy' as const, location: { kind: 'board' as const, cell: { col: 1 + i * 2, row: 3 - (i % 2) } } }))];
    const preparation = { ...m.preparation, units };
    let c: any = createCombatWithEvents(preparation, buildStrategySnapshot({ ...m, round: 10, preparation, augments: [{ definitionId: 'shocking-troll', choiceId: 't', acquiredRound: 1 }] }), 'troll', 42).state;
    const growth: any[] = [];
    while (c.status === 'running' && c.tick < 1200 && growth.length === 0) {
      const step = stepCombat(c); c = step.state;
      growth.push(...(step.events as any[]).filter(e => e.type === 'growth' && e.unitId === 'h0'));
    }
    expect(growth[0]?.amountBps).toBe(trollStep);
  });

  it('steps follow the owner and the seat: Tristana always, Trundle only with the augment, any champion after a transform', () => {
    expect(persistentGrowthSteps('tristana', [])).toEqual(tristana.stepsBps);
    expect(persistentGrowthSteps('trundle', [])).toEqual([]);
    expect(persistentGrowthSteps('trundle', ['shocking-troll'])).toEqual([trollStep]);
    expect(persistentGrowthSteps('irelia', ['shocking-troll'])).toEqual([]);
    for (const transfer of GROWTH_TRANSFER_AUGMENTS) {
      expect(persistentGrowthSteps('irelia', [transfer])).toEqual(tristana.stepsBps);
      expect([...persistentGrowthSteps('irelia', [transfer, 'shocking-troll'])].sort((a, b) => a - b))
        .toEqual([...new Set([...tristana.stepsBps, trollStep])].sort((a, b) => a - b));
    }
  });

  it('amounts must be sums of the allowed steps', () => {
    expect(growthRepresentable(trollStep * 4, [trollStep])).toBe(true);
    expect(growthRepresentable(trollStep * 4 + 1, [trollStep])).toBe(false);
    expect(growthRepresentable(0, [trollStep])).toBe(false);
    expect(growthRepresentable(trollStep, [])).toBe(false);
    const both = [...new Set([tristanaStep, trollStep])].sort((a, b) => a - b);
    expect(growthRepresentable(tristanaStep * 3 + trollStep * 2, both)).toBe(true);
    expect(growthRepresentable(1, both)).toBe(Math.min(...both) === 1);
  });
});

describe('every validator accepts the table and still rejects invented growth', () => {
  it('seed 20261012 shape: a Shocking Troll Trundle with four casts of growth passes the battle snapshot', () => {
    const growth = [{ unitId: 'unit-1', attackDamageBps: trollStep * 4 }];
    const state = seat([unit('trundle')], { augments: [trollAugment], persistentGrowth: growth });
    expect(snapshotForBattle(freeze(state), 'bot-3').persistentGrowth).toEqual(growth);
    // Unchanged rejections: no augment, a non-step amount, a Tristana-only amount on a non-transformed owner.
    expect(() => snapshotForBattle(freeze({ ...state, augments: [] }), 'bot-3')).toThrow('invalid-snapshot');
    expect(() => snapshotForBattle(freeze({ ...state, persistentGrowth: [{ unitId: 'unit-1', attackDamageBps: trollStep * 4 + 1 }] }), 'bot-3')).toThrow('invalid-snapshot');
    expect(() => snapshotForBattle(freeze(seat([unit('irelia')], { augments: [trollAugment], persistentGrowth: growth })), 'bot-3')).toThrow('invalid-snapshot');
  });

  it('Tristana growth still passes, and a transformed owner keeps it', () => {
    const growth = [{ unitId: 'unit-1', attackDamageBps: tristanaStep * 3 }];
    expect(snapshotForBattle(freeze(seat([unit('tristana')], { persistentGrowth: growth })), 'A').persistentGrowth).toEqual(growth);
    expect(() => snapshotForBattle(freeze(seat([unit('irelia')], { persistentGrowth: growth })), 'A')).toThrow('invalid-snapshot');
  });

  it('a long game: late-round growth from many casts and merged copies is not refused; the safety ceiling still is', () => {
    const last = getCatalogRoundByOrdinal(FINAL_ROUND);
    const heavy = trollStep * 40 * last.ordinal * 3; // forty casts a combat, every combat, three copies merged.
    expect(validLedgerGrowth(heavy, 'trundle', ['shocking-troll'], last.ordinal)).toBe(true);
    const state = seat([unit('trundle', 'unit-1', 2)], { augments: [trollAugment], persistentGrowth: [{ unitId: 'unit-1', attackDamageBps: heavy }] }, last.roundId);
    expect(snapshotForBattle(freeze(state), 'A').persistentGrowth).toEqual([{ unitId: 'unit-1', attackDamageBps: heavy }]);
    const ceiling = persistentGrowthCeiling([trollStep], last.ordinal);
    expect(validLedgerGrowth(ceiling, 'trundle', ['shocking-troll'], last.ordinal)).toBe(true);
    expect(validLedgerGrowth(ceiling + trollStep, 'trundle', ['shocking-troll'], last.ordinal)).toBe(false);
    expect(validCombatGrowthDelta(persistentGrowthCeiling([trollStep], 1, 1) + trollStep, 'trundle', ['shocking-troll'])).toBe(false);
  });

  it('a PvP receipt carrying Trundle growth settles with the augment and is refused without it', () => {
    const base = opening();
    const state: MatchState = { ...base, augments: [trollAugment],
      preparation: { ...base.preparation, units: [{ id: 'unit-1', definitionId: 'trundle', team: 'player', starLevel: 1, location: { kind: 'board', cell: { col: 3, row: 4 } } }] } };
    const r = receipt(state, { growth: [{ unitId: 'unit-1', attackDamageBps: trollStep * 2 }] });
    const next = accepted(applyRoundSettlement(freeze(state), r));
    expect(next.persistentGrowth).toEqual([{ unitId: 'unit-1', attackDamageBps: trollStep * 2 }]);
    expect(snapshotForBattle(accepted(nextRound(next, next.round)), 'A').persistentGrowth).toEqual(next.persistentGrowth);
    const refused = applyRoundSettlement(freeze({ ...state, augments: [] }), r);
    expect(refused.ok === false && refused.reason).toBe('invalid-receipt');
    const odd = applyRoundSettlement(freeze(state), receipt(state, { growth: [{ unitId: 'unit-1', attackDamageBps: trollStep + 1 }] }));
    expect(odd.ok === false && odd.reason).toBe('invalid-receipt');
  });
});

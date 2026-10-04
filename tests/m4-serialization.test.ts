import { beforeAll, describe, expect, it } from 'vitest';
import {
  combineItems, createMatch, deployMatchUnit, equipItem, nextRound, rerollAnomaly, selectAnomalyTarget,
  selectChoice, sellUnit, startMatchCombat, stepMatch, type MatchCommandResult, type MatchState,
} from '../src/simulation/match';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { canonicalContent } from '../src/simulation/content';

const fixtures: Record<string, MatchState> = {};
function accept(result: MatchCommandResult): MatchState {
  if (!result.ok) throw new Error(`Unexpected rejection: ${result.reason}`);
  return result.state;
}
function frozen<T>(value: T): T {
  if (value && typeof value === 'object') { Object.values(value).forEach(frozen); Object.freeze(value); }
  return value;
}
function patch(state: MatchState, path: readonly (string | number)[], value: unknown): unknown {
  const output: unknown = structuredClone(state);
  let object = output as Record<string, unknown>;
  for (const part of path.slice(0, -1)) object = object[part] as Record<string, unknown>;
  object[path[path.length - 1]] = value;
  return output;
}
function choose(state: MatchState): MatchState {
  const choice = state.pendingChoice!;
  const preferred = ['opening-guard', 'cast-echo', 'cycling-core', 'echo-core', 'guarded-form'];
  const definition = preferred.find(id => choice.offers.includes(id)) ?? choice.offers[0];
  return accept(selectChoice(state, choice.choiceId, choice.generation, definition));
}

/** Every fixture comes from one unmodified command-driven Match, including its natural defeat. */
beforeAll(() => {
  let state = createMatch(12345);
  fixtures.initial = state;
  state = accept(combineItems(state, state.items[0].id, state.items[1].id));
  state = accept(equipItem(state, state.items[0].id, 'unit-2', 0));
  for (const [col, id] of ['unit-1', 'unit-2', 'unit-3'].entries()) {
    state = accept(deployMatchUnit(state, id, { kind: 'board', cell: { col: 1 + col * 2, row: 4 } }));
  }
  for (let operation = 0; operation < 30000 && state.phase !== 'gameOver'; operation++) {
    if (state.phase === 'preparation') {
      fixtures[`preparation${state.round}`] = state;
      state = accept(startMatchCombat(state));
      fixtures[`start${state.round}`] = state;
    } else if (state.phase === 'combat') {
      if (state.combat.tick === 10) fixtures[`middle${state.round}`] = state;
      if (state.combat.units.some(unit => unit.triggers!.length > 0)) fixtures.triggerCombat ??= state;
      if (state.combat.units.some(unit => unit.effectRuntime!.some(counter => counter.count > 0))) fixtures.counterCombat ??= state;
      state = stepMatch(state).state;
    } else if (state.phase === 'settlement') {
      fixtures[`settlement${state.round}`] = state;
      state = accept(nextRound(state, state.round));
    } else {
      const choice = state.pendingChoice!;
      if (choice.kind === 'augment') {
        fixtures[`augment${state.round}`] = state;
        state = choose(state);
      } else {
        fixtures.anomalyTarget = state;
        state = accept(selectAnomalyTarget(state, choice.choiceId, choice.generation, 'unit-1'));
        fixtures.anomalyOffer = state;
        state = accept(rerollAnomaly(state, state.pendingChoice!.choiceId, state.pendingChoice!.generation));
        fixtures.anomalyRerolled = state;
        state = choose(state);
        fixtures.anomalyBound = state;
      }
    }
  }
  expect(state.phase).toBe('gameOver');
  fixtures.gameOver = state;
  expect(fixtures.anomalyBound).toBeDefined();
  expect(fixtures.triggerCombat).toBeDefined();
  expect(fixtures.counterCombat).toBeDefined();
});

describe('M4 JSON restoration through real Match states', () => {
  it('roundtrips preparation, both Augments, each Anomaly substate, binding, all combat boundaries and Game Over without side effects', () => {
    for (const [label, state] of Object.entries(fixtures)) {
      const before = canonicalContent(state);
      const restored = restoreMatch(frozen(state));
      expect(restored, label).toEqual(state);
      expect(restored).not.toBe(state);
      expect(restored.preparation).not.toBe(state.preparation);
      expect(restored.items).not.toBe(state.items);
      expect(restored.scheduleReceipts).not.toBe(state.scheduleReceipts);
      expect(restoreMatch(serializeMatch(state)), label).toEqual(state);
      expect(canonicalContent(state), label).toBe(before);
    }
  });

  it('restores at every real tick and produces identical subsequent events, counters, stats and settlement', () => {
    const phases = new Set<string>();
    let sawNonzeroCounter = false;
    for (const start of [fixtures.start1, fixtures.start7, fixtures.start8]) {
      let original = start;
      let resumed = restoreMatch(serializeMatch(original));
      while (original.phase === 'combat') {
        phases.add(original.phase);
        const expected = stepMatch(frozen(original));
        const actual = stepMatch(resumed);
        expect(actual).toEqual(expected);
        original = expected.state;
        resumed = restoreMatch(serializeMatch(actual.state));
        if (original.combat?.units.some(unit => unit.effectRuntime?.some(counter => counter.count > 0))) sawNonzeroCounter = true;
      }
      phases.add(original.phase);
      expect(resumed).toEqual(original);
      expect(original.phase).toBe('settlement');
    }
    expect(phases).toEqual(new Set(['combat', 'settlement']));
    expect(sawNonzeroCounter).toBe(true);
  }, 30000);

  it('continues restored choices with the same locked target, offers, RNG, receipts and generation', () => {
    let original = fixtures.anomalyTarget;
    let restored = restoreMatch(serializeMatch(original));
    const first = original.pendingChoice!;
    const expectedTarget = selectAnomalyTarget(original, first.choiceId, first.generation, 'unit-1');
    expect(selectAnomalyTarget(restored, first.choiceId, first.generation, 'unit-1')).toEqual(expectedTarget);
    original = accept(expectedTarget);
    restored = restoreMatch(serializeMatch(original));
    const offer = original.pendingChoice!;
    const expectedReroll = rerollAnomaly(original, offer.choiceId, offer.generation);
    expect(rerollAnomaly(restored, offer.choiceId, offer.generation)).toEqual(expectedReroll);
    original = accept(expectedReroll);
    restored = restoreMatch(serializeMatch(original));
    expect(choose(restored)).toEqual(choose(original));
    expect(restored.choiceRngState).toBe(original.choiceRngState);
    expect(restored.rewardRngState).toBe(original.rewardRngState);
    expect(restored.rngState).toBe(original.rngState);
  });

  it('preserves completed Anomaly history after selling the bound unit, and does not invent a new choice', () => {
    const bound = fixtures.anomalyBound;
    const sold = accept(sellUnit(bound, bound.anomalyBinding!.unitId));
    const restored = restoreMatch(serializeMatch(sold));
    expect(restored.anomalyBinding).toBeNull();
    expect(restored.pendingChoice).toBeNull();
    expect(restored.scheduleReceipts).toEqual(sold.scheduleReceipts);
    expect(restored.scheduleReceipts.some(receipt => receipt.kind === 'anomaly')).toBe(true);
  });
});

const invalidPatches: readonly [string, string, readonly (string | number)[], unknown][] = [
  ['legacy schema', 'initial', ['schemaVersion'], 3],
  ['unknown schema', 'initial', ['schemaVersion'], 999],
  ['unknown rules', 'initial', ['rulesVersion'], 'm4-v2'],
  ['unknown content version', 'initial', ['contentVersion'], 'm4-slice-v2'],
  ['wrong content digest', 'initial', ['contentDigest'], 'other'],
  ['out-of-range shop RNG', 'initial', ['rngState'], 0x100000000],
  ['negative choice RNG', 'initial', ['choiceRngState'], -1],
  ['fractional reward RNG', 'initial', ['rewardRngState'], 1.5],
  ['nonfinite gold', 'initial', ['gold'], NaN],
  ['unsafe gold', 'initial', ['gold'], Number.MAX_SAFE_INTEGER + 1],
  ['serial rollback', 'initial', ['nextUnitSerial'], 5],
  ['item serial rollback', 'initial', ['nextItemSerial'], 2],
  ['unknown unit', 'initial', ['preparation', 'units', 0, 'definitionId'], 'unknown'],
  ['duplicate unit ID', 'initial', ['preparation', 'units', 1, 'id'], 'unit-1'],
  ['unknown item', 'initial', ['items', 0, 'definitionId'], 'unknown'],
  ['duplicate item ID', 'initial', ['items', 1, 'id'], 'item-1'],
  ['dangling equipment owner', 'initial', ['items', 0, 'location'], { kind: 'unit', unitId: 'unit-999', slot: 0 }],
  ['enemy equipment owner', 'initial', ['items', 0, 'location'], { kind: 'unit', unitId: 'enemy-1', slot: 0 }],
  ['fourth equipment slot', 'initial', ['items', 0, 'location'], { kind: 'unit', unitId: 'unit-1', slot: 3 }],
  ['augment acquisition round disagrees with receipt', 'anomalyBound', ['augments', 0, 'acquiredRound'], 1],
  ['binding round disagrees with receipt', 'anomalyBound', ['anomalyBinding', 'boundRound'], 1],
  ['missing augment definition', 'anomalyBound', ['augments', 0, 'definitionId'], 'unknown'],
  ['dangling binding owner', 'anomalyBound', ['anomalyBinding', 'unitId'], 'unit-999'],
  ['invalid binding definition', 'anomalyBound', ['anomalyBinding', 'definitionId'], 'unknown'],
  ['multiple bindings', 'anomalyBound', ['anomalyBinding'], []],
  ['nonempty target offers', 'anomalyTarget', ['pendingChoice', 'offers'], ['echo-core']],
  ['target selected prematurely', 'anomalyTarget', ['pendingChoice', 'targetId'], 'unit-1'],
  ['offer missing locked target', 'anomalyOffer', ['pendingChoice', 'targetId'], null],
  ['offer dangling locked target', 'anomalyOffer', ['pendingChoice', 'targetId'], 'unit-999'],
  ['reroll generation mismatch', 'anomalyRerolled', ['pendingChoice', 'generation'], 1],
  ['invalid offer ID', 'augment2', ['pendingChoice', 'offers', 0], 'unknown'],
  ['incomplete offer', 'augment2', ['pendingChoice', 'offers'], []],
  ['missing reward receipt', 'initial', ['scheduleReceipts'], []],
  ['fractional combat tick', 'start1', ['combat', 'tick'], 0.5],
  ['negative combat seq', 'start1', ['combat', 'nextEventSeq'], -1],
  ['HP above maximum', 'start1', ['combat', 'units', 0, 'hp'], 999999],
  ['unknown combat target', 'middle1', ['combat', 'units', 0, 'targetId'], 'unknown'],
  ['combat unit changed team', 'start1', ['combat', 'units', 0, 'team'], 'player'],
  ['combat unit changed definition', 'start1', ['combat', 'units', 0, 'definitionId'], 'oracle'],
  ['combat unit changed star', 'start1', ['combat', 'units', 0, 'starLevel'], 3],
  ['unbounded resolved attack', 'start1', ['combat', 'units', 0, 'attackDamage'], Number.MAX_SAFE_INTEGER],
  ['snapshot missing all unit resolutions', 'start1', ['combat', 'strategy', 'units'], []],
  ['snapshot fake trait count', 'start1', ['combat', 'strategy', 'traits', 0, 'count'], 999],
  ['snapshot fake resolved attack', 'start1', ['combat', 'strategy', 'units', 0, 'stats', 'attack'], 999999],
  ['unknown ability ID', 'start1', ['combat', 'units', 0, 'ability', 'id'], 'unknown'],
  ['invalid shield skill duration', 'start1', ['combat', 'units', 0, 'ability', 'durationTicks'], -1],
  ['inconsistent top-level HP', 'settlement1', ['playerHp'], 1],
  ['impossible negative HP', 'gameOver', ['playerHp'], -1],
  ['nonterminal Game Over', 'gameOver', ['combat', 'status'], 'running'],
];

describe('M4 rejects corrupt saves atomically', () => {
  it.each(invalidPatches)('rejects %s', (_label, fixture, path, value) => {
    const original = fixtures[fixture];
    const before = canonicalContent(original);
    const invalid = patch(original, path, value);
    expect(() => restoreMatch(invalid)).toThrow();
    expect(canonicalContent(original)).toBe(before);
  });

  it('rejects two different items occupying the same unit slot', () => {
    const invalid = structuredClone(fixtures.initial);
    const items = invalid.items.map(item => ({ ...item, location: { kind: 'unit' as const, unitId: 'unit-1', slot: 0 } }));
    expect(() => restoreMatch({ ...invalid, items })).toThrow();
  });

  it('rejects duplicated Augments and receipts, or a completed event still pending', () => {
    const bound = fixtures.anomalyBound;
    expect(() => restoreMatch({ ...bound, augments: [bound.augments[0], bound.augments[0]] })).toThrow();
    expect(() => restoreMatch({ ...bound, scheduleReceipts: [...bound.scheduleReceipts, bound.scheduleReceipts[0]] })).toThrow();
    expect(() => restoreMatch({ ...bound, scheduleReceipts: [...bound.scheduleReceipts].reverse() })).toThrow();
    const target = fixtures.anomalyTarget;
    const receipt = bound.scheduleReceipts.find(receipt => receipt.kind === 'anomaly')!;
    expect(() => restoreMatch({ ...target, scheduleReceipts: [...target.scheduleReceipts, receipt] })).toThrow();
  });

  it('rejects non-JSON containers, undefined, functions and Infinity rather than silently dropping them', () => {
    for (const value of [new Map(), new Set(), undefined, () => 1, Infinity]) {
      expect(() => restoreMatch({ ...fixtures.initial, extra: value })).toThrow();
    }
  });

  it('rejects missing required settlement fields and a forged reward receipt', () => {
    const invalid = structuredClone(fixtures.settlement1) as unknown as Record<string, unknown>;
    const history = invalid.roundResults as Record<string, unknown>[];
    delete history[0].income;
    expect(() => restoreMatch(invalid)).toThrow();
    expect(() => restoreMatch(patch(fixtures.initial, ['scheduleReceipts', 0, 'gold'], 500))).toThrow();
  });

  it('rejects missing on-board Combat units and impossible running/finished results', () => {
    const start = fixtures.start1;
    expect(() => restoreMatch({ ...start, combat: { ...start.combat, units: start.combat!.units.slice(1) } })).toThrow();
    const end = fixtures.settlement1;
    expect(() => restoreMatch({ ...end, combat: { ...end.combat, status: 'banana' } })).toThrow();
    expect(() => restoreMatch({ ...end, combat: { ...end.combat, result: end.combat!.result === 'playerWin' ? 'enemyWin' : 'playerWin' } })).toThrow();
  });

  it('rejects unknown effects, mismatched trigger provenance/actions and invalid runtime counters', () => {
    const state = fixtures.triggerCombat;
    const index = state.combat!.units.findIndex(unit => unit.triggers!.length > 0);
    const unit = state.combat!.units[index];
    const sourceIndex = unit.sources!.findIndex(source => source.effect.kind === 'trigger');
    expect(() => restoreMatch(patch(state, ['combat', 'units', index, 'sources', sourceIndex, 'effect'], { kind: 'unknown' }))).toThrow();
    expect(() => restoreMatch(patch(state, ['combat', 'units', index, 'triggers', 0, 'hook'], 'onHpLoss'))).toThrow();
    expect(() => restoreMatch(patch(state, ['combat', 'units', index, 'triggers', 0, 'action', 'amount'], 9999))).toThrow();
    expect(() => restoreMatch(patch(state, ['combat', 'units', index, 'triggers', 0, 'source', 'ownerId'], 'unit-999'))).toThrow();
    expect(() => restoreMatch(patch(state, ['combat', 'units', index, 'effectRuntime', 0, 'count'], -1))).toThrow();
    expect(() => restoreMatch(patch(state, ['combat', 'units', index, 'effectRuntime', 0, 'count'], 0.5))).toThrow();
    expect(() => restoreMatch(patch(state, ['combat', 'units', index, 'effectRuntime', 0, 'count'], Number.MAX_SAFE_INTEGER + 1))).toThrow();
  });
});

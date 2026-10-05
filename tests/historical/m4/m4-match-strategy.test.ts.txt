import { describe, expect, it } from 'vitest';
import {
  buyUnit, buyXp, combineItems, createMatch, deployMatchUnit, equipItem, nextRound, rerollAnomaly,
  rerollShop, selectAnomalyTarget, selectChoice, sellUnit, startMatchCombat, stepMatch,
  type MatchCommandResult, type MatchEvent, type MatchState,
} from '../src/simulation/match';
import type { ItemInstance, PendingChoice } from '../src/simulation/strategy-types';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import type { Unit } from '../src/simulation/units';
import { accepted, freeze } from './match-helpers';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const streams = (state: MatchState) => [state.rngState, state.choiceRngState, state.rewardRngState];
function rejected(state: MatchState, command: (state: MatchState) => MatchCommandResult, reason: string): void {
  const before = JSON.stringify(state), result = command(freeze(state));
  expect(result).toEqual({ ok: false, state, reason });
  expect(result.state).toBe(state);
  expect(JSON.stringify(state)).toBe(before);
}
function pending(state: MatchState): PendingChoice {
  expect(state.phase).toBe('choice');
  if (!state.pendingChoice) throw new Error('Missing pending choice');
  return state.pendingChoice;
}
function chooseFirst(state: MatchState): MatchState {
  const choice = pending(state);
  return accepted(selectChoice(state, choice.choiceId, choice.generation, choice.offers[0]));
}
function finish(state: MatchState): MatchState {
  let count = 0;
  while (state.phase === 'combat') {
    state = stepMatch(state).state;
    if (++count > 1200) throw new Error('Combat did not terminate');
  }
  return state;
}
/** Boundary fixtures still enter every round through real Match progression. */
function toRound(state: MatchState, round: number): MatchState {
  while (state.round < round) {
    if (state.phase === 'choice') state = chooseFirst(state);
    state = finish(accepted(startMatchCombat(state)));
    expect(state.phase).toBe('settlement');
    state = accepted(nextRound(state, state.round));
  }
  return state;
}
const fixtureItem = (id: string, definitionId: string, unitId?: string, slot = 0): ItemInstance => ({
  id, definitionId, location: unitId === undefined ? { kind: 'inventory' } : { kind: 'unit', unitId, slot },
});
const fixtureUnit = (id: string, slot: number, starLevel: Unit['starLevel'] = 1, onBoard = false): Unit => ({
  id, definitionId: 'sentinel', team: 'player', starLevel,
  location: onBoard ? { kind: 'board', cell: { row: 4, col: slot } } : { kind: 'bench', slot },
});
function ordinaryCommands(state: MatchState): ((state: MatchState) => MatchCommandResult)[] {
  return [rerollShop, buyXp, s => sellUnit(s, 'unit-1'), s => buyUnit(s, 0, state.shop.generation),
    s => deployMatchUnit(s, 'unit-1', { kind: 'board', cell: { row: 4, col: 1 } }),
    s => combineItems(s, 'item-1', 'item-2'), s => equipItem(s, 'item-1', 'unit-1', 0),
    startMatchCombat, s => nextRound(s, state.round)];
}
// A separate integer arithmetic oracle; it does not call the production RNG helper.
function words(seed: number, count: number): number {
  let state = BigInt(seed);
  for (let i = 0; i < count; i++) state = (state * 1664525n + 1013904223n) & 0xffffffffn;
  return Number(state);
}

describe('M4 Match inventory transactions and unit lifecycle', () => {
  it('obtains opening components naturally, combines/equips once, and returns the same item on sale', () => {
    const initial = freeze(createMatch(42));
    expect(initial.items).toEqual([fixtureItem('item-1', 'blade'), fixtureItem('item-2', 'rod')]);
    expect(initial.nextItemSerial).toBe(3);
    expect(initial.scheduleReceipts).toEqual([{ eventId: 'r1-reward', round: 1, kind: 'reward',
      itemIds: ['item-1', 'item-2'], gold: 0, unitId: null, definitionId: null }]);
    const combined = accepted(combineItems(initial, 'item-2', 'item-1'));
    expect(combined.items).toEqual([fixtureItem('item-3', 'spell-edge')]);
    expect(combined.nextItemSerial).toBe(4);
    expect(combined.gold).toBe(10);
    expect(streams(combined)).toEqual(streams(initial));
    rejected(combined, s => combineItems(s, 'item-1', 'item-2'), 'unknown-item');
    const equipped = accepted(equipItem(freeze(combined), 'item-3', 'unit-1', 2));
    expect(equipped.items).toEqual([fixtureItem('item-3', 'spell-edge', 'unit-1', 2)]);
    expect(equipped.gold).toBe(10);
    expect(streams(equipped)).toEqual(streams(initial));
    rejected(equipped, s => equipItem(s, 'item-3', 'unit-1', 0), 'item-not-inventory');
    const sold = accepted(sellUnit(freeze(equipped), 'unit-1'));
    expect(sold.gold).toBe(11);
    expect(sold.items).toEqual([fixtureItem('item-3', 'spell-edge')]);
    expect(sold.nextItemSerial).toBe(4);
    expect(streams(sold)).toEqual(streams(initial));
    expect(initial.items).toHaveLength(2);
  });

  it('keeps the entire Match, ID counters, gold and three RNG streams identical after invalid item commands', () => {
    const state = createMatch(0);
    rejected(state, s => combineItems(s, 'item-1', 'item-1'), 'invalid-recipe');
    rejected(state, s => combineItems(s, 'missing', 'item-2'), 'unknown-item');
    rejected(state, s => equipItem(s, 'item-1', 'enemy-1', 0), 'enemy-unit');
    rejected(state, s => equipItem(s, 'item-1', 'unit-1', 3), 'invalid-slot');
    const equipped = accepted(equipItem(state, 'item-1', 'unit-1', 0));
    rejected(equipped, s => combineItems(s, 'item-1', 'item-2'), 'item-not-inventory');
    rejected(equipped, s => equipItem(s, 'item-2', 'unit-1', 0), 'item-slot-occupied');
  });

  it('commits gold, shop, serial, chained upgrades, equipment and binding together', () => {
    const initial = createMatch();
    const state: MatchState = { ...initial, shop: { ...initial.shop, slots: [{ status: 'available', definitionId: 'sentinel' }] },
      preparation: { ...initial.preparation, units: [fixtureUnit('unit-1', 1, 2, true), fixtureUnit('unit-2', 0, 2),
        fixtureUnit('unit-3', 1), fixtureUnit('unit-4', 2)] },
      items: [fixtureItem('item-1', 'blade', 'unit-1', 2), fixtureItem('item-2', 'rod', 'unit-2', 0),
        fixtureItem('item-3', 'vest', 'unit-3', 2), fixtureItem('item-4', 'belt', 'unit-4', 0)], nextItemSerial: 5,
      anomalyBinding: { definitionId: 'cycling-core', unitId: 'unit-4', choiceId: 'r7-anomaly', boundRound: 7 } };
    const before = clone(state), result = buyUnit(freeze(state), 0, state.shop.generation), next = accepted(result);
    expect(next.preparation.units).toEqual([fixtureUnit('unit-1', 1, 3, true)]);
    expect(next.items).toEqual([fixtureItem('item-1', 'blade', 'unit-1', 2), fixtureItem('item-2', 'rod', 'unit-1', 0),
      fixtureItem('item-3', 'vest'), fixtureItem('item-4', 'belt', 'unit-1', 1)]);
    expect(next.anomalyBinding).toEqual({ ...state.anomalyBinding, unitId: 'unit-1' });
    expect([next.gold, next.nextUnitSerial, next.nextItemSerial]).toEqual([9, 7, 5]);
    expect(next.shop.slots).toEqual([{ status: 'purchased' }]);
    expect(streams(next)).toEqual(streams(state));
    if (!result.ok) throw new Error(result.reason);
    expect(result.events.filter(event => event.type === 'unitUpgraded')).toHaveLength(2);
    expect(result.events.filter(event => event.type === 'anomalyTransferred').map(event => [event.fromId, event.toId]))
      .toEqual([['unit-4', 'unit-3'], ['unit-3', 'unit-1']]);
    expect(result.events.map(event => event.eventSeq)).toEqual(result.events.map((_, i) => state.nextMatchEventSeq + i));
    expect(state).toEqual(before);
    rejected(next, s => buyUnit(s, 0, state.shop.generation), 'purchased-slot');
  });

  it('discards all temporary roster/resource work if the final bench placement fails', () => {
    const initial = createMatch();
    const state: MatchState = { ...initial, shop: { ...initial.shop, slots: [{ status: 'available', definitionId: 'sentinel' }] },
      preparation: { ...initial.preparation, benchSize: 1, units: [fixtureUnit('a', 1, 1, true), fixtureUnit('b', 2, 1, true),
        fixtureUnit('c', 3, 1, true), { ...fixtureUnit('other', 0), definitionId: 'ranger' }] },
      items: [fixtureItem('item-1', 'blade', 'a', 2), fixtureItem('item-2', 'rod', 'b', 0)],
      anomalyBinding: { definitionId: 'cycling-core', unitId: 'b', choiceId: 'r7-anomaly', boundRound: 7 } };
    rejected(state, s => buyUnit(s, 0, s.shop.generation), 'bench-full');
  });
});

describe('M4 scheduled choices, locked phases and independent RNG streams', () => {
  it('blocks every ordinary command throughout augment, anomaly target and anomaly offer phases', () => {
    const augment = toRound(createMatch(), 2), anomaly = toRound(createMatch(), 7), choice = pending(anomaly);
    const offer = accepted(selectAnomalyTarget(anomaly, choice.choiceId, choice.generation, 'unit-1'));
    for (const state of [augment, anomaly, offer]) {
      for (const command of ordinaryCommands(state)) rejected(state, command, 'wrong-phase');
      for (let i = 0; i < 30; i++) for (const command of [rerollShop, buyXp, (s: MatchState) => sellUnit(s, 'unit-1')]) {
        rejected(state, command, 'wrong-phase');
      }
      const stepped = stepMatch(freeze(state));
      expect(stepped.state).toBe(state);
      expect(stepped.events).toEqual([]);
    }
  });

  it('draws exactly three choice words, excludes the prior augment and charges nothing to select', () => {
    const initial = createMatch(42), atTwo = toRound(initial, 2), choice = pending(atTwo);
    expect(atTwo.choiceRngState).toBe(words((42 ^ 0x9e3779b9) >>> 0, 3));
    expect(choice.offers).toHaveLength(3);
    expect(new Set(choice.offers).size).toBe(3);
    rejected(atTwo, s => selectChoice(s, choice.choiceId, choice.generation - 1, choice.offers[0]), 'stale-choice');
    rejected(atTwo, s => selectChoice(s, 'stale', choice.generation, choice.offers[0]), 'stale-choice');
    rejected(atTwo, s => selectChoice(s, choice.choiceId, choice.generation, 'missing'), 'invalid-choice');
    rejected(atTwo, s => rerollAnomaly(s, choice.choiceId, choice.generation), 'invalid-choice');
    const selected = chooseFirst(freeze(atTwo));
    expect(selected.phase).toBe('preparation');
    expect(selected.pendingChoice).toBeNull();
    expect(selected.gold).toBe(atTwo.gold);
    expect(streams(selected)).toEqual(streams(atTwo));
    expect(selected.augments).toEqual([{ definitionId: choice.offers[0], choiceId: 'r2-augment', acquiredRound: 2 }]);
    rejected(selected, s => selectChoice(s, choice.choiceId, choice.generation, choice.offers[0]), 'wrong-phase');
    const atFive = toRound(selected, 5), second = pending(atFive);
    expect(atFive.choiceRngState).toBe(words((42 ^ 0x9e3779b9) >>> 0, 6));
    expect(second.offers).not.toContain(choice.offers[0]);
    expect(chooseFirst(atFive).augments).toHaveLength(2);
  });

  it('locks one anomaly target, rerolls for exactly 2 gold and three words, and permanently binds the selected offer', () => {
    const targetState = toRound(createMatch(42), 7), targetChoice = pending(targetState);
    expect(targetState.scheduleReceipts.at(-1)).toMatchObject({ eventId: 'r7-reward', gold: 2 });
    expect(targetChoice).toMatchObject({ kind: 'anomaly', step: 'target', generation: 0, offers: [], targetId: null, rerollCount: 0 });
    expect(targetState.choiceRngState).toBe(words((42 ^ 0x9e3779b9) >>> 0, 6));
    rejected(targetState, s => selectAnomalyTarget(s, targetChoice.choiceId, 0, 'enemy-r7-1'), 'invalid-target');
    rejected(targetState, s => selectAnomalyTarget(s, targetChoice.choiceId, 0, 'missing'), 'invalid-target');
    rejected(targetState, s => rerollAnomaly(s, targetChoice.choiceId, 0), 'invalid-choice');
    rejected(targetState, s => selectChoice(s, targetChoice.choiceId, 0, 'cycling-core'), 'invalid-choice');
    const offerState = accepted(selectAnomalyTarget(freeze(targetState), targetChoice.choiceId, 0, 'unit-1'));
    const offer = pending(offerState);
    expect(offer).toMatchObject({ step: 'offer', targetId: 'unit-1', generation: 1, rerollCount: 0 });
    expect(offerState.choiceRngState).toBe(words((42 ^ 0x9e3779b9) >>> 0, 9));
    expect(offerState.gold).toBe(targetState.gold);
    rejected(offerState, s => selectAnomalyTarget(s, offer.choiceId, offer.generation, 'unit-2'), 'invalid-choice');
    rejected({ ...offerState, gold: 1 }, s => rerollAnomaly(s, offer.choiceId, offer.generation), 'insufficient-gold');
    const rerolled = accepted(rerollAnomaly(freeze(offerState), offer.choiceId, offer.generation)), current = pending(rerolled);
    expect(rerolled.gold).toBe(offerState.gold - 2);
    expect(rerolled.choiceRngState).toBe(words((42 ^ 0x9e3779b9) >>> 0, 12));
    expect([rerolled.rngState, rerolled.rewardRngState]).toEqual([offerState.rngState, offerState.rewardRngState]);
    expect(current).toMatchObject({ generation: 2, rerollCount: 1, targetId: 'unit-1' });
    expect(current.offers.every(id => !offer.offers.includes(id))).toBe(true);
    rejected(rerolled, s => rerollAnomaly(s, offer.choiceId, offer.generation), 'stale-choice');
    rejected(rerolled, s => selectChoice(s, offer.choiceId, offer.generation, offer.offers[0]), 'stale-choice');
    const selected = chooseFirst(freeze(rerolled));
    expect(selected.anomalyBinding).toEqual({ definitionId: current.offers[0], unitId: 'unit-1', choiceId: current.choiceId, boundRound: 7 });
    expect(selected.gold).toBe(rerolled.gold);
    expect(streams(selected)).toEqual(streams(rerolled));
    const sold = accepted(sellUnit(freeze(selected), 'unit-1'));
    expect(sold.anomalyBinding).toBeNull();
    expect(sold.gold).toBe(selected.gold + 1);
    expect(sold.pendingChoice).toBeNull();
    expect(sold.scheduleReceipts).toEqual(selected.scheduleReceipts);
    expect(sold.scheduleReceipts.filter(receipt => receipt.eventId === 'r7-anomaly')).toHaveLength(1);
  });

  it('restores locked targets/offers/generations and grants an empty-roster fallback only once', () => {
    let empty = createMatch();
    for (const unit of empty.preparation.units.filter(unit => unit.team === 'player')) empty = accepted(sellUnit(empty, unit.id));
    const before = toRound(empty, 6), after = toRound(before, 7), choice = pending(after);
    const receipt = after.scheduleReceipts.find(receipt => receipt.eventId === 'r7-reward');
    expect(receipt).toMatchObject({ unitId: 'unit-6', gold: 2 });
    expect(after.preparation.units.filter(unit => unit.team === 'player')).toEqual([fixtureUnit('unit-6', 0)]);
    expect(after.nextUnitSerial).toBe(7);
    const selected = selectAnomalyTarget(after, choice.choiceId, choice.generation, 'unit-6');
    expect(selectAnomalyTarget(clone(after), choice.choiceId, choice.generation, 'unit-6')).toEqual(selected);
    const offerState = accepted(selected), offer = pending(offerState);
    const rerolled = rerollAnomaly(offerState, offer.choiceId, offer.generation);
    expect(rerollAnomaly(clone(offerState), offer.choiceId, offer.generation)).toEqual(rerolled);
    const current = accepted(rerolled), currentChoice = pending(current);
    expect(selectChoice(clone(current), currentChoice.choiceId, currentChoice.generation, currentChoice.offers[0]))
      .toEqual(selectChoice(current, currentChoice.choiceId, currentChoice.generation, currentChoice.offers[0]));
    const final = chooseFirst(current);
    expect(final.nextUnitSerial).toBe(7);
    expect(final.scheduleReceipts.filter(value => value.eventId === 'r7-reward')).toHaveLength(1);
  });

  it('shop D/F activity cannot alter augment candidates or component rewards', () => {
    const passive = toRound(createMatch(123), 7);
    let active = createMatch(123);
    active = accepted(rerollShop(active));
    active = accepted(buyXp(active));
    active = accepted(rerollShop(active));
    active = toRound(active, 7);
    expect(active.rngState).not.toBe(passive.rngState);
    expect(active.choiceRngState).toBe(passive.choiceRngState);
    expect(active.rewardRngState).toBe(passive.rewardRngState);
    expect(active.items).toEqual(passive.items);
    expect(active.augments).toEqual(passive.augments);
    expect(active.pendingChoice).toEqual(passive.pendingChoice);
    expect(active.rewardRngState).toBe(words((123 ^ 0x85ebca6b) >>> 0, 3));
  });
});

function naturalReplay(options: { restore?: boolean; failures?: boolean } = {}) {
  let state = createMatch(42);
  const states: MatchState[] = [], events: MatchEvent[] = [], snapshots: unknown[] = [];
  function checkpoint(): void {
    if (options.failures) {
      rejected(state, s => combineItems(s, 'missing-a', 'missing-b'), state.phase === 'preparation' ? 'unknown-item' : 'wrong-phase');
      rejected(state, s => equipItem(s, 'missing', 'unit-1', 0), state.phase === 'preparation' ? 'unknown-item' : 'wrong-phase');
      rejected(state, s => selectChoice(s, 'stale-choice', -1, 'missing'), state.phase === 'choice' ? 'stale-choice' : 'wrong-phase');
    }
    states.push(clone(state));
    if (options.restore) state = clone(state);
  }
  function command(result: MatchCommandResult): void {
    state = accepted(result);
    if (result.ok) events.push(...result.events);
    checkpoint();
  }
  checkpoint();
  for (const [index, id] of ['unit-1', 'unit-2', 'unit-3'].entries()) {
    command(deployMatchUnit(state, id, { kind: 'board', cell: { row: 4, col: index * 2 + 1 } }));
  }
  command(combineItems(state, 'item-1', 'item-2'));
  command(equipItem(state, 'item-3', 'unit-1', 0));
  command(buyUnit(state, 0, state.shop.generation));
  command(buyUnit(state, 2, state.shop.generation));
  expect(state.preparation.units.find(unit => unit.id === 'unit-3')?.starLevel).toBe(2);
  expect(buildStrategySnapshot(state).traits.find(trait => trait.team === 'player' && trait.traitId === 'conduit')?.tier).toBe(2);
  command(rerollShop(state));
  command(buyXp(state));
  command(sellUnit(state, 'unit-5'));
  expect(state.shop.slots[0]).toEqual({ status: 'available', definitionId: 'binder' });
  command(buyUnit(state, 0, state.shop.generation));
  while (state.phase !== 'gameOver') {
    if (state.round > 30) throw new Error('Natural Match failed to terminate within 30 rounds');
    if (state.phase === 'choice') {
      let choice = pending(state);
      if (choice.kind === 'anomaly') {
        command(selectAnomalyTarget(state, choice.choiceId, choice.generation, 'unit-1'));
        choice = pending(state);
        command(rerollAnomaly(state, choice.choiceId, choice.generation));
        choice = pending(state);
      }
      const selected = ['cycling-core', 'guarded-form', 'echo-core'].find(id => choice.offers.includes(id)) ?? choice.offers[0];
      command(selectChoice(state, choice.choiceId, choice.generation, selected));
    }
    const round = state.round;
    if (round === 2) {
      expect(state.shop.slots[0]).toEqual({ status: 'available', definitionId: 'archer' });
      command(buyUnit(state, 0, state.shop.generation));
      command(deployMatchUnit(state, 'unit-2', { kind: 'bench', slot: 2 }));
      command(deployMatchUnit(state, 'unit-8', { kind: 'board', cell: { row: 5, col: 0 } }));
      command(deployMatchUnit(state, 'unit-9', { kind: 'board', cell: { row: 4, col: 3 } }));
      expect(buildStrategySnapshot(state).traits.find(trait => trait.team === 'player' && trait.traitId === 'conduit')?.tier).toBe(4);
    }
    if (round >= 7 && round <= 8) {
      const actual = buildStrategySnapshot(state), without = buildStrategySnapshot({ ...state, anomalyBinding: null });
      const owner = actual.units.find(unit => unit.unitId === 'unit-1')!;
      expect(new Set(owner.sources.map(effect => effect.source.sourceKind))).toEqual(new Set(['trait', 'item', 'augment', 'anomaly']));
      expect(owner).not.toEqual(without.units.find(unit => unit.unitId === 'unit-1'));
      snapshots.push(clone(actual));
    }
    command(startMatchCombat(state));
    if (round >= 7 && round <= 8) {
      const owner = state.combat?.units.find(unit => unit.id === 'unit-1');
      const anomalyKeys = owner?.triggers?.filter(trigger => trigger.source.sourceKind === 'anomaly').map(trigger => trigger.key) ?? [];
      expect(owner?.effectRuntime?.filter(runtime => anomalyKeys.includes(runtime.key)).every(runtime => runtime.count === 0)).toBe(true);
    }
    while (state.phase === 'combat') {
      const step = stepMatch(state); state = step.state; events.push(...step.events); checkpoint();
    }
    expect(state.roundResults).toHaveLength(round);
    if (state.phase === 'settlement') command(nextRound(state, round));
  }
  expect(snapshots).toHaveLength(2);
  expect(state.round).toBeGreaterThanOrEqual(8);
  expect(state.anomalyBinding?.unitId).toBe('unit-1');
  expect(events.some(event => event.type === 'cast')).toBe(true);
  expect(events.some(event => event.type === 'manaChanged')).toBe(true);
  for (const round of [7, 8]) {
    expect(events.some(event => event.type === 'effectTriggered' && event.source.sourceKind === 'anomaly' && event.combatId === `round-${round}`)).toBe(true);
  }
  for (const command of ordinaryCommands(state)) rejected(state, command, 'wrong-phase');
  expect(stepMatch(state)).toEqual({ state, events: [] });
  const reset = createMatch(42);
  expect(reset).toEqual(createMatch(42));
  expect(reset.anomalyBinding).toBeNull();
  expect(reset.augments).toEqual([]);
  expect(reset.items).toEqual([fixtureItem('item-1', 'blade'), fixtureItem('item-2', 'rod')]);
  return { state, states, events, snapshots };
}

describe('M4 naturally progressed Match replay through two bound battles and Game Over', () => {
  it('uses one continuous createMatch state with real rewards, choices, paid reroll and four-source combat', () => {
    expect(naturalReplay()).toEqual(naturalReplay());
  }, 60000);
  it('preserves every command/tick snapshot and event when JSON-restoring and inserting rejected commands', () => {
    expect(naturalReplay({ restore: true, failures: true })).toEqual(naturalReplay());
  }, 60000);
});

import { beforeAll, describe, expect, it } from 'vitest';
import {
  buyUnit, combineItems, createMatch, deployMatchUnit, equipItem, nextRound, rerollShop,
  selectChoice, sellUnit, startMatchCombat, stepMatch,
  type MatchCommandResult, type MatchEvent, type MatchState,
} from '../src/simulation/match';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';

// LOOT §6.1–6.3's H=80 arithmetic remains independently pinned in
// m8-b8-oracle.test.ts. These production controls acquire everything by public
// commands: their actual historical interest is 14, so their starting H is 112.
// Never inject gold, progress, deaths, resources, receipts or provenance to make
// a reachable Match look like the isolated arithmetic inputs.
const VECTORS = [
  { gold: 9, rerolls: 25, interestBasis: 10, interest: 1, goldAfter: 16, investmentHp: 120 },
  { gold: 49, rerolls: 5, interestBasis: 50, interest: 5, goldAfter: 60, investmentHp: 152 },
  { gold: 50, rerolls: 5, interestBasis: 51, interest: 5, goldAfter: 61, investmentHp: 152 },
] as const;
const source = (slot: string) => JSON.stringify(['pve', '2-7', 'krugs-v1', slot]);
const drop = (slot: string, ordinal: number) => JSON.stringify(['2-7', 'krugs-v1', source(slot), ordinal]);
const receiptId = (dropId: string) => JSON.stringify([dropId, 'grant']);
const componentDrop = drop('k01', 0), goldDrop = drop('k01', 1), choiceDrop = drop('k02', 0);
const choiceId = JSON.stringify(['m8b-loot-choice', choiceDrop]);
const counter = JSON.stringify(['m8b-loot-project-v1', '2-7', 'components-granted']);
const componentReceipt = {
  receiptId: receiptId(componentDrop), dropId: componentDrop,
  payload: { kind: 'item', definitionId: 'belt', quantity: 1 }, grantedItemIds: ['item-5'], grantedUnitIds: [],
};
const goldReceipt = {
  receiptId: receiptId(goldDrop), dropId: goldDrop,
  payload: { kind: 'gold', quantity: 1 }, grantedItemIds: [], grantedUnitIds: [],
};
const choiceReceipt = {
  receiptId: receiptId(choiceDrop), dropId: choiceDrop,
  payload: { kind: 'item', definitionId: 'tear', quantity: 1 }, grantedItemIds: ['item-6'], grantedUnitIds: [],
};
type Mutable<T> = { -readonly [K in keyof T]: Mutable<T[K]> };

function accepted(result: MatchCommandResult): MatchState {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.reason);
  return result.state;
}
function roundTrip(state: MatchState): MatchState {
  const saved = serializeMatch(state), before = structuredClone(state);
  const restored = restoreMatch(saved);
  expect(restored).toEqual(before);
  expect(restored).not.toBe(state);
  expect(restored.m8.loot).not.toBe(state.m8.loot);
  expect(restored.resourceProvenance).not.toBe(state.resourceProvenance);
  expect(serializeMatch(state)).toBe(saved);
  return restored;
}
function expectNoDraws(before: MatchState, after: MatchState): void {
  for (const field of ['rngState', 'choiceRngState', 'rewardRngState', 'battleSeedRngState', 'equipmentState'] as const) {
    expect(after[field]).toEqual(before[field]);
  }
  expect(after.m8.loot.frozen.rng).toEqual(before.m8.loot.frozen.rng);
  expect(after.combat?.rngState).toBe(before.combat?.rngState);
  expect(after.combat?.rngDraws).toBe(before.combat?.rngDraws);
}
function rejectCommand(state: MatchState, call: (state: MatchState) => MatchCommandResult, reason: string): void {
  const saved = serializeMatch(state), result = call(state);
  expect(result).toEqual({ ok: false, state, reason });
  expect(result.state).toBe(state);
  expect(serializeMatch(state)).toBe(saved);
}
function rejectSave(state: MatchState, change: (state: Mutable<MatchState>) => void, reason: string): void {
  // A JSON save has separate receipt/plan objects. structuredClone preserves
  // live shared payload references and would corrupt two fields at once.
  const saved = serializeMatch(state), invalid = JSON.parse(saved) as Mutable<MatchState>;
  change(invalid);
  expect(() => restoreMatch(invalid)).toThrow(reason);
  expect(serializeMatch(state)).toBe(saved);
}
function finish(state: MatchState): MatchState {
  state = accepted(startMatchCombat(state));
  for (let tick = 0; state.phase === 'combat' && tick < 1201; tick++) state = stepMatch(state).state;
  expect(['settlement', 'choice']).toContain(state.phase);
  return state;
}
function benchPlayers(input: MatchState): MatchState {
  let state = input;
  for (const unit of state.preparation.units.filter(unit => unit.team === 'player' && unit.location.kind === 'board')) {
    const used = new Set(state.preparation.units.flatMap(unit => unit.location.kind === 'bench' ? [unit.location.slot] : []));
    const slot = Array.from({ length: 9 }, (_, index) => index).find(index => !used.has(index));
    if (slot === undefined) throw new Error('No public bench slot');
    state = accepted(deployMatchUnit(state, unit.id, { kind: 'bench', slot }));
  }
  return state;
}
let preparation: MatchState;
beforeAll(() => {
  let state = createMatch(42);
  while (state.roundDefinitionId !== '2-7') {
    if (state.phase === 'choice') {
      const choice = state.pendingChoice!;
      expect(choice.kind === 'component' || choice.offers.includes('investment-strategy-i')).toBe(true);
      state = accepted(selectChoice(state, choice.choiceId, choice.generation,
        choice.kind === 'component' ? 'sword' : 'investment-strategy-i'));
    } else if (state.phase === 'settlement') state = accepted(nextRound(state, state.round));
    else {
      if (state.round > 3) state = benchPlayers(state);
      else if (state.round > 1) state = accepted(deployMatchUnit(state, state.round === 2 ? 'unit-2' : 'unit-3',
        { kind: 'board', cell: { col: state.round === 2 ? 3 : 5, row: 7 } }));
      state = finish(state);
    }
  }
  expect(state).toMatchObject({ phase: 'preparation', gold: 60, playerHp: 73, level: 4,
    augmentProgress: { pumpingRounds: 0, investmentHp: 112 } });
  expect(state.roundResults.map(result => [result.roundId, result.incomeBreakdown.interest])).toEqual([
    ['1-2', 0], ['1-3', 0], ['1-4', 0], ['2-1', 1], ['2-2', 1], ['2-3', 2], ['2-4', 3], ['2-5', 3], ['2-6', 4],
  ]);
  expect(state.items.map(item => [item.id, item.definitionId])).toEqual([
    ['item-1', 'sword'], ['item-2', 'sword'], ['item-3', 'sword'],
  ]);
  state = accepted(combineItems(state, 'item-1', 'item-2'));
  state = accepted(equipItem(state, 'item-4', 'unit-2', 0));
  state = accepted(equipItem(state, 'item-3', 'unit-2', 1));
  for (const [index, unitId] of ['unit-1', 'unit-2', 'unit-3'].entries()) state = accepted(deployMatchUnit(state, unitId,
    { kind: 'board', cell: { col: 1 + index * 2, row: index ? 7 : 4 } }));
  preparation = roundTrip(state);
});

describe('B8 public Match loot-before-interest production controls', () => {
  it.each(VECTORS)('$gold G + real 1G settles to $goldAfter G once, across restore and public choice/Continue', vector => {
    let state = roundTrip(preparation);
    if (vector.gold !== 50) {
      expect(state.shop.generation).toBe(10);
      expect(state.shop.slots[0]).toEqual({ status: 'available', definitionId: 'maddie' });
      state = accepted(buyUnit(state, 0, 10));
    }
    for (let index = 0; index < vector.rerolls; index++) state = accepted(rerollShop(state));
    expect(state.gold).toBe(vector.gold);
    expect(state.augmentProgress.investmentHp).toBe(112);
    const before = state, prefix = state.resourceProvenance.entries.length;
    const allEvents: MatchEvent[] = [], restoredEvents: MatchEvent[] = [];
    const started = startMatchCombat(state), resumedStart = startMatchCombat(roundTrip(state));
    expect(resumedStart).toEqual(started);
    state = accepted(started);
    let resumed = accepted(resumedStart);
    if (!started.ok || !resumedStart.ok) throw new Error('Public start failed');
    allEvents.push(...started.events); restoredEvents.push(...resumedStart.events);
    const basis = structuredClone(state.combatInputBasis), strategy = structuredClone(state.combat!.strategy);
    expect(basis!.inputs.augmentProgress.investmentHp).toBe(112);
    let revealRestored = false;
    for (let tick = 0; state.phase === 'combat' && tick < 1201; tick++) {
      const next = stepMatch(state), restoredNext = stepMatch(resumed);
      expect(restoredNext).toEqual(next);
      allEvents.push(...next.events); restoredEvents.push(...restoredNext.events);
      state = next.state; resumed = restoredNext.state;
      expect(state.combatInputBasis).toEqual(basis);
      expect(state.combat!.strategy).toEqual(strategy);
      if (state.phase === 'combat') {
        expect(state.gold).toBe(vector.gold);
        expect(state.augmentProgress.investmentHp).toBe(112);
        expect(state.items).toEqual(before.items);
        expect(state.preparation).toEqual(before.preparation);
        expect(state.resourceProvenance).toEqual(before.resourceProvenance);
        expect(state.m8.loot.receipts).toEqual(before.m8.loot.receipts);
        expect(state.nextUnitSerial).toBe(before.nextUnitSerial);
        expect(state.nextItemSerial).toBe(before.nextItemSerial);
        expect(state.m8.loot.frozen).toEqual(before.m8.loot.frozen);
        if (!revealRestored && next.events.some(event => event.type === 'lootRevealed')) {
          resumed = roundTrip(resumed); revealRestored = true;
          expect(state.pendingChoice).toBeNull();
          expect(state.m8.loot.choiceEligibility.at(-1)).toEqual({ dropId: choiceDrop, status: 'revealed' });
        }
      }
    }
    expect(revealRestored).toBe(true);
    expect(restoredEvents).toEqual(allEvents);
    expect(resumed).toEqual(state);
    expect(state).toMatchObject({ phase: 'choice', gold: vector.goldAfter, playerHp: 73,
      augmentProgress: { pumpingRounds: 0, investmentHp: vector.investmentHp } });
    expect(state.combat!.result).toBe('playerWin');
    expect(state.combatInputBasis!.inputs.augmentProgress.investmentHp).toBe(112);
    expect(state.roundResults.at(-1)).toMatchObject({ roundId: '2-7', settlementId: 'round-10-settled',
      goldBefore: vector.interestBasis, interestBasis: vector.interestBasis, goldAfter: vector.goldAfter,
      income: 5 + vector.interest, incomeBreakdown: { base: 5, win: 0, interest: vector.interest, streak: 0 },
      xpRequested: 2, xpAwarded: 2, hpBefore: 73, hpAfter: 73 });
    expect(state.m8.loot.receipts).toEqual([...before.m8.loot.receipts, componentReceipt, goldReceipt]);
    expect(state.resourceProvenance.entries.slice(prefix)).toEqual([
      { sequence: prefix, roundId: '2-7', kind: 'item-acquired', itemId: 'item-5', source: { kind: 'loot', receiptId: receiptId(componentDrop) } },
      { sequence: prefix + 1, roundId: '2-7', kind: 'combat-growth-committed', combatId: 'round-10', settlementId: 'round-10-settled',
        combatStartProvenancePrefixLength: prefix, sourceDeltas: [] },
    ]);
    expect(state.m8.loot.guaranteeCounters[counter]).toBe(1);
    expect(state.nextUnitSerial).toBe(before.nextUnitSerial);
    expect(state.nextItemSerial).toBe(6);
    expect(state.scheduleReceipts).toEqual(before.scheduleReceipts);
    expect(state.m8.loot.frozen).toEqual(before.m8.loot.frozen);
    expect(state.pendingChoice).toEqual({ kind: 'component', step: 'offer', choiceId, eventId: choiceId,
      generation: 0, returnPhase: 'settlement', offers: ['sword', 'vest', 'belt', 'rod', 'cloak', 'bow', 'gloves', 'tear'],
      targetId: null, rerollCount: 0 });
    expect(allEvents.filter(event => event.domain === 'match').map(event => event.type)).toEqual([
      'lootRevealed', 'lootRevealed', 'lootRevealed', 'lootGranted', 'lootGranted', 'roundSettled', 'choiceOpened',
    ]);
    const deaths = allEvents.filter(event => event.type === 'death');
    for (const [dropId, sourceUnitId] of [[componentDrop, source('k01')], [goldDrop, source('k01')], [choiceDrop, source('k02')]]) {
      const death = deaths.find(event => event.type === 'death' && event.unitId === sourceUnitId)!;
      expect(state.m8.loot.earnedEvidence.find(evidence => evidence.dropId === dropId)).toEqual({ dropId,
        death: { combatId: 'round-10', tick: death.tick, eventSeq: death.eventSeq } });
    }
    resumed = roundTrip(state);
    for (const candidate of [state, resumed]) {
      expect(stepMatch(candidate)).toEqual({ state: candidate, events: [] });
      expect(stepMatch(candidate).state).toBe(candidate);
      rejectCommand(candidate, s => nextRound(s, 10), 'wrong-phase');
      rejectCommand(candidate, s => startMatchCombat(s), 'wrong-phase');
      rejectCommand(candidate, s => sellUnit(s, 'unit-1'), 'wrong-phase');
      rejectCommand(candidate, s => selectChoice(s, choiceId, 1, 'tear'), 'stale-choice');
      rejectCommand(candidate, s => selectChoice(s, 'unknown-choice', 0, 'tear'), 'stale-choice');
      rejectCommand(candidate, s => selectChoice(s, choiceId, 0, 'deathblade'), 'invalid-choice');
    }
    rejectSave(state, s => { s.gold++; }, 'current settlement totals');
    rejectSave(state, s => { s.roundResults.at(-1)!.interestBasis++; }, 'history income');
    rejectSave(state, s => { s.augmentProgress.investmentHp += 8; }, 'investment progress');
    rejectSave(state, s => { s.m8.loot.receipts.at(-1)!.payload.quantity++; }, 'frozen receipt payload');
    rejectSave(state, s => { s.resourceProvenance.entries.pop(); }, 'missing combat growth commit');
    rejectSave(state, s => { s.resourceProvenance.entries[prefix].sequence++; }, 'sequence');
    rejectSave(state, s => {
      const birth = s.resourceProvenance.entries[prefix];
      if (birth.kind !== 'item-acquired' || birth.source.kind !== 'loot') throw new Error('Missing actual component birth');
      birth.source.receiptId = receiptId(choiceDrop);
    }, 'receipt birth binding');
    rejectSave(state, s => { s.m8.loot.guaranteeCounters[counter]++; }, 'actual guarantee counters');
    const selected = selectChoice(state, choiceId, 0, 'tear');
    const restoredSelected = selectChoice(resumed, choiceId, 0, 'tear');
    expect(restoredSelected).toEqual(selected);
    const pending = state;
    state = accepted(selected); resumed = roundTrip(accepted(restoredSelected));
    expect(state.phase).toBe('settlement');
    expect(state.gold).toBe(vector.goldAfter);
    expect(state.augmentProgress.investmentHp).toBe(vector.investmentHp);
    expect(state.roundResults).toEqual(pending.roundResults);
    expect(state.combat).toEqual(pending.combat);
    expect(state.combatInputBasis).toEqual(basis);
    expectNoDraws(pending, state);
    expect(state.nextUnitSerial).toBe(pending.nextUnitSerial);
    expect(state.scheduleReceipts).toEqual(before.scheduleReceipts);
    expect(state.m8.loot.frozen).toEqual(before.m8.loot.frozen);
    expect(state.m8.loot.receipts).toEqual([...pending.m8.loot.receipts, choiceReceipt]);
    expect(state.m8.loot.choiceResolutions.at(-1)).toEqual({ dropId: choiceDrop, receiptId: receiptId(choiceDrop), method: 'player-choice' });
    expect(state.m8.loot.guaranteeCounters[counter]).toBe(2);
    expect(state.resourceProvenance.entries).toEqual([...pending.resourceProvenance.entries,
      { sequence: prefix + 2, roundId: '2-7', kind: 'item-acquired', itemId: 'item-6', source: { kind: 'loot', receiptId: receiptId(choiceDrop) } },
    ]);
    if (!selected.ok) throw new Error(selected.reason);
    expect(selected.events.map(event => event.type)).toEqual(['lootGranted', 'lootChoiceResolved', 'choiceSelected']);
    for (const candidate of [state, resumed]) {
      expect(stepMatch(candidate)).toEqual({ state: candidate, events: [] });
      rejectCommand(candidate, s => selectChoice(s, choiceId, 0, 'tear'), 'wrong-phase');
      rejectCommand(candidate, s => nextRound(s, 9), 'stale-round');
      rejectCommand(candidate, s => sellUnit(s, 'unit-1'), 'wrong-phase');
    }
    rejectSave(state, s => { s.m8.loot.choiceResolutions.at(-1)!.method = 'terminal-fallback'; }, 'terminal fallback');
    rejectSave(state, s => { s.resourceProvenance.entries.pop(); }, 'birth');
    const continued = nextRound(state, 10), resumedContinue = nextRound(resumed, 10);
    expect(resumedContinue).toEqual(continued);
    const settled = state;
    state = accepted(continued); resumed = roundTrip(accepted(resumedContinue));
    expect(resumed).toEqual(state);
    expect(state).toMatchObject({ phase: 'preparation', roundDefinitionId: '3-1', gold: vector.goldAfter,
      augmentProgress: { pumpingRounds: 0, investmentHp: vector.investmentHp }, combat: null, combatInputBasis: null });
    expect(state.roundResults).toEqual(settled.roundResults);
    expect(state.m8.loot.receipts).toEqual(settled.m8.loot.receipts);
    expect(state.resourceProvenance).toEqual(settled.resourceProvenance);
    expect(state.nextUnitSerial).toBe(settled.nextUnitSerial);
    expect(state.nextItemSerial).toBe(7);
    expect(stepMatch(state)).toEqual({ state, events: [] });
    rejectCommand(state, s => nextRound(s, 10), 'wrong-phase');
  });
});

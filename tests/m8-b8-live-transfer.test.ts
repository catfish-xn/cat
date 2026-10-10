import { describe, expect, it } from 'vitest';
import * as api from '../src/simulation/match';
import type { MatchCommandResult, MatchEvent, MatchState } from '../src/simulation/match';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { run } from '../scripts/generate-m5-route.cjs';
import type { FrozenDirectDrop } from '../src/simulation/loot-types';

const SURVIVOR = 'unit-21', DONOR = 'unit-22', REWARD = 'unit-24', TG = 'item-9';
const players = (state: MatchState) => state.preparation.units.filter(unit => unit.team === 'player');
function accepted(result: MatchCommandResult): MatchState {
  if (!result.ok) throw new Error(`Public transfer fixture: ${result.reason}`);
  return result.state;
}
function choose(state: MatchState, definitionId: string): MatchState {
  const choice = state.pendingChoice!;
  return accepted(api.selectChoice(state, choice.choiceId, choice.generation, definitionId));
}
function finish(input: MatchState) {
  let state = input;
  const events: MatchEvent[] = [];
  while (state.phase === 'combat' && state.combat.tick < 1201) {
    const result = api.stepMatch(state);
    state = result.state; events.push(...result.events);
  }
  if (state.phase === 'combat') throw new Error('Public transfer battle exceeded its tick bound');
  return { state, events };
}
function roundTrip(state: MatchState): MatchState {
  const saved = serializeMatch(state), restored = restoreMatch(saved);
  expect(restored).toEqual(state);
  expect(restored).not.toBe(state);
  expect(serializeMatch(state)).toBe(saved);
  return restored;
}
/** Real seed-230 cannon commands/ticks through 3-4, then a fixed public branch.
 * No HP, resources, roster, deaths, provenance, or saved state is injected.
 * This is a domain route, not B9 application/history-envelope acceptance. */
async function preparation(): Promise<MatchState> {
  let prefix: MatchState | undefined;
  const captured = new Error('Captured real 3-4 component choice');
  try {
    await run({ ...api, selectChoice(state: MatchState, ...args: [string, number, string]) {
      if (state.roundDefinitionId === '3-4') { prefix = state; throw captured; }
      return api.selectChoice(state, ...args);
    } }, { build: 'cannon', seed: 230 });
  } catch (error) { if (error !== captured) throw error; }
  if (!prefix) throw new Error('Public route did not reach 3-4');
  let state = accepted(api.nextRound(choose(prefix, 'gloves'), 14));
  // Sell the old 2-star Ezreal; return the two Maddies' real items to Tristana.
  for (const id of ['unit-16', 'unit-2', 'unit-10']) state = accepted(api.sellUnit(state, id));
  state = accepted(api.equipItem(state, 'item-3', 'unit-13', 0));
  state = accepted(api.equipItem(state, 'item-7', 'unit-13', 1));
  for (let count = 0; count < 8; count++) state = accepted(api.buyXp(state));
  state = accepted(api.buyUnit(state, 0, 20));
  for (let count = 0; count < 4; count++) state = accepted(api.rerollShop(state));
  state = accepted(api.buyUnit(state, 2, 24));
  state = accepted(api.deployMatchUnit(state, SURVIVOR, { kind: 'board', cell: { col: 3, row: 7 } }));
  state = accepted(api.deployMatchUnit(state, DONOR, { kind: 'board', cell: { col: 5, row: 7 } }));
  // item-5 is the actual 2-7 direct gloves; item-8 is the actual 3-4 supply choice.
  state = accepted(api.combineItems(state, 'item-5', 'item-8'));
  state = accepted(api.equipItem(state, TG, DONOR, 0));
  while (state.roundDefinitionId !== '4-7') {
    if (state.phase === 'choice') {
      const choice = state.pendingChoice!;
      if (choice.kind === 'anomaly' && choice.step === 'target') {
        state = accepted(api.selectAnomalyTarget(state, choice.choiceId, choice.generation, DONOR));
      } else state = choose(state, choice.kind === 'component' ? 'gloves'
        : choice.kind === 'anomaly' ? 'mage-armor' : 'bulky-buddies-i');
    } else if (state.phase === 'settlement') state = accepted(api.nextRound(state, state.round));
    else if (state.phase === 'preparation') state = finish(accepted(api.startMatchCombat(state))).state;
    else throw new Error(`Unexpected public transfer phase: ${state.phase}`);
  }
  return state;
}
function battle(prepared: MatchState) {
  const start = api.startMatchCombat(prepared), started = accepted(start);
  if (!start.ok) throw new Error(start.reason);
  let ended = started, revealed: MatchState | undefined, beforeFinal: MatchState | undefined;
  let revealPrefix: MatchEvent[] = [];
  const events: MatchEvent[] = [...start.events];
  while (ended.phase === 'combat' && ended.combat.tick < 1201) {
    const before = ended, step = api.stepMatch(ended);
    ended = step.state; events.push(...step.events);
    if (!revealed && ended.phase === 'combat' && step.events.some(event => event.type === 'lootRevealed')) {
      revealed = ended; revealPrefix = [...events];
    }
    if (ended.phase !== 'combat') beforeFinal = before;
  }
  if (!revealed || !beforeFinal || ended.phase !== 'choice') throw new Error('Expected real reveal and finished loot choice');
  return { prepared, started, revealed, beforeFinal, ended, selected: choose(ended, 'sword'), events, revealPrefix, startEvents: start.events };
}
const prepared = await preparation();
const migration = battle(prepared);
// The only alternative is one public equip of the already-earned 3-7 belt.
const conflict = battle(accepted(api.equipItem(prepared, 'item-10', SURVIVOR, 0)));
const scenarios = [{ name: 'TG migrates', live: migration, returned: false },
  { name: 'conflicting TG returns', live: conflict, returned: true }];

function assertOriginalInput(live: ReturnType<typeof battle>): void {
  const { prepared, started, ended } = live, basis = ended.combatInputBasis!;
  expect(basis).toEqual(started.combatInputBasis);
  expect(basis.inputs.preparation).toEqual(prepared.preparation);
  expect(basis.inputs.items).toEqual(prepared.items);
  expect(basis.inputs.anomalyBinding).toEqual(prepared.anomalyBinding);
  expect(basis.inputs.temporaryEquipment).toEqual(prepared.temporaryEquipment);
  expect(basis.equipmentRollPrefixLength).toBe(10);
  expect(basis.provenancePrefixLength).toBe(64);
  expect(basis.inputs.items.find(item => item.id === TG)?.location).toEqual({ kind: 'unit', unitId: DONOR, slot: 0 });
  expect(basis.inputs.anomalyBinding?.unitId).toBe(DONOR);
  expect(ended.combat!.strategy).toEqual(buildStrategySnapshot(basis.inputs));
  expect(ended.combat!.strategy).not.toEqual(buildStrategySnapshot(ended));
  expect(ended.combat!.units.filter(unit => [SURVIVOR, DONOR].includes(unit.id)).map(({ id, starLevel }) => ({ id, starLevel })))
    .toEqual([{ id: SURVIVOR, starLevel: 1 }, { id: DONOR, starLevel: 1 }]);
  expect(ended.combat!.units.some(unit => unit.id === REWARD)).toBe(false);
  const original = ended.combat!.units.find(unit => unit.id === DONOR)!;
  expect(original.itemPrograms!.find(program => program.source.instanceId === TG)?.source)
    .toEqual({ ownerId: DONOR, sourceKind: 'item', definitionId: 'thiefs-gloves', instanceId: TG, effectIndex: 2048, parentItemInstanceId: null });
  expect(original.sources!.filter(effect => effect.source.sourceKind === 'anomaly').map(effect => effect.source))
    .toEqual([{ ownerId: DONOR, sourceKind: 'anomaly', sourceDefinitionId: 'mage-armor',
      sourceInstanceId: 'round:4-6:anomaly', effectIndex: 0 }]);
  for (const child of prepared.temporaryEquipment) {
    const sources = original.sources!.filter(effect => effect.source.sourceInstanceId === child.temporaryId);
    expect(sources.length).toBeGreaterThan(0);
    expect(sources.every(effect => effect.source.ownerId === DONOR && effect.source.parentItemInstanceId === TG)).toBe(true);
  }
  expect(ended.equipmentState).toEqual(prepared.equipmentState);
}

describe('B8 live reward upgrade with equipment, anomaly and G12 transfer', () => {
  it('pins actual purchases, component births, anomaly target and the 4-7 reward candidate', () => {
    expect(prepared).toMatchObject({ roundDefinitionId: '4-7', phase: 'preparation', playerHp: 81, gold: 118, level: 7,
      nextUnitSerial: 24, nextItemSerial: 13 });
    expect(players(prepared).filter(unit => unit.definitionId === 'ezreal').map(({ id, starLevel, location }) => ({ id, starLevel, location })))
      .toEqual([{ id: SURVIVOR, starLevel: 1, location: { kind: 'board', cell: { col: 3, row: 7 } } },
        { id: DONOR, starLevel: 1, location: { kind: 'board', cell: { col: 5, row: 7 } } }]);
    expect(prepared.resourceProvenance.entries.filter(entry => entry.kind === 'unit-acquired' && [SURVIVOR, DONOR].includes(entry.unitId)))
      .toEqual([expect.objectContaining({ unitId: SURVIVOR, source: { kind: 'shop', generation: 20, slotIndex: 0, definitionId: 'ezreal' } }),
        expect.objectContaining({ unitId: DONOR, source: { kind: 'shop', generation: 24, slotIndex: 2, definitionId: 'ezreal' } })]);
    expect(prepared.resourceProvenance.entries.find(entry => entry.kind === 'unit-sold' && entry.unitId === 'unit-16'))
      .toMatchObject({ roundId: '3-5', context: 'preparation', goldGranted: 8 });
    expect(prepared.m8.loot.receipts.find(receipt => receipt.grantedItemIds.includes('item-5'))?.payload)
      .toEqual({ kind: 'item', definitionId: 'gloves', quantity: 1 });
    expect(prepared.scheduleReceipts.find(receipt => receipt.eventId === 'round:3-4:supply'))
      .toMatchObject({ itemIds: ['item-8'], definitionId: 'gloves' });
    expect(prepared.resourceProvenance.entries.find(entry => entry.kind === 'item-combined' && entry.event.itemId === TG))
      .toMatchObject({ event: { consumedIds: ['item-5', 'item-8'], itemId: TG, definitionId: 'thiefs-gloves' } });
    expect(prepared.scheduleReceipts.at(-1)).toEqual({ eventId: 'round:4-6:anomaly', round: 23, kind: 'anomaly',
      itemIds: [], gold: 0, unitId: DONOR, definitionId: 'mage-armor' });
    expect(prepared.temporaryEquipment).toEqual([
      { temporaryId: '["item-9","4-7",1]', parentItemInstanceId: TG, roundId: '4-7', holderId: DONOR,
        definitionId: 'archangel', slot: 1, expiresAfterRoundId: '4-7' },
      { temporaryId: '["item-9","4-7",2]', parentItemInstanceId: TG, roundId: '4-7', holderId: DONOR,
        definitionId: 'deathcap', slot: 2, expiresAfterRoundId: '4-7' },
    ]);
    expect(prepared.equipmentState.equipment).toEqual({ state: 667155026, draws: 20 });
    expect(prepared.equipmentState.rolls).toHaveLength(10);
    expect(prepared.equipmentState.rolls.at(-1)).toEqual({ parentItemInstanceId: TG, roundId: '4-7', playerLevelSnapshot: 7,
      poolVersion: 'tg-01-v1', children: ['archangel', 'deathcap'], rngDrawStart: 18, rngDrawEnd: 20 });
    const drops: readonly FrozenDirectDrop[] = prepared.m8.loot.frozen.rounds.at(-1)!.encounterPlan.drops;
    expect(drops.map(({ sourceUnitId, slotOrdinal, payload }) => ({ sourceUnitId, slotOrdinal, payload }))).toEqual([
      { sourceUnitId: '["pve","4-7","razorbeaks-v1","r00"]', slotOrdinal: 0, payload: { kind: 'item', definitionId: 'gloves', quantity: 1 } },
      { sourceUnitId: '["pve","4-7","razorbeaks-v1","r00"]', slotOrdinal: 1, payload: { kind: 'unit', definitionId: 'ezreal', quantity: 1 } },
    ]);
    expect(migration.revealed.combat!.tick).toBe(29);
    expect(migration.ended.combat!.tick).toBe(143);
    expect(migration.ended.combat!.neutralReceipts!.deaths[0])
      .toEqual({ unitId: drops[0].sourceUnitId, tick: 29, eventSeq: 86 });
  });

  it.each(scenarios)('$name: keeps the old Combat basis and commits the candidate/upgrade before current projections', ({ live, returned }) => {
    assertOriginalInput(live);
    const { ended, events } = live;
    expect(players(ended).filter(unit => unit.definitionId === 'ezreal'))
      .toEqual([{ id: SURVIVOR, definitionId: 'ezreal', team: 'player', starLevel: 2, location: { kind: 'board', cell: { col: 3, row: 7 } } }]);
    const receipt = ended.m8.loot.receipts.find(value => value.grantedUnitIds.includes(REWARD))!;
    expect(receipt.payload).toEqual({ kind: 'unit', definitionId: 'ezreal', quantity: 1 });
    expect(receipt.grantedUnitIds).toEqual([REWARD]);
    const suffix = ended.resourceProvenance.entries.slice(64);
    expect(suffix.map(entry => entry.kind)).toEqual(['item-acquired', 'unit-acquired', 'unit-upgraded', 'combat-growth-committed']);
    expect(suffix[1]).toEqual({ kind: 'unit-acquired', unitId: REWARD, source: { kind: 'loot', receiptId: receipt.receiptId }, sequence: 65, roundId: '4-7' });
    expect(suffix[2]).toEqual({ kind: 'unit-upgraded', acquisitionSequence: 65, sequence: 66, roundId: '4-7', event: {
      type: 'unitUpgraded', survivorId: SURVIVOR, consumedIds: [DONOR, REWARD], definitionId: 'ezreal', fromStar: 1, toStar: 2,
      location: { kind: 'board', cell: { col: 3, row: 7 } },
    } });
    expect(ended.anomalyBinding).toEqual({ definitionId: 'mage-armor', unitId: SURVIVOR, choiceId: 'round:4-6:anomaly', boundRound: 23 });
    expect(ended.items.find(item => item.id === TG)?.location).toEqual(returned ? { kind: 'inventory' } : { kind: 'unit', unitId: SURVIVOR, slot: 0 });
    expect(ended.temporaryEquipment).toEqual(returned ? [] : prepared.temporaryEquipment.map(child => ({ ...child, holderId: SURVIVOR })));
    expect(events.filter(event => event.type === 'anomalyTransferred')).toEqual([
      expect.objectContaining({ type: 'anomalyTransferred', fromId: DONOR, toId: SURVIVOR }),
    ]);
    expect(events.filter(event => event.type === 'itemsReturned')).toEqual(returned
      ? [expect.objectContaining({ type: 'itemsReturned', unitId: DONOR, itemIds: [TG] })] : []);
    expect(events.filter(event => event.type === 'temporaryEquipmentChanged')).toEqual([
      expect.objectContaining({ removed: prepared.temporaryEquipment,
        applied: returned ? [] : prepared.temporaryEquipment.map(child => ({ ...child, holderId: SURVIVOR })) }),
    ]);
    expect(events.some(event => event.type === 'equipmentRolled')).toBe(false);
    expect(ended.nextUnitSerial).toBe(25); expect(ended.nextItemSerial).toBe(14);
    expect(ended.m8.loot.receipts.length).toBe(prepared.m8.loot.receipts.length + 2);
    expect(ended.scheduleReceipts).toEqual(prepared.scheduleReceipts);
    expect(ended.items.filter(item => item.id === TG)).toHaveLength(1);
    const current = buildStrategySnapshot(ended).units.find(unit => unit.unitId === SURVIVOR)!;
    expect(current.sources.some(effect => effect.source.sourceKind === 'anomaly'
      && effect.source.ownerId === SURVIVOR && effect.source.sourceDefinitionId === 'mage-armor')).toBe(true);
    expect(current.sources.filter(effect => effect.source.parentItemInstanceId === TG).length).toBe(returned ? 0 : 5);
    expect(current.sources.filter(effect => effect.source.parentItemInstanceId === TG).every(effect => effect.source.ownerId === SURVIVOR)).toBe(true);
  });

  it.each(scenarios)('$name: strict restores every live boundary and preserves complete state/events through choice and Continue', ({ live, returned }) => {
    for (const state of [live.prepared, live.started, live.revealed, live.beforeFinal, live.ended, live.selected]) roundTrip(state);
    expect(api.startMatchCombat(roundTrip(live.prepared))).toEqual(api.startMatchCombat(live.prepared));
    const uninterrupted = finish(live.revealed), resumed = finish(roundTrip(live.revealed));
    expect(resumed).toEqual(uninterrupted);
    expect([...live.revealPrefix, ...resumed.events]).toEqual(live.events);
    expect(resumed.state).toEqual(live.ended);
    expect(api.stepMatch(roundTrip(live.beforeFinal))).toEqual(api.stepMatch(live.beforeFinal));
    const combatEvents = live.events.filter(event => event.domain === 'combat');
    expect(combatEvents.map(event => event.eventSeq)).toEqual(combatEvents.map((_, index) => index));
    expect(combatEvents.filter(event => event.type === 'combatFinished')).toHaveLength(1);
    const choice = live.ended.pendingChoice!;
    const chosen = api.selectChoice(live.ended, choice.choiceId, choice.generation, 'sword');
    expect(api.selectChoice(roundTrip(live.ended), choice.choiceId, choice.generation, 'sword')).toEqual(chosen);
    expect(accepted(chosen)).toEqual(live.selected);
    expect(live.selected.combat).toEqual(live.ended.combat);
    expect(live.selected.combatInputBasis).toEqual(live.ended.combatInputBasis);
    expect(live.selected.equipmentState).toEqual(live.ended.equipmentState);
    expect(live.selected.m8.loot.receipts.length).toBe(prepared.m8.loot.receipts.length + 3);
    expect(live.selected.nextItemSerial).toBe(15); expect(live.selected.nextUnitSerial).toBe(25);
    expect(live.selected.scheduleReceipts).toEqual(prepared.scheduleReceipts);
    const continued = api.nextRound(live.selected, 24);
    expect(api.nextRound(roundTrip(live.selected), 24)).toEqual(continued);
    const next = roundTrip(accepted(continued));
    expect(next.roundDefinitionId).toBe('5-1'); expect(next.combatInputBasis).toBeNull();
    expect(next.resourceProvenance).toEqual(live.selected.resourceProvenance);
    expect(next.m8.loot.receipts).toEqual(live.selected.m8.loot.receipts);
    expect(next.nextUnitSerial).toBe(25); expect(next.nextItemSerial).toBe(15);
    // A legitimately equipped parent rolls once for the new round, never again for restore/retry.
    expect(next.equipmentState.rolls.length).toBe(returned ? 10 : 11);
    expect(next.equipmentState.equipment.draws).toBe(returned ? 20 : 22);
    expect(next.temporaryEquipment.every(child => child.holderId === SURVIVOR && child.roundId === '5-1')).toBe(true);
  });

  it.each(scenarios)('$name: repeats cannot reroll, regrant, resettle or consume serials', ({ live }) => {
    const choice = live.ended.pendingChoice!, advanced = accepted(api.nextRound(live.selected, 24));
    const reject = (state: MatchState, operation: (value: MatchState) => MatchCommandResult, reason: string) => {
      const saved = serializeMatch(state), result = operation(state);
      expect(result).toEqual({ ok: false, state, reason }); expect(result.state).toBe(state);
      expect(serializeMatch(state)).toBe(saved);
      const restored = roundTrip(state), restoredBefore = serializeMatch(restored), resumed = operation(restored);
      expect(resumed).toEqual(result); expect(resumed.state).toBe(restored);
      expect(serializeMatch(restored)).toBe(restoredBefore);
    };
    for (const state of [live.ended, live.selected, roundTrip(live.selected), advanced]) {
      const saved = serializeMatch(state), result = api.stepMatch(state);
      expect(result).toEqual({ state, events: [] }); expect(result.state).toBe(state);
      expect(serializeMatch(state)).toBe(saved);
    }
    reject(live.ended, state => api.nextRound(state, 24), 'wrong-phase');
    reject(live.ended, state => api.selectChoice(state, choice.choiceId, choice.generation + 1, 'sword'), 'stale-choice');
    reject(live.selected, state => api.selectChoice(state, choice.choiceId, choice.generation, 'sword'), 'wrong-phase');
    reject(live.selected, api.startMatchCombat, 'wrong-phase');
    reject(advanced, state => api.nextRound(state, 24), 'wrong-phase');
    for (const state of [live.ended, live.selected, advanced]) {
      expect(state.resourceProvenance.entries.filter(entry => entry.kind === 'combat-growth-committed' && entry.combatId === 'round-24')).toHaveLength(1);
      expect(state.resourceProvenance.entries.filter(entry => entry.kind === 'unit-acquired' && entry.unitId === REWARD)).toHaveLength(1);
    }
  });
});

type Mutable<T> = T extends readonly (infer Value)[] ? Mutable<Value>[]
  : T extends object ? { -readonly [Key in keyof T]: Mutable<T[Key]> } : T;
type MutableMatch = Mutable<MatchState>;
const corruptions: readonly [string, (state: MutableMatch) => void, string][] = [
  ['basis equipment roll prefix', state => { state.combatInputBasis!.equipmentRollPrefixLength--; }, 'Invalid combat input basis'],
  ['basis TG parent moved without its children', state => {
    state.combatInputBasis!.inputs.items.find(item => item.id === TG)!.location = { kind: 'unit', unitId: SURVIVOR, slot: 0 };
  }, 'Invalid combat input basis'],
  ['basis temporary holder rewritten after upgrade', state => {
    state.combatInputBasis!.inputs.temporaryEquipment.forEach(child => { child.holderId = SURVIVOR; });
  }, 'Invalid combat input basis'],
  ['basis one-star origin rewritten after upgrade', state => {
    state.combatInputBasis!.inputs.preparation.units.find(unit => unit.id === DONOR)!.starLevel = 2;
  }, 'Invalid combat input basis'],
  ['basis anomaly target rewritten after upgrade', state => { state.combatInputBasis!.inputs.anomalyBinding!.unitId = SURVIVOR; },
    'Invalid Match save: resolved strategy'],
  ['current TG parent falsely returned with matching empty children', state => {
    state.items.find(item => item.id === TG)!.location = { kind: 'inventory' }; state.temporaryEquipment = [];
  }, 'Invalid B8 Match: finished resource projection'],
  ['current anomaly silently removed', state => { state.anomalyBinding = null; }, 'Invalid B8 Match: finished resource projection'],
  ['current child moved back to consumed donor', state => { state.temporaryEquipment.forEach(child => { child.holderId = DONOR; }); },
    'Invalid current temporary equipment projection'],
  ['original finished Combat star rewritten', state => { state.combat!.units.find(unit => unit.id === DONOR)!.starLevel = 2; },
    'Invalid Match save: combat unit identity'],
  ['original finished Combat child source parent rewritten', state => {
    state.combat!.units.find(unit => unit.id === DONOR)!.sources!.find(effect => effect.source.parentItemInstanceId === TG)!.source.parentItemInstanceId = 'item-3';
  }, 'Invalid Match save: resolved effect source/trigger'],
  ['reward receipt rewritten to survivor', state => {
    state.m8.loot.receipts.find(receipt => receipt.grantedUnitIds.includes(REWARD))!.grantedUnitIds = [SURVIVOR];
  }, 'Invalid resource provenance: receipt birth binding'],
  ['neutral death identity rewritten', state => { state.combat!.neutralReceipts!.deaths[0].eventSeq++; },
    'Invalid B8 Match: current death evidence'],
];
describe('B8 strict live transfer corruption boundaries', () => {
  it.each(corruptions)('rejects %s without changing the live route', (_label, change, message) => {
    const saved = serializeMatch(migration.selected), bad: MutableMatch = JSON.parse(saved);
    change(bad);
    expect(() => restoreMatch(bad)).toThrowError(new RegExp(`^${message.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
    expect(serializeMatch(migration.selected)).toBe(saved);
  });
});

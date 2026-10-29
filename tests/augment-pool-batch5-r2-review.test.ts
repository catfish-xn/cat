import { expect, it } from 'vitest';
import { createCombatWithEvents } from '../src/simulation/combat';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { combineItems, createMatch, equipItem, selectChoice, type MatchState } from '../src/simulation/match';
import { grantMechanicItem, openMechanicChoice } from '../src/simulation/seat-mechanics';
import { recordAugmentAcquisition } from '../src/simulation/augment-history';
import { ROUND_SETTLEMENT_VERSION } from '../src/simulation/round-settlement';
import { snapshotForBattle } from '../src/simulation/two-sided-snapshot';
import { compileBattle, proposeSettlement, readBattleLiveGoldReaders, startTwoSidedBattle, startTwoSidedCombatWithEvents } from '../src/simulation/two-sided-battle';
import { toCombatReplay } from '../src/simulation/combat-replay-view';
import { PORTABLE_ANOMALY_PREFIX } from '../src/simulation/content/augment-pool-batch5-r2';
import { accepted, catalogPreparation } from './t5r-helpers';
import * as oracle from './fixtures/m5/oracle.g2.cjs';
import { validateRewards } from './fixtures/m5/augment-rewards-oracle.cjs';

const hunger = 'TFT13_GoopBuff_HungerForPower';
function army(anomalyId: string, originalId = 'unit-1', benched = false): MatchState {
  const base = catalogPreparation('4-6', 1);
  return { ...base, level: 9, xp: 0, gold: 40, nextUnitSerial: 3, nextItemSerial: 2,
    preparation: { ...base.preparation, units: [
      ...base.preparation.units.filter(u => u.team === 'enemy'),
      ...['garen', 'darius'].map((definitionId, i) => ({ id: `unit-${i + 1}`, definitionId,
        team: 'player' as const, starLevel: 2 as const,
        location: benched && `unit-${i + 1}` === originalId ? { kind: 'bench' as const, slot: 0 }
          : { kind: 'board' as const, cell: { col: i * 2, row: 4 } } })),
    ] },
    items: [{ id: 'item-1', definitionId: PORTABLE_ANOMALY_PREFIX + anomalyId, location: { kind: 'inventory' } }],
    anomalyBinding: { unitId: originalId, definitionId: anomalyId, boundRound: base.round, choiceId: 'anomaly' } };
}

it.each(['unit-1', 'unit-2'])('single-sided opening rechecks life after either original/copy is consumed (original=%s)', originalId => {
  const copyId = originalId === 'unit-1' ? 'unit-2' : 'unit-1';
  const state = accepted(equipItem(army(hunger, originalId), 'item-1', copyId, 0));
  const opened = createCombatWithEvents(state.preparation, buildStrategySnapshot(state), 'double-hunger', 1);
  const holders = opened.state.units.filter(u => u.team === 'player');
  expect(holders.filter(u => u.alive)).toHaveLength(1);
  expect(holders.find(u => u.id === 'unit-1')).toMatchObject({ alive: true, anomalyState: { consumed: { unitId: 'unit-2' } } });
  const consumed = holders.find(u => u.id === 'unit-2')!;
  expect(consumed).toMatchObject({ alive: false, hp: 0 });
  expect(consumed.anomalyState?.consumed).toBeUndefined();
  expect(opened.events.filter(e => e.type === 'maxHpChanged' && e.source.definitionId === hunger)).toHaveLength(1);
  expect(opened.state.status).toBe('running');
});

it.each(['unit-1', 'unit-2'])('two-sided opening preserves one living Hunger holder on each team (original=%s)', originalId => {
  const copyId = originalId === 'unit-1' ? 'unit-2' : 'unit-1';
  const state = accepted(equipItem(army(hunger, originalId), 'item-1', copyId, 0));
  const input = compileBattle(snapshotForBattle(state, 'a'), snapshotForBattle(state, 'b'), 1, { battleId: 'double-hunger-pvp' });
  const opened = startTwoSidedCombatWithEvents(input);
  for (const [seatId, team] of [['a', 'player'], ['b', 'enemy']] as const) {
    const id = (originalId: string) => input.mapping.find(m => m.seatId === seatId && m.kind === 'unit' && m.originalId === originalId)!.combatId;
    const holders = opened.state.units.filter(u => u.team === team);
    expect(holders.filter(u => u.alive)).toHaveLength(1);
    expect(holders.find(u => u.id === id('unit-1'))).toMatchObject({ alive: true, anomalyState: { consumed: { unitId: id('unit-2') } } });
    expect(holders.find(u => u.id === id('unit-2'))).toMatchObject({ alive: false, hp: 0 });
    expect(holders.find(u => u.id === id('unit-2'))!.anomalyState?.consumed).toBeUndefined();
  }
  expect(opened.events.filter(e => e.type === 'maxHpChanged' && e.source.definitionId === hunger)).toHaveLength(2);
  expect(opened.state.status).toBe('running');
});

it.each(['a', 'b'])('first installed Avarice copy enables live samples and authenticates replay/settlement (seat=%s)', seatId => {
  const source = army('avarice-incarnate', 'unit-1', true), other = army('bulwark');
  const a = seatId === 'a' ? source : other, b = seatId === 'b' ? source : other;
  const input = compileBattle(snapshotForBattle(a, 'a'), snapshotForBattle(b, 'b'), 1, { battleId: 'installed-avarice' });
  expect(readBattleLiveGoldReaders(input).map(r => r.readsLiveGold)).toEqual([false, false]);
  const task = startTwoSidedBattle(input, { captureReplay: true });
  expect(task.sampleBankGold(seatId, 0)).toBe(false);
  expect(task.advance(3)).toBeNull();
  const equipped = accepted(equipItem(source, 'item-1', 'unit-2', 0));
  task.queueEquipment({ kind: 'equipment', seq: 1, effectiveTick: 4, seatId, unitId: 'unit-2', itemId: 'item-1', slot: 0 }, equipped);
  expect(task.advance(1)).toBeNull();
  expect(task.sampleBankGold(seatId, 0)).toBe(true);
  expect(task.sampleBankGold(seatId, 0)).toBe(false);
  expect(task.sampleBankGold(seatId, 20)).toBe(true);
  expect(task.sampleBankGold(seatId, 0)).toBe(true);
  const result = task.advance(1201)!;
  const team = seatId === 'a' ? 'player' : 'enemy';
  expect(result.bankSamples).toEqual([0, 20, 0].map(liveGold => ({ tick: 4, team, liveGold })));
  const copyId = input.mapping.find(m => m.seatId === seatId && m.kind === 'unit' && m.originalId === 'unit-2')!.combatId;
  expect(result.terminal.units.find(u => u.id === copyId)).toMatchObject({ openingItemBankGold: 40, currentItemBankGold: 0 });
  const restored = JSON.parse(JSON.stringify(result));
  expect(toCombatReplay(restored)).toEqual(task.replay());
  expect(proposeSettlement(restored)).toEqual(proposeSettlement(result));
  expect(JSON.stringify(task.replay())).not.toMatch(/bankSamples|liveGold|currentItemBankGold|openingItemBankGold/);
  const forgeries = [
    { ...restored, bankSamples: [{ tick: 3, team, liveGold: 0 }] },
    { ...restored, bankSamples: [{ tick: 4, team: team === 'player' ? 'enemy' : 'player', liveGold: 0 }] },
    { ...restored, bankSamples: [{ tick: 4, team, liveGold: 40 }] },
    { ...restored, bankSamples: undefined },
  ];
  for (const bad of forgeries) {
    expect(() => toCombatReplay(bad)).toThrow();
    expect(() => proposeSettlement(bad)).toThrow('invalid-result');
  }
});

function angerState(): MatchState {
  const base = createMatch(1);
  return recordAugmentAcquisition(base, { ...base,
    multiplayer: { version: ROUND_SETTLEMENT_VERSION, seatId: 'a', status: 'active', receipts: [], forfeitedChoices: [] },
    augments: [{ definitionId: 'anger-issues', choiceId: 'anger', acquiredRound: 1 }] });
}
function withItems(definitions: readonly string[]): MatchState {
  let state = angerState();
  for (const [i, definitionId] of definitions.entries()) {
    const grant = grantMechanicItem(state, { source: 'vector', receiptId: `vector:${i}`, definitionId });
    if (!grant.ok) throw Error(grant.reason);
    state = grant.state;
  }
  return state;
}
function checkConversion(before: MatchState, result: ReturnType<typeof combineItems>, command: Readonly<{ type: string; [key: string]: unknown }>, raw: string): void {
  if (!result.ok) throw Error(result.reason);
  const check = (state: MatchState) => {
    validateRewards(before, state, command, result.events, oracle);
    new oracle.Ledger(before).apply(before, state, command, result.events);
  };
  expect(() => check(result.state)).not.toThrow();
  for (const mutation of ['unconverted-without-fact', 'missing-fact', 'wrong-input', 'duplicate-fact']) {
    const bad = structuredClone(result.state) as any;
    const facts = bad.resourceProvenance.entries;
    if (mutation === 'unconverted-without-fact') bad.items.find((i: any) => i.id === `item-${before.nextItemSerial}`).definitionId = raw;
    if (mutation === 'unconverted-without-fact' || mutation === 'missing-fact') bad.resourceProvenance.entries = facts.filter((f: any) => f.kind !== 'anger-item-converted');
    if (mutation === 'wrong-input') facts.find((f: any) => f.kind === 'anger-item-converted').from = raw === 'deathblade' ? 'giant-slayer' : 'deathblade';
    if (mutation === 'duplicate-fact') facts.push(structuredClone(facts.find((f: any) => f.kind === 'anger-item-converted')));
    bad.resourceProvenance.entries.forEach((f: any, sequence: number) => { f.sequence = sequence; });
    expect(() => validateRewards(before, bad, command, result.events, oracle), mutation).toThrow();
    expect(() => new oracle.Ledger(before).apply(before, bad, command, result.events), mutation).toThrow();
  }
}
it.each([['sword', 'bow', 'giant-slayer'], ['sword', 'sword', 'deathblade'], ['gloves', 'gloves', 'thiefs-gloves']])(
  'independent reward and full ledgers derive future %s + %s conversion even if its facts are erased', (a, b, raw) => {
    const before = withItems([a, b]), command = { type: 'combine', a: before.items[0].id, b: before.items[1].id };
    checkConversion(before, combineItems(before, command.a, command.b), command, raw);
  });

it('independent ledgers derive an in-place composition from the inventory and worn component', () => {
  let state = withItems(['sword', 'bow']);
  const unitId = state.preparation.units.find(u => u.team === 'player')!.id;
  state = accepted(equipItem(state, state.items[0].id, unitId, 0));
  const command = { type: 'equip', itemId: state.items[1].id, unitId, slot: 2 };
  checkConversion(state, equipItem(state, command.itemId, unitId, command.slot), command, 'giant-slayer');
});

it('independent ledgers derive future forge conversion from the selected reward, preserving its raw receipt', () => {
  const before = accepted(openMechanicChoice(angerState(), { choiceId: 'r2-forge', returnPhase: 'preparation', offers: ['deathblade', 'giant-slayer'],
    payload: { kind: 'forge', source: 'anvil-unit', timeoutOption: 'deathblade' } }));
  const command = { type: 'select', choiceId: 'r2-forge', generation: 0, definitionId: 'deathblade' };
  checkConversion(before, selectChoice(before, command.choiceId, command.generation, command.definitionId), command, 'deathblade');
});

import { describe, expect, it } from 'vitest';
import { MatchSession } from '../src/rendering/match-session';
import { createMatch, type MatchState, type RoundResult } from '../src/simulation/match';
import { createRoundEnemies } from '../src/simulation/round-enemies';
import { getRoundSchedule } from '../src/simulation/round-schedule';
import { restoreMatch } from '../src/simulation/serialization';
import type { CombatEvent } from '../src/simulation/combat';
import type { ItemInstance, ScheduleReceipt } from '../src/simulation/strategy-types';
import type { Unit } from '../src/simulation/unit-types';

/** Explicit capacity fixture, separate from the command-only full-Match acceptance route.
 * All nine player slots, all 27 equipment slots, both Augments and the one Anomaly are occupied.
 * Three-star units and capped late-round enemies keep the finite hook load active in a dense battle.
 */
function maximumLoadout(): MatchState {
  const initial = createMatch(42), round = 29;
  const definitions = ['sentinel', 'squire', 'bulwark', 'warden', 'colossus', 'arcanist', 'oracle', 'duelist', 'beacon'];
  const players: Unit[] = definitions.map((definitionId, index) => ({
    id: `unit-${index + 1}`, definitionId, team: 'player', starLevel: 3,
    location: { kind: 'board', cell: index < 7 ? { col: index, row: 4 } : { col: 2 + (index - 7) * 2, row: 5 } },
  }));
  let serial = 1;
  const scheduleReceipts: ScheduleReceipt[] = [];
  for (let eventRound = 1; eventRound <= round; eventRound++) for (const event of getRoundSchedule(eventRound)) {
    scheduleReceipts.push({ eventId: event.id, round: eventRound, kind: event.kind,
      itemIds: event.kind === 'reward' ? Array.from({ length: event.components.length + event.randomComponents }, () => `item-${serial++}`) : [],
      gold: event.kind === 'reward' ? event.gold : 0,
      unitId: event.kind === 'anomaly' ? 'unit-6' : null,
      definitionId: event.kind === 'augment' ? (eventRound === 2 ? 'opening-guard' : 'cast-echo') : event.kind === 'anomaly' ? 'echo-core' : null });
  }
  const items: ItemInstance[] = players.flatMap(unit => ['flowing-tear', 'ward-rod', 'pulse-edge'].map((definitionId, slot) => ({
    id: `item-${serial++}`, definitionId, location: { kind: 'unit', unitId: unit.id, slot },
  })));
  const roundResults: RoundResult[] = Array.from({ length: round - 1 }, (_, index) => ({
    round: index + 1, result: 'playerWin', combatTicks: 100, income: 5, goldBefore: 100 + 5 * index, goldAfter: 105 + 5 * index,
    xpAwarded: 0, levelBefore: 9, levelAfter: 9, xpBefore: 0, xpAfter: 0, hpBefore: 100, hpAfter: 100,
    baseDamage: 2 + 2 * Math.floor(index / 3), survivingEnemyCount: 0, playerDamage: 0, hpLost: 0,
  }));
  // Validate the authored fixture's phases, references, capacities, snapshots and history shape.
  return restoreMatch({ ...initial, round, level: 9, xp: 0, gold: 1000, playerHp: 100, nextUnitSerial: 100,
    nextItemSerial: serial, items, roundResults, scheduleReceipts, nextMatchEventSeq: 1000,
    preparation: { ...initial.preparation, units: [...players, ...createRoundEnemies(round)] },
    augments: [
      { definitionId: 'opening-guard', choiceId: 'r2-augment', acquiredRound: 2 },
      { definitionId: 'cast-echo', choiceId: 'r5-augment', acquiredRound: 5 },
    ],
    anomalyBinding: { definitionId: 'echo-core', unitId: 'unit-6', choiceId: 'r7-anomaly', boundRound: 7 },
  });
}

const bytes = (value: unknown): number => new TextEncoder().encode(JSON.stringify(value)).byteLength;

describe('A7 maximum roster/effect observer ledger bounds', () => {
  it('retains a complete bounded ledger, isolates every read, and clears it at Continue and New Match', () => {
    const fixture = maximumLoadout();
    const session = new MatchSession(fixture);
    expect(fixture.preparation.units.filter(unit => unit.team === 'player')).toHaveLength(9);
    expect(fixture.preparation.units.filter(unit => unit.team === 'enemy')).toHaveLength(6);
    expect(fixture.items).toHaveLength(27);
    expect(fixture.augments).toHaveLength(2);
    expect(fixture.anomalyBinding).not.toBeNull();
    const started = session.start();
    expect(started.ok).toBe(true);
    if (!started.ok) throw new Error(started.reason);
    const commandEvents = started.events.filter((event): event is CombatEvent => 'tick' in event);
    expect(commandEvents).toHaveLength(18); // Nine independent opening-guard hooks and nine aggregated shields.
    expect(commandEvents.every(event => event.tick === 0)).toBe(true);
    expect(session.combatEvents).toEqual(commandEvents);
    expect(session.combat!.units.filter(unit => unit.team === 'player').every(unit =>
      new Set(unit.sources!.filter(source => source.source.sourceKind === 'item').map(source => source.source.sourceInstanceId)).size === 3)).toBe(true);

    const events: CombatEvent[] = [...commandEvents];
    for (let step = 0; step < 1200 && session.phase === 'combat'; step++) {
      events.push(...session.advance(50));
    }
    expect(session.phase).toBe('settlement');
    expect(session.combat!.status).toBe('finished');
    expect(session.combat!.tick).toBeLessThanOrEqual(1200);
    const ledger = session.combatEvents;
    expect(ledger).toEqual(events);
    expect(ledger.length).toBeGreaterThan(200);
    expect(ledger.map(event => event.eventSeq)).toEqual(ledger.map((_, index) => index));
    expect(new Set(ledger.map(event => `${event.combatId}:${event.eventSeq}`)).size).toBe(ledger.length);
    expect(ledger.every(event => event.domain === 'combat' && event.combatId === 'round-29')).toBe(true);
    expect(ledger.filter(event => event.type === 'combatFinished')).toHaveLength(1);
    expect(ledger.at(-1)?.type).toBe('combatFinished');
    const triggeredKinds = new Set(ledger.filter(event => event.type === 'effectTriggered').map(event => event.source.sourceKind));
    expect(triggeredKinds).toEqual(new Set(['trait', 'item', 'augment', 'anomaly']));
    expect(ledger.some(event => event.type === 'cast')).toBe(true);
    expect(ledger.some(event => event.type === 'manaChanged' && event.hookGain! > 0)).toBe(true);

    const ledgerBytes = bytes(ledger), combinedBytes = bytes({ state: session.state, ledger });
    expect(ledgerBytes).toBeLessThan(20 * 1024 * 1024);
    expect(combinedBytes).toBeLessThan(20 * 1024 * 1024);
    // Report measurements without a machine-dependent timing or exact-size assertion.
    console.info(`A7 maximum-loadout ledger: ticks=${session.combat!.tick}, events=${ledger.length}, ledgerBytes=${ledgerBytes}, stateAndLedgerBytes=${combinedBytes}`);

    for (let read = 0; read < 5; read++) {
      const copy = session.combatEvents as CombatEvent[];
      expect(copy).toEqual(ledger);
      expect(copy).not.toBe(ledger);
      expect(copy[0]).not.toBe(ledger[0]);
      const effect = copy.find(event => event.type === 'effectTriggered')!;
      (effect.source as { ownerId: string }).ownerId = 'tampered';
      (effect.action as { amount: number }).amount = -1;
      const damage = copy.find(event => event.type === 'damage' && event.packets!.length > 0)!;
      if (damage.type !== 'damage') throw new Error('Expected a damage packet');
      (damage.packets![0] as { rawAmount: number }).rawAmount = -1;
      copy.length = 0;
      expect(session.combatEvents).toEqual(ledger);
      expect(bytes({ state: session.state, ledger: session.combatEvents })).toBe(combinedBytes);
    }
    const settled = session.state;
    expect(session.advance(60000)).toEqual([]);
    expect(session.state).toBe(settled);
    expect(session.combatEvents).toEqual(ledger);

    expect(session.continue(fixture.round).ok).toBe(true);
    expect(session.combatEvents).toEqual([]);
    expect(session.state.round).toBe(30);
    expect(session.start().ok).toBe(true);
    expect(session.combatEvents.map(event => event.eventSeq)).toEqual(commandEvents.map((_, index) => index));
    expect(session.combatEvents.every(event => event.combatId === 'round-30')).toBe(true);
    session.advance(50);
    expect(session.combatEvents.length).toBeGreaterThan(commandEvents.length);
    session.newMatch();
    expect(session.combatEvents).toEqual([]);
    expect(session.state).toEqual(createMatch(42));
    expect(session.combat).toBeNull();
  });
});

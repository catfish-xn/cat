import { describe, expect, it } from 'vitest';
import { DEFAULT_BOARD } from '../src/simulation/board';
import { createCombatWithEvents, stepCombat, type CombatEvent, type CombatState } from '../src/simulation/combat';
import { applyCombatStart } from '../src/simulation/combat-effects';
import { resolveAbility } from '../src/simulation/combat-abilities';
import { makeSourcedEffects, resolveEffects } from '../src/simulation/effects';
import { getUnitStats } from '../src/simulation/unit-stats';
import type { ResolvedUnitStats, Unit } from '../src/simulation/unit-types';
import type { SourcedEffect, StrategySnapshot } from '../src/simulation/strategy-types';
import { createMatch } from '../src/simulation/match';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { validateContent } from '../src/simulation/validate-content';
import { TRAIT_DEFINITIONS } from '../src/simulation/content/traits';
import { ITEM_DEFINITIONS } from '../src/simulation/content/items';
import { AUGMENT_DEFINITIONS } from '../src/simulation/content/augments';
import { ANOMALY_DEFINITIONS } from '../src/simulation/content/anomalies';

function frozen<T>(value: T): T {
  if (value && typeof value === 'object') { Object.values(value).forEach(frozen); Object.freeze(value); }
  return value;
}
function unit(id: string, team: Unit['team'], col: number, row = 3, definitionId = 'ranger'): Unit {
  return { id, definitionId, team, starLevel: 1, location: { kind: 'board', cell: { col, row } } };
}
function battle(units: readonly Unit[], effects: readonly SourcedEffect[] = [], stats: Readonly<Record<string, Partial<ResolvedUnitStats>>> = {}) {
  const preparation = { board: DEFAULT_BOARD, benchSize: 7, units };
  const strategy: StrategySnapshot = { traits: [], units: units.map(unit => {
    const base = { ...getUnitStats(unit.definitionId, unit.starLevel), ...stats[unit.id] };
    return { unitId: unit.id, ...resolveEffects(base, resolveAbility(base.abilityId, unit.starLevel), effects.filter(effect => effect.source.ownerId === unit.id)) };
  }).sort((a, b) => a.unitId < b.unitId ? -1 : a.unitId > b.unitId ? 1 : 0) };
  return createCombatWithEvents(preparation, strategy, 'test-combat');
}
const sources = (ownerId: string, kind: Parameters<typeof makeSourcedEffects>[1], id: string, effects: Parameters<typeof makeSourcedEffects>[4]) =>
  makeSourcedEffects(ownerId, kind, id, id, effects);

describe('strategy effects at real Combat barriers', () => {
  it('starts once, sorts owner before source, aggregates the strongest shield and longest duration, and stamps tick-zero events', () => {
    const start = battle([unit('z-player', 'player', 1), unit('a-enemy', 'enemy', 2)], [
      ...sources('z-player', 'item', 'shield', [{ kind: 'trigger', hook: 'combatStart', everyN: 1, action: { kind: 'grantShield', amount: 200, durationTicks: 60 } }]),
      ...sources('z-player', 'augment', 'weak-long-shield', [{ kind: 'trigger', hook: 'combatStart', everyN: 1, action: { kind: 'grantShield', amount: 120, durationTicks: 80 } }]),
      ...sources('a-enemy', 'anomaly', 'mana', [{ kind: 'trigger', hook: 'combatStart', everyN: 1, action: { kind: 'gainMana', amount: 100 } }]),
    ]);
    expect(start.events.map(event => event.type)).toEqual(['effectTriggered', 'effectTriggered', 'effectTriggered', 'shieldChanged', 'manaChanged']);
    expect(start.events.filter(event => event.type === 'effectTriggered').map(event => event.source.ownerId)).toEqual(['a-enemy', 'z-player', 'z-player']);
    expect(start.events.map(event => event.eventSeq)).toEqual([0, 1, 2, 3, 4]);
    expect(start.events.every(event => event.domain === 'combat' && event.combatId === 'test-combat' && event.tick === 0)).toBe(true);
    expect(start.state.units.find(unit => unit.id === 'z-player')).toMatchObject({ shield: 200, shieldExpiresAtTick: 80 });
    expect(start.events.find(event => event.type === 'manaChanged')).toMatchObject({ hookGain: 100, after: 60, overflow: 40 });
    expect(start.state.units.every(unit => unit.effectRuntime!.every(counter => counter.count === 1))).toBe(true);
    const saved: CombatState = JSON.parse(JSON.stringify(start.state));
    expect(applyCombatStart(frozen(saved))).toEqual({ state: saved, events: [] });
    expect(stepCombat(saved)).toEqual(stepCombat(frozen(start.state)));
  });

  it('does not run start hooks on a tick-zero empty-team result', () => {
    const start = battle([unit('p', 'player', 1)], sources('p', 'augment', 'start', [
      { kind: 'trigger', hook: 'combatStart', everyN: 1, action: { kind: 'grantShield', amount: 200, durationTicks: 80 } },
    ]));
    expect(start.state.status).toBe('finished');
    expect(start.state.units[0].shield).toBe(0);
    expect(start.state.units[0].effectRuntime![0].count).toBe(0);
    expect(start.events.some(event => event.type === 'effectTriggered')).toBe(false);
    expect(stepCombat(start.state)).toEqual({ state: start.state, events: [] });
  });

  it('combines four sources with an AOE ability, aims derived damage at the primary enemy once, and applies Mana after action planning', () => {
    const start = battle([unit('p', 'player', 1, 3, 'arcanist'), unit('e1', 'enemy', 2), unit('e2', 'enemy', 2, 2)], [
      ...sources('p', 'trait', 'skill', [{ kind: 'statPercentBps', stat: 'abilityAmount', bps: 1500 }]),
      ...sources('p', 'item', 'echo', [{ kind: 'trigger', hook: 'onCast', everyN: 1, action: { kind: 'dealDamage', amount: 70, damageType: 'magic' } }]),
      ...sources('p', 'augment', 'shield', [{ kind: 'trigger', hook: 'onCast', everyN: 1, action: { kind: 'grantShield', amount: 120, durationTicks: 60 } }]),
      ...sources('p', 'anomaly', 'mana', [{ kind: 'trigger', hook: 'onCast', everyN: 1, action: { kind: 'gainMana', amount: 90 } }]),
    ], { p: { initialMana: 80 }, e1: { magicResist: 0, armor: 0 }, e2: { magicResist: 0, armor: 0 } });
    const tick = stepCombat(frozen(start.state));
    const caster = tick.state.units.find(unit => unit.id === 'p')!;
    expect(caster.ability.amount).toBe(241);
    expect(tick.events.filter(event => event.type === 'cast' && event.sourceId === 'p')).toHaveLength(1);
    expect(tick.events.filter(event => event.type === 'attack' && event.attackerId === 'p')).toHaveLength(0);
    const damages = tick.events.filter((event): event is Extract<CombatEvent, { type: 'damage' }> => event.type === 'damage' && event.unitId !== 'p');
    expect(damages.map(event => [event.unitId, event.magicAmount])).toEqual([['e1', 311], ['e2', 241]]);
    expect(damages.flatMap(event => event.packets ?? []).filter(packet => packet.sourceKind === 'item')).toHaveLength(1);
    expect(damages.flatMap(event => event.packets ?? []).filter(packet => packet.sourceKind === 'item')[0].triggerEligible).toBe(false);
    expect(caster.shield).toBeGreaterThan(0);
    expect(caster.mana).toBe(80);
    expect(tick.events.find(event => event.type === 'manaChanged' && event.unitId === 'p')).toMatchObject({ spent: 80, hookGain: 90, overflow: 10 });
    expect(caster.effectRuntime!.every(counter => counter.count === 1)).toBe(true);
    expect(tick.events.map(event => event.eventSeq)).toEqual(tick.events.map((_, index) => start.state.nextEventSeq! + index));
    expect(tick.events.findIndex(event => event.type === 'effectTriggered')).toBeGreaterThan(Math.max(...tick.events.map((event, index) => event.type === 'cast' || event.type === 'attack' ? index : -1)));
    expect(tick.events.findIndex(event => event.type === 'shieldChanged')).toBeLessThan(tick.events.findIndex(event => event.type === 'damage'));
    expect(tick.events.findIndex(event => event.type === 'damage')).toBeLessThan(tick.events.findIndex(event => event.type === 'manaChanged'));
  });

  it('counts aggregate HP loss once despite multiple main/derived packets and does not recursively fire attack procs', () => {
    const start = battle([unit('p1', 'player', 1), unit('p2', 'player', 2, 2), unit('e', 'enemy', 2)], [
      ...sources('p1', 'item', 'damage', [{ kind: 'trigger', hook: 'onAttack', everyN: 1, action: { kind: 'dealDamage', amount: 25, damageType: 'physical' } }]),
      ...sources('p2', 'anomaly', 'damage', [{ kind: 'trigger', hook: 'onAttack', everyN: 1, action: { kind: 'dealDamage', amount: 25, damageType: 'magic' } }]),
      ...sources('e', 'item', 'hp-mana', [{ kind: 'trigger', hook: 'onHpLoss', everyN: 1, action: { kind: 'gainMana', amount: 3 } }]),
    ], { e: { health: 1000, armor: 0, magicResist: 0 } });
    const tick = stepCombat(start.state);
    const effects = tick.events.filter(event => event.type === 'effectTriggered');
    expect(effects.map(event => event.source.ownerId)).toEqual(['p1', 'p2', 'e']);
    expect(tick.events.find(event => event.type === 'damage' && event.unitId === 'e')).toMatchObject({ hpDamage: 190 });
    expect(tick.events.find(event => event.type === 'manaChanged' && event.unitId === 'e')).toMatchObject({ attackGain: 10, damageGain: 19, hookGain: 3, after: 32 });
    expect(tick.state.units.every(unit => unit.effectRuntime!.every(counter => counter.count === 1))).toBe(true);
  });

  it('finishes both planned lethal attacks and their hooks while giving dead units no Mana', () => {
    const start = battle([unit('p', 'player', 1), unit('e', 'enemy', 2)], [
      ...sources('p', 'item', 'damage', [{ kind: 'trigger', hook: 'onAttack', everyN: 1, action: { kind: 'dealDamage', amount: 25, damageType: 'physical' } }]),
      ...sources('e', 'anomaly', 'mana', [{ kind: 'trigger', hook: 'onAttack', everyN: 1, action: { kind: 'gainMana', amount: 10 } }]),
    ], { p: { health: 1, armor: 0 }, e: { health: 1, armor: 0 } });
    const tick = stepCombat(start.state);
    expect(tick.state.result).toBe('draw');
    expect(tick.events.filter(event => event.type === 'attack')).toHaveLength(2);
    expect(tick.events.filter(event => event.type === 'effectTriggered')).toHaveLength(2);
    expect(tick.events.filter(event => event.type === 'manaChanged')).toHaveLength(0);
    expect(tick.state.units.every(unit => !unit.alive && unit.mana === 0)).toBe(true);
    expect(tick.events.filter(event => event.type === 'combatFinished')).toHaveLength(1);
  });

  it('resumes runtime counters/event sequences from JSON and is independent of input enumeration through a whole battle', () => {
    const units = [unit('p', 'player', 1), unit('e', 'enemy', 2)];
    const effects = sources('p', 'anomaly', 'third', [
      { kind: 'trigger', hook: 'onAttack', everyN: 3, action: { kind: 'dealDamage', amount: 30, damageType: 'magic' } },
    ]);
    let original = battle(units, effects).state;
    let permuted = battle([...units].reverse(), [...effects].reverse()).state;
    const history: CombatEvent[] = [];
    for (let tick = 0; tick < 1200 && original.status === 'running'; tick++) {
      const next = stepCombat(frozen(original));
      const reverse = stepCombat(permuted);
      expect(reverse).toEqual(next);
      expect(stepCombat(JSON.parse(JSON.stringify(original)))).toEqual(next);
      history.push(...next.events);
      original = next.state;
      permuted = reverse.state;
    }
    expect(original.status).toBe('finished');
    expect(history.some(event => event.type === 'effectTriggered')).toBe(true);
    expect(history.some(event => event.type === 'cast')).toBe(true);
    expect(history.map(event => event.eventSeq)).toEqual(history.map((_, index) => index));
  });

  it('validates and runs a new authored Augment through the generic snapshot and Combat with no content-ID branch', () => {
    const augments = { ...AUGMENT_DEFINITIONS, 'new-augment': { id: 'new-augment', name: 'test', description: 'data-only extension', effects: [
      { kind: 'statFlat' as const, stat: 'attackDamage' as const, amount: 17 },
      { kind: 'trigger' as const, hook: 'onAttack' as const, everyN: 1, action: { kind: 'gainMana' as const, amount: 9 } },
    ] } };
    expect(() => validateContent({ augments })).not.toThrow();
    const state = { ...createMatch(123), preparation: { board: DEFAULT_BOARD, benchSize: 7, units: [unit('p', 'player', 1), unit('e', 'enemy', 2)] },
      augments: [{ definitionId: 'new-augment', choiceId: 'new-choice', acquiredRound: 2 }] };
    const snapshot = buildStrategySnapshot(state, { traits: TRAIT_DEFINITIONS, items: ITEM_DEFINITIONS, augments, anomalies: ANOMALY_DEFINITIONS });
    expect(snapshot.units.find(unit => unit.unitId === 'p')!.stats.attack).toBe(87);
    const start = createCombatWithEvents(state.preparation, snapshot, 'extension-test');
    const tick = stepCombat(start.state);
    expect(tick.events.find(event => event.type === 'effectTriggered')).toMatchObject({ source: { sourceDefinitionId: 'new-augment' }, action: { kind: 'gainMana', amount: 9 } });
    expect(tick.events.find(event => event.type === 'damage' && event.unitId === 'e')).toMatchObject({ physicalAmount: 75 });
    expect(tick.events.find(event => event.type === 'manaChanged' && event.unitId === 'p')).toMatchObject({ attackGain: 10, hookGain: 9 });
  });
});

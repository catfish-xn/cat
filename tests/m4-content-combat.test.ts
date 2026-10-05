import { describe, expect, it } from 'vitest';
import { createMatch, type MatchState } from '../src/simulation/match';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { createCombatWithEvents, stepCombat, type CombatEvent, type CombatState } from '../src/simulation/combat';
import { ITEM_DEFINITIONS } from '../src/simulation/content/items';
import { AUGMENT_DEFINITIONS } from '../src/simulation/content/augments';
import { ANOMALY_DEFINITIONS } from '../src/simulation/content/anomalies';
import type { EffectAction, SourceKind, StrategySnapshot } from '../src/simulation/strategy-types';
import type { Unit } from '../src/simulation/unit-types';

type Vector = readonly [hp: number, attack: number, armor: number, mr: number, mana: number, interval: number, ability: number];
interface ContentCase {
  readonly id: string;
  readonly vector: Vector;
  readonly trigger?: { readonly everyN: number; readonly hook: string; readonly action: EffectAction };
}
// Independent R9 numerical oracle: Ranger 1-star is [500,70,15,15,0,20,150].
// Every row writes the complete expected result instead of reading content effects
// or calling the production modifier arithmetic to calculate its own expectation.
const ITEMS: readonly ContentCase[] = [
  { id: 'blade', vector: [500, 80, 15, 15, 0, 20, 150] },
  { id: 'rod', vector: [500, 70, 15, 15, 0, 20, 170] },
  { id: 'vest', vector: [500, 70, 30, 15, 0, 20, 150] },
  { id: 'tear', vector: [500, 70, 15, 15, 15, 20, 150] },
  { id: 'belt', vector: [600, 70, 15, 15, 0, 20, 150] },
  { id: 'twin-edge', vector: [500, 100, 15, 15, 0, 20, 150] },
  { id: 'spell-edge', vector: [500, 85, 15, 15, 0, 20, 180] },
  { id: 'guard-edge', vector: [500, 85, 35, 15, 0, 20, 150] },
  { id: 'pulse-edge', vector: [500, 80, 15, 15, 0, 20, 150], trigger: { everyN: 3, hook: 'onAttack', action: { kind: 'gainMana', amount: 15 } } },
  { id: 'heavy-edge', vector: [680, 85, 15, 15, 0, 20, 150] },
  { id: 'focus-rod', vector: [500, 70, 15, 15, 0, 20, 240] },
  { id: 'ward-rod', vector: [500, 70, 35, 15, 0, 20, 150], trigger: { everyN: 1, hook: 'onCast', action: { kind: 'grantShield', amount: 120, durationTicks: 60 } } },
  { id: 'echo-rod', vector: [500, 70, 15, 15, 0, 20, 150], trigger: { everyN: 1, hook: 'onCast', action: { kind: 'dealDamage', amount: 70, damageType: 'magic' } } },
  { id: 'vital-rod', vector: [680, 70, 15, 15, 0, 20, 180] },
  { id: 'fortress', vector: [500, 70, 60, 35, 0, 20, 150] },
  { id: 'dawn-ward', vector: [500, 70, 15, 15, 0, 20, 150], trigger: { everyN: 1, hook: 'combatStart', action: { kind: 'grantShield', amount: 200, durationTicks: 80 } } },
  { id: 'heavy-plate', vector: [740, 70, 40, 15, 0, 20, 150] },
  { id: 'flowing-tear', vector: [500, 70, 15, 15, 30, 20, 150], trigger: { everyN: 1, hook: 'onHpLoss', action: { kind: 'gainMana', amount: 3 } } },
  { id: 'reservoir', vector: [680, 70, 15, 15, 0, 20, 150], trigger: { everyN: 1, hook: 'onCast', action: { kind: 'gainMana', amount: 10 } } },
  { id: 'giant-belt', vector: [1000, 70, 15, 15, 0, 20, 150] },
];
const AUGMENTS: readonly ContentCase[] = [
  { id: 'iron-line', vector: [500, 70, 30, 30, 0, 20, 150] },
  { id: 'vitality', vector: [650, 70, 15, 15, 0, 20, 150] },
  { id: 'heavy-hands', vector: [500, 82, 15, 15, 0, 20, 150] },
  { id: 'quick-drill', vector: [500, 70, 15, 15, 0, 18, 150] },
  { id: 'study-circle', vector: [500, 70, 15, 15, 0, 20, 180] },
  { id: 'charged-start', vector: [500, 70, 15, 15, 20, 20, 150] },
  { id: 'opening-guard', vector: [500, 70, 15, 15, 0, 20, 150], trigger: { everyN: 1, hook: 'combatStart', action: { kind: 'grantShield', amount: 120, durationTicks: 60 } } },
  { id: 'cast-echo', vector: [500, 70, 15, 15, 0, 20, 150], trigger: { everyN: 2, hook: 'onCast', action: { kind: 'dealDamage', amount: 60, damageType: 'magic' } } },
];
const ANOMALIES: readonly ContentCase[] = [
  { id: 'colossal-form', vector: [700, 70, 15, 15, 0, 20, 150] },
  { id: 'tempered-core', vector: [500, 70, 50, 50, 0, 20, 150] },
  { id: 'rapid-form', vector: [500, 70, 15, 15, 0, 15, 150] },
  { id: 'arcane-form', vector: [500, 70, 15, 15, 0, 20, 225] },
  { id: 'crushing-form', vector: [500, 94, 15, 15, 0, 20, 150] },
  { id: 'echo-core', vector: [500, 70, 15, 15, 0, 20, 150], trigger: { everyN: 1, hook: 'onCast', action: { kind: 'dealDamage', amount: 100, damageType: 'magic' } } },
  { id: 'guarded-form', vector: [500, 70, 15, 15, 0, 20, 150], trigger: { everyN: 1, hook: 'onCast', action: { kind: 'grantShield', amount: 200, durationTicks: 60 } } },
  { id: 'cycling-core', vector: [500, 70, 15, 15, 0, 20, 150], trigger: { everyN: 2, hook: 'onAttack', action: { kind: 'gainMana', amount: 15 } } },
];

function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
function unit(id: string, definitionId: string, team: Unit['team'], col: number, row: number): Unit {
  return { id, definitionId, team, starLevel: 1, location: { kind: 'board', cell: { col, row } } };
}
function fixture(kind: SourceKind, definitionId: string): MatchState {
  const base = createMatch();
  return {
    ...base, round: 7,
    preparation: { ...base.preparation, units: [unit('unit-1', 'ranger', 'player', 3, 4), unit('enemy-1', 'mystic', 'enemy', 3, 3)] },
    items: kind === 'item' ? [{ id: 'item-3', definitionId, location: { kind: 'unit', unitId: 'unit-1', slot: 0 } }] : [],
    augments: kind === 'augment' ? [{ definitionId, choiceId: 'r2-augment', acquiredRound: 2 }] : [],
    anomalyBinding: kind === 'anomaly' ? { definitionId, unitId: 'unit-1', choiceId: 'r7-anomaly', boundRound: 7 } : null,
  };
}
function combatVector(state: CombatState): Vector {
  const unit = state.units.find(unit => unit.id === 'unit-1')!;
  return [unit.maxHp, unit.attackDamage, unit.armor, unit.magicResist, unit.mana, unit.attackIntervalTicks, unit.ability.amount];
}
function runAuthoredRecord(kind: SourceKind, authored: ContentCase): void {
  const match = freeze(fixture(kind, authored.id)), before = JSON.stringify(match), snapshot = buildStrategySnapshot(match);
  const compiled = snapshot.units.find(unit => unit.unitId === 'unit-1')!;
  expect([compiled.stats.health, compiled.stats.attack, compiled.stats.armor, compiled.stats.magicResist,
    compiled.stats.initialMana, compiled.stats.attackIntervalTicks, compiled.ability.amount]).toEqual(authored.vector);
  const instanceId = kind === 'item' ? 'item-3' : kind === 'augment' ? 'r2-augment' : 'r7-anomaly';
  expect(compiled.sources.length).toBeGreaterThan(0);
  for (const sourced of compiled.sources) expect(sourced.source).toMatchObject({
    ownerId: 'unit-1', sourceKind: kind, sourceDefinitionId: authored.id, sourceInstanceId: instanceId,
  });
  expect(compiled.triggers).toHaveLength(authored.trigger ? 1 : 0);
  if (authored.trigger) expect(compiled.triggers[0]).toMatchObject(authored.trigger);

  // Explicit Combat microfixture: only the opposing practice target is adjusted.
  // Its 20,000 HP prevents premature elimination, zero resistances expose packets,
  // and 21-point physical/magic actions exercise real HP-loss and Mana hooks.
  // Player stats and every authored effect are exactly the compiled production data.
  const practice: StrategySnapshot = { ...snapshot, units: snapshot.units.map(unit => unit.unitId === 'enemy-1'
    ? { ...unit, stats: { ...unit.stats, health: 20000, attack: 21, armor: 0, magicResist: 0 }, ability: { ...unit.ability, amount: 21 } }
    : unit) };
  const started = createCombatWithEvents(match.preparation, freeze(practice), `coverage-${kind}-${authored.id}`);
  expect(combatVector(started.state)).toEqual(authored.vector);
  let state = started.state;
  const events: CombatEvent[] = [...started.events];
  for (let tick = 0; tick < 300 && state.status === 'running'; tick++) {
    const next = stepCombat(state); state = next.state; events.push(...next.events);
  }
  expect(JSON.stringify(match)).toBe(before);
  expect(events.some(event => event.type === 'attack' && event.attackerId === 'unit-1')).toBe(true);
  expect(events.some(event => event.type === 'cast' && event.sourceId === 'unit-1')).toBe(true);
  const outgoing = events.filter((event): event is Extract<CombatEvent, { type: 'damage' }> => event.type === 'damage' && event.unitId === 'enemy-1');
  expect(outgoing.flatMap(event => event.packets ?? []).find(packet => packet.sourceId === 'unit-1' && packet.sourceKind === 'attack'))
    .toMatchObject({ rawAmount: authored.vector[1], mitigated: authored.vector[1] });
  expect(outgoing.flatMap(event => event.packets ?? []).find(packet => packet.sourceId === 'unit-1' && packet.sourceKind === 'ability'))
    .toMatchObject({ rawAmount: authored.vector[6], mitigated: authored.vector[6] });
  const attacks = events.filter((event): event is Extract<CombatEvent, { type: 'attack' }> => event.type === 'attack' && event.attackerId === 'unit-1');
  expect(attacks[1].tick - attacks[0].tick).toBe(authored.vector[5]);
  const incoming = events.filter((event): event is Extract<CombatEvent, { type: 'damage' }> => event.type === 'damage' && event.unitId === 'unit-1');
  const physical = incoming.flatMap(event => event.packets ?? []).find(packet => packet.sourceKind === 'attack')!;
  const magic = incoming.flatMap(event => event.packets ?? []).find(packet => packet.sourceKind === 'ability')!;
  expect(physical.mitigated).toBe(Math.floor(2100 / (100 + authored.vector[2])));
  expect(magic.mitigated).toBe(Math.floor(2100 / (100 + authored.vector[3])));

  const procs = events.filter((event): event is Extract<CombatEvent, { type: 'effectTriggered' }> => event.type === 'effectTriggered');
  if (!authored.trigger) expect(procs).toEqual([]);
  else {
    expect(procs.length, `${kind}/${authored.id} must actually trigger`).toBeGreaterThan(0);
    for (const proc of procs) {
      expect(proc.source).toMatchObject({ ownerId: 'unit-1', sourceKind: kind, sourceDefinitionId: authored.id, sourceInstanceId: instanceId });
      expect(proc.action).toEqual(authored.trigger.action);
      expect(proc.targetId).toBe(authored.trigger.action.kind === 'dealDamage' ? 'enemy-1' : 'unit-1');
      expect(proc.effectKey).toBe(compiled.triggers[0].key);
    }
    const first = procs[0], trigger = authored.trigger;
    if (trigger.hook === 'combatStart') expect(first.tick).toBe(0);
    if (trigger.hook === 'onAttack') expect(first.tick).toBe(attacks[trigger.everyN - 1].tick);
    if (trigger.hook === 'onCast') {
      const casts = events.filter((event): event is Extract<CombatEvent, { type: 'cast' }> => event.type === 'cast' && event.sourceId === 'unit-1');
      expect(first.tick).toBe(casts[trigger.everyN - 1].tick);
    }
    if (trigger.hook === 'onHpLoss') expect(first.tick).toBe(incoming.find(event => event.hpDamage > 0)!.tick);
    if (trigger.action.kind === 'dealDamage') {
      const packet = outgoing.flatMap(event => event.packets ?? []).find(packet => packet.source?.sourceDefinitionId === authored.id)!;
      expect(packet).toMatchObject({ rawAmount: trigger.action.amount, mitigated: trigger.action.amount, triggerEligible: false,
        sourceKind: kind, sourceInstanceId: instanceId, source: { sourceDefinitionId: authored.id } });
    } else if (trigger.action.kind === 'gainMana') {
      expect(events.find(event => event.type === 'manaChanged' && event.tick === first.tick && event.unitId === 'unit-1'))
        .toMatchObject({ hookGain: trigger.action.amount });
    } else {
      expect(events.find(event => event.type === 'shieldChanged' && event.tick === first.tick && event.unitId === 'unit-1'))
        .toMatchObject({ reason: 'granted', after: trigger.action.amount, expiresAtTick: first.tick + trigger.action.durationTicks });
    }
  }
}

describe('every authored strategy record reaches snapshot and real Combat', () => {
  it('covers the complete published 20 / 8 / 8 catalogs without silent omissions', () => {
    for (const [cases, catalog, count] of [[ITEMS, ITEM_DEFINITIONS, 20], [AUGMENTS, AUGMENT_DEFINITIONS, 8], [ANOMALIES, ANOMALY_DEFINITIONS, 8]] as const) {
      expect(cases).toHaveLength(count);
      expect(cases.map(entry => entry.id).sort()).toEqual(Object.keys(catalog).sort());
    }
  });
  it.each(ITEMS)('item $id preserves its exact stats and emits any declared real hook', entry => runAuthoredRecord('item', entry));
  it.each(AUGMENTS)('augment $id preserves its exact stats and emits any declared real hook', entry => runAuthoredRecord('augment', entry));
  it.each(ANOMALIES)('anomaly $id preserves its exact stats and emits any declared real hook', entry => runAuthoredRecord('anomaly', entry));
});

describe('independent four-source complete short-battle golden', () => {
  it('finishes at tick 62 with authored Forge, Echo Rod, Heavy Hands and Cycling Core', () => {
    const initial = fixture('item', 'echo-rod');
    const match: MatchState = freeze({ ...initial,
      preparation: { ...initial.preparation, units: [unit('unit-1', 'ranger', 'player', 3, 4),
        unit('unit-2', 'bulwark', 'player', 4, 4), unit('enemy-1', 'mystic', 'enemy', 3, 3)] },
      augments: [{ definitionId: 'heavy-hands', choiceId: 'r2-augment', acquiredRound: 2 }],
      anomalyBinding: { definitionId: 'cycling-core', unitId: 'unit-1', choiceId: 'r7-anomaly', boundRound: 7 },
    });
    const compiled = buildStrategySnapshot(match);
    expect(compiled.traits.find(trait => trait.team === 'player' && trait.traitId === 'forge')).toMatchObject({ count: 2, tier: 2 });
    const main = compiled.units.find(unit => unit.unitId === 'unit-1')!, support = compiled.units.find(unit => unit.unitId === 'unit-2')!;
    expect(main.stats.attack).toBe(90); // 70 + Forge 8 + Heavy Hands 12.
    expect(support.stats.attack).toBe(75); // 55 + the same two team modifiers.
    expect(main.ability.amount).toBe(150); // Fixed Echo Rod packet does not amplify the primary skill.
    expect(new Set(main.sources.map(source => source.source.sourceKind))).toEqual(new Set(['trait', 'item', 'augment', 'anomaly']));
    // Explicit stationary microfixture: the enemy has 800 HP, no resistances and
    // zero attack/ability damage. Its real actions and Mana still execute.
    // Players keep all authored stats; four attacks deal 4*(90+75)=660.
    // Cycling grants 15 Mana on attacks 2/4: 10,35,45,60 (10 overflow).
    // Next-tick cast deals physical150 + Echo magic70 to the remaining140 HP.
    const snapshot: StrategySnapshot = { ...compiled, units: compiled.units.map(unit => unit.unitId === 'enemy-1'
      ? { ...unit, stats: { ...unit.stats, health: 800, attack: 0, armor: 0, magicResist: 0 }, ability: { ...unit.ability, amount: 0 } }
      : unit) };
    const start = createCombatWithEvents(match.preparation, freeze(snapshot), 'four-source-golden');
    expect(start.events).toEqual([]);
    let state = start.state;
    const events: CombatEvent[] = [];
    while (state.status === 'running') {
      expect(state.tick).toBeLessThan(62);
      const next = stepCombat(freeze(state));
      expect(stepCombat(JSON.parse(JSON.stringify(state)))).toEqual(next);
      state = next.state; events.push(...next.events);
    }
    expect(state).toMatchObject({ tick: 62, status: 'finished', result: 'playerWin', nextEventSeq: 43 });
    expect(events).toHaveLength(43);
    expect([...new Set(events.map(event => event.tick))]).toEqual([1, 21, 41, 42, 61, 62]);
    expect(events.map(event => event.eventSeq)).toEqual(Array.from({ length: 43 }, (_, index) => index));
    expect(events.every(event => event.domain === 'combat' && event.combatId === 'four-source-golden')).toBe(true);
    expect(events.filter(event => event.type === 'attack').map(event => [event.tick, event.attackerId, event.targetId])).toEqual([
      [1, 'enemy-1', 'unit-1'], [1, 'unit-1', 'enemy-1'], [1, 'unit-2', 'enemy-1'],
      [21, 'enemy-1', 'unit-1'], [21, 'unit-1', 'enemy-1'], [21, 'unit-2', 'enemy-1'],
      [41, 'enemy-1', 'unit-1'], [41, 'unit-1', 'enemy-1'], [41, 'unit-2', 'enemy-1'],
      [61, 'unit-1', 'enemy-1'], [61, 'unit-2', 'enemy-1'], [62, 'enemy-1', 'unit-1'],
    ]);
    expect(events.filter(event => event.type === 'cast').map(event => [event.tick, event.sourceId, event.abilityId, event.manaSpent])).toEqual([
      [42, 'enemy-1', 'mystic-bolt', 60], [62, 'unit-1', 'ranger-shot', 60],
    ]);
    expect(events.filter(event => event.type === 'effectTriggered').map(event => [event.tick, event.source.sourceKind,
      event.source.sourceDefinitionId, event.action, event.targetId])).toEqual([
      [21, 'anomaly', 'cycling-core', { kind: 'gainMana', amount: 15 }, 'unit-1'],
      [61, 'anomaly', 'cycling-core', { kind: 'gainMana', amount: 15 }, 'unit-1'],
      [62, 'item', 'echo-rod', { kind: 'dealDamage', amount: 70, damageType: 'magic' }, 'enemy-1'],
    ]);
    expect(events.filter((event): event is Extract<CombatEvent, { type: 'damage' }> => event.type === 'damage' && event.unitId === 'enemy-1')
      .map(event => [event.tick, event.physicalAmount, event.magicAmount, event.hpDamage, event.hp])).toEqual([
      [1, 165, 0, 165, 635], [21, 165, 0, 165, 470], [41, 165, 0, 165, 305],
      [61, 165, 0, 165, 140], [62, 150, 70, 140, 0],
    ]);
    expect(events.filter((event): event is Extract<CombatEvent, { type: 'manaChanged' }> => event.type === 'manaChanged' && event.unitId === 'unit-1')
      .map(event => [event.tick, event.before, event.spent, event.attackGain, event.damageGain, event.hookGain, event.overflow, event.after])).toEqual([
      [1, 0, 0, 10, 0, 0, 0, 10], [21, 10, 0, 10, 0, 15, 0, 35], [41, 35, 0, 10, 0, 0, 0, 45],
      [61, 45, 0, 10, 0, 15, 10, 60], [62, 60, 60, 0, 0, 0, 0, 0],
    ]);
    expect(state.units.map(unit => [unit.id, unit.hp, unit.mana, unit.alive])).toEqual([
      ['enemy-1', 0, 0, false], ['unit-1', 500, 0, true], ['unit-2', 1000, 40, true],
    ]);
    expect(events.slice(-2)).toEqual([
      { type: 'death', tick: 62, unitId: 'enemy-1', domain: 'combat', combatId: 'four-source-golden', eventSeq: 41 },
      { type: 'combatFinished', tick: 62, result: 'playerWin', reason: 'elimination', domain: 'combat', combatId: 'four-source-golden', eventSeq: 42 },
    ]);
    expect(stepCombat(state)).toEqual({ state, events: [] });
    expect(stepCombat(state).state).toBe(state);
  });
});

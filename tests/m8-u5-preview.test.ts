import { describe, expect, it } from 'vitest';
import * as match from '../src/simulation/match';
import type { CombatUnit } from '../src/simulation/combat-types';
import { DEFAULT_BOARD } from '../src/simulation/board';
import { createCombatWithEvents } from '../src/simulation/combat';
import { applyCombatStart } from '../src/simulation/combat-effects';
import { compileCombatInitialInputs, projectCombatStartMana } from '../src/simulation/combat-initialization';
import { resolveAbility } from '../src/simulation/combat-abilities';
import { initializeEffectRuntime, makeSourcedEffects, resolveEffects } from '../src/simulation/effects';
import { ITEM_DEFINITIONS } from '../src/simulation/content/items';
import type { BoundItemProgram } from '../src/simulation/m8/item-program';
import type { Effect, ResolvedTrigger, StrategySnapshot } from '../src/simulation/strategy-types';
import type { ResolvedUnitStats, StarLevel, Unit } from '../src/simulation/unit-types';
import { interval, spellCrit, type S13Unit } from '../src/simulation/combat-s13-state';
import type { EncounterPreview } from '../src/simulation/m8/ui-contracts';
import { ROUND_CATALOG } from '../src/simulation/content/round-catalog';
import { getRoundEnemyItems } from '../src/simulation/round-enemies';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { getUnitStats } from '../src/simulation/unit-stats';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { accepted, freeze, resolveM5Choices } from './match-helpers';

// Independent transcription of M8B_ENCOUNTERS §2–3, not derived from the
// production content/compiler or from readEncounterPreview's own output.
const NEUTRAL_STATS = [
  ['pve-minion-melee-a', 'minion', 110, 8, 40, 0, 0, 1],
  ['pve-minion-melee-b', 'minion', 160, 10, 34, 0, 0, 1],
  ['pve-minion-ranged-b', 'minion', 120, 9, 34, 0, 0, 3],
  ['pve-minion-melee-c', 'minion', 220, 12, 34, 0, 0, 1],
  ['pve-minion-ranged-c', 'minion', 160, 10, 34, 0, 0, 3],
  ['pve-krug', 'krug', 400, 30, 25, 20, 20, 1],
  ['pve-wolf-large', 'wolf', 900, 50, 25, 15, 15, 1],
  ['pve-wolf-small', 'wolf', 450, 22, 25, 15, 15, 1],
  ['pve-razorbeak-large', 'razorbeak', 1400, 65, 25, 25, 25, 1],
  ['pve-razorbeak-small', 'razorbeak', 680, 32, 25, 25, 25, 1],
  ['pve-elder-dragon', 'elder-dragon', 6000, 85, 20, 50, 50, 2],
  ['pve-rift-herald', 'rift-herald', 9000, 120, 20, 60, 60, 2],
] as const;
const ENCOUNTERS = [
  ['1-2', 'minions-a-v1', [['m01', 'pve-minion-melee-a', 2, 3], ['m02', 'pve-minion-melee-a', 4, 3]]],
  ['1-3', 'minions-b-v1', [['m01', 'pve-minion-melee-b', 2, 3], ['m02', 'pve-minion-melee-b', 4, 3], ['r01', 'pve-minion-ranged-b', 3, 1]]],
  ['1-4', 'minions-c-v1', [['m01', 'pve-minion-melee-c', 2, 3], ['m02', 'pve-minion-melee-c', 4, 3], ['r01', 'pve-minion-ranged-c', 2, 1], ['r02', 'pve-minion-ranged-c', 4, 1]]],
  ['2-7', 'krugs-v1', [['k01', 'pve-krug', 1, 3], ['k02', 'pve-krug', 3, 3], ['k03', 'pve-krug', 5, 3]]],
  ['3-7', 'wolves-v1', [['w00', 'pve-wolf-large', 3, 2], ['w01', 'pve-wolf-small', 1, 3], ['w02', 'pve-wolf-small', 2, 3], ['w03', 'pve-wolf-small', 4, 3], ['w04', 'pve-wolf-small', 5, 3]]],
  ['4-7', 'razorbeaks-v1', [['r00', 'pve-razorbeak-large', 3, 2], ['r01', 'pve-razorbeak-small', 0, 3], ['r02', 'pve-razorbeak-small', 1, 3], ['r03', 'pve-razorbeak-small', 2, 3], ['r04', 'pve-razorbeak-small', 4, 3], ['r05', 'pve-razorbeak-small', 5, 3]]],
  ['5-7', 'elder-dragon-v1', [['d01', 'pve-elder-dragon', 3, 2]]],
  ['6-7', 'rift-herald-v1', [['h01', 'pve-rift-herald', 3, 1]]],
] as const;

/** Earlier rounds use synthetic wins only to obtain valid late-round history
 * and resources, as in the B7 wiring fixtures. Each round under test is started
 * by the public command and otherwise runs the real combat/restore pipeline.
 * This is not a public no-cheat route, a loot test, or a balance acceptance. */
const preparedStates = new Map<string, match.MatchState>();
function prepared(roundId: string): match.MatchState {
  if (!preparedStates.size) {
    let state = match.createMatch(42);
    while (true) {
      state = resolveM5Choices(state);
      preparedStates.set(state.roundDefinitionId, state);
      if (state.m8.round.isFinal) break;
      if (state.phase === 'preparation') {
        state = accepted(match.startMatchCombat(state));
        if (state.phase === 'combat') state = match.stepMatch(state).state;
        if (state.phase === 'combat') {
          state = { ...state, combat: { ...state.combat, units: state.combat.units.map(unit =>
            unit.team === 'enemy' ? { ...unit, hp: 0, alive: false } : unit) } };
          state = match.stepMatch(state).state;
        }
      }
      state = resolveM5Choices(state);
      state = accepted(match.nextRound(state, state.round));
    }
  }
  const state = preparedStates.get(roundId);
  if (!state) throw new Error(`Missing prepared fixture: ${roundId}`);
  return state;
}
function sturdyArmy(roundId: string): match.MatchState {
  const state = prepared(roundId);
  return { ...state, nextUnitSerial: 4, preparation: { ...state.preparation,
    units: [...state.preparation.units.filter(unit => unit.team === 'enemy'),
      ...['garen', 'caitlyn', 'lux'].map((definitionId, index) => ({
        id: `unit-${index + 1}`, definitionId, team: 'player' as const, starLevel: 3 as const,
        location: { kind: 'board' as const, cell: { col: 1 + index * 2, row: index === 0 ? 4 : 7 } },
      }))],
  } };
}
function preview(state: match.MatchState): EncounterPreview {
  const result = match.readEncounterPreview(state);
  if (!result) throw new Error(`Expected a preview for ${state.roundDefinitionId}`);
  return result;
}
function tickZeroStats(unit: CombatUnit): EncounterPreview['units'][number]['stats'] {
  const crit = spellCrit(unit);
  // AP must be read from the actual initialized CombatUnit. Do not silently
  // substitute a default or inspect the strategy snapshot for the oracle.
  expect(unit.abilityPower).toBeDefined();
  return {
    maxHp: unit.maxHp, attackDamage: unit.attackDamage, armor: unit.armor, magicResist: unit.magicResist,
    attackRange: unit.attackRange, attackIntervalTicks: unit.attackIntervalTicks,
    critChanceBps: crit.chanceBps, critMultiplierBps: crit.multiplierBps,
    abilityPower: unit.abilityPower!, mana: unit.mana, maxMana: unit.maxMana,
  };
}
function expectTickZero(state: match.MatchState, view = preview(state)): match.MatchState {
  const started = accepted(match.startMatchCombat(state));
  expect(started.combat!.tick).toBe(0);
  const enemies = started.combat!.units.filter(unit => unit.team === 'enemy');
  expect(enemies.map(unit => unit.id).sort()).toEqual(view.units.map(unit => unit.unitId).sort());
  for (const unit of view.units) {
    const actual = enemies.find(enemy => enemy.id === unit.unitId)!;
    expect(unit, unit.unitId).toMatchObject({ definitionId: actual.definitionId, starLevel: actual.starLevel,
      cell: actual.cell, stats: tickZeroStats(actual) });
  }
  expect(preview(started)).toEqual(view);
  return started;
}
function expectDeepFrozen(value: unknown): void {
  expect(value).not.toBeUndefined();
  if (value && typeof value === 'object') {
    expect(Object.isFrozen(value)).toBe(true);
    for (const child of Object.values(value)) expectDeepFrozen(child);
  }
}
function expectPublicShape(view: EncounterPreview): void {
  expect(Object.keys(view).sort()).toEqual(['encounterId', 'rulesNote', 'units']);
  expectDeepFrozen(view);
  for (const unit of view.units) {
    expect(Object.keys(unit).sort()).toEqual([
      'abilityDescription', 'cell', 'definitionId', 'monsterFamily', 'name', 'starLevel', 'stats', 'unitId', 'unitKind',
    ]);
    expect(Object.keys(unit.cell).sort()).toEqual(['col', 'row']);
    expect(Object.keys(unit.stats).sort()).toEqual([
      'abilityPower', 'armor', 'attackDamage', 'attackIntervalTicks', 'attackRange', 'critChanceBps',
      'critMultiplierBps', 'magicResist', 'mana', 'maxHp', 'maxMana',
    ]);
    expect(unit.name.length).toBeGreaterThan(0);
    expect(unit.abilityDescription.length).toBeGreaterThan(5);
    for (const value of Object.values(unit.stats)) {
      expect(Number.isSafeInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
    }
    expect(unit.stats.maxHp).toBeGreaterThan(0);
    expect(unit.stats.attackIntervalTicks).toBeGreaterThan(0);
    expect(unit.stats.critChanceBps).toBeLessThanOrEqual(10000);
    expect(unit.stats.critMultiplierBps).toBeGreaterThanOrEqual(10000);
    expect(unit.stats.mana).toBeLessThanOrEqual(unit.stats.maxMana);
    expect(unit.stats.maxMana).toBeGreaterThanOrEqual(unit.unitKind === 'neutral' ? 0 : 1);
  }
}
function expectUnchangedByReads(state: match.MatchState): void {
  const serialized = serializeMatch(state), entireState = structuredClone(state);
  const first = match.readEncounterPreview(state);
  for (let repeat = 0; repeat < 3; repeat++) expect(match.readEncounterPreview(state)).toEqual(first);
  // Full state covers every RNG stream and draw count, combat events/sequence,
  // receipts, resources, preparation, and all next-ID counters, not a shortlist.
  expect(state).toEqual(entireState);
  expect(serializeMatch(state)).toBe(serialized);
}
function expectRestoredPreview(state: match.MatchState): void {
  const saved = serializeMatch(state), restored = restoreMatch(saved);
  expect(serializeMatch(restored)).toBe(saved);
  expect(match.readEncounterPreview(restored)).toEqual(match.readEncounterPreview(state));
  expectUnchangedByReads(restored);
  expect(match.stepMatch(restored)).toEqual(match.stepMatch(state));
}

describe('U5 EncounterPreview additive opening-state contract', () => {
  it('covers the eight authored PvE encounters and exactly 25 distinct instances', () => {
    expect(ROUND_CATALOG.filter(round => round.kind === 'pve').map(round => round.roundId))
      .toEqual(ENCOUNTERS.map(([roundId]) => roundId));
    const ids = ENCOUNTERS.flatMap(([roundId]) => preview(prepared(roundId)).units.map(unit => unit.unitId));
    expect(ids).toHaveLength(25);
    expect(new Set(ids).size).toBe(25);
  });

  it.each(ENCOUNTERS)('%s projects independent family/stats/identity anchors and real tick-zero combat', (roundId, encounterId, slots) => {
    const state = prepared(roundId), view = preview(state);
    expectPublicShape(view);
    expect(view.encounterId).toBe(encounterId);
    expect(view.units.map(unit => [unit.unitId, unit.definitionId, unit.cell])).toEqual(
      slots.map(([slotId, definitionId, col, row]) => [JSON.stringify(['pve', roundId, encounterId, slotId]), definitionId, { col, row }]),
    );
    for (const unit of view.units) {
      const anchor = NEUTRAL_STATS.find(row => row[0] === unit.definitionId)!;
      expect(anchor).toBeDefined();
      const [, monsterFamily, maxHp, attackDamage, attackIntervalTicks, armor, magicResist, attackRange] = anchor;
      expect(unit).toMatchObject({ unitKind: 'neutral', monsterFamily, starLevel: 1 });
      expect(unit.stats).toEqual({ maxHp, attackDamage, armor, magicResist, attackRange, attackIntervalTicks,
        critChanceBps: 2500, critMultiplierBps: 14000, abilityPower: 100, mana: 0, maxMana: 0 });
    }
    expectUnchangedByReads(state);
    expectRestoredPreview(state);
    expectRestoredPreview(expectTickZero(state, view));
  });

  it.each(ROUND_CATALOG.filter(round => round.kind === 'pvp'))('$roundId projects all public PvP templates and authored star/equipment/trait tiers', round => {
    const state = prepared(round.roundId), view = preview(state);
    expectPublicShape(view);
    expect(view.encounterId).toBe(`pvp:${round.roundId}`);
    expect(view.units).toHaveLength(round.stage === 2 ? (round.subround >= 5 ? 4 : 3) : round.stage + 2);
    expect(view.units.map(unit => unit.starLevel)).toEqual(view.units.map((_, index) =>
      round.stage >= 5 ? 2 : round.stage === 4 && index < 3 ? 2 : round.stage === 3 && index === 0 ? 2 : 1));
    for (const unit of view.units) expect(unit).toMatchObject({ unitKind: 'champion', monsterFamily: null });
    const snapshot = buildStrategySnapshot(state);
    expect(snapshot.traits.some(trait => trait.team === 'enemy' && trait.tier > 0)).toBe(true);
    if (round.stage >= 4) expect(view.units.some(unit => {
      const bare = getUnitStats(unit.definitionId, unit.starLevel);
      return unit.stats.maxHp !== bare.health || unit.stats.attackDamage !== bare.attack
        || unit.stats.armor !== bare.armor || unit.stats.magicResist !== bare.magicResist;
    })).toBe(true);
    const items = getRoundEnemyItems(round.ordinal);
    expect(items.length).toBe(round.stage < 4 ? 0 : (round.stage - 3) + Math.max(0, round.stage - 4));
    for (const item of items) expect(snapshot.units.find(unit => unit.unitId === item.unitId)!.sources.some(source =>
      source.source.sourceKind === 'item' && source.source.sourceDefinitionId === item.definitionId)).toBe(true);
    expectTickZero(state, view);
    expectUnchangedByReads(state);
  });

  it('pins all three stage-six lineups and demonstrates equipment/trait AP and mana beyond bare definitions', () => {
    const lineups = ['6-1', '6-2', '6-3'].map(roundId => preview(prepared(roundId)));
    expect(lineups.map(view => view.units.map(unit => unit.definitionId))).toEqual([
      ['irelia', 'rell', 'leona', 'loris', 'lux', 'zyra', 'nami', 'zoe'],
      ['irelia', 'rell', 'leona', 'loris', 'tristana', 'urgot', 'ezreal', 'corki'],
      ['darius', 'vander', 'scar', 'garen', 'irelia', 'loris', 'maddie', 'kogmaw'],
    ]);
    const all = lineups.flatMap(view => view.units);
    expect(all.some(unit => unit.stats.abilityPower > 100)).toBe(true);
    expect(all.some(unit => unit.stats.mana > getUnitStats(unit.definitionId, unit.starLevel).initialMana)).toBe(true);
    expect(all.some(unit => unit.stats.attackIntervalTicks < getUnitStats(unit.definitionId, unit.starLevel).attackIntervalTicks)).toBe(true);
  });

  it.each(['2-4', '3-4', '4-4', '5-4', '6-4'])('%s remains null, read-only and restore-stable on every supply round', roundId => {
    const state = prepared(roundId);
    expect(match.readEncounterPreview(state)).toBeNull();
    expectUnchangedByReads(state);
    expectRestoredPreview(state);
  });

  it.each(['1-3', '4-7', '6-1'])('%s is detached and deeply frozen with exactly the approved public fields', roundId => {
    const state = freeze(structuredClone(prepared(roundId))), before = serializeMatch(state);
    const first = preview(state), second = preview(state), unit = first.units[0];
    expectPublicShape(first);
    expect(second).toEqual(first);
    expect(second).not.toBe(first);
    expect(second.units).not.toBe(first.units);
    expect(second.units[0].stats).not.toBe(unit.stats);
    expect(second.units[0].cell).not.toBe(unit.cell);
    expect(unit.cell).not.toBe(state.m8.preparation.enemies[0].location.kind === 'board'
      ? state.m8.preparation.enemies[0].location.cell : null);
    expect(Reflect.set(first, 'rulesNote', 'changed')).toBe(false);
    expect(Reflect.set(first.units, '0', null)).toBe(false);
    expect(Reflect.set(unit, 'unitKind', 'forged')).toBe(false);
    expect(Reflect.set(unit.stats, 'mana', 99999)).toBe(false);
    expect(Reflect.set(unit.cell, 'row', 7)).toBe(false);
    expect(serializeMatch(state)).toBe(before);
    expect(preview(state)).toEqual(second);
  });

  it.each(['1-2', '3-7', '6-2'])('%s does not consume RNG, allocate IDs, publish events or perturb the next real command', roundId => {
    const state = prepared(roundId), control = restoreMatch(serializeMatch(state));
    const baseline = match.startMatchCombat(control);
    expectUnchangedByReads(state);
    const actual = match.startMatchCombat(state);
    expect(actual).toEqual(baseline);
    if (!actual.ok || !baseline.ok) throw new Error('Fixture cannot start');
    expectUnchangedByReads(actual.state);
    expect(match.stepMatch(actual.state)).toEqual(match.stepMatch(baseline.state));
  });

  it('keeps the same current encounter through preparation/combat/settlement, then switches only on nextRound', () => {
    let state = prepared('1-2');
    const opening = preview(state);
    state = expectTickZero(state, opening);
    let sawDamage = false;
    while (state.phase === 'combat') {
      state = match.stepMatch(state).state;
      sawDamage ||= state.combat!.units.some(unit => unit.team === 'enemy' && unit.hp < unit.maxHp);
      expect(preview(state)).toEqual(opening);
    }
    expect(sawDamage).toBe(true);
    expect(state.phase).toBe('settlement');
    expectRestoredPreview(state);
    state = accepted(match.nextRound(state, state.round));
    expect(preview(state).encounterId).toBe('minions-b-v1');
    expect(preview(state).units).toHaveLength(3);
    expect(preview(state)).not.toEqual(opening);
  });

  it('does not replace opening mana/health with live PvP values after enemy casts and damage', () => {
    let state = sturdyArmy('4-3');
    const opening = preview(state), enemyIds = new Set(opening.units.map(unit => unit.unitId));
    state = expectTickZero(state, opening);
    let sawEnemyCast = false, sawChangedEnemyMana = false, sawDamage = false;
    while (state.phase === 'combat' && !(sawEnemyCast && sawChangedEnemyMana && sawDamage)) {
      const result = match.stepMatch(state);
      state = result.state;
      sawEnemyCast ||= result.events.some(event => event.type === 'cast' && enemyIds.has(event.sourceId));
      sawChangedEnemyMana ||= state.combat!.units.some(unit => enemyIds.has(unit.id)
        && unit.mana !== opening.units.find(view => view.unitId === unit.id)!.stats.mana);
      sawDamage ||= state.combat!.units.some(unit => enemyIds.has(unit.id) && unit.hp < unit.maxHp);
      expect(preview(state)).toEqual(opening);
    }
    expect({ sawEnemyCast, sawChangedEnemyMana, sawDamage }).toEqual({ sawEnemyCast: true, sawChangedEnemyMana: true, sawDamage: true });
    expectRestoredPreview(state);
  });

  it('retains opening range/cells/intervals after real bird deaths and next-tick speed stacks', () => {
    let state = sturdyArmy('4-7');
    const opening = preview(state);
    state = expectTickZero(state, opening);
    while (state.phase === 'combat' && !state.combat.companionState?.reactions.some(reaction => reaction.status === 'pending'))
      state = match.stepMatch(state).state;
    expect(state.combat!.companionState!.reactions.some(reaction => reaction.status === 'pending')).toBe(true);
    state = match.stepMatch(state).state;
    const buffed = state.combat!.units.find(unit => unit.team === 'enemy' && unit.alive && unit.mechanismState?.statuses.some(group =>
      group.contributions.some(contribution => contribution.application.modifier?.stat === 'attackSpeed')))!;
    expect(buffed).toBeDefined();
    expect(interval(buffed as S13Unit, state.combat!.tick)).toBeLessThan(25);
    expect(preview(state)).toEqual(opening);
    expectUnchangedByReads(state);
    expectRestoredPreview(state);
  });

  it('keeps the final current encounter available at gameOver without inventing a next encounter', () => {
    let state = expectTickZero(sturdyArmy('6-7'));
    const opening = preview(state);
    while (state.phase === 'combat') state = match.stepMatch(state).state;
    expect(state.phase).toBe('gameOver');
    expect(preview(state)).toEqual(opening);
    expect(opening.encounterId).toBe('rift-herald-v1');
    expectRestoredPreview(state);
  });
});


/** Isolated existing Combat domain seam: no Match enemy template/catalog is
 * modified. This lets the shared path prove future public equipment and start
 * hooks which the current fixed PvP formations do not happen to equip. */
function initializationFixture(definitionId: string, effects: readonly Effect[] = [],
  items: readonly string[] = [], stats: Partial<ResolvedUnitStats> = {}, starLevel: StarLevel = 1) {
  const units: readonly Unit[] = [
    { id: 'p', definitionId, team: 'player', starLevel, location: { kind: 'board', cell: { col: 1, row: 4 } } },
    { id: 'e', definitionId: 'ranger', team: 'enemy', starLevel: 1, location: { kind: 'board', cell: { col: 2, row: 3 } } },
  ];
  const preparation = { board: DEFAULT_BOARD, benchSize: 7, units };
  const strategy: StrategySnapshot = { traits: [], units: units.map(unit => {
    const base = { ...getUnitStats(unit.definitionId, unit.starLevel), ...(unit.id === 'p' ? stats : {}) };
    const sources = unit.id !== 'p' ? [] : [
      ...makeSourcedEffects('p', 'augment', 'u5-start-fixture', 'start-source', effects),
      ...items.flatMap((id, index) => makeSourcedEffects('p', 'item', id, `item-${index}`, ITEM_DEFINITIONS[id].effects)),
    ];
    const itemPrograms: BoundItemProgram[] = unit.id !== 'p' ? [] : items.flatMap((id, index) => {
      const item = ITEM_DEFINITIONS[id];
      return item.combatProgram ? [{ source: { ownerId: 'p', sourceKind: 'item', definitionId: id,
        instanceId: `item-${index}`, effectIndex: (item.effects.length + 1) * 1024, parentItemInstanceId: null },
      program: item.combatProgram }] : [];
    });
    return { unitId: unit.id, ...resolveEffects(base, resolveAbility(base.abilityId, unit.starLevel), sources),
      ...(itemPrograms.length ? { itemPrograms } : {}) };
  }) };
  return { preparation, strategy };
}

describe('U5 shared initialization differential at existing Combat seams', () => {
  it.each(['ranger', 'lux'])('%s shares initial mana, start hooks, overflow, event ordering and once-only runtime', definitionId => {
    const fixture = initializationFixture(definitionId, [
      { kind: 'trigger', hook: 'combatStart', everyN: 1, action: { kind: 'gainMana', amount: 9 } },
      { kind: 'trigger', hook: 'combatStart', everyN: 1, action: { kind: 'grantShield', amount: 12, durationTicks: 20 } },
      { kind: 'trigger', hook: 'combatStart', everyN: 1, action: { kind: 'gainMana', amount: 50 } },
      { kind: 'trigger', hook: 'onAttack', everyN: 1, action: { kind: 'gainMana', amount: 99 } },
    ], [], { initialMana: 5, maxMana: 40 });
    freeze(fixture);
    const before = structuredClone(fixture), resolved = fixture.strategy.units.find(unit => unit.unitId === 'p')!;
    const initial = compileCombatInitialInputs('p', resolved.stats, resolved.ability, resolved);
    const input = freeze({ ...initial, id: 'p', triggers: resolved.triggers, effectRuntime: initializeEffectRuntime(resolved.triggers) });
    const projected = projectCombatStartMana(input);
    expect(projected).toMatchObject({ gain: 59, after: 40, overflow: 24 });
    expect(input.mana).toBe(5);
    expect(input.effectRuntime.every(counter => counter.count === 0)).toBe(true);
    expect(projected.invocations.map(invocation => invocation.action.kind)).toEqual(['gainMana', 'grantShield', 'gainMana']);
    const actual = createCombatWithEvents(fixture.preparation, fixture.strategy, 'u5-mana-fixture', 99);
    const actor = actual.state.units.find(unit => unit.id === 'p')!;
    expect(actor).toMatchObject({ mana: 40, maxMana: 40, shield: 12, shieldExpiresAtTick: 20 });
    expect(actor.effectRuntime).toEqual(projected.runtime);
    expect(actual.events.find(event => event.type === 'manaChanged')).toMatchObject({
      tick: 0, unitId: 'p', before: 5, spent: 0, attackGain: 0, damageGain: 0, hookGain: 59, overflow: 24, after: 40,
    });
    expect(actual.events.filter(event => event.type === 'effectTriggered').map(event => event.action))
      .toEqual(projected.invocations.map(invocation => invocation.action));
    expect(actual.events.map(event => event.eventSeq)).toEqual(actual.events.map((_, index) => index));
    expect(actual.state).toMatchObject({ tick: 0, rngState: 99, rngDraws: 0, nextActionSeq: 0, startEffectsApplied: true });
    expect(applyCombatStart(freeze(actual.state))).toEqual({ state: actual.state, events: [] });
    expect(fixture).toEqual(before);
  });

  it('shares trigger filtering and everyN counters without mutating existing runtime', () => {
    // everyN=2 at combatStart is intentionally a lower-level trigger seam;
    // authored content still rejects it. No catalog or enemy definition changes.
    const trigger: ResolvedTrigger = { key: 'u5-trigger', source: { ownerId: 'p', sourceKind: 'augment',
      sourceDefinitionId: 'fixture', sourceInstanceId: 'fixture-1', effectIndex: 0 },
    hook: 'combatStart', everyN: 2, action: { kind: 'gainMana', amount: 13 } };
    const other: ResolvedTrigger = { ...trigger, key: 'other-owner', everyN: 1, source: { ...trigger.source, ownerId: 'e' } };
    const attack: ResolvedTrigger = { ...trigger, key: 'on-attack', everyN: 1, hook: 'onAttack' };
    const input = freeze({ id: 'p', mana: 3, maxMana: 40, triggers: [trigger, other, attack],
      effectRuntime: [{ key: trigger.key, count: 0 }, { key: other.key, count: 4 }, { key: attack.key, count: 7 }] });
    const before = structuredClone(input), first = projectCombatStartMana(input);
    expect(first).toMatchObject({ gain: 0, after: 3, overflow: 0, invocations: [] });
    expect(first.runtime).toEqual([{ key: 'on-attack', count: 7 }, { key: 'other-owner', count: 4 }, { key: 'u5-trigger', count: 1 }]);
    const second = projectCombatStartMana({ ...input, effectRuntime: first.runtime });
    expect(second).toMatchObject({ gain: 13, after: 16, overflow: 0 });
    expect(second.invocations).toHaveLength(1);
    expect(second.runtime.find(counter => counter.key === trigger.key)!.count).toBe(2);
    expect(input).toEqual(before);
  });

  it.each([
    { items: [], chance: 2500, multiplier: 14000, enabled: false, authorizations: 0, ap: 100 },
    { items: ['gloves'], chance: 4500, multiplier: 14000, enabled: false, authorizations: 0, ap: 100 },
    { items: ['infinity-edge'], chance: 6000, multiplier: 14000, enabled: true, authorizations: 1, ap: 100 },
    { items: ['jeweled-gauntlet'], chance: 6000, multiplier: 14000, enabled: true, authorizations: 1, ap: 135 },
    { items: ['infinity-edge', 'jeweled-gauntlet'], chance: 9500, multiplier: 15000, enabled: true, authorizations: 2, ap: 135 },
    { items: ['infinity-edge', 'jeweled-gauntlet', 'infinity-edge'], chance: 10000, multiplier: 16000, enabled: true, authorizations: 3, ap: 135 },
  ])('shares authored item crit modifiers/authorization multiplicity and AP: $items', row => {
    const fixture = freeze(initializationFixture('zyra', [], row.items, {}, 3));
    const before = structuredClone(fixture), resolved = fixture.strategy.units.find(unit => unit.unitId === 'p')!;
    const initial = compileCombatInitialInputs('p', resolved.stats, resolved.ability, resolved);
    const projected = spellCrit({ ...initial, id: 'p', ability: resolved.ability });
    expect(projected).toMatchObject({ chanceBps: row.chance, multiplierBps: row.multiplier, enabled: row.enabled });
    expect(projected.itemSources).toHaveLength(row.authorizations);
    expect(projected.nonItemSources).toEqual([]);
    expect(initial.abilityPower).toBe(row.ap);
    const actual = createCombatWithEvents(fixture.preparation, fixture.strategy, 'u5-crit-fixture', 99);
    const actor = actual.state.units.find(unit => unit.id === 'p')!;
    expect(actor).toMatchObject(initial);
    expect(spellCrit(actor)).toEqual(projected);
    expect(actor.abilityPower).toBe(row.ap);
    expect(actual.state).toMatchObject({ tick: 0, rngState: 99, rngDraws: 0 });
    expect(fixture).toEqual(before);
  });

  it('retains the old neutral guard zero-crit boundary in the shared compiler and actual Combat', () => {
    const fixture = initializationFixture('neutral-stage-2');
    const resolved = fixture.strategy.units.find(unit => unit.unitId === 'p')!;
    const initial = compileCombatInitialInputs('p', resolved.stats, resolved.ability, resolved);
    expect(spellCrit({ ...initial, id: 'p', ability: resolved.ability }))
      .toMatchObject({ chanceBps: 0, multiplierBps: 14000, enabled: false });
    const actual = createCombatWithEvents(fixture.preparation, fixture.strategy, 'u5-legacy-neutral');
    expect(spellCrit(actual.state.units.find(unit => unit.id === 'p')!))
      .toMatchObject({ chanceBps: 0, multiplierBps: 14000, enabled: false });
  });
});

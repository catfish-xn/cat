import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as match from '../src/simulation/match';
import { resolveAbility } from '../src/simulation/combat-abilities';
import { spellCrit } from '../src/simulation/combat-s13-state';
import { ITEM_DEFINITIONS } from '../src/simulation/content/items';
import { makeSourcedEffects, resolveEffects } from '../src/simulation/effects';
import type { BoundItemProgram } from '../src/simulation/m8/item-program';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import type { StrategyUnitSnapshot } from '../src/simulation/strategy-types';
import { getUnitStats } from '../src/simulation/unit-stats';
import { accepted, freeze, reachRound } from './match-helpers';

type InjectionMode = 'disabled' | 'enhanced' | 'legacy-ability' | 'zero-ap';
const injection = vi.hoisted((): { mode: InjectionMode; unitId: string } => ({
  mode: 'disabled', unitId: '',
}));

// This file alone intercepts the existing strategy seam. Both public Match
// entrypoints still execute their real implementation and the real Combat.
// No catalog, enemy template, preparation unit or production module is changed.
vi.mock('../src/simulation/strategy-snapshot', async importOriginal => {
  const actual = await importOriginal<typeof import('../src/simulation/strategy-snapshot')>();
  return { ...actual, buildStrategySnapshot: vi.fn((...args: Parameters<typeof actual.buildStrategySnapshot>) => {
    const snapshot = actual.buildStrategySnapshot(...args);
    if (injection.mode === 'disabled') return snapshot;
    return { ...snapshot, units: snapshot.units.map(unit => unit.unitId === injection.unitId
      ? injectEnemy(unit, args[0]) : unit) };
  }) };
});

function injectEnemy(unit: StrategyUnitSnapshot, state: match.MatchState): StrategyUnitSnapshot {
  if (injection.mode === 'legacy-ability') {
    // A supported legacy ability legitimately omits AP from the initial inputs;
    // no unsafe cast or deletion of a required runtime field is needed.
    return { ...unit, ability: resolveAbility('ranger-shot', 1) };
  }
  if (injection.mode === 'zero-ap') return { ...unit, abilityPower: 0 };
  const enemy = state.preparation.units.find(candidate => candidate.id === unit.unitId && candidate.team === 'enemy');
  if (!enemy) throw new Error('The snapshot injection must target a real enemy');
  const items = ['infinity-edge', 'jeweled-gauntlet'];
  const sources = [
    ...unit.sources,
    ...items.flatMap((id, index) => makeSourcedEffects(unit.unitId, 'item', id,
      `u5-preview-item-${index}`, ITEM_DEFINITIONS[id].effects)),
    ...makeSourcedEffects(unit.unitId, 'augment', 'u5-preview-start-mana', 'u5-preview-start-source', [
      { kind: 'trigger', hook: 'combatStart', everyN: 1, action: { kind: 'gainMana', amount: 9 } },
    ]),
  ];
  const itemPrograms: BoundItemProgram[] = items.map((id, index) => {
    const item = ITEM_DEFINITIONS[id];
    if (!item.combatProgram) throw new Error(`Missing authored item program: ${id}`);
    return { source: { ownerId: unit.unitId, sourceKind: 'item', definitionId: id,
      instanceId: `u5-preview-item-${index}`, effectIndex: (item.effects.length + 1) * 1024,
      parentItemInstanceId: null }, program: structuredClone(item.combatProgram) };
  });
  const resolved = resolveEffects(getUnitStats(enemy.definitionId, enemy.starLevel), unit.ability, sources);
  return { ...unit, ...resolved, stats: { ...resolved.stats, initialMana: 5, maxMana: 40 },
    itemPrograms: [...(unit.itemPrograms ?? []), ...itemPrograms] };
}

const snapshots = vi.mocked(buildStrategySnapshot);
function resetInjection(): void {
  injection.mode = 'disabled';
  injection.unitId = '';
  snapshots.mockClear();
}
beforeEach(resetInjection);
afterEach(resetInjection);

function prepared(): match.MatchState {
  // Reach the real first PvP preparation through public choices/empty-board
  // concessions while the mock passes through, then legally deploy a survivor.
  expect(injection.mode).toBe('disabled');
  let state = reachRound('2-1');
  const hero = state.preparation.units.find(unit => unit.id === 'unit-1');
  if (!hero) throw new Error('Missing publicly acquired starting hero');
  if (hero.location.kind !== 'board') state = accepted(match.deployMatchUnit(state, hero.id,
    { kind: 'board', cell: { col: 1, row: 4 } }));
  expect(state.phase).toBe('preparation');
  expect(state.m8.round.kind).toBe('pvp');
  return freeze(state);
}

function readAndStart(mode: 'enhanced' | 'zero-ap') {
  const state = prepared();
  const before = structuredClone(state);
  const normal = buildStrategySnapshot(state);
  injection.unitId = state.m8.preparation.enemies[0].id;
  injection.mode = mode;
  snapshots.mockClear();

  const view = match.readEncounterPreview(state);
  if (!view) throw new Error('The real PvP preparation must have a preview');
  expect(snapshots).toHaveBeenCalledTimes(1);
  expect(snapshots).toHaveBeenNthCalledWith(1, state);
  const projectionCall = snapshots.mock.results[0];
  if (projectionCall.type !== 'return') throw new Error('The snapshot query must return normally');
  const projectedSnapshot = projectionCall.value;
  expect(projectedSnapshot.units.filter(unit => unit.unitId !== injection.unitId))
    .toEqual(normal.units.filter(unit => unit.unitId !== injection.unitId));
  expect(projectedSnapshot.traits).toEqual(normal.traits);
  expect(state).toEqual(before);

  const result = match.startMatchCombat(state);
  const started = accepted(result);
  expect(snapshots).toHaveBeenCalledTimes(2);
  expect(snapshots).toHaveBeenNthCalledWith(2, state);
  expect(snapshots.mock.results[1].value).toEqual(projectedSnapshot);
  expect(started.phase).toBe('combat');
  if (!started.combat) throw new Error('Public Start must create real combat');
  expect(started.combat).toMatchObject({ tick: 0, rngDraws: 0, strategy: projectedSnapshot });
  const previewUnit = view.units.find(unit => unit.unitId === injection.unitId);
  const combatUnit = started.combat.units.find(unit => unit.id === injection.unitId);
  if (!previewUnit || !combatUnit) throw new Error('Both public entrypoints must include the injected enemy');
  expect(combatUnit.team).toBe('enemy');
  expect(state).toEqual(before);
  // Synthetic compiled snapshots intentionally cannot be restored as production
  // content. Clone the legal input instead: reading must not change any seed,
  // event, receipt, ID or the next real public command's result.
  expect(match.startMatchCombat(before)).toEqual(result);
  return { previewUnit, combatUnit, started };
}

async function expectDefaultSnapshot(): Promise<void> {
  const state = prepared();
  const actual = await vi.importActual<typeof import('../src/simulation/strategy-snapshot')>(
    '../src/simulation/strategy-snapshot');
  const normal = actual.buildStrategySnapshot(state);
  expect(buildStrategySnapshot(state)).toEqual(normal);
  const before = structuredClone(state);
  const view = match.readEncounterPreview(state);
  if (!view) throw new Error('Missing default PvP preview');
  const started = accepted(match.startMatchCombat(state));
  expect(started.combat!.strategy).toEqual(normal);
  for (const unit of view.units) {
    const combatUnit = started.combat!.units.find(candidate => candidate.id === unit.unitId)!;
    expect(unit.stats).toMatchObject({ critChanceBps: 2500, critMultiplierBps: 14000,
      abilityPower: combatUnit.abilityPower, mana: combatUnit.mana, maxMana: combatUnit.maxMana });
  }
  expect(state).toEqual(before);
}

describe('U5 public preview consumes the same mocked strategy as real tick-zero Combat', () => {
  it('passes through the actual snapshot by default before any injection', expectDefaultSnapshot);

  it('projects nondefault item crit chance 9500 through the public preview selector', () => {
    const { previewUnit, combatUnit } = readAndStart('enhanced');
    // Independent rule arithmetic: 2500 base + 3500 IE + 3500 JG = 9500.
    expect(spellCrit(combatUnit).chanceBps).toBe(9500);
    expect(previewUnit.stats.critChanceBps).toBe(9500);
    expect(previewUnit.stats.critChanceBps).toBe(spellCrit(combatUnit).chanceBps);
  });

  it('projects nondefault duplicate item crit multiplier 15000 through the public preview selector', () => {
    const { previewUnit, combatUnit } = readAndStart('enhanced');
    // Independent rule arithmetic: 14000 base + one duplicate authorization's
    // 1000 bonus = 15000. Both authorizations are real authored item programs.
    const crit = spellCrit(combatUnit);
    expect(crit.itemSources.map(source => source.definitionId)).toEqual(['infinity-edge', 'jeweled-gauntlet']);
    expect(crit.enabled).toBe(true);
    expect(crit.multiplierBps).toBe(15000);
    expect(previewUnit.stats.critMultiplierBps).toBe(15000);
    expect(previewUnit.stats.critMultiplierBps).toBe(crit.multiplierBps);
  });

  it('projects combatStart mana 14 rather than resolved initial mana 5 through the public preview selector', () => {
    const { previewUnit, combatUnit, started } = readAndStart('enhanced');
    // Independent rule arithmetic: min(40, 5 initial + 9 combatStart) = 14.
    expect(started.combat!.strategy!.units.find(unit => unit.unitId === combatUnit.id)!.stats)
      .toMatchObject({ initialMana: 5, maxMana: 40 });
    expect(combatUnit).toMatchObject({ mana: 14, maxMana: 40, abilityPower: 135 });
    expect(previewUnit.stats).toMatchObject({ mana: 14, maxMana: 40, abilityPower: 135 });
    expect(previewUnit.stats.mana).toBe(combatUnit.mana);
    expect(previewUnit.stats.abilityPower).toBe(combatUnit.abilityPower);
  });

  it('rejects missing initialized AP from a supported legacy ability with an explicit RangeError', () => {
    const state = prepared(), before = structuredClone(state);
    injection.unitId = state.m8.preparation.enemies[0].id;
    injection.mode = 'legacy-ability';
    snapshots.mockClear();
    let failure: unknown;
    try { match.readEncounterPreview(state); } catch (error) { failure = error; }
    expect(failure).toBeInstanceOf(RangeError);
    expect(failure).toHaveProperty('message', 'Missing preview ability power');
    expect(snapshots).toHaveBeenCalledTimes(1);
    const started = accepted(match.startMatchCombat(state));
    expect(snapshots).toHaveBeenCalledTimes(2);
    const combatUnit = started.combat!.units.find(unit => unit.id === injection.unitId)!;
    expect(started.combat!.tick).toBe(0);
    expect(combatUnit.ability).toEqual(resolveAbility('ranger-shot', 1));
    expect(combatUnit.abilityPower).toBeUndefined();
    expect(state).toEqual(before);
  });

  it('preserves legitimate zero AP in both the public preview and real tick-zero Combat', () => {
    const { previewUnit, combatUnit } = readAndStart('zero-ap');
    expect(combatUnit.abilityPower).toBe(0);
    expect(previewUnit.stats.abilityPower).toBe(0);
    expect(previewUnit.stats.abilityPower).toBe(combatUnit.abilityPower);
  });

  it('returns to the actual default snapshot after all injected and guard cases', expectDefaultSnapshot);
});

import { describe, expect, it } from 'vitest';
import { createMatch, deployMatchUnit, startMatchCombat, type MatchCommandResult, type MatchState } from '../src/simulation/match';
import { restoreMatch } from '../src/simulation/serialization';
import type { UnitLocation } from '../src/simulation/unit-types';
import { createCombatWithEvents } from '../src/simulation/combat';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { validateContent } from '../src/simulation/validate-content';
import { TRAIT_DEFINITIONS, ITEM_DEFINITIONS, AUGMENT_DEFINITIONS, ANOMALY_DEFINITIONS } from '../src/simulation/content';
import type { ChoiceDefinition } from '../src/simulation/strategy-types';
function accept(result: MatchCommandResult): MatchState {
  if (!result.ok) throw new Error(result.reason);
  return result.state;
}
function running(): MatchState {
  return accept(startMatchCombat(accept(deployMatchUnit(createMatch(), 'unit-1', { kind: 'board', cell: { col: 2, row: 4 } }))));
}
function mutable(state: MatchState): Record<string, any> { return JSON.parse(JSON.stringify(state)); }

describe('review regressions: runtime commands and safe restore', () => {
  it.each([null, undefined, { kind: 'board', cell: null }, { kind: 'board' }, { kind: 'teleport', slot: 5 }, { slot: 5 }])(
    'atomically rejects malformed deployment %j without throwing or corrupting location', target => {
      const state = createMatch();
      const before = JSON.stringify(state);
      let result: MatchCommandResult | undefined;
      expect(() => { result = deployMatchUnit(state, 'unit-1', target as UnitLocation); }).not.toThrow();
      expect(result?.ok).toBe(false);
      expect(result?.state).toBe(state);
      expect(JSON.stringify(state)).toBe(before);
    });
  it('rejects enemy IDs that collide with the next player-unit serial namespace', () => {
    const invalid = mutable(createMatch());
    const enemy = invalid.preparation.units.find((unit: { team: string }) => unit.team === 'enemy');
    enemy.id = `unit-${invalid.nextUnitSerial}`;
    expect(() => restoreMatch(invalid)).toThrow();
  });
  it('rejects non-normalized current XP that would grant free levels after restore', () => {
    expect(() => restoreMatch({ ...createMatch(), xp: 999 })).toThrow();
  });
  it('rejects a restored preparation roster above current population cap', () => {
    const state = createMatch();
    const units = state.preparation.units.map((unit, index) => unit.team === 'player'
      ? { ...unit, location: { kind: 'board' as const, cell: { col: index, row: 4 } } } : unit);
    expect(() => restoreMatch({ ...state, preparation: { ...state.preparation, units } })).toThrow();
  });
  it('rejects a running combat that has already reached its mandatory timeout', () => {
    const state = running();
    if (!state.combat) throw new Error('Expected combat');
    expect(() => restoreMatch({ ...state, combat: { ...state.combat, tick: state.combat.maxTicks } })).toThrow();
  });
  it('rejects a running combat after one entire team has already been eliminated', () => {
    const invalid = mutable(running());
    for (const unit of invalid.combat.units) if (unit.team === 'player') Object.assign(unit, {
      hp: 0, alive: false, mana: 0, shield: 0, shieldExpiresAtTick: null, targetId: null, cooldownTicks: 0, moveCooldownTicks: 0,
    });
    expect(() => restoreMatch(invalid)).toThrow();
  });
  it('rejects cooldowns longer than the resolved attack interval', () => {
    const invalid = mutable(running());
    invalid.combat.units[0].cooldownTicks = Number.MAX_SAFE_INTEGER;
    expect(() => restoreMatch(invalid)).toThrow();
  });
  it('rejects a combat target pointing to the owner itself', () => {
    const invalid = mutable(running());
    invalid.combat.units[0].targetId = invalid.combat.units[0].id;
    expect(() => restoreMatch(invalid)).toThrow();
  });
  it('rejects reward receipts with duplicate item IDs or invented fixed gold', () => {
    const duplicate = mutable(createMatch());
    duplicate.scheduleReceipts[0].itemIds = ['item-1', 'item-1'];
    expect(() => restoreMatch(duplicate)).toThrow();
    const wrongGold = mutable(createMatch());
    wrongGold.scheduleReceipts[0].gold = 999;
    expect(() => restoreMatch(wrongGold)).toThrow();
  });
});

it('aggregates every legal start shield duration before applying the nonzero shield condition', () => {
  const state = accept(deployMatchUnit(createMatch(), 'unit-1', { kind: 'board', cell: { col: 2, row: 4 } }));
  const augments: Readonly<Record<string, ChoiceDefinition>> = { ...AUGMENT_DEFINITIONS,
    'a-zero': { id: 'a-zero', name: '零盾', description: '零盾长时', effects: [{ kind: 'trigger', hook: 'combatStart', everyN: 1, action: { kind: 'grantShield', amount: 0, durationTicks: 100 } }] },
    'z-strong': { id: 'z-strong', name: '短盾', description: '百盾短时', effects: [{ kind: 'trigger', hook: 'combatStart', everyN: 1, action: { kind: 'grantShield', amount: 100, durationTicks: 10 } }] },
  };
  expect(() => validateContent({ augments })).not.toThrow();
  const strategy = buildStrategySnapshot({ ...state, augments: [
    { definitionId: 'a-zero', choiceId: 'first', acquiredRound: 2 },
    { definitionId: 'z-strong', choiceId: 'second', acquiredRound: 5 },
  ] }, { traits: TRAIT_DEFINITIONS, items: ITEM_DEFINITIONS, augments, anomalies: ANOMALY_DEFINITIONS });
  const started = createCombatWithEvents(state.preparation, strategy, 'review-start');
  expect(started.state.units.find(unit => unit.id === 'unit-1')).toMatchObject({ shield: 100, shieldExpiresAtTick: 100 });
});

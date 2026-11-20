import { describe, expect, it } from 'vitest';
import { namedAsEffectSource, removeCombatUnit } from '../src/simulation/seat-mechanics/combat-events';
import { effectSourceUnit, sourceSpellCrit } from '../src/simulation/effect-source';
import type { CombatState, CombatUnit } from '../src/simulation/combat-types';

// Only the fields these helpers read; the rest of a combat unit is irrelevant here.
const unit = (id: string, sourceOwners: { tasks?: string[]; statuses?: string[] } = {}): CombatUnit => ({
  id, targetId: null,
  mechanismState: {
    periodicTasks: (sourceOwners.tasks ?? []).map(ownerId => ({ source: { ownerId } })),
    statuses: (sourceOwners.statuses ?? []).map(ownerId => ({ contributions: [{ source: { ownerId } }] })),
  },
} as unknown as CombatUnit);
const state = (units: CombatUnit[]): CombatState => ({ units } as unknown as CombatState);

describe('departed effect source', () => {
  it('keeps a removed unit only while a remaining effect names it as source', () => {
    const named = removeCombatUnit(state([unit('a'), unit('b', { tasks: ['a'] })]), 'a', 'trench-split', 5).state;
    expect(named.removedUnitIds).toEqual(['a']);
    expect(named.departedUnits?.map(u => u.id)).toEqual(['a']);
    const status = removeCombatUnit(state([unit('a'), unit('b', { statuses: ['a'] })]), 'a', 'trench-split', 5).state;
    expect(status.departedUnits?.map(u => u.id)).toEqual(['a']);
    const unnamed = removeCombatUnit(state([unit('a'), unit('b', { tasks: ['b'] })]), 'a', 'trench-split', 5).state;
    expect(unnamed.departedUnits).toBeUndefined();
    expect(namedAsEffectSource([unit('b', { tasks: ['a'] })], 'a')).toBe(true);
    expect(namedAsEffectSource([unit('b')], 'a')).toBe(false);
  });

  it('looks a source up on the board, then the banished roster, then departed units', () => {
    const board = unit('x'), banished = unit('y'), departed = unit('z');
    const ctx = { units: [board], roster: [board, banished], departedUnits: [departed] } as never;
    expect(effectSourceUnit(ctx, 'x')).toBe(board);
    expect(effectSourceUnit(ctx, 'y')).toBe(banished);
    expect(effectSourceUnit(ctx, 'z')).toBe(departed);
    expect(effectSourceUnit(ctx, 'gone')).toBeUndefined();
    expect(sourceSpellCrit(ctx, 'gone').enabled).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { getNeighbors } from '../src/simulation/board';
import type { CombatUnit } from '../src/simulation/combat';
import { stepMatch, type MatchState } from '../src/simulation/match';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { battle } from './match-helpers';

function approachSave(): MatchState {
  const state = stepMatch(battle()).state; // battle() uses seed 42.
  expect(state.seed).toBe(42);
  expect(state.combat!.tick).toBe(1);
  const holder = state.combat!.units.find(unit => unit.meleeApproach && !unit.targetEngaged);
  expect(holder).toBeDefined();
  expect(holder!.meleeApproach).toBeDefined();
  expect(holder!.targetEngaged).toBeUndefined();
  return state;
}
function rejectEveryEntrance(state: MatchState, reason: RegExp) {
  expect(() => serializeMatch(state)).toThrow(reason);
  expect(() => restoreMatch(state)).toThrow(reason);
  expect(() => restoreMatch(JSON.stringify(state))).toThrow(reason);
}

describe('melee approach restore authentication', () => {
  it('restores the seed 42 tick 1 locks from object and JSON and resumes every tick identically', () => {
    const state = approachSave();
    for (const input of [structuredClone(state), serializeMatch(state)]) {
      let live = state, restored = restoreMatch(input);
      expect(restored).toEqual(live);
      while (live.phase === 'combat') {
        const next = stepMatch(live), resumed = stepMatch(restored);
        expect(resumed).toEqual(next);
        live = next.state; restored = resumed.state;
      }
    }
  });

  it.each(['another attack hex', 'missing lock', 'invented lock', 'malformed lock'] as const)(
    'rejects %s at serialization and both restore entrances', kind => {
      // All opening units already have a lock at tick 1; use the genuine
      // seed 42 tick 0 opening for the invented-lock case, where none do.
      const bad = structuredClone(kind === 'invented lock' ? battle() : approachSave());
      const holder = bad.combat!.units.find(unit => unit.meleeApproach && !unit.targetEngaged)!;
      if (kind === 'another attack hex') {
        const target = bad.combat!.units.find(unit => unit.id === holder.meleeApproach!.targetId)!;
        const other = getNeighbors(bad.combat!.board, target.cell).find(cell =>
          cell.col !== holder.meleeApproach!.cell.col || cell.row !== holder.meleeApproach!.cell.row)!;
        expect(other).toBeDefined();
        Object.assign(holder, { meleeApproach: { targetId: target.id, cell: other } });
      } else if (kind === 'missing lock') {
        delete (holder as { meleeApproach?: CombatUnit['meleeApproach'] }).meleeApproach;
      } else if (kind === 'invented lock') {
        const unbound = bad.combat!.units.find(unit => !unit.meleeApproach)!;
        expect(unbound).toBeDefined();
        const enemy = bad.combat!.units.find(unit => unit.team !== unbound.team)!;
        Object.assign(unbound, { meleeApproach: { targetId: enemy.id, cell: getNeighbors(bad.combat!.board, enemy.cell)[0] } });
      } else Object.assign(holder, { meleeApproach: { foo: 1 } });
      rejectEveryEntrance(bad, kind === 'malformed lock' ? /melee approach|target binding facts/ : /target binding facts/);
    });

  it.each([
    ['extra approach key', (unit: CombatUnit) => ({ ...unit.meleeApproach!, extra: 1 }), /melee approach keys/],
    ['missing target', (unit: CombatUnit) => ({ cell: unit.meleeApproach!.cell }), /melee approach keys/],
    ['unknown target', (unit: CombatUnit) => ({ ...unit.meleeApproach!, targetId: 'absent' }), /melee approach target reference/],
    ['friendly target', (unit: CombatUnit) => ({ ...unit.meleeApproach!, targetId: unit.id }), /melee approach target reference/],
    ['extra cell key', (unit: CombatUnit) => ({ ...unit.meleeApproach!, cell: { ...unit.meleeApproach!.cell, extra: 1 } }), /melee approach cell keys/],
    ['missing coordinate', (unit: CombatUnit) => ({ ...unit.meleeApproach!, cell: { col: 1 } }), /melee approach cell keys/],
    ['fractional coordinate', (unit: CombatUnit) => ({ ...unit.meleeApproach!, cell: { col: 1.5, row: 1 } }), /integer/],
    ['off-board cell', (unit: CombatUnit) => ({ ...unit.meleeApproach!, cell: { col: 7, row: 1 } }), /melee approach cell/],
    ['non-object cell', (unit: CombatUnit) => ({ ...unit.meleeApproach!, cell: null }), /object/],
  ] as const)('checks %s structurally', (_name, patch, reason) => {
    const bad = structuredClone(approachSave());
    const holder = bad.combat!.units.find(unit => unit.meleeApproach && !unit.targetEngaged)!;
    Object.assign(holder, { meleeApproach: patch(holder) });
    rejectEveryEntrance(bad, reason);
  });
});

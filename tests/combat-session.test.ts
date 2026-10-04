import { describe, expect, it, vi } from 'vitest';
import { CombatSession } from '../src/rendering/combat-session';
import { createCombat, stepCombat, type CombatEvent, type CombatState, type CombatStep } from '../src/simulation/combat';
import { createGame, deployUnit } from '../src/simulation/game';

function preparation() {
  return deployUnit(createGame(), 'unit-1', { kind: 'board', cell: { col: 2, row: 7 } }).state;
}
// A controllable API verifies lifecycle isolation independently of combat balancing.
function injuredStep(state: CombatState): CombatStep {
  return {
    state: { ...state, tick: state.tick + 1, units: state.units.map((unit, i) => ({ ...unit,
      hp: i === 0 ? 0 : 1, alive: i !== 0, cooldownTicks: 9, moveCooldownTicks: 3,
      cell: { col: i, row: 3 },
    })) },
    events: [{ type: 'damage', tick: state.tick + 1, unitId: state.units[0].id, amount: 800, hp: 0 }],
  };
}

describe('combat session lifecycle and fixed clock', () => {
  it('locks deployment and rejects repeated Start throughout combat and result', () => {
    const session = new CombatSession(preparation(), { createCombat, stepCombat: state => ({
      state: { ...state, tick: 1, status: 'finished', result: 'draw' }, events: [],
    }) });
    expect(session.start()).toBe(true);
    const first = session.combat;
    expect(session.start()).toBe(false);
    expect(session.combat).toBe(first);
    expect(session.deploy('unit-1', { kind: 'bench', slot: 0 })).toBe('combat-active');
    session.advance(50);
    expect(session.phase).toBe('result');
    expect(session.start()).toBe(false);
    expect(session.deploy('unit-1', { kind: 'bench', slot: 0 })).toBe('combat-active');
    expect(session.advance(500)).toEqual([]);
    expect(session.combat?.tick).toBe(1);
  });

  it('restores the full Start snapshot and clears damage, death, cooldown, events and partial time', () => {
    const prep = preparation(), session = new CombatSession(prep, { createCombat, stepCombat: injuredStep });
    const before = structuredClone(prep);
    expect(session.reset()).toBe(false);
    session.start();
    expect(session.advance(75)).toHaveLength(1);
    expect(session.combat?.units.some(unit => !unit.alive)).toBe(true);
    expect(session.preparation).toEqual(before);
    expect(session.reset()).toBe(true);
    expect(session.phase).toBe('preparation');
    expect(session.combat).toBeNull();
    expect(session.preparation).toEqual(before);
    expect(session.advance(1000)).toEqual([]);
    expect(session.deploy('unit-1', { kind: 'board', cell: { col: 4, row: 6 } })).toBeUndefined();
    const secondSnapshot = structuredClone(session.preparation);
    session.start();
    expect(session.combat?.units.every(unit => unit.hp === unit.maxHp && unit.alive && unit.cooldownTicks === 0 && unit.moveCooldownTicks === 0)).toBe(true);
    expect(session.combat?.units.find(unit => unit.id === 'unit-1')?.cell).toEqual({ col: 4, row: 6 });
    expect(session.advance(25)).toEqual([]);
    expect(session.combat?.tick).toBe(0);
    session.advance(25);
    session.reset();
    expect(session.preparation).toEqual(secondSnapshot);
    expect(prep).toEqual(before);
  });

  it('only advances whole 50 ms ticks and ignores invalid deltas', () => {
    const session = new CombatSession(preparation());
    session.start();
    for (const delta of [-1, NaN, Infinity, -Infinity, 0]) expect(session.advance(delta)).toEqual([]);
    session.advance(49);
    expect(session.combat?.tick).toBe(0);
    session.advance(1);
    expect(session.combat?.tick).toBe(1);
    session.advance(125);
    expect(session.combat?.tick).toBe(3);
    session.advance(25);
    expect(session.combat?.tick).toBe(4);
  });

  it('retains every tick and event across different frame delta partitions', () => {
    function run(deltas: number[]) {
      const session = new CombatSession(preparation(), { createCombat, stepCombat });
      const events: CombatEvent[] = [];
      session.start();
      for (const delta of deltas) events.push(...session.advance(delta));
      return { state: session.combat, events };
    }
    expect(run([13, 7, 75, 5, 900])).toEqual(run(Array(100).fill(10)));
    expect(run([1000])).toEqual(run(Array(20).fill(50)));
    expect(run([60_000])).toEqual(run(Array(1200).fill(50)));
    expect(run([60_000]).state?.status).toBe('finished');
  });

  it.each(['missing-player', 'missing-enemy', 'missing-both'] as const)('rejects %s without creating combat or a reset snapshot', reason => {
    const prep = preparation();
    const units = reason === 'missing-player' ? createGame().units
      : reason === 'missing-enemy' ? prep.units.filter(unit => unit.team === 'player') : [];
    const create = vi.fn(createCombat);
    const session = new CombatSession({ ...prep, units }, { createCombat: create, stepCombat });
    const before = structuredClone(session.preparation);
    expect(session.startFailure).toBe(reason);
    expect(session.start()).toBe(false);
    expect(session.start()).toBe(false);
    expect(create).not.toHaveBeenCalled();
    expect(session.phase).toBe('preparation');
    expect(session.combat).toBeNull();
    expect(session.advance(1000)).toEqual([]);
    expect(session.reset()).toBe(false);
    expect(session.preparation).toEqual(before);
  });

  it('rechecks eligibility after deployment and after returning the last player to bench', () => {
    const session = new CombatSession(createGame());
    expect(session.start()).toBe(false);
    session.deploy('unit-1', { kind: 'board', cell: { col: 2, row: 7 } });
    expect(session.startFailure).toBeUndefined();
    expect(session.start()).toBe(true);
    expect(session.phase).toBe('combat');
    session.reset();
    session.deploy('unit-1', { kind: 'bench', slot: 0 });
    expect(session.startFailure).toBe('missing-player');
    expect(session.start()).toBe(false);
    expect(session.phase).toBe('preparation');
  });
});

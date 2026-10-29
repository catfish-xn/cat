import { describe, expect, it } from 'vitest';
import { DEFAULT_BOARD, hexDistance } from '../src/simulation/board';
import { createCombat, stepCombat, type CombatState, type CombatUnit, type CombatEvent } from '../src/simulation/combat';
import { resolveAbility } from '../src/simulation/combat-abilities';
import { combatCellKey, decideCombatTarget } from '../src/simulation/combat-targeting';
import { applyStatus, EMPTY_RUNTIME, origin, range, type S13Unit } from '../src/simulation/combat-s13-state';
import { nextRandom } from '../src/simulation/rng';
import { isSelectable } from '../src/simulation/anomalies/availability';
import { applyStatusContribution } from '../src/simulation/m8/status';
import { effectIdentity } from '../src/simulation/m8/identity';
import type { Unit } from '../src/simulation/unit-types';
import { battle, freeze, unit } from './combat-helpers';

function actor(id = 'p', patch: Partial<CombatUnit> = {}): S13Unit {
  return unit(id, 'player', 3, 4, { definitionId: 'draven', ability: resolveAbility('draven-ability', 1),
    hp: 10000, maxHp: 10000, maxMana: 100000, attackRange: 1, attackDamage: 40,
    baseAttackSpeedBps: 10000, runtime: { ...EMPTY_RUNTIME }, statuses: [], tasks: [], shieldLayers: [], ...patch }) as S13Unit;
}
function enemy(id: string, col: number, row: number, patch: Partial<CombatUnit> = {}): S13Unit {
  return actor(id, { team: 'enemy', definitionId: 'neutral-stage-2', ability: resolveAbility('neutral-attack', 1),
    cell: { col, row }, cooldownTicks: 1000, moveCooldownTicks: 1000, attackDamage: 0, ...patch });
}
const occupied = (units: readonly S13Unit[]) => new Set(units.filter(u => u.alive).map(u => combatCellKey(u.cell)));
const decide = (p: S13Unit, others: S13Unit[], tick = 1, reselect = false) =>
  decideCombatTarget(DEFAULT_BOARD, p, [p, ...others], tick, occupied([p, ...others]), reselect);
const run = (units: CombatUnit[], tick = 0) => stepCombat(freeze(battle(units, { tick, rngState: 42, rngDraws: 0 })));
const get = (state: CombatState, id = 'p') => state.units.find(u => u.id === id)!;

describe('P0 target retention', () => {
  it.each([1, 2])('keeps the old in-range tank when a new enemy is at distance %i (closer or tied)', distance => {
    const p = actor('p', { attackRange: 3, targetId: 'z-old', targetEngaged: true });
    const old = enemy('z-old', 3, 2), near = enemy('a-new', distance === 1 ? 3 : 4, distance === 1 ? 3 : 2);
    expect(hexDistance(p.cell, near.cell)).toBe(distance);
    expect(decide(p, [near, old]).target?.id).toBe(old.id);
    const result = run([p, old, near]);
    expect(get(result.state).targetId).toBe(old.id);
    expect(result.events.filter(e => e.type === 'targetChanged' && e.unitId === p.id)).toEqual([]);
    expect(result.events.filter(e => e.type === 'attack')).toEqual([{ type: 'attack', tick: 1, attackerId: p.id, targetId: old.id }]);
    expect(result.state.rngDraws).toBe(1); // Only the ordinary crit roll.
  });

  it.each(['dead', 'zero-hp', 'invisible', 'absent', 'untargetable', 'proxy'] as const)('reselects when the old target becomes %s', kind => {
    const p = actor('p', { attackRange: 4, targetId: 'z-old', targetEngaged: true });
    const old = enemy('z-old', 3, 2), near = enemy('a-new', 3, 3);
    if (kind === 'dead') { old.alive = false; old.hp = 0; }
    if (kind === 'zero-hp') old.hp = 0;
    if (kind === 'invisible') old.anomalyState = { invisibleUntilTick: 10 } as S13Unit['anomalyState'];
    if (kind === 'absent') old.itemBanish = { ownerId: 'p', itemInstanceId: 'test', untilTick: 10 };
    if (kind === 'proxy') old.definitionId = 'v20-silco-minion';
    if (kind === 'untargetable') {
      applyStatus(old, origin(old), 'stun', 0, 10, 0, []);
      old.mechanismState = { ...old.mechanismState!, statuses: applyStatusContribution([], effectIdentity('targeting', { ...origin(old), parentItemInstanceId: null }, old.id),
        { kind: 'untargetable', magnitudeBps: 0, activation: 'immediate', duration: { kind: 'ticks', ticks: 10 },
          stackPolicy: { kind: 'independent-instances' }, removable: true, polarity: 'beneficial', damageFilter: null, onEnd: null }, 0).groups };
    }
    expect(isSelectable(old, 1)).toBe(false);
    expect(decide(p, [old, near]).target?.id).toBe(near.id);
  });

  it('preserves taunt > Betrayal > Cull > ordinary retention', () => {
    const p = actor('p', { definitionId: 'maddie', attackRange: 4, targetId: 'old', targetEngaged: true });
    const old = enemy('old', 3, 3), low = enemy('low', 4, 3, { hp: 10 }), forced = enemy('forced', 6, 1);
    const ambessa = actor('ambessa', { definitionId: 'ambessa', targetId: forced.id });
    const source = { ...origin(p), sourceKind: 'anomaly' as const, definitionId: 'cull-the-weak' };
    p.mechanics = [{ source, mechanic: 's13P2Anomaly', values: {} }];
    expect(decide(p, [old, low, forced, ambessa], 60).target?.id).toBe(low.id);
    p.mechanics = [...p.mechanics, { source: { ...source, sourceKind: 'augment', definitionId: 'betrayal' }, mechanic: 'traitAugmentB2', values: {} }];
    expect(decide(p, [old, low, forced, ambessa], 60).target?.id).toBe(forced.id);
    p.voidSwarmTaunt = old.id;
    expect(decide(p, [old, low, forced, ambessa], 60).target?.id).toBe(old.id);
  });

  it('keeps existing controlled-tick rescans and reselects on control release', () => {
    const p = actor('p', { attackRange: 4, targetId: 'old', targetEngaged: true, moveCooldownTicks: 100 });
    const old = enemy('old', 3, 1), near = enemy('near', 3, 3);
    applyStatus(p, origin(old), 'stun', 0, 2, 0, []); // active ticks 1,2, released at 3
    const controlled = run([p, old, near]);
    expect(get(controlled.state).targetId).toBe(near.id);
    expect(controlled.events.some(e => e.type === 'attack')).toBe(false);
    const release = run([{ ...get(controlled.state), targetId: old.id }, old, near], 2);
    expect(get(release.state).targetId).toBe(near.id);
    expect(release.events.some(e => e.type === 'attack' && e.attackerId === p.id)).toBe(true);
  });

  it('keeps ordinary retention separate from Maddie’s farthest-target cast and bound multishot tasks', () => {
    const p = actor('p', { definitionId: 'maddie', ability: resolveAbility('maddie-ability', 1), attackRange: 4,
      mana: 100, maxMana: 100, targetId: 'old', targetEngaged: true, moveCooldownTicks: 100 });
    const old = enemy('old', 3, 3), far = enemy('far', 0, 1), near = enemy('near', 4, 4);
    const first = run([p, old, far, near]);
    expect(get(first.state).targetId).toBe(old.id);
    const cast = first.events.find(e => e.type === 'cast');
    expect(cast).toMatchObject({ receipt: { targetIds: [far.id] } });
    expect(get(first.state).tasks!.map(t => t.targetId)).toEqual(Array(5).fill(far.id));
    const second = stepCombat(first.state);
    expect(get(second.state).targetId).toBe(old.id);
    expect(get(second.state).tasks).toEqual(get(first.state).tasks);
  });
});

describe('P0 engaged-target chase', () => {
  it('chases one legal step before considering an already closer in-range enemy', () => {
    const p = actor('p', { targetId: 'old', targetEngaged: true }), old = enemy('old', 3, 2), near = enemy('near', 4, 4);
    const result = run([p, old, near]);
    expect(get(result.state).cell).toEqual({ col: 2, row: 3 });
    expect(get(result.state).targetId).toBe(old.id);
    expect(result.events.filter(e => e.type === 'attack')).toEqual([{ type: 'attack', tick: 1, attackerId: p.id, targetId: old.id }]);
  });

  it.each(['two-steps', 'occupied'] as const)('reselects when one-step recovery fails: %s', kind => {
    const p = actor('p', { targetId: 'old', targetEngaged: true }), near = enemy('near', 4, 4);
    const old = enemy('old', 3, kind === 'two-steps' ? 1 : 2);
    const blockers = kind === 'occupied' ? [enemy('b1', 2, 3, { team: 'player' }), enemy('b2', 3, 3, { team: 'player' })] : [];
    const result = run([p, old, near, ...blockers]);
    expect(get(result.state).cell).toEqual(p.cell);
    expect(get(result.state).targetId).toBe(near.id);
    expect(result.events).toContainEqual({ type: 'targetChanged', tick: 1, unitId: p.id, before: old.id, after: near.id });
  });

  it('waits for movement cooldown without dropping the pending one-step chase; JSON resume agrees', () => {
    const p = actor('p', { targetId: 'old', targetEngaged: true, moveCooldownTicks: 3 });
    let state = battle([p, enemy('old', 3, 2), enemy('near', 4, 4)], { rngState: 42, rngDraws: 0 });
    for (let tick = 1; tick <= 3; tick++) {
      const result = stepCombat(state);
      expect(stepCombat(JSON.parse(JSON.stringify(state)))).toEqual(result);
      state = result.state;
      expect(get(state).targetId).toBe('old');
      expect(get(state).targetEngaged).toBe(true);
      expect(get(state).cell).toEqual(tick < 3 ? p.cell : { col: 2, row: 3 });
      expect(state.rngDraws).toBe(tick < 3 ? 0 : 1);
    }
  });

  it('retains the old initial-approach nearest/ID fallback and multi-step BFS', () => {
    const p = actor('p', { targetId: 'old' }), old = enemy('old', 3, 0), near = enemy('near', 3, 1);
    expect(decide(p, [old, near])).toEqual({ target: near, engaged: false });
    const result = run([p, old, near]);
    expect(hexDistance(p.cell, get(result.state).cell)).toBe(1);
    expect(get(result.state).targetEngaged).toBeUndefined();
    expect(get(result.state).targetId).toBe(near.id);
  });

  it('does not treat an empty adjacent cell as a legal chase for an immobile unit', () => {
    const p = actor('p', { definitionId: 'training-dummy', targetId: 'old', targetEngaged: true });
    expect(decide(p, [enemy('old', 3, 2), enemy('near', 4, 4)]).target?.id).toBe('near');
  });
});

/** Exact report generator: real S13 definitions, no strategy/traits/equipment. */
function reportInput(seed: number): Unit[] {
  let rng = seed;
  const draw = () => (rng = nextRandom(rng).word), result: Unit[] = [];
  const names = ['trundle', 'steb', 'darius', 'irelia', 'maddie', 'zyra', 'vex', 'draven', 'camille', 'akali', 'nocturne', 'renni', 'vander'];
  for (const team of ['enemy', 'player'] as const) {
    const cells = [];
    for (let row = team === 'enemy' ? 0 : 4; row < (team === 'enemy' ? 4 : 8); row++)
      for (let col = 0; col < 7; col++) cells.push({ col, row });
    for (let i = 0; i < 8; i++) {
      const cell = cells.splice(draw() % cells.length, 1)[0];
      result.push({ id: `${team === 'enemy' ? 'e' : 'p'}${i + 1}`, definitionId: names[draw() % names.length],
        team, starLevel: 1, location: { kind: 'board', cell } });
    }
  }
  return result;
}
function reportBattle(seed: number, reverse = false) {
  const units = reportInput(seed); if (reverse) units.reverse();
  let state: CombatState = { ...createCombat({ board: DEFAULT_BOARD, benchSize: 9, units }), rngState: seed, rngDraws: 0 };
  const frames: { state: CombatState; events: readonly CombatEvent[] }[] = [];
  while (state.status === 'running') { const step = stepCombat(state); state = step.state; frames.push(step); }
  return frames;
}

describe('research report reproductions', () => {
  it('seed 42: Draven keeps the living in-range Vander instead of switching to Nocturne at tick 6', () => {
    const frames = reportBattle(42), first = frames[0], sixth = frames[5];
    expect(get(first.state, 'e1')).toMatchObject({ definitionId: 'draven', targetId: 'p7', cell: { col: 3, row: 2 } });
    const tank = get(sixth.state, 'p7'), draven = get(sixth.state, 'e1');
    expect(tank.definitionId).toBe('vander'); expect(isSelectable(tank, 6)).toBe(true);
    expect(hexDistance(draven.cell, tank.cell)).toBeLessThanOrEqual(range(draven as S13Unit));
    expect(draven.targetId).toBe(tank.id);
    expect(frames.slice(1, 6).flatMap(f => f.events).filter(e => e.type === 'targetChanged' && e.unitId === draven.id)).toEqual([]);
    expect(reportBattle(42)).toEqual(frames);
    expect(reportBattle(42, true)).toEqual(frames);
  });

  it('seed 104729: records Vander’s initial-approach backtrack as a remaining P1 occupancy case', () => {
    const frames = reportBattle(104729);
    const moves = frames.slice(0, 11).flatMap(f => f.events).filter(e => e.type === 'movement' && e.unitId === 'e3');
    expect(moves).toEqual([
      { type: 'movement', tick: 1, unitId: 'e3', from: { col: 2, row: 0 }, to: { col: 2, row: 1 } },
      { type: 'movement', tick: 6, unitId: 'e3', from: { col: 2, row: 1 }, to: { col: 3, row: 1 } },
      { type: 'movement', tick: 11, unitId: 'e3', from: { col: 3, row: 1 }, to: { col: 2, row: 1 } },
    ]);
    expect([0, 5, 10].map(i => get(frames[i].state, 'e3').targetId)).toEqual(['p6', 'p6', 'p6']);
    expect(reportBattle(104729, true)).toEqual(frames);
  });
});

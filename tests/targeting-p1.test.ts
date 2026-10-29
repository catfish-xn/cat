import { describe, expect, it } from 'vitest';
import { DEFAULT_BOARD, getNeighbors, hexDistance } from '../src/simulation/board';
import { createCombat, stepCombat, type CombatState, type CombatUnit, type CombatEvent } from '../src/simulation/combat';
import { resolveAbility } from '../src/simulation/combat-abilities';
import { decideCombatTarget, ordinaryNearestTies } from '../src/simulation/combat-targeting';
import { applyStatus, EMPTY_RUNTIME, origin, type S13Unit } from '../src/simulation/combat-s13-state';
import { isControlled } from '../src/simulation/combat-movement';
import { p2Target } from '../src/simulation/s13-augments-p2-combat';
import { nextRandom } from '../src/simulation/rng';
import type { Unit } from '../src/simulation/unit-types';
import { battle, freeze, unit } from './combat-helpers';

function actor(id = 'p', patch: Partial<CombatUnit> = {}): S13Unit {
  return unit(id, 'player', 3, 4, { definitionId: 'draven', ability: resolveAbility('draven-ability', 1),
    hp: 10000, maxHp: 10000, maxMana: 100000, attackRange: 1, attackDamage: 40,
    baseAttackSpeedBps: 10000, runtime: { ...EMPTY_RUNTIME }, statuses: [], tasks: [], shieldLayers: [],
    cooldownTicks: 1000, moveCooldownTicks: 1000, ...patch }) as S13Unit;
}
function enemy(id: string, col: number, row: number, patch: Partial<CombatUnit> = {}): S13Unit {
  return actor(id, { team: 'enemy', definitionId: 'neutral-stage-2', ability: resolveAbility('neutral-attack', 1),
    cell: { col, row }, attackDamage: 0, ...patch });
}
const get = (state: CombatState, id = 'p') => state.units.find(u => u.id === id)!;
const step = (units: CombatUnit[], rngState = 0) => stepCombat(freeze(battle(units, { tick: 0, rngState, rngDraws: 0 })));

describe('equal-distance tie break', () => {
  const pair = (rngState: number, reverse = false, patch: Partial<CombatUnit> = {}) => {
    const units = [actor('p', patch), enemy('a', 3, 3), enemy('z', 2, 3)];
    expect(hexDistance(units[0].cell, units[1].cell)).toBe(hexDistance(units[0].cell, units[2].cell));
    return step(reverse ? [...units].reverse() : units, rngState);
  };

  it('draws the combat lcg32 stream and can select either tied enemy', () => {
    const low = pair(1), high = pair(0);
    expect(get(low.state).targetId).toBe('a');
    expect(get(high.state).targetId).toBe('z');
    expect(low.state.rngDraws).toBe(1);
    expect(high.state.rngDraws).toBe(1);
    expect(pair(0, true).state.units.map(u => ({ id: u.id, targetId: u.targetId, rng: undefined }))).toEqual(
      pair(0).state.units.map(u => ({ id: u.id, targetId: u.targetId, rng: undefined })));
    expect(pair(0, true).state.rngState).toBe(pair(0).state.rngState);
    expect(stepCombat(JSON.parse(JSON.stringify(freeze(battle(
      [actor('p'), enemy('a', 3, 3), enemy('z', 2, 3)], { tick: 0, rngState: 0, rngDraws: 0 })))))).toEqual(pair(0));
  });

  it('keeps an already tied target without another draw, including across the action recheck', () => {
    const first = pair(0);
    expect(get(first.state).targetId).toBe('z');
    const second = stepCombat(first.state);
    expect(get(second.state).targetId).toBe('z');
    expect(second.state.rngDraws).toBe(1);
    const held = pair(0, false, { targetId: 'z' });
    expect(get(held.state).targetId).toBe('z');
    expect(held.state.rngDraws).toBe(0);
  });

  it('still breaks a new tie when the current target is farther, and direct calls without a draw stay on ID', () => {
    const result = step([actor('p', { targetId: 'far' }), enemy('far', 3, 0), enemy('a', 3, 3), enemy('z', 2, 3)], 0);
    expect(get(result.state).targetId).toBe('z');
    expect(result.state.rngDraws).toBe(1);
    const p = actor('p'), a = enemy('a', 3, 3), z = enemy('z', 2, 3);
    expect(decideCombatTarget(DEFAULT_BOARD, p, [p, z, a], 1, new Set(), false).target?.id).toBe('a');
    expect(p2Target(p, [p, z, a], 1)?.id).toBe('a');
    expect(ordinaryNearestTies(p, [p, z, a], 1).map(u => u.id)).toEqual(['a', 'z']);
  });

  it('rejects the all-ones word before taking index 2 of three tied enemies', () => {
    const cells = [{ id: 'a', col: 2, row: 3 }, { id: 'm', col: 3, row: 3 }, { id: 'z', col: 4, row: 4 }];
    const units = [actor('p'), ...cells.map(cell => enemy(cell.id, cell.col, cell.row))];
    expect(new Set(cells.map(cell => hexDistance(units[0].cell, cell))).size).toBe(1);
    const result = step(units, 653637408);
    expect(get(result.state).targetId).toBe('z');
    expect(result.state.rngDraws).toBe(2);
    expect(step([...units].reverse(), 653637408).state.rngState).toBe(result.state.rngState);
  });
});

describe('hard-control target hold', () => {
  const board = (patch: Partial<CombatUnit> = {}, knockup = false) => {
    const p = actor('p', { attackRange: 1, targetId: 'old', cooldownTicks: 0, moveCooldownTicks: 0, ...patch });
    const old = enemy('old', 3, 2), near = enemy('near', 3, 3);
    applyStatus(p, origin(old), 'stun', 0, 2, 0, [], false, '', undefined, knockup);
    return { p, old, near };
  };

  it.each([false, true])('knockup=%s keeps an out-of-range target until release, then selects the nearer enemy', knockup => {
    const { p, old, near } = board({}, knockup);
    expect(hexDistance(p.cell, old.cell)).toBeGreaterThan(1);
    expect(hexDistance(p.cell, near.cell)).toBe(1);
    const stunned = step([p, old, near]);
    expect(isControlled(get(stunned.state) as S13Unit, 1)).toBe(true);
    expect(get(stunned.state).targetId).toBe('old');
    expect(get(stunned.state).cell).toEqual(p.cell);
    expect(stunned.events.filter(e => e.type === 'targetChanged' && e.unitId === 'p')).toEqual([]);
    expect(stunned.events.filter(e => e.type === 'attack' && e.attackerId === 'p')).toEqual([]);
    expect(stunned.events.filter(e => e.type === 'movement' && e.unitId === 'p')).toEqual([]);
    expect(stunned.state.rngDraws).toBe(0);
    const held = stepCombat(stunned.state);
    expect(get(held.state).targetId).toBe('old');
    expect(held.state.rngDraws).toBe(0);
    const release = stepCombat(held.state);
    expect(isControlled(get(release.state) as S13Unit, 3)).toBe(false);
    expect(get(release.state).targetId).toBe('near');
    expect(release.events.filter(e => e.type === 'attack' && e.attackerId === 'p')).toEqual([
      { type: 'attack', tick: 3, attackerId: 'p', targetId: 'near' },
    ]);
  });

  it('keeps a dead target id through the remaining stun and replaces it on the release tick', () => {
    const { p, old, near } = board({ attackRange: 4, targetEngaged: true, moveCooldownTicks: 100 });
    const stunned = step([p, old, near]);
    const corpse = get(stunned.state, 'old') as S13Unit;
    corpse.alive = false; corpse.hp = 0;
    const still = stepCombat(stunned.state);
    expect(get(still.state).targetId).toBe('old');
    expect(still.events.filter(e => e.type === 'attack')).toEqual([]);
    const release = stepCombat(still.state);
    expect(get(release.state).targetId).toBe('near');
    expect(release.events.filter(e => e.type === 'attack' && e.attackerId === 'p')).toEqual([
      { type: 'attack', tick: 3, attackerId: 'p', targetId: 'near' },
    ]);
  });

  it('does not freeze taunt, and does not treat channel or permanent frenzy as hard control', () => {
    const taunted = actor('p', { attackRange: 1, targetId: 'old', voidSwarmTaunt: 'forced', cooldownTicks: 1000 });
    const old = enemy('old', 3, 2), forced = enemy('forced', 0, 0), near = enemy('near', 3, 3);
    applyStatus(taunted, origin(old), 'stun', 0, 2, 0, []);
    expect(get(step([taunted, old, forced, near]).state).targetId).toBe('forced');

    const channel = actor('p', { attackRange: 1, targetId: 'old', cooldownTicks: 0 });
    applyStatus(channel, origin(old), 'channel', 0, 5, 0, []);
    const channeled = step([channel, enemy('old', 3, 2), enemy('near', 3, 3)]);
    expect(get(channeled.state).targetId).toBe('near');
    expect(channeled.events.filter(e => e.type === 'attack')).toEqual([]);

    const frenzy = actor('p', { attackRange: 1, targetId: 'old', cooldownTicks: 0, sixCost: {
      energy: 0, convertedMana: 0, frenzyUntil: 0, permanentFrenzy: true, nextFrenzyPulse: 99,
      kills: 0, devoured: [], pendingDevour: null, storedEnergy: 0, absorbedRemainder: 0, storm: null } });
    applyStatus(frenzy, origin(old), 'stun', 0, 2, 0, []);
    const acting = step([frenzy, enemy('old', 3, 2), enemy('near', 3, 3)]);
    expect(get(acting.state).targetId).toBe('near');
    expect(acting.events.filter(e => e.type === 'attack' && e.attackerId === 'p')).toEqual([
      { type: 'attack', tick: 1, attackerId: 'p', targetId: 'near' },
    ]);
  });
});

/** Same generator as the P0 research reproduction. */
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
function openingFrames(seed: number) {
  let state: CombatState = { ...createCombat({ board: DEFAULT_BOARD, benchSize: 9, units: reportInput(seed) }), rngState: seed, rngDraws: 0 };
  const frames: { before: CombatState; state: CombatState; events: readonly CombatEvent[] }[] = [];
  while (state.status === 'running' && frames.length < 11) {
    const before = state;
    const stepped = stepCombat(state);
    state = stepped.state;
    frames.push({ before, state, events: stepped.events });
  }
  return frames;
}

describe('Vander seed 104729', () => {
  it('still backtracks on tick 11 because the target never ties or takes hard control', () => {
    const frames = openingFrames(104729);
    const moves = frames.flatMap(frame => frame.events).filter(event => event.type === 'movement' && event.unitId === 'e3');
    expect(moves).toEqual([
      { type: 'movement', tick: 1, unitId: 'e3', from: { col: 2, row: 0 }, to: { col: 2, row: 1 } },
      { type: 'movement', tick: 6, unitId: 'e3', from: { col: 2, row: 1 }, to: { col: 3, row: 1 } },
      { type: 'movement', tick: 11, unitId: 'e3', from: { col: 3, row: 1 }, to: { col: 2, row: 1 } },
    ]);
    for (const frame of frames) {
      const tick = frame.state.tick;
      const decided = get(frame.before, 'e3') as S13Unit;
      const vander = get(frame.state, 'e3') as S13Unit;
      expect(vander.definitionId).toBe('vander');
      expect(vander.targetId).toBe('p6');
      expect(isControlled(decided, tick)).toBe(false);
      const ties = ordinaryNearestTies(decided, frame.before.units as S13Unit[], tick);
      expect(ties.map(unit => unit.id)).toEqual(['p6']);
    }
    const tick11 = frames[10];
    const vander = get(tick11.before, 'e3') as S13Unit;
    const target = get(tick11.before, 'p6');
    const occupant = (col: number, row: number) => tick11.before.units.find(u => u.alive && u.cell.col === col && u.cell.row === row)?.id ?? null;
    expect(target.cell).toEqual({ col: 3, row: 3 });
    expect(hexDistance(vander.cell, target.cell)).toBe(2);
    expect(vander.attackRange).toBe(1);
    const inRange = getNeighbors(DEFAULT_BOARD, vander.cell).filter(cell => hexDistance(cell, target.cell) <= 1);
    expect(inRange).toEqual([{ col: 4, row: 2 }, { col: 3, row: 2 }]);
    expect(inRange.map(cell => occupant(cell.col, cell.row))).toEqual(['e7', 'e5']);
  });
});

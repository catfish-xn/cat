import { describe, expect, it } from 'vitest';
import { stepCombat, createCombatWithEvents, type CombatEvent, type CombatState, type CombatUnit } from '../src/simulation/combat';
import { resolveAbility } from '../src/simulation/combat-abilities';
import { EMPTY_RUNTIME } from '../src/simulation/combat-s13-state';
import { MALZAHAR_3STAR_GATE_TICKS, RENNI_LIFT_TICKS, RENNI_SLAM_AFTER_STUN_TICKS } from '../src/simulation/cast-windup';
import { createMatch, snapshotForBattle, compileBattle, resolveTwoSidedBattle, startTwoSidedBattle,
  startCombatReplay, toCombatReplay, type MatchState } from '../src/server-entry';
import { getCatalogRoundById } from '../src/simulation/round-selectors';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { freezeCombatInput } from '../src/simulation/combat-input';
import { createRestoreCombatReplay } from '../src/simulation/restore-combat-replay';
import { validateM5Runtime } from '../src/simulation/serialization-structure';
import { battle, unit } from './combat-helpers';
import { packets } from './helpers/replay2-views';

// Cast wind-up alignment, batch 4 (user-approved timing only, 2026-11-17; fitted values, not original data): Malzahar's gate at
// 3 stars lands MALZAHAR_3STAR_GATE_TICKS after his cast (1 and 2 stars unchanged); Renni lifts RENNI_LIFT_TICKS after her cast
// and slams RENNI_SLAM_AFTER_STUN_TICKS after her stun ends. docs/S13_RULES_GAP.md (技能生效前摇对齐).
function hero(name: string, star: 1 | 2 | 3 = 1): CombatUnit {
  return unit('p', 'player', 1, 3, { definitionId: name, starLevel: star, ability: resolveAbility(name + '-ability', star), hp: 3000, maxHp: 5000, armor: 0, magicResist: 0,
    mana: 100, maxMana: 100, attackDamage: 100, attackRange: 6, abilityPower: 100, baseAttackSpeedBps: 10000,
    runtime: { ...EMPTY_RUNTIME }, statuses: [], shieldLayers: [], tasks: [], mechanics: [] });
}
function dummy(id: string, col: number, row = 3): CombatUnit {
  return unit(id, 'enemy', col, row, { definitionId: 'neutral-stage-2', ability: resolveAbility('neutral-attack', 1), hp: 100000, maxHp: 100000, mana: 0, maxMana: 1,
    attackDamage: 0, cooldownTicks: 1000, moveCooldownTicks: 1000, runtime: { ...EMPTY_RUNTIME }, statuses: [], shieldLayers: [], tasks: [] });
}
function run(state: CombatState, count: number) {
  const events: CombatEvent[] = [];
  for (let n = 0; n < count && state.status === 'running'; n++) { const r = stepCombat(state); state = r.state; events.push(...r.events); }
  return { state, events };
}
const hits = (events: readonly CombatEvent[], target?: string) => packets(events)
  .filter(x => x.source.ownerId === 'p' && x.source.sourceKind === 'ability' && (target === undefined || x.unitId === target));
/** A death the next step settles (hp 0 while still alive), as a lethal hit would leave it: its death cleanup runs then. */
const fell = (state: CombatState, id: string) => { const next = structuredClone(state); Object.assign(next.units.find(u => u.id === id)!, { hp: 0 }); return next; };
// A passive ally far back keeps the fight running after the caster's death.
const ally = () => ({ ...dummy('ally', 6, 7), team: 'player' as const });
const start = (name: string, star: 1 | 2 | 3 = 1) => battle([hero(name, star), ally(), dummy('e', 2), dummy('f', 1, 2), dummy('g', 2, 2)], { rngState: 42 });




const carries = (events: readonly CombatEvent[]) => events.filter(e => e.type === 'carryChanged').map(e => e.type === 'carryChanged' ? [e.tick, e.holderId, e.targetId, e.carried] : []);
const stunned = (state: CombatState, id: string) => (state.units.find(u => u.id === id)!.mechanismState?.statuses ?? []).some(g => g.kind === 'stun');

describe('Malzahar: at 3 stars the gate lands MALZAHAR_3STAR_GATE_TICKS after the cast; 1 and 2 stars on the cast', () => {
  it('3 stars: nothing on the cast or before; damage and shred on the landing tick; infection 20 ticks later', () => {
    const cast = run(start('malzahar', 3), 1), castTick = cast.state.tick;
    expect(hits(cast.events)).toEqual([]);
    const before = run(cast.state, MALZAHAR_3STAR_GATE_TICKS - 1); expect(hits(before.events)).toEqual([]);
    const land = run(before.state, 1);
    expect(hits(land.events).length).toBeGreaterThan(0);
    expect(land.state.tick - castTick).toBe(MALZAHAR_3STAR_GATE_TICKS);
    const infection = cast.state.units.find(u => u.id === 'p')!.tasks!.filter(t => t.kind === 'g2Infection').map(t => t.executeAtTick - castTick);
    expect(new Set(infection)).toEqual(new Set([MALZAHAR_3STAR_GATE_TICKS + 20]));
  });
  it('1 star: the gate still lands on the cast, the infection 20 ticks after it', () => {
    const cast = run(start('malzahar', 1), 1);
    expect(hits(cast.events).length).toBeGreaterThan(0);
    expect(new Set(cast.state.units.find(u => u.id === 'p')!.tasks!.filter(t => t.kind === 'g2Infection').map(t => t.executeAtTick - cast.state.tick))).toEqual(new Set([20]));
  });
});

describe('Renni: lift RENNI_LIFT_TICKS after the cast, slam RENNI_SLAM_AFTER_STUN_TICKS after the stun', () => {
  const n = 30; // her stun, StunDuration 1.5 s
  it('the stun and the carry start on the lift and end n ticks later; the slam lands 2 ticks after, on the targets taken on the cast', () => {
    const cast = run(start('renni'), 1), castTick = cast.state.tick, target = 'f';
    expect(stunned(cast.state, target)).toBe(false);
    const lift = run(cast.state, RENNI_LIFT_TICKS);
    expect(carries(lift.events)).toEqual([[castTick + RENNI_LIFT_TICKS, 'p', target, true]]);
    const stunEnd = run(lift.state, n);
    expect(carries(stunEnd.events)).toEqual([[castTick + RENNI_LIFT_TICKS + n, 'p', target, false]]);
    // The target walks away in the slam's two ticks: it is still hit (the slam's targets are taken on the cast).
    const moved = structuredClone(stunEnd.state); Object.assign(moved.units.find(u => u.id === target)!, { cell: { col: 6, row: 0 } });
    const before = run(moved, RENNI_SLAM_AFTER_STUN_TICKS - 1), slam = run(before.state, 1);
    expect(hits(before.events).filter(x => x.raw > 100)).toEqual([]);
    expect(hits(slam.events, target).length).toBeGreaterThan(0);
  });
  it('the carry ends at once when the holder or the target dies mid-lift', () => {
    const lifted = run(start('renni'), RENNI_LIFT_TICKS + 5).state;
    expect(carries(run(fell(lifted, 'p'), 1).events).filter(c => c[3] === false)).toEqual([[lifted.tick + 1, 'p', 'f', false]]);
    expect(carries(run(fell(lifted, 'f'), 1).events).filter(c => c[3] === false)).toEqual([[lifted.tick + 1, 'p', 'f', false]]);
  });
});

// Save / restore / replay with pending tasks, as earlier batches.
function army(name: string, star: 1 | 2 | 3 = 3): MatchState {
  const base = createMatch(42), round = getCatalogRoundById('2-1');
  return { ...base, level: 9, round: round.ordinal, roundDefinitionId: round.roundId, m8: { ...base.m8, round }, items: [],
    preparation: { ...base.preparation, units: [name, 'drmundo', 'drmundo'].map((definitionId, i) => ({ id: `unit-${i + 1}`, definitionId,
      team: 'player', starLevel: i === 0 ? star : 3, location: { kind: 'board', cell: { col: 2 + i, row: i === 0 ? 5 : 4 } } })) } };
}
const pendingKind = { malzahar: 'g2Landing', renni: 'g23RenniLift' } as const;
for (const name of ['malzahar', 'renni'] as const) {
  it(`${name} synchronous / 1- and 7-tick slices / replay preserve complete bytes`, () => {
    const source = compileBattle(snapshotForBattle(army(name), 'A'), snapshotForBattle(army('garen'), 'B'), 42, { battleId: `${name}-windup4` });
    const expected = resolveTwoSidedBattle(source, 901), expectedReplay = toCombatReplay(expected);
    expect(expected.events.some(e => e.type === 'cast' && e.receipt.source.definitionId === `${name}-ability`)).toBe(true);
    for (const budget of [1, 7]) {
      const task = startTwoSidedBattle(source); let result = task.advance(budget);
      while (!result) result = task.advance(budget);
      expect(JSON.stringify(result)).toBe(JSON.stringify(expected));
      const replay = startCombatReplay(JSON.parse(JSON.stringify(result))); let frames = replay.advance(budget);
      while (!frames) frames = replay.advance(budget);
      expect(JSON.stringify(frames)).toBe(JSON.stringify(expectedReplay));
    }
  }, 30000);
  it(`${name} restores ticks with a pending ${pendingKind[name]}, continues identically and rejects a forged one`, () => {
    const player = army(name), opponent = army('garen');
    const s: MatchState = { ...player, items: (['blue-buff', 'tear', 'tear'] as const).map((definitionId, slot) => ({ id: `mana-${slot}`, definitionId, location: { kind: 'unit' as const, unitId: 'unit-1', slot: slot as 0 | 1 | 2 } })),
      preparation: { ...player.preparation, units: [...player.preparation.units,
        ...opponent.preparation.units.map(u => ({ ...u, id: 'enemy-' + u.id, team: 'enemy' as const,
          location: { kind: 'board' as const, cell: { col: u.location.kind === 'board' ? u.location.cell.col : 0, row: 2 } } }))] } };
    const strategy = buildStrategySnapshot(s), basis = freezeCombatInput(s, 42, s.resourceProvenance.entries.length);
    let state = createCombatWithEvents(s.preparation, strategy, basis.combatId, 42).state, checked = 0;
    const mine = (t: { kind: string; source: { definitionId: string } }) => t.kind === pendingKind[name] && t.source.definitionId === `${name}-ability`;
    while (state.status === 'running' && checked < 6) {
      state = stepCombat(state).state;
      if (!state.units.some(u => u.tasks?.some(mine))) continue;
      const rebuilt = createRestoreCombatReplay(JSON.parse(JSON.stringify(basis)), strategy, state.tick).stateAtSaveTick();
      expect(rebuilt).toEqual(state);
      const ids = new Set(state.units.map(u => u.id)), same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
      for (const u of state.units) validateM5Runtime(u, state.tick, ids, state.units, state.combatId!, new Set(), same, state.nextActionSeq!);
      const forged = structuredClone(state), owner = forged.units.find(u => u.tasks?.some(mine))!;
      const pending = owner.tasks!.find(mine)!;
      Object.assign(pending, { source: { ...pending.source, definitionId: 'lux-ability' } });
      expect(() => validateM5Runtime(owner, state.tick, ids, forged.units, state.combatId!, new Set(), same, state.nextActionSeq!)).toThrow();
      expect(stepCombat(JSON.parse(JSON.stringify(rebuilt)))).toEqual(stepCombat(state));
      checked++;
    }
    expect(checked).toBe(6);
  }, 60000);
}

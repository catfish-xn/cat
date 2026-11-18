import { describe, expect, it } from 'vitest';
import { stepCombat, type CombatEvent, type CombatState, type CombatUnit } from '../src/simulation/combat';
import { resolveAbility } from '../src/simulation/combat-abilities';
import { EMPTY_RUNTIME, variable } from '../src/simulation/combat-s13-state';
import { rangedAttackFlightTicks } from '../src/simulation/cast-windup';
import { hexDistance } from '../src/simulation/board';
import { battle, unit } from './combat-helpers';
import { packets } from './helpers/replay2-views';

// Ranged attack landing (fitted, not original data): a ranged hero's basic attack settles when its shot arrives,
// rangedAttackFlightTicks(hexes on the attack tick) later; melee attacks are unchanged. docs/S13_RULES_GAP.md.
function shooter(name: string, range: number, patch: Partial<CombatUnit> = {}): CombatUnit {
  return unit('p', 'player', 3, 6, { definitionId: name, ability: resolveAbility(name + '-ability', 1), hp: 3000, maxHp: 3000, armor: 0, magicResist: 0,
    mana: 0, maxMana: 1000, attackDamage: 100, attackRange: range, abilityPower: 100, baseAttackSpeedBps: 10000, moveCooldownTicks: 1000,
    runtime: { ...EMPTY_RUNTIME }, statuses: [], shieldLayers: [], tasks: [], mechanics: [], ...patch });
}
const dummy = (id: string, col: number, row: number, patch: Partial<CombatUnit> = {}): CombatUnit => unit(id, 'enemy', col, row, { definitionId: 'neutral-stage-2',
  ability: resolveAbility('neutral-attack', 1), hp: 100000, maxHp: 100000, mana: 0, maxMana: 1, attackDamage: 0, cooldownTicks: 1000, moveCooldownTicks: 1000,
  runtime: { ...EMPTY_RUNTIME }, statuses: [], shieldLayers: [], tasks: [], ...patch });
// A passive ally keeps the fight running when the shooter falls.
const ally = () => ({ ...dummy('ally', 6, 7), team: 'player' as const });
function run(state: CombatState, count: number) {
  const out: { tick: number; events: readonly CombatEvent[] }[] = [];
  for (let n = 0; n < count && state.status === 'running'; n++) { const r = stepCombat(state); state = r.state; out.push({ tick: state.tick, events: r.events }); }
  return { state, out };
}
const attackTicks = (out: { tick: number; events: readonly CombatEvent[] }[]) => out.flatMap(s => s.events.filter(e => e.type === 'attack' && e.attackerId === 'p').map(() => s.tick));
const hitTicks = (out: { tick: number; events: readonly CombatEvent[] }[], target = 'e') => out.flatMap(s => packets(s.events).filter(x => x.source.ownerId === 'p' && x.unitId === target).map(() => s.tick));

describe('ranged attack landing', () => {
  it('a ranged hero\'s attack lands rangedAttackFlightTicks(hexes) after it; its attack mana comes on the attack tick', () => {
    const start = battle([shooter('ezreal', 4), dummy('e', 3, 3)], { rngState: 42 });
    const hexes = hexDistance(start.units[0]!.cell, start.units[1]!.cell), flight = rangedAttackFlightTicks(hexes, 'ezreal');
    const r = run(start, 30), first = attackTicks(r.out)[0]!;
    expect(hitTicks(r.out)[0]).toBe(first + flight);
    const attackStep = r.out.find(s => s.tick === first)!;
    expect(packets(attackStep.events).filter(x => x.source.ownerId === 'p')).toEqual([]);
    expect(attackStep.events.some(e => e.type === 'manaChanged' && JSON.stringify(e).includes('"p"'))).toBe(true);
  });
  it('a melee hero\'s attack still settles on its attack tick', () => {
    const r = run(battle([shooter('garen', 1), dummy('e', 3, 5)], { rngState: 42 }), 30);
    expect(hitTicks(r.out)[0]).toBe(attackTicks(r.out)[0]);
  });
  it('a target that dies in flight takes nothing and no other target is picked; one that moves is still hit on time', () => {
    const start = battle([shooter('ezreal', 4), dummy('e', 3, 3), dummy('f', 2, 3)], { rngState: 42 });
    const pre = run(start, 30), first = attackTicks(pre.out)[0]!;
    const shot = pre.out.find(s => s.tick === first)!.events.find(e => e.type === 'attack' && e.attackerId === 'p') as Extract<CombatEvent, { type: 'attack' }>;
    const aimed = shot.targetId, other = aimed === 'e' ? 'f' : 'e', flight = hitTicks(pre.out, aimed)[0]! - first;
    expect(flight).toBeGreaterThan(0);
    const atAttack = run(start, first - start.tick).state;
    const killed = structuredClone(atAttack); Object.assign(killed.units.find(u => u.id === aimed)!, { hp: 0 });
    const k = run(killed, flight + 1);
    expect(hitTicks(k.out, aimed)).toEqual([]);
    expect(hitTicks(k.out, other).filter(t => t <= first + flight)).toEqual([]);
    const moved = structuredClone(atAttack); Object.assign(moved.units.find(u => u.id === aimed)!, { cell: { col: 0, row: 0 } });
    expect(hitTicks(run(moved, flight + 1).out, aimed)[0]).toBe(first + flight);
  });
  it('the shooter\'s death or a stun on her in flight does not stop the shot', () => {
    const start = battle([shooter('ezreal', 4), ally(), dummy('e', 3, 3)], { rngState: 42 });
    const pre = run(start, 30), first = attackTicks(pre.out)[0]!, flight = hitTicks(pre.out)[0]! - first;
    const atAttack = run(start, first - start.tick).state, dead = structuredClone(atAttack);
    Object.assign(dead.units.find(u => u.id === 'p')!, { hp: 0 });
    expect(hitTicks(run(dead, flight + 1).out)[0]).toBe(first + flight);
  });
});

import { createHash } from 'node:crypto';
import { createMatch, snapshotForBattle, compileBattle, resolveTwoSidedBattle, startTwoSidedBattle, startCombatReplay, toCombatReplay, type MatchState } from '../src/server-entry';
import { getCatalogRoundById } from '../src/simulation/round-selectors';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { freezeCombatInput } from '../src/simulation/combat-input';
import { createRestoreCombatReplay } from '../src/simulation/restore-combat-replay';
import { createCombatWithEvents } from '../src/simulation/combat';
import { validateM5Runtime } from '../src/simulation/serialization-structure';

function army(names: readonly string[], star: 1 | 2 | 3 = 2): MatchState {
  const base = createMatch(42), round = getCatalogRoundById('2-1');
  return { ...base, level: 9, round: round.ordinal, roundDefinitionId: round.roundId, m8: { ...base.m8, round }, items: [],
    preparation: { ...base.preparation, units: names.map((definitionId, i) => ({ id: `unit-${i + 1}`, definitionId,
      team: 'player', starLevel: star, location: { kind: 'board', cell: { col: 1 + i, row: i % 2 ? 4 : 5 } } })) } };
}
const sha = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex');

// Melee only: the whole replay is byte-for-byte what it was before ranged attack landing (hash recorded on e9f33376).
it('a melee-only battle replays byte-for-byte as before ranged attack landing', () => {
  const source = compileBattle(snapshotForBattle(army(['garen', 'darius', 'vi', 'sett']), 'A'), snapshotForBattle(army(['illaoi', 'trundle', 'vander', 'akali']), 'B'), 42, { battleId: 'melee-only' });
  expect(sha(toCombatReplay(resolveTwoSidedBattle(source, 901)))).toBe('3c86400202001fafdf75c6726fcdb9bd8a07e4cd2aca262687372995b7f5e2aa');
});

it('ranged synchronous / 1- and 7-tick slices / replay preserve complete bytes', () => {
  const source = compileBattle(snapshotForBattle(army(['ezreal', 'jinx', 'garen']), 'A'), snapshotForBattle(army(['caitlyn', 'tristana', 'darius']), 'B'), 42, { battleId: 'ranged-landing' });
  const expected = resolveTwoSidedBattle(source, 901), expectedReplay = toCombatReplay(expected);
  for (const budget of [1, 7]) {
    const task = startTwoSidedBattle(source); let result = task.advance(budget);
    while (!result) result = task.advance(budget);
    expect(JSON.stringify(result)).toBe(JSON.stringify(expected));
    const replay = startCombatReplay(JSON.parse(JSON.stringify(result))); let frames = replay.advance(budget);
    while (!frames) frames = replay.advance(budget);
    expect(JSON.stringify(frames)).toBe(JSON.stringify(expectedReplay));
  }
}, 60000);

it('restores ticks with a pending attackLanding, continues identically and rejects a forged one', () => {
  const player = army(['ezreal', 'jinx', 'garen']), opponent = army(['garen', 'darius']);
  const s: MatchState = { ...player, preparation: { ...player.preparation, units: [...player.preparation.units,
    ...opponent.preparation.units.map(u => ({ ...u, id: 'enemy-' + u.id, team: 'enemy' as const,
      location: { kind: 'board' as const, cell: { col: u.location.kind === 'board' ? u.location.cell.col : 0, row: 2 } } }))] } };
  const strategy = buildStrategySnapshot(s), basis = freezeCombatInput(s, 42, s.resourceProvenance.entries.length);
  let state = createCombatWithEvents(s.preparation, strategy, basis.combatId, 42).state, checked = 0;
  while (state.status === 'running' && checked < 6) {
    state = stepCombat(state).state;
    if (!state.units.some(u => u.tasks?.some(t => t.kind === 'attackLanding'))) continue;
    const rebuilt = createRestoreCombatReplay(JSON.parse(JSON.stringify(basis)), strategy, state.tick).stateAtSaveTick();
    expect(rebuilt).toEqual(state);
    const ids = new Set(state.units.map(u => u.id)), same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
    for (const u of state.units) validateM5Runtime(u, state.tick, ids, state.units, state.combatId!, new Set(), same, state.nextActionSeq!);
    for (const forge of [(t: any) => { t.landing.packets[0].targetId = 'nobody'; }, (t: any) => { t.source = { ...t.source, sourceKind: 'ability' }; }]) {
      const forged = structuredClone(state), owner = forged.units.find(u => u.tasks?.some(t => t.kind === 'attackLanding'))!;
      forge(owner.tasks!.find(t => t.kind === 'attackLanding')!);
      expect(() => validateM5Runtime(owner, state.tick, ids, forged.units, state.combatId!, new Set(), same, state.nextActionSeq!)).toThrow();
    }
    expect(stepCombat(JSON.parse(JSON.stringify(rebuilt)))).toEqual(stepCombat(state));
    checked++;
  }
  expect(checked).toBe(6);
}, 60000);

it('Zeri\'s empowered shot is an instant beam: it settles on its attack tick; her other attacks fly', () => {
  const start = battle([shooter('zeri', 4), dummy('e', 3, 3)], { rngState: 42 });
  const r = run(start, 120), attacks = attackTicks(r.out), hits = new Set(hitTicks(r.out));
  const n = variable(start.units.find(u => u.id === 'p')!, 'NumOfAttacks');
  expect(n).toBeGreaterThan(1);
  const flight = rangedAttackFlightTicks(hexDistance({ col: 3, row: 6 }, { col: 3, row: 3 }), 'zeri');
  expect(attacks.length).toBeGreaterThan(n);
  attacks.forEach((t, i) => expect(hits.has((i + 1) % n === 0 ? t : t + flight), `attack ${i + 1} at ${t}`).toBe(true));
});

import { describe, expect, it } from 'vitest';
import { stepCombat, createCombatWithEvents, type CombatEvent, type CombatState, type CombatUnit } from '../src/simulation/combat';
import { resolveAbility } from '../src/simulation/combat-abilities';
import { EMPTY_RUNTIME, applyStatus, origin, type S13Unit } from '../src/simulation/combat-s13-state';
import { VI_SLAM_TICKS } from '../src/simulation/combat-g2-2';
import { createMatch, snapshotForBattle, compileBattle, resolveTwoSidedBattle, startTwoSidedBattle,
  startCombatReplay, toCombatReplay, type MatchState } from '../src/server-entry';
import { getCatalogRoundById } from '../src/simulation/round-selectors';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { freezeCombatInput } from '../src/simulation/combat-input';
import { createRestoreCombatReplay } from '../src/simulation/restore-combat-replay';
import { validateM5Runtime } from '../src/simulation/serialization-structure';
import { battle, unit } from './combat-helpers';
import { packets } from './helpers/replay2-views';

// Vi grabs her target on the cast and slams VI_SLAM_TICKS later (user 2026-11-11, docs/S13_RULES_GAP.md 蔚).
function vi(patch: Partial<CombatUnit> = {}): CombatUnit {
  return unit('p', 'player', 1, 3, { definitionId: 'vi', ability: resolveAbility('vi-ability', 1), hp: 4000, maxHp: 5000, armor: 0, magicResist: 0,
    mana: 100, maxMana: 100, attackDamage: 100, attackRange: 6, abilityPower: 100, baseAttackSpeedBps: 10000,
    runtime: { ...EMPTY_RUNTIME }, statuses: [], shieldLayers: [], tasks: [], mechanics: [], ...patch });
}
function dummy(id: string, col: number, row = 3, hp = 100000): CombatUnit {
  return unit(id, 'enemy', col, row, { definitionId: 'neutral-stage-2', ability: resolveAbility('neutral-attack', 1), hp, maxHp: hp, mana: 0, maxMana: 1,
    attackDamage: 0, cooldownTicks: 1000, moveCooldownTicks: 1000, runtime: { ...EMPTY_RUNTIME }, statuses: [], shieldLayers: [], tasks: [] });
}
function run(state: CombatState, count: number) {
  const events: CombatEvent[] = [];
  for (let n = 0; n < count && state.status === 'running'; n++) { const r = stepCombat(state); state = r.state; events.push(...r.events); }
  return { state, events };
}
const hits = (events: readonly CombatEvent[], target: string) => packets(events).filter(x => x.source.ownerId === 'p' && x.source.sourceKind === 'ability' && x.unitId === target);
const stuns = (events: readonly CombatEvent[]) => events.filter((e): e is Extract<CombatEvent, { type: 'statusChanged' }> =>
  e.type === 'statusChanged' && e.reason === 'applied' && e.group.kind === 'stun').map(e => [e.group.targetId, e.group.contributions.some(c => c.application.knockup === true)]);
const start = () => battle([vi(), dummy('e', 2), dummy('f', 3), dummy('g', 4, 2)], { rngState: 42 });

describe('Vi grabs, then slams VI_SLAM_TICKS later', () => {
  it('holds the target (a knock-up) and herself on the cast; damage, the stun and the row land at the slam', () => {
    const cast = run(start(), 1);
    expect(hits(cast.events, 'e')).toEqual([]); expect(hits(cast.events, 'f')).toEqual([]);
    expect(stuns(cast.events)).toEqual([['e', true]]);
    const p = cast.state.units.find(u => u.id === 'p')!;
    expect(p.mechanismState!.activities).toContainEqual(expect.objectContaining({ kind: 'channel', lifecycle: 'active', expiresAtTick: 1 + VI_SLAM_TICKS }));
    const before = run(cast.state, VI_SLAM_TICKS - 1);
    expect(hits(before.events, 'e')).toEqual([]);
    expect(before.events.some(e => e.type === 'attack' && (e as { attackerId?: string }).attackerId === 'p')).toBe(false);
    const slam = run(before.state, 1);
    expect(hits(slam.events, 'e')).toHaveLength(1); expect(hits(slam.events, 'f')).toHaveLength(1); expect(hits(slam.events, 'g')).toEqual([]);
    expect(Object.fromEntries(stuns(slam.events))).toEqual({ e: false, f: true });
  });
  it('a dead Vi never slams', () => {
    let state = run(start(), 3).state;
    state = structuredClone(state);
    const p = state.units.find(u => u.id === 'p')!; Object.assign(p, { hp: 0, alive: false });
    const after = run(state, VI_SLAM_TICKS);
    expect(hits(after.events, 'e')).toEqual([]); expect(hits(after.events, 'f')).toEqual([]);
    expect(stuns(after.events)).toEqual([]);
  });
  it('a control on Vi ends her channel, and the slam still lands', () => {
    let state = run(start(), 3).state;
    state = structuredClone(state);
    const p = state.units.find(u => u.id === 'p')! as S13Unit, e = state.units.find(u => u.id === 'e')!;
    applyStatus(p, origin(e), 'stun', 0, 5, state.tick, [], true);
    const after = run(state, VI_SLAM_TICKS);
    expect(after.events.some(ev => ev.type === 'activityChanged' && (ev as { reason?: string }).reason === 'control-cancelled')).toBe(true);
    expect(hits(after.events, 'e')).toHaveLength(1); expect(hits(after.events, 'f')).toHaveLength(1);
  });
  it('a target that dies while held loses its share; the row recorded on the cast is still hit', () => {
    let state = run(start(), 3).state;
    state = structuredClone(state);
    const e = state.units.find(u => u.id === 'e')!; Object.assign(e, { hp: 0, alive: false });
    const after = run(state, VI_SLAM_TICKS);
    expect(hits(after.events, 'e')).toEqual([]); expect(hits(after.events, 'g')).toEqual([]);
    expect(hits(after.events, 'f')).toHaveLength(1);
    expect(Object.fromEntries(stuns(after.events))).toEqual({ f: true });
  });
});

// Save / restore / replay mid-grab, as five-cost-replay does for Sevika's slot wait (g23Roll).
function army(name: string, star: 1 | 2 | 3 = 3): MatchState {
  const base = createMatch(42), round = getCatalogRoundById('2-1');
  return { ...base, level: 9, round: round.ordinal, roundDefinitionId: round.roundId, m8: { ...base.m8, round }, items: [],
    preparation: { ...base.preparation, units: [name, 'drmundo', 'drmundo'].map((definitionId, i) => ({ id: `unit-${i + 1}`, definitionId,
      team: 'player', starLevel: i === 0 ? star : 3, location: { kind: 'board', cell: { col: 2 + i, row: i === 0 ? 5 : 4 } } })) } };
}
it('Vi synchronous / 1- and 7-tick slices / replay preserve complete bytes', () => {
  const source = compileBattle(snapshotForBattle(army('vi'), 'A'), snapshotForBattle(army('garen'), 'B'), 42, { battleId: 'vi-slam' });
  const expected = resolveTwoSidedBattle(source, 901), expectedReplay = toCombatReplay(expected);
  expect(expected.events.some(e => e.type === 'cast' && e.receipt.source.definitionId === 'vi-ability')).toBe(true);
  for (const budget of [1, 7]) {
    const task = startTwoSidedBattle(source); let result = task.advance(budget);
    while (!result) result = task.advance(budget);
    expect(JSON.stringify(result)).toBe(JSON.stringify(expected));
    const replay = startCombatReplay(JSON.parse(JSON.stringify(result))); let frames = replay.advance(budget);
    while (!frames) frames = replay.advance(budget);
    expect(JSON.stringify(frames)).toBe(JSON.stringify(expectedReplay));
  }
});
it('Vi restores every tick of a pending slam from authenticated inputs, continues identically and rejects a forged slam', () => {
  const player = army('vi'), opponent = army('garen');
  const s: MatchState = { ...player, items: (['blue-buff', 'tear', 'tear'] as const).map((definitionId, slot) => ({ id: `mana-${slot}`, definitionId, location: { kind: 'unit' as const, unitId: 'unit-1', slot: slot as 0 | 1 | 2 } })),
    preparation: { ...player.preparation, units: [...player.preparation.units,
      ...opponent.preparation.units.map(u => ({ ...u, id: 'enemy-' + u.id, team: 'enemy' as const,
        location: { kind: 'board' as const, cell: { col: u.location.kind === 'board' ? u.location.cell.col : 0, row: 2 } } }))] } };
  const strategy = buildStrategySnapshot(s), basis = freezeCombatInput(s, 42, s.resourceProvenance.entries.length);
  let state = createCombatWithEvents(s.preparation, strategy, basis.combatId, 42).state, checked = 0;
  while (state.status === 'running' && checked < VI_SLAM_TICKS) {
    state = stepCombat(state).state;
    if (!state.units.some(u => u.tasks?.some(t => t.kind === 'g22ViSlam'))) continue;
    const rebuilt = createRestoreCombatReplay(JSON.parse(JSON.stringify(basis)), strategy, state.tick).stateAtSaveTick();
    expect(rebuilt).toEqual(state);
    const ids = new Set(state.units.map(u => u.id)), same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
    for (const u of state.units) validateM5Runtime(u, state.tick, ids, state.units, state.combatId!, new Set(), same, state.nextActionSeq!);
    const forged = structuredClone(state), owner = forged.units.find(u => u.tasks?.some(t => t.kind === 'g22ViSlam'))!;
    Object.assign(owner.tasks!.find(t => t.kind === 'g22ViSlam')!, { source: { ...owner.tasks!.find(t => t.kind === 'g22ViSlam')!.source, definitionId: 'lux-ability' } });
    expect(() => validateM5Runtime(owner, state.tick, ids, forged.units, state.combatId!, new Set(), same, state.nextActionSeq!)).toThrow();
    expect(stepCombat(JSON.parse(JSON.stringify(rebuilt)))).toEqual(stepCombat(state));
    checked++;
  }
  expect(checked).toBe(VI_SLAM_TICKS);
});

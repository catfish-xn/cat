import { describe, expect, it } from 'vitest';
import { stepCombat, createCombatWithEvents, type CombatEvent, type CombatState, type CombatUnit } from '../src/simulation/combat';
import { resolveAbility } from '../src/simulation/combat-abilities';
import { EMPTY_RUNTIME } from '../src/simulation/combat-s13-state';
import { CAST_WINDUP_TICKS } from '../src/simulation/cast-windup';
import { createMatch, snapshotForBattle, compileBattle, resolveTwoSidedBattle, startTwoSidedBattle,
  startCombatReplay, toCombatReplay, type MatchState } from '../src/server-entry';
import { getCatalogRoundById } from '../src/simulation/round-selectors';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { freezeCombatInput } from '../src/simulation/combat-input';
import { createRestoreCombatReplay } from '../src/simulation/restore-combat-replay';
import { validateM5Runtime } from '../src/simulation/serialization-structure';
import { battle, unit } from './combat-helpers';
import { packets, heals } from './helpers/replay2-views';

// Cast wind-up alignment, batch 1 (user-approved timing only, 2026-11-16): these skills land CAST_WINDUP_TICKS after the
// cast; amounts and targets are taken on the cast. docs/S13_RULES_GAP.md (技能生效前摇对齐).
function hero(name: string): CombatUnit {
  return unit('p', 'player', 1, 3, { definitionId: name, ability: resolveAbility(name + '-ability', 1), hp: 3000, maxHp: 5000, armor: 0, magicResist: 0,
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
const myHeals = (events: readonly CombatEvent[]) => heals(events).filter(x => x.unitId === 'p');
const stuns = (events: readonly CombatEvent[]) => events.filter(e => e.type === 'statusChanged' && (e as any).reason === 'applied' && (e as any).group.kind === 'stun');
const kill = (state: CombatState, id: string) => { const next = structuredClone(state); Object.assign(next.units.find(u => u.id === id)!, { hp: 0, alive: false }); return next; };
const start = (name: string) => battle([hero(name), dummy('e', 2), dummy('f', 1, 2), dummy('g', 2, 2)], { rngState: 42 });

const cases = [['sett', true], ['trundle', true], ['violet', true], ['zyra', true], ['drmundo', false]] as const;
for (const [name, stunsOrBites] of cases) describe(`${name}: lands CAST_WINDUP_TICKS.${name} after the cast`, () => {
  const w = CAST_WINDUP_TICKS[name];
  it('nothing on the cast or before; damage (and heal, stun) on the landing tick', () => {
    const cast = run(start(name), 1);
    expect(cast.events.some(e => e.type === 'cast')).toBe(true);
    expect(hits(cast.events)).toEqual([]); expect(myHeals(cast.events)).toEqual([]); expect(stuns(cast.events)).toEqual([]);
    const before = run(cast.state, w - 1);
    expect(hits(before.events)).toEqual([]); expect(myHeals(before.events)).toEqual([]); expect(stuns(before.events)).toEqual([]);
    const land = run(before.state, 1);
    if (name === 'drmundo') expect(myHeals(land.events).length).toBe(1);
    else expect(hits(land.events).length).toBeGreaterThan(0);
    if (stunsOrBites && name !== 'trundle') expect(stuns(land.events).length).toBeGreaterThan(0);
    if (name === 'trundle') expect(myHeals(land.events).length).toBe(1);
  });
  it('a caster dead before the landing deals nothing', () => {
    const after = run(kill(run(start(name), 2).state, 'p'), w + 45);
    expect(hits(after.events)).toEqual([]);
  });
  if (name !== 'drmundo') it('a target dead before the landing takes nothing; no other target is picked', () => {
    const cast = run(start(name), 1);
    const owner = cast.state.units.find(u => u.id === 'p')!;
    const landing = owner.tasks!.filter(t => t.kind === 'g2Landing' && t.targetId !== 'p');
    const first = landing[0]!.targetId!;
    const after = run(kill(cast.state, first), w);
    expect(hits(after.events, first)).toEqual([]);
    expect(hits(after.events).map(x => x.unitId).sort()).toEqual(landing.map(t => t.targetId!).filter(id => id !== first).sort());
  });
});

// Save / restore / replay with a pending landing, as vi-grab-slam does.
function army(name: string, star: 1 | 2 | 3 = 3): MatchState {
  const base = createMatch(42), round = getCatalogRoundById('2-1');
  return { ...base, level: 9, round: round.ordinal, roundDefinitionId: round.roundId, m8: { ...base.m8, round }, items: [],
    preparation: { ...base.preparation, units: [name, 'drmundo', 'drmundo'].map((definitionId, i) => ({ id: `unit-${i + 1}`, definitionId,
      team: 'player', starLevel: i === 0 ? star : 3, location: { kind: 'board', cell: { col: 2 + i, row: i === 0 ? 5 : 4 } } })) } };
}
for (const name of ['sett', 'trundle', 'violet', 'zyra'] as const) {
  it(`${name} synchronous / 1- and 7-tick slices / replay preserve complete bytes`, () => {
    const source = compileBattle(snapshotForBattle(army(name), 'A'), snapshotForBattle(army('garen'), 'B'), 42, { battleId: `${name}-windup` });
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
  it(`${name} restores every tick of a pending landing, continues identically and rejects a forged one`, () => {
    const player = army(name), opponent = army('garen');
    const s: MatchState = { ...player, items: (['blue-buff', 'tear', 'tear'] as const).map((definitionId, slot) => ({ id: `mana-${slot}`, definitionId, location: { kind: 'unit' as const, unitId: 'unit-1', slot: slot as 0 | 1 | 2 } })),
      preparation: { ...player.preparation, units: [...player.preparation.units,
        ...opponent.preparation.units.map(u => ({ ...u, id: 'enemy-' + u.id, team: 'enemy' as const,
          location: { kind: 'board' as const, cell: { col: u.location.kind === 'board' ? u.location.cell.col : 0, row: 2 } } }))] } };
    const strategy = buildStrategySnapshot(s), basis = freezeCombatInput(s, 42, s.resourceProvenance.entries.length);
    let state = createCombatWithEvents(s.preparation, strategy, basis.combatId, 42).state, checked = 0;
    const w = CAST_WINDUP_TICKS[name];
    while (state.status === 'running' && checked < w) {
      state = stepCombat(state).state;
      if (!state.units.some(u => u.tasks?.some(t => t.kind === 'g2Landing'))) continue;
      const rebuilt = createRestoreCombatReplay(JSON.parse(JSON.stringify(basis)), strategy, state.tick).stateAtSaveTick();
      expect(rebuilt).toEqual(state);
      const ids = new Set(state.units.map(u => u.id)), same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
      for (const u of state.units) validateM5Runtime(u, state.tick, ids, state.units, state.combatId!, new Set(), same, state.nextActionSeq!);
      const forged = structuredClone(state), owner = forged.units.find(u => u.tasks?.some(t => t.kind === 'g2Landing'))!;
      const pending = owner.tasks!.find(t => t.kind === 'g2Landing')!;
      Object.assign(pending, { source: { ...pending.source, definitionId: 'lux-ability' } });
      expect(() => validateM5Runtime(owner, state.tick, ids, forged.units, state.combatId!, new Set(), same, state.nextActionSeq!)).toThrow();
      expect(stepCombat(JSON.parse(JSON.stringify(rebuilt)))).toEqual(stepCombat(state));
      checked++;
    }
    expect(checked).toBe(w);
  }, 30000);
}

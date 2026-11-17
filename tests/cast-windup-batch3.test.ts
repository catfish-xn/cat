import { describe, expect, it } from 'vitest';
import { stepCombat, createCombatWithEvents, type CombatEvent, type CombatState, type CombatUnit } from '../src/simulation/combat';
import { resolveAbility } from '../src/simulation/combat-abilities';
import { EMPTY_RUNTIME, applyStatus, origin, type S13Unit } from '../src/simulation/combat-s13-state';
import { CAST_WINDUP_TICKS, POWDER_MONKEY_BASE_TICKS, POWDER_MONKEY_TICKS_PER_HEX } from '../src/simulation/cast-windup';
import { hexDistance } from '../src/simulation/board';
import { createMatch, snapshotForBattle, compileBattle, resolveTwoSidedBattle, startTwoSidedBattle,
  startCombatReplay, toCombatReplay, type MatchState } from '../src/server-entry';
import { getCatalogRoundById } from '../src/simulation/round-selectors';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { freezeCombatInput } from '../src/simulation/combat-input';
import { createRestoreCombatReplay } from '../src/simulation/restore-combat-replay';
import { validateM5Runtime } from '../src/simulation/serialization-structure';
import { battle, unit } from './combat-helpers';
import { packets } from './helpers/replay2-views';

// Cast wind-up alignment, batch 3 (user-approved timing only, 2026-11-17; fitted values, not original data): Renata's missiles
// land CAST_WINDUP_TICKS.renata after her cast (her shields stay on the cast); Powder's monkey explodes on reaching the landing
// cell taken on her cast, POWDER_MONKEY_* ticks by distance later. docs/S13_RULES_GAP.md (技能生效前摇对齐).
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
const kill = (state: CombatState, id: string) => { const next = structuredClone(state); Object.assign(next.units.find(u => u.id === id)!, { hp: 0, alive: false }); return next; };
const start = (name: string) => battle([hero(name), dummy('e', 2), dummy('f', 1, 2), dummy('g', 2, 2)], { rngState: 42 });



describe('Renata: the missiles land CAST_WINDUP_TICKS.renata after the cast; the shields stay on the cast', () => {
  const w = CAST_WINDUP_TICKS.renata;
  it('nothing on the cast or before; the damage on the landing tick', () => {
    const cast = run(start('renata'), 1);
    expect(hits(cast.events)).toEqual([]);
    const before = run(cast.state, w - 1); expect(hits(before.events)).toEqual([]);
    expect(hits(run(before.state, 1).events).length).toBeGreaterThan(0);
  });
  it('her death stops it, a control does not; a dead target takes nothing and nobody else is picked', () => {
    expect(hits(run(kill(run(start('renata'), 2).state, 'p'), w + 5).events)).toEqual([]);
    const state = structuredClone(run(start('renata'), 1).state);
    applyStatus(state.units.find(u => u.id === 'p')! as S13Unit, origin(state.units.find(u => u.id === 'e')!), 'stun', 0, 40, state.tick, [], true);
    expect(hits(run(state, w).events).length).toBeGreaterThan(0);
    const cast = run(start('renata'), 1), landing = cast.state.units.find(u => u.id === 'p')!.tasks!.filter(t => t.kind === 'g2Landing');
    const first = landing[0]!.targetId!;
    const after = run(kill(cast.state, first), w);
    expect(hits(after.events, first)).toEqual([]);
    expect(hits(after.events).map(x => x.unitId).sort()).toEqual(landing.map(t => t.targetId!).filter(id => id !== first).sort());
  });
});

describe('Powder: the monkey explodes on reaching the landing cell taken on the cast', () => {
  const sentOf = (events: readonly CombatEvent[]) => events.find(e => e.type === 'abilityMarker' && e.marker === 'powder-monkey-sent') as Extract<CombatEvent, { type: 'abilityMarker' }>;
  it('arrives POWDER_MONKEY_BASE_TICKS + POWDER_MONKEY_TICKS_PER_HEX × hexes after the cast; nothing before', () => {
    const cast = run(start('powder'), 1), sent = sentOf(cast.events), p = cast.state.units.find(u => u.id === 'p')!;
    expect(sent.arrivalTick - sent.tick).toBe(POWDER_MONKEY_BASE_TICKS + POWDER_MONKEY_TICKS_PER_HEX * hexDistance(p.cell, sent.cell));
    const before = run(cast.state, sent.arrivalTick - cast.state.tick - 1);
    expect(hits(before.events)).toEqual([]);
    const land = run(before.state, 1);
    expect(hits(land.events).length).toBeGreaterThan(0);
    expect(land.events.some(e => e.type === 'abilityMarker' && e.marker === 'powder-monkey-arrived')).toBe(true);
  });
  it('explodes at the cell taken on the cast even when everyone there moved away; her death stops it', () => {
    const cast = run(start('powder'), 1), sent = sentOf(cast.events), moved = structuredClone(cast.state);
    for (const u of moved.units.filter(u => u.team === 'enemy')) Object.assign(u, { cell: { col: 6, row: 0 } });
    const after = run(moved, sent.arrivalTick - cast.state.tick);
    expect(after.events.some(e => e.type === 'abilityMarker' && e.marker === 'powder-monkey-arrived')).toBe(true);
    expect(hits(after.events)).toEqual([]);
    expect(run(kill(cast.state, 'p'), sent.arrivalTick - cast.state.tick + 2).events.some(e => e.type === 'abilityMarker' && e.marker === 'powder-monkey-arrived')).toBe(false);
  });
});

// Save / restore / replay with pending tasks, as batches 1 and 2.
function army(name: string, star: 1 | 2 | 3 = 3): MatchState {
  const base = createMatch(42), round = getCatalogRoundById('2-1');
  return { ...base, level: 9, round: round.ordinal, roundDefinitionId: round.roundId, m8: { ...base.m8, round }, items: [],
    preparation: { ...base.preparation, units: [name, 'drmundo', 'drmundo'].map((definitionId, i) => ({ id: `unit-${i + 1}`, definitionId,
      team: 'player', starLevel: i === 0 ? star : 3, location: { kind: 'board', cell: { col: 2 + i, row: i === 0 ? 5 : 4 } } })) } };
}
const pendingKind = { renata: 'g2Landing', powder: 'g2PowderMonkey' } as const;
for (const name of ['renata', 'powder'] as const) {
  it(`${name} synchronous / 1- and 7-tick slices / replay preserve complete bytes`, () => {
    const source = compileBattle(snapshotForBattle(army(name), 'A'), snapshotForBattle(army('garen'), 'B'), 42, { battleId: `${name}-windup3` });
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

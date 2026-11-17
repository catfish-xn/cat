import { describe, expect, it } from 'vitest';
import { stepCombat, createCombatWithEvents, type CombatEvent, type CombatState, type CombatUnit } from '../src/simulation/combat';
import { resolveAbility } from '../src/simulation/combat-abilities';
import { EMPTY_RUNTIME, applyStatus, origin, type S13Unit } from '../src/simulation/combat-s13-state';
import { CAST_WINDUP_TICKS, POWDER_MONKEY_RELEASE_TICKS, POWDER_MONKEY_TICKS_PER_HEX, POWDER_MONKEY_WALK_BASE_TICKS, RENATA_MISSILE_FLIGHT_TICKS } from '../src/simulation/cast-windup';
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
/** A death the next step settles (hp 0 while still alive), as a lethal hit would leave it: its death cleanup runs then. */
const fell = (state: CombatState, id: string) => { const next = structuredClone(state); Object.assign(next.units.find(u => u.id === id)!, { hp: 0 }); return next; };
// A passive ally far back keeps the fight running after the caster's death.
const ally = () => ({ ...dummy('ally', 6, 7), team: 'player' as const });
const start = (name: string) => battle([hero(name), ally(), dummy('e', 2), dummy('f', 1, 2), dummy('g', 2, 2)], { rngState: 42 });



describe('Renata: the missiles land CAST_WINDUP_TICKS.renata after the cast; the shields stay on the cast', () => {
  const w = CAST_WINDUP_TICKS.renata;
  it('nothing on the cast or before; the damage on the landing tick', () => {
    const cast = run(start('renata'), 1);
    expect(hits(cast.events)).toEqual([]);
    const before = run(cast.state, w - 1); expect(hits(before.events)).toEqual([]);
    expect(hits(run(before.state, 1).events).length).toBeGreaterThan(0);
  });
  it('her death before the missiles leave stops them, after they leave it does not; a control does not; a dead target takes nothing', () => {
    // The missiles leave her RENATA_MISSILE_FLIGHT_TICKS before they land; a death settled on an earlier tick stops them.
    const castState = run(start('renata'), 1).state, lands = castState.units.find(u => u.id === 'p')!.tasks!.find(t => t.kind === 'g2Landing')!.executeAtTick;
    const leave = lands - RENATA_MISSILE_FLIGHT_TICKS, upTo = (tick: number) => run(castState, tick - castState.tick).state;
    expect(hits(run(fell(upTo(leave - 2), 'p'), w + 5).events)).toEqual([]); // dies on leave - 1
    expect(hits(run(fell(upTo(leave - 1), 'p'), w + 5).events).length).toBeGreaterThan(0); // dies on leave
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
  it('lets go POWDER_MONKEY_RELEASE_TICKS after the cast and arrives POWDER_MONKEY_WALK_BASE_TICKS + POWDER_MONKEY_TICKS_PER_HEX × hexes later; nothing before', () => {
    const cast = run(start('powder'), 1), p = cast.state.units.find(u => u.id === 'p')!;
    expect(sentOf(cast.events)).toBeUndefined();
    const held = run(cast.state, POWDER_MONKEY_RELEASE_TICKS - 1);
    expect(sentOf(held.events)).toBeUndefined();
    const go = run(held.state, 1), sent = sentOf(go.events);
    expect(sent.tick - cast.state.tick).toBe(POWDER_MONKEY_RELEASE_TICKS);
    expect(sent.arrivalTick - sent.tick).toBe(POWDER_MONKEY_WALK_BASE_TICKS + POWDER_MONKEY_TICKS_PER_HEX * hexDistance(p.cell, sent.cell));
    const before = run(cast.state, sent.arrivalTick - cast.state.tick - 1);
    expect(hits(before.events)).toEqual([]);
    const land = run(before.state, 1);
    expect(hits(land.events).length).toBeGreaterThan(0);
    expect(land.events.some(e => e.type === 'abilityMarker' && e.marker === 'powder-monkey-arrived')).toBe(true);
  });
  const arrived = (events: readonly CombatEvent[]) => events.some(e => e.type === 'abilityMarker' && e.marker === 'powder-monkey-arrived');
  it('explodes at the cell taken on the cast even when everyone there moved away, and after her death once let go', () => {
    const cast = run(start('powder'), 1), go = run(cast.state, POWDER_MONKEY_RELEASE_TICKS), sent = sentOf(go.events), moved = structuredClone(go.state);
    for (const u of moved.units.filter(u => u.team === 'enemy')) Object.assign(u, { cell: { col: 6, row: 0 } });
    const after = run(moved, sent.arrivalTick - go.state.tick);
    expect(arrived(after.events)).toBe(true);
    expect(hits(after.events)).toEqual([]);
    const afterDeath = run(fell(go.state, 'p'), sent.arrivalTick - go.state.tick + 2);
    expect(arrived(afterDeath.events)).toBe(true);
    expect(hits(afterDeath.events).length).toBeGreaterThan(0);
  });
  it('her death before letting go stops it: no monkey, no explosion', () => {
    const cast = run(start('powder'), 1), held = run(cast.state, POWDER_MONKEY_RELEASE_TICKS - 2);
    const dead = run(fell(held.state, 'p'), 60);
    expect(sentOf(dead.events)).toBeUndefined();
    expect(arrived(dead.events)).toBe(false);
    expect(hits(dead.events)).toEqual([]);
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

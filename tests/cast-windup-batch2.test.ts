import { describe, expect, it } from 'vitest';
import { stepCombat, createCombatWithEvents, type CombatEvent, type CombatState, type CombatUnit } from '../src/simulation/combat';
import { resolveAbility } from '../src/simulation/combat-abilities';
import { EMPTY_RUNTIME, applyStatus, origin, type S13Unit } from '../src/simulation/combat-s13-state';
import { CAST_WINDUP_TICKS, DRMUNDO_BLAST_AFTER_PULSE_TICKS, NUNU_SECOND_AFTER_PULSE_TICKS, SMEECH_STAB_TICKS } from '../src/simulation/cast-windup';
import { createMatch, snapshotForBattle, compileBattle, resolveTwoSidedBattle, startTwoSidedBattle,
  startCombatReplay, toCombatReplay, type MatchState } from '../src/server-entry';
import { getCatalogRoundById } from '../src/simulation/round-selectors';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { freezeCombatInput } from '../src/simulation/combat-input';
import { createRestoreCombatReplay } from '../src/simulation/restore-combat-replay';
import { validateM5Runtime } from '../src/simulation/serialization-structure';
import { battle, unit } from './combat-helpers';
import { packets, heals } from './helpers/replay2-views';

// Cast wind-up alignment, batch 2 (user-approved timing only, 2026-11-16; fitted values, not original data): Tristana's shell
// lands CAST_WINDUP_TICKS.tristana after her cast, Smeech's stabs SMEECH_STAB_TICKS apart, Dr. Mundo's blast and Nunu's second
// damage a few ticks after their last pulse. Amounts and targets are taken on the cast. docs/S13_RULES_GAP.md (技能生效前摇对齐).
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


describe('Tristana: the shell lands CAST_WINDUP_TICKS.tristana after the cast', () => {
  const w = CAST_WINDUP_TICKS.tristana;
  it('nothing on the cast or before; the damage on the landing tick, to the target taken on the cast', () => {
    const cast = run(start('tristana'), 1);
    const target = cast.state.units.find(u => u.id === 'p')!.tasks!.find(t => t.kind === 'g2Landing')!.targetId!;
    expect(hits(cast.events)).toEqual([]);
    const before = run(cast.state, w - 1); expect(hits(before.events)).toEqual([]);
    const land = run(before.state, 1); expect(hits(land.events).map(x => x.unitId)).toEqual([target]);
  });
  it('a control on her after the cast does not stop it; her death does; a dead target takes nothing and nobody else is hit', () => {
    const state = structuredClone(run(start('tristana'), 1).state);
    const p = state.units.find(u => u.id === 'p')! as S13Unit, e = state.units.find(u => u.id === 'e')!;
    applyStatus(p, origin(e), 'stun', 0, 40, state.tick, [], true);
    expect(hits(run(state, w).events)).toHaveLength(1);
    expect(hits(run(kill(run(start('tristana'), 2).state, 'p'), w + 5).events)).toEqual([]);
    const cast = run(start('tristana'), 1), target = cast.state.units.find(u => u.id === 'p')!.tasks!.find(t => t.kind === 'g2Landing')!.targetId!;
    expect(hits(run(kill(cast.state, target), w).events)).toEqual([]);
  });
  it('the overkill ricochet follows the landing, one tick later', () => {
    const state = structuredClone(run(start('tristana'), 1).state);
    const target = state.units.find(u => u.id === 'p')!.tasks!.find(t => t.kind === 'g2Landing')!.targetId!;
    Object.assign(state.units.find(u => u.id === target)!, { hp: 1 });
    const after = run(state, w + 1), mine = hits(after.events);
    expect(mine.map(x => x.tick - mine[0]!.tick)).toEqual([0, 1]);
    expect(mine[1]!.unitId).not.toBe(target);
  });
});

describe('Smeech, Dr. Mundo and Nunu: the later parts land at fixed distances from the earlier ones', () => {
  const ticksOf = (name: string, count: number) => hits(run(start(name), count).events).map(x => x.tick);
  it('Smeech: three stabs SMEECH_STAB_TICKS apart', () => {
    const t = ticksOf('smeech', 3 * SMEECH_STAB_TICKS);
    expect(t.slice(0, 3).map(x => x - t[0]!)).toEqual([0, SMEECH_STAB_TICKS, 2 * SMEECH_STAB_TICKS]);
  });
  it('Dr. Mundo: the blast DRMUNDO_BLAST_AFTER_PULSE_TICKS after the last pulse', () => {
    const all = hits(run(start('drmundo'), 80).events), last = all.filter(x => x.raw === all[0]!.raw).at(-1)!, blast = all.find(x => x.raw !== all[0]!.raw)!;
    expect(blast.tick - last.tick).toBe(DRMUNDO_BLAST_AFTER_PULSE_TICKS);
  });
  it('Nunu: the second damage NUNU_SECOND_AFTER_PULSE_TICKS after the last periodic one', () => {
    const all = hits(run(start('nunu'), 100).events), periodic = all.filter(x => x.raw === all[0]!.raw), second = all.find(x => x.raw !== all[0]!.raw)!;
    expect(second.tick - periodic.at(-1)!.tick).toBe(NUNU_SECOND_AFTER_PULSE_TICKS);
  });
});

// Save / restore / replay with pending tasks, as batch 1.
function army(name: string, star: 1 | 2 | 3 = 3): MatchState {
  const base = createMatch(42), round = getCatalogRoundById('2-1');
  return { ...base, level: 9, round: round.ordinal, roundDefinitionId: round.roundId, m8: { ...base.m8, round }, items: [],
    preparation: { ...base.preparation, units: [name, 'drmundo', 'drmundo'].map((definitionId, i) => ({ id: `unit-${i + 1}`, definitionId,
      team: 'player', starLevel: i === 0 ? star : 3, location: { kind: 'board', cell: { col: 2 + i, row: i === 0 ? 5 : 4 } } })) } };
}
const pendingKind = { tristana: 'g2Landing', smeech: 'g23Stab', nunu: 'g23Magic' } as const;
for (const name of ['tristana', 'smeech', 'nunu'] as const) {
  it(`${name} synchronous / 1- and 7-tick slices / replay preserve complete bytes`, () => {
    const source = compileBattle(snapshotForBattle(army(name), 'A'), snapshotForBattle(army('garen'), 'B'), 42, { battleId: `${name}-windup2` });
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

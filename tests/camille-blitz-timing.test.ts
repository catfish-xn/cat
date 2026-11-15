import { describe, expect, it } from 'vitest';
import { stepCombat, createCombatWithEvents, type CombatEvent, type CombatState, type CombatUnit } from '../src/simulation/combat';
import { resolveAbility } from '../src/simulation/combat-abilities';
import { EMPTY_RUNTIME, applyStatus, origin, type S13Unit } from '../src/simulation/combat-s13-state';
import { CAMILLE_KICK_TICKS } from '../src/simulation/combat-g2-2';
import { BLITZ_SHOCK_TICKS } from '../src/simulation/combat-g2';
import { createMatch, snapshotForBattle, compileBattle, resolveTwoSidedBattle, startTwoSidedBattle,
  startCombatReplay, toCombatReplay, type MatchState } from '../src/server-entry';
import { getCatalogRoundById } from '../src/simulation/round-selectors';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { freezeCombatInput } from '../src/simulation/combat-input';
import { createRestoreCombatReplay } from '../src/simulation/restore-combat-replay';
import { validateM5Runtime } from '../src/simulation/serialization-structure';
import { battle, unit } from './combat-helpers';
import { packets } from './helpers/replay2-views';

// Camille's kick and Blitzcrank's shock land after the cast (user 2026-11-15, docs/S13_RULES_GAP.md 卡蜜尔 / 布里茨).
// The amounts are unchanged; only the tick moves.
function hero(name: string, patch: Partial<CombatUnit> = {}): CombatUnit {
  return unit('p', 'player', 1, 3, { definitionId: name, ability: resolveAbility(name + '-ability', 1), hp: 4000, maxHp: 5000, armor: 0, magicResist: 0,
    mana: 100, maxMana: 100, attackDamage: 100, attackRange: 6, abilityPower: 100, baseAttackSpeedBps: 10000,
    runtime: { ...EMPTY_RUNTIME }, statuses: [], shieldLayers: [], tasks: [], mechanics: [], ...patch });
}
function dummy(id: string, col: number, row = 3, patch: Partial<CombatUnit> = {}): CombatUnit {
  return unit(id, 'enemy', col, row, { definitionId: 'neutral-stage-2', ability: resolveAbility('neutral-attack', 1), hp: 100000, maxHp: 100000, mana: 0, maxMana: 1,
    attackDamage: 0, cooldownTicks: 1000, moveCooldownTicks: 1000, runtime: { ...EMPTY_RUNTIME }, statuses: [], shieldLayers: [], tasks: [], ...patch });
}
function run(state: CombatState, count: number) {
  const events: CombatEvent[] = [];
  for (let n = 0; n < count && state.status === 'running'; n++) { const r = stepCombat(state); state = r.state; events.push(...r.events); }
  return { state, events };
}
const hits = (events: readonly CombatEvent[], target?: string) => packets(events)
  .filter(x => x.source.ownerId === 'p' && x.source.sourceKind === 'ability' && (target === undefined || x.unitId === target));
const kill = (state: CombatState, id: string) => { const next = structuredClone(state); Object.assign(next.units.find(u => u.id === id)!, { hp: 0, alive: false }); return next; };

const cases = [
  { name: 'camille', delay: CAMILLE_KICK_TICKS, kind: 'g22CamilleKick', start: () => battle([hero('camille'), dummy('e', 2), dummy('f', 4, 2)], { rngState: 42 }) },
  { name: 'blitzcrank', delay: BLITZ_SHOCK_TICKS, kind: 'g2BlitzShock', start: () => battle([hero('blitzcrank'), dummy('e', 2), dummy('f', 4, 2)], { rngState: 42 }) },
] as const;

for (const c of cases) describe(`${c.name}: the damage lands ${c.delay} ticks after the cast`, () => {
  it('nothing on the cast or before; the damage on the landing tick', () => {
    const cast = run(c.start(), 1);
    expect(cast.events.some(e => e.type === 'cast')).toBe(true);
    expect(hits(cast.events)).toEqual([]);
    const before = run(cast.state, c.delay - 1);
    expect(hits(before.events)).toEqual([]);
    const land = run(before.state, 1);
    expect(hits(land.events).length).toBeGreaterThan(0);
    expect(hits(land.events).every(x => x.tick === cast.state.tick + c.delay - 1 + 1)).toBe(true);
  });
  it(`a dead ${c.name} deals nothing`, () => {
    const after = run(kill(run(c.start(), 2).state, 'p'), c.delay);
    expect(hits(after.events)).toEqual([]);
  });
  it(`a control on ${c.name} after the cast does not stop it`, () => {
    const state = structuredClone(run(c.start(), 2).state);
    const p = state.units.find(u => u.id === 'p')! as S13Unit, e = state.units.find(u => u.id === 'e')!;
    applyStatus(p, origin(e), 'stun', 0, 20, state.tick, [], true);
    expect(hits(run(state, c.delay).events, 'e')).toHaveLength(1);
  });
  it('a target that died in the meantime takes nothing and no other target is picked', () => {
    const cast = run(c.start(), 1);
    const targets = new Set(cast.state.units.find(u => u.id === 'p')!.tasks!.filter(t => t.kind === c.kind).map(t => t.targetId));
    expect(targets.has('e')).toBe(true);
    const after = run(kill(cast.state, 'e'), c.delay);
    expect(hits(after.events, 'e')).toEqual([]);
    // Blitzcrank's other shocked enemy is still hit; Camille has only the one target.
    expect(hits(after.events).map(x => x.unitId).sort()).toEqual([...targets].filter(id => id !== 'e').sort());
  });
  it('a target that moved away is still hit', () => {
    const cast = run(c.start(), 1), state = structuredClone(cast.state);
    Object.assign(state.units.find(u => u.id === 'e')!, { cell: { col: 6, row: 7 } });
    expect(hits(run(state, c.delay).events, 'e')).toHaveLength(1);
  });
});

describe('Camille: adaptive damage is picked when the kick lands', () => {
  for (const [armor, magicResist, type] of [[0, 50, 'physical'], [50, 0, 'magic'], [40, 40, 'magic']] as const)
    it(`armor ${armor} / magic resist ${magicResist} → ${type}`, () => {
      const r = run(battle([hero('camille'), dummy('e', 2, 3, { armor, magicResist })], { rngState: 42 }), 1 + CAMILLE_KICK_TICKS);
      expect(hits(r.events, 'e').map(x => x.damageType)).toEqual([type]);
    });
});

describe('Blitzcrank: the shield on the cast, the debuff with the shock', () => {
  it('shield at once; the outgoing-damage debuff only on the shocked enemies at the shock', () => {
    const cast = run(cases[1].start(), 1);
    expect(cast.state.units.find(u => u.id === 'p')!.shield).toBe(470);
    const amp = (s: CombatState, id: string) => (s.units.find(u => u.id === id)!.mechanismState?.statuses ?? [])
      .filter(g => g.contributions.some(x => x.source.definitionId === 'blitzcrank-ability')).length;
    expect(amp(cast.state, 'e')).toBe(0);
    const land = run(cast.state, BLITZ_SHOCK_TICKS);
    expect(amp(land.state, 'e')).toBe(1); expect(amp(land.state, 'f')).toBe(1);
  });
});

// Save / restore / replay with a pending kick or shock, as vi-grab-slam does for Vi's slam.
function army(name: string, star: 1 | 2 | 3 = 3): MatchState {
  const base = createMatch(42), round = getCatalogRoundById('2-1');
  return { ...base, level: 9, round: round.ordinal, roundDefinitionId: round.roundId, m8: { ...base.m8, round }, items: [],
    preparation: { ...base.preparation, units: [name, 'drmundo', 'drmundo'].map((definitionId, i) => ({ id: `unit-${i + 1}`, definitionId,
      team: 'player', starLevel: i === 0 ? star : 3, location: { kind: 'board', cell: { col: 2 + i, row: i === 0 ? 5 : 4 } } })) } };
}
for (const c of cases) {
  it(`${c.name} synchronous / 1- and 7-tick slices / replay preserve complete bytes`, () => {
    const source = compileBattle(snapshotForBattle(army(c.name), 'A'), snapshotForBattle(army('garen'), 'B'), 42, { battleId: `${c.name}-timing` });
    const expected = resolveTwoSidedBattle(source, 901), expectedReplay = toCombatReplay(expected);
    expect(expected.events.some(e => e.type === 'cast' && e.receipt.source.definitionId === `${c.name}-ability`)).toBe(true);
    for (const budget of [1, 7]) {
      const task = startTwoSidedBattle(source); let result = task.advance(budget);
      while (!result) result = task.advance(budget);
      expect(JSON.stringify(result)).toBe(JSON.stringify(expected));
      const replay = startCombatReplay(JSON.parse(JSON.stringify(result))); let frames = replay.advance(budget);
      while (!frames) frames = replay.advance(budget);
      expect(JSON.stringify(frames)).toBe(JSON.stringify(expectedReplay));
    }
  });
  it(`${c.name} restores every tick of a pending ${c.kind}, continues identically and rejects a forged one`, () => {
    const player = army(c.name), opponent = army('garen');
    const s: MatchState = { ...player, items: (['blue-buff', 'tear', 'tear'] as const).map((definitionId, slot) => ({ id: `mana-${slot}`, definitionId, location: { kind: 'unit' as const, unitId: 'unit-1', slot: slot as 0 | 1 | 2 } })),
      preparation: { ...player.preparation, units: [...player.preparation.units,
        ...opponent.preparation.units.map(u => ({ ...u, id: 'enemy-' + u.id, team: 'enemy' as const,
          location: { kind: 'board' as const, cell: { col: u.location.kind === 'board' ? u.location.cell.col : 0, row: 2 } } }))] } };
    const strategy = buildStrategySnapshot(s), basis = freezeCombatInput(s, 42, s.resourceProvenance.entries.length);
    let state = createCombatWithEvents(s.preparation, strategy, basis.combatId, 42).state, checked = 0;
    while (state.status === 'running' && checked < c.delay) {
      state = stepCombat(state).state;
      if (!state.units.some(u => u.tasks?.some(t => t.kind === c.kind))) continue;
      const rebuilt = createRestoreCombatReplay(JSON.parse(JSON.stringify(basis)), strategy, state.tick).stateAtSaveTick();
      expect(rebuilt).toEqual(state);
      const ids = new Set(state.units.map(u => u.id)), same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
      for (const u of state.units) validateM5Runtime(u, state.tick, ids, state.units, state.combatId!, new Set(), same, state.nextActionSeq!);
      const forged = structuredClone(state), owner = forged.units.find(u => u.tasks?.some(t => t.kind === c.kind))!;
      const pending = owner.tasks!.find(t => t.kind === c.kind)!;
      Object.assign(pending, { source: { ...pending.source, definitionId: 'lux-ability' } });
      expect(() => validateM5Runtime(owner, state.tick, ids, forged.units, state.combatId!, new Set(), same, state.nextActionSeq!)).toThrow();
      expect(stepCombat(JSON.parse(JSON.stringify(rebuilt)))).toEqual(stepCombat(state));
      checked++;
    }
    expect(checked).toBe(c.delay);
  });
}

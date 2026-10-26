import { describe, expect, it } from 'vitest';
import { projectG23Summons } from '../src/simulation/g2-3-summons';
import { createCombatWithEvents, stepCombat, type CombatState } from '../src/simulation/combat';
import { createMatch } from '../src/simulation/match';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { getCatalogRoundById } from '../src/simulation/round-selectors';
import { M5_UNIT_DEFINITIONS } from '../src/simulation/units';
import { EMBLEM_ITEMS } from '../src/simulation/content/emblems';
import { type S13Unit } from '../src/simulation/combat-s13-state';
import { effectiveStatuses } from '../src/simulation/m8/status';
import { isAbsent, isSelectable } from '../src/simulation/anomalies/availability';
import { DEFAULT_BOARD } from '../src/simulation/board';
import type { GameState } from '../src/simulation/game';
import type { TraitSnapshot } from '../src/simulation/strategy-types';

function army(tier: number): CombatState {
  const s = createMatch(42), round = getCatalogRoundById('2-1');
  const native = Object.values(M5_UNIT_DEFINITIONS).filter(u => u.traits.includes('black-rose')).slice(0, tier).map(u => u.id);
  const added = Object.values(M5_UNIT_DEFINITIONS).filter(u => !u.traits.includes('black-rose')).slice(0, tier - native.length).map(u => u.id);
  const emblem = Object.values(EMBLEM_ITEMS).find(i => i.emblemTrait === 'black-rose')!;
  const hero = (id: string, i: number) => ({ id, definitionId: id, team: 'player' as const, starLevel: 1 as const, location: { kind: 'board' as const, cell: { col: i, row: 7 } } });
  const state = { ...s, round: round.ordinal, roundDefinitionId: round.roundId, m8: { ...s.m8, round },
    items: added.map((id, i) => ({ id: 'item-' + (i + 1), definitionId: emblem.id, location: { kind: 'unit' as const, unitId: id, slot: 0 } })),
    preparation: { ...s.preparation, units: [...[...native,...added].map(hero), { ...hero('enemy', 3), definitionId: 'garen', team: 'enemy' as const, location: { kind: 'board' as const, cell: { col: 3, row: 3 } } }] } };
  const c = createCombatWithEvents(state.preparation, buildStrategySnapshot(state), 'v23-review-sion', 42).state;
  return { ...c, units: c.units.map(u => ({ ...u, cooldownTicks: 1200, moveCooldownTicks: 1200, mana: 0, maxMana: 0 })) };
}
const sion = (c: CombatState) => c.units.find(u => u.definitionId === 'g23-sion')! as S13Unit;
const patch = (c: CombatState, id: string, p: Partial<S13Unit>) => ({ ...c, units: c.units.map(u => u.id === id ? { ...u,...p } : u) });

describe('v23 independent review: Sion ownership, shield and revival', () => {
  it.each(['player','enemy'] as const)('%s owner is numeric-lowest member, invariant under preparation order', team => {
    const members = ['unit-100','unit-10','unit-9'];
    const traits: TraitSnapshot[] = [{ team, traitId: 'black-rose', count: 3, tier: 3, memberDefinitionIds: ['morgana'], memberUnitIds: members, targetUnitIds: [] }];
    for (const ids of [members, [...members].reverse(), ['unit-10','unit-9','unit-100']]) {
      const prep: GameState = { board: DEFAULT_BOARD, benchSize: 9, units: ids.map((id,i) => ({ id, definitionId: 'morgana', team, starLevel: 1, location: { kind: 'board', cell: { col: i, row: team === 'player' ? 7 : 0 } } })) };
      const result = projectG23Summons(prep, traits).units.filter(u => u.definitionId === 'g23-sion');
      expect(result).toEqual([{ id: 'unit-9:g23-sion', definitionId: 'g23-sion', team, starLevel: 1, location: { kind: 'board', cell: { col: 3, row: team === 'player' ? 4 : 3 } } }]);
    }
  });

  it.each([[3,175],[4,175],[5,75],[7,75]])('tier %i active has %i AP shield for 60 ticks and plain line stun for 20', (tier, shield) => {
    let c = army(tier); const u = sion(c);
    c = patch(c, u.id, { runtime: { ...u.runtime, buddyTriggered: true }, abilityPower: 100, mana: 120, maxMana: 120 });
    const r = stepCombat(c), after = sion(r.state);
    expect(after.shieldLayers).toContainEqual(expect.objectContaining({ remaining: shield, expiresAtTick: 61 }));
    const stunned = r.state.units.find(u => u.id === 'enemy')!.mechanismState!.statuses.find(g => g.kind === 'stun')!.contributions[0];
    expect(stunned.application.knockup).toBeUndefined();
    expect([stunned.appliedAtTick,stunned.expiresAtTick]).toEqual([2,22]);
    expect(r.events.filter(e => e.type === 'packetDamage' && e.outcome.context.source.ownerId === u.id)).toHaveLength(1);
  });

  it.each([1, 100])('Zephyr record ending at tick %i never duplicates a newly reviving Sion', untilTick => {
    let c = army(7), u = sion(c);
    const member = c.units.find(x => x.team === 'player' && x.id !== u.id)!;
    c = patch(c, member.id, { itemBanish: { ownerId: 'enemy', itemInstanceId: 'zephyr', untilTick } });
    c = patch(c, u.id, { hp: 0, runtime: { ...u.runtime, buddyTriggered: true } });
    const ids = c.units.map(x => x.id).sort();
    for (let tick = 1; tick <= 22; tick++) {
      const r = stepCombat(c); c = r.state;
      expect(c.units.map(x => x.id).sort()).toEqual(ids);
      expect(c.units.filter(x => x.id === u.id)).toHaveLength(1);
      expect(sion(c).g23Sion).toEqual({ reviveAtTick: 21, revived: tick >= 21 });
      expect(r.events.filter(e => e.type === 'unitRevived' && e.unitId === u.id)).toHaveLength(tick === 21 ? 1 : 0);
    }
  });

  it('ordinary movement may take the waiting cell; revival lands on the nearest free hex and resumes identically', () => {
    let c = army(7), u = sion(c);
    const member = c.units.find(x => x.team === 'player' && x.id !== u.id)!;
    c = patch(c, u.id, { hp: 0, cell: { col: 3, row: 4 }, runtime: { ...u.runtime, buddyTriggered: true } });
    c = patch(c, member.id, { cell: { col: 3, row: 5 }, moveCooldownTicks: 2, attackRange: 1 });
    c = stepCombat(c).state;
    let r = stepCombat(c); c = r.state;
    expect(r.events.filter(e => e.type === 'movement').map(({ type, tick, unitId, from, to }) => ({ type, tick, unitId, from, to }))).toEqual([
      { type: 'movement', tick: 2, unitId: member.id, from: { col: 3, row: 5 }, to: { col: 3, row: 4 } },
    ]);
    // Freeze only subsequent movement, preserving the real step into Sion's old cell.
    c = patch(c, member.id, { moveCooldownTicks: 1200 });
    while (c.tick < 20) c = stepCombat(c).state;
    const resumed = JSON.parse(JSON.stringify(c)) as CombatState;
    r = stepCombat(c);
    expect(stepCombat(resumed)).toEqual(r);
    expect(stepCombat({ ...c, units: [...c.units].reverse() })).toEqual(r);
    expect(r.events.filter(e => e.type === 'movement').filter(e => e.unitId === u.id).map(({ type, tick, unitId, from, to }) => ({ type, tick, unitId, from, to }))).toEqual([
      { type: 'movement', tick: 21, unitId: u.id, from: { col: 3, row: 4 }, to: { col: 2, row: 3 } },
    ]);
    expect(sion(r.state).cell).toEqual({ col: 2, row: 3 });
    const cells = r.state.units.filter(x => x.alive && !isAbsent(x, 21)).map(x => `${x.cell.col},${x.cell.row}`);
    expect(new Set(cells).size).toBe(cells.length);
    expect(r.events.filter(e => e.type === 'unitRevived' && e.unitId === u.id)).toHaveLength(1);
  });

  it('simultaneous lethal attacks keep the waiting Sion alive when every opponent dies', () => {
    const c = army(7), u = sion(c);
    const live = { ...c, units: c.units.filter(x => x.id === u.id || x.id === 'enemy').map(x => ({ ...x,
      hp: 1, armor: 0, shield: 0, shieldLayers: [], cooldownTicks: 0, attackRange: 20,
      attackDamage: 10000, attackDamageBase: 10000, attackDamagePercentBps: 0, baseCritChanceBps: 0,
      runtime: { ...x.runtime!, buddyTriggered: true },
    })) };
    const r = stepCombat(live);
    expect(r.events.filter(e => e.type === 'kill').map(e => e.unitId).sort()).toEqual(['enemy', u.id].sort());
    expect(r.events.filter(e => e.type === 'death').map(e => e.unitId)).toEqual(['enemy']);
    expect(sion(r.state)).toMatchObject({ alive: true, hp: Math.floor(u.maxHp * 0.75), g23Sion: { reviveAtTick: 21, revived: false } });
    expect(r.state.result).toBe('playerWin');
  });

  it('revive absence lasts 20 ticks, denies targeting/actions, survives JSON resume and cannot repeat', () => {
    let c = army(7), u = sion(c);
    c = patch(c, u.id, { hp: 0, runtime: { ...u.runtime, buddyTriggered: true } });
    let r = stepCombat(c), live = r.state, resumed = JSON.parse(JSON.stringify(live)) as CombatState;
    expect(sion(live).g23Sion).toEqual({ reviveAtTick: 21, revived: false });
    expect(sion(live).hp).toBe(Math.floor(u.maxHp * 0.75));
    for (let tick = 2; tick <= 21; tick++) {
      r = stepCombat(live); const b = stepCombat(resumed);
      expect(b).toEqual(r); live = r.state; resumed = JSON.parse(JSON.stringify(b.state));
      expect(isAbsent(sion(live), tick)).toBe(tick < 21);
      expect(isSelectable(sion(live), tick)).toBe(tick >= 21);
      if (tick < 21) {
        expect(live.units.filter(v => v.team === 'enemy').every(v => v.targetId !== u.id)).toBe(true);
        expect(r.events.some(e => e.type === 'attack' && e.attackerId === u.id)).toBe(false);
        expect(r.events.some(e => e.type === 'unitRevived')).toBe(false);
      }
    }
    expect(r.events.filter(e => e.type === 'unitRevived' && e.unitId === u.id)).toHaveLength(1);
    expect(effectiveStatuses(sion(live).mechanismState!.statuses,21).some(g => g.kind === 'control-immunity')).toBe(true);
    const death = stepCombat(patch(live,u.id,{hp:0}));
    expect(death.events.filter(e => e.type === 'death' && e.unitId === u.id)).toHaveLength(1);
    expect(sion(death.state).alive).toBe(false);
  });
});

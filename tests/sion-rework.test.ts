import { describe, it, expect } from 'vitest';
import { createMatch } from '../src/simulation/match';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { createCombatWithEvents, stepCombat, type CombatState } from '../src/simulation/combat';
import type { Unit } from '../src/simulation/unit-types';
import type { MatchState } from '../src/simulation/match-types';
import { M5_UNIT_DEFINITIONS } from '../src/simulation/units';
import { EMBLEM_ITEMS } from '../src/simulation/content/emblems';
import { ap, attackSpeedBonus, type S13Unit } from '../src/simulation/combat-s13-state';
import { getCatalogRoundById } from '../src/simulation/round-selectors';
import { getNeighbors, hexDistance } from '../src/simulation/board';
import { shortestPath } from '../src/simulation/m8/targeting';
import { effectiveStatuses } from '../src/simulation/m8/status';
import { vampRates } from '../src/simulation/m8/s13-mechanisms';

const hero = (id: string, col = 0, row = 4, team: 'player' | 'enemy' = 'player', definitionId = id): Unit =>
  ({ id, definitionId, team, starLevel: 1, location: { kind: 'board', cell: { col, row } } });
/** Black Rose army at `tier` (emblems fill past the five native members) against Garens at (0,3) and (6,0). */
function roseArmy(tier: number): MatchState {
  const s = createMatch(42), round = getCatalogRoundById('2-1');
  const native = Object.values(M5_UNIT_DEFINITIONS).filter(u => u.traits.includes('black-rose')).slice(0, tier).map(u => u.id);
  const added = Object.values(M5_UNIT_DEFINITIONS).filter(u => !u.traits.includes('black-rose')).slice(0, tier - native.length).map(u => u.id);
  const emblem = Object.values(EMBLEM_ITEMS).find(i => i.emblemTrait === 'black-rose')!;
  return { ...s, round: round.ordinal, roundDefinitionId: round.roundId, m8: { ...s.m8, round },
    items: added.map((id, i) => ({ id: 'item-' + (i + 1), definitionId: emblem.id, location: { kind: 'unit' as const, unitId: id, slot: 0 } })),
    preparation: { ...s.preparation, units: [...[...native, ...added].map((n, i) => hero(n, i % 7, 5 + Math.floor(i / 7))),
      hero('enemy', 0, 3, 'enemy', 'garen'), hero('enemy-far', 6, 0, 'enemy', 'garen')] } };
}
const start = (s: MatchState) => createCombatWithEvents(s.preparation, buildStrategySnapshot(s), 'sion', 42).state;
const sionOf = (c: CombatState) => c.units.find(u => u.definitionId === 'g23-sion')! as S13Unit;
const unit = (c: CombatState, id: string) => c.units.find(u => u.id === id)! as S13Unit;
/** Everyone except `active` stands still and never casts. */
const idle = (c: CombatState, active: string[] = []): CombatState =>
  ({ ...c, units: c.units.map(u => active.includes(u.id) ? u : { ...u, cooldownTicks: 1200, moveCooldownTicks: 1200, mana: 0, maxMana: 0 }) });
const patch = (c: CombatState, id: string, p: Partial<S13Unit>): CombatState => ({ ...c, units: c.units.map(u => u.id === id ? { ...u, ...p } as S13Unit : u) });

describe('Black Rose Sion rework (14.24 values, P user 2026-10-24)', () => {
  it.each([[3, 40], [4, 45], [5, 50], [7, 100]])('tier %i Sion has 750 base HP, 50 base AD, 120/120 mana and %i armor and MR', (tier, resists) => {
    const sion = sionOf(start(roseArmy(tier)));
    expect(sion.mechanics?.find(m => m.mechanic === 'g23Sion')?.values.tier).toBe(tier);
    expect([sion.armor, sion.magicResist]).toEqual([resists, resists]);
    expect([sion.mana, sion.maxMana, sion.attackDamageBase, sion.maxHpBasis?.base]).toEqual([120, 120, 50, 750]);
  });

  it('the unshackle charge hits only enemies on the path to the nearest enemy, knocks them up, marks them and lands behind the target', () => {
    let c = idle(start(roseArmy(4)));
    const sion = sionOf(c);
    c = patch(c, sion.id, { cell: { col: 0, row: 7 }, hp: Math.floor(sion.maxHp / 2), maxMana: 0, mana: 0 });
    const path = shortestPath(c.board, { col: 0, row: 7 }, unit(c, 'enemy').cell);
    // Park the far Garen on the first path hex: it is hit as well, but it is not the charge target.
    const onPath = path.find(cell => !c.units.some(u => u.alive && u.cell.col === cell.col && u.cell.row === cell.row))!;
    c = patch(c, 'enemy-far', { cell: onPath });
    const target = hexDistance(onPath, { col: 0, row: 7 }) < hexDistance(unit(c, 'enemy').cell, { col: 0, row: 7 }) ? 'enemy-far' : 'enemy';
    const free = getNeighbors(c.board, unit(c, target).cell).filter(cell => !c.units.some(u => u.alive && u.id !== sion.id && u.cell.col === cell.col && u.cell.row === cell.row));
    const farthest = Math.max(...free.map(cell => hexDistance(cell, { col: 0, row: 7 })));
    const step = stepCombat(c);
    expect(step.events).toContainEqual(expect.objectContaining({ type: 'bindingChanged', unitId: sion.id, bound: false, reason: 'hp-threshold' }));
    const hits = step.events.flatMap(e => e.type === 'packetDamage' && e.outcome.context.source.ownerId === sion.id ? [e.outcome.context.targetId] : []);
    expect([...hits].sort()).toEqual(target === 'enemy-far' ? ['enemy-far'] : ['enemy', 'enemy-far']);
    for (const id of hits) {
      expect(unit(step.state, id).v19?.roseTeams).toEqual(['player']);
      const stun = effectiveStatuses(unit(step.state, id).mechanismState!.statuses, step.state.tick + 1).find(g => g.kind === 'stun');
      expect(stun?.contributions.some(x => x.application.knockup === true && x.expiresAtTick! - x.appliedAtTick === 10)).toBe(true);
    }
    const moved = step.events.find(e => e.type === 'movement' && e.unitId === sion.id);
    const landing = sionOf(step.state).cell, aim = unit(step.state, target).cell;
    expect(moved).toBeDefined();
    expect(hexDistance(landing, aim)).toBe(1);
    expect(hexDistance(landing, { col: 0, row: 7 })).toBe(farthest);
  });

  it('an attack from an unshackled Sion does not mark its target', () => {
    let c = idle(start(roseArmy(4)));
    const sion = sionOf(c);
    c = patch(c, sion.id, { runtime: { ...sion.runtime!, buddyTriggered: true }, maxMana: 0, mana: 0, attackRange: 100, cooldownTicks: 0 });
    const step = stepCombat(c);
    expect(step.events.some(e => e.type === 'packetDamage' && e.outcome.context.source.ownerId === sion.id)).toBe(true);
    expect(step.state.units.every(u => !u.v19?.roseTeams)).toBe(true);
  });

  it('5 Black Rose unshackle heals all missing health and grants 100 AP; 4 Black Rose does neither', () => {
    for (const tier of [4, 5]) {
      let c = idle(start(roseArmy(tier)));
      const sion = sionOf(c), missing = sion.maxHp - Math.floor(sion.maxHp / 2);
      c = patch(c, sion.id, { hp: sion.maxHp - missing, maxMana: 0, mana: 0 });
      const before = ap(sionOf(c), c.tick), step = stepCombat(c);
      const heal = step.events.find(e => e.type === 'heal' && e.outcome.targetId === sion.id);
      expect(heal?.type === 'heal' ? heal.outcome.actual : 0).toBe(tier >= 5 ? missing : 0);
      expect(ap(sionOf(step.state), step.state.tick) - before).toBe(tier >= 5 ? 100 : 0);
    }
  });

  it('7 Black Rose Sion revives once, 1s after dying, keeps its team alive meanwhile, then gains 300% AS, 40% omnivamp and control immunity', () => {
    let c = idle(start(roseArmy(7)));
    const sion = sionOf(c);
    c = patch(c, sion.id, { runtime: { ...sion.runtime!, buddyTriggered: true }, hp: 0 });
    // Every other player unit falls on the same tick: the absent Sion alone keeps the player team in combat.
    for (const u of c.units.filter(u => u.team === 'player' && u.id !== sion.id)) c = patch(c, u.id, { hp: 0 });
    let step = stepCombat(c);
    const diedAt = step.state.tick;
    expect(step.events.some(e => e.type === 'death' && e.unitId === sion.id)).toBe(false);
    expect(step.state.status).toBe('running');
    expect(sionOf(step.state)).toMatchObject({ alive: true, hp: Math.floor(sion.maxHp * 3 / 4), g23Sion: { reviveAtTick: diedAt + 20, revived: false } });
    while (step.state.tick < diedAt + 20) {
      step = stepCombat(idle(step.state));
      if (step.state.tick < diedAt + 20) expect(step.events.some(e => e.type === 'unitRevived')).toBe(false);
    }
    expect(step.events).toContainEqual(expect.objectContaining({ type: 'unitRevived', unitId: sion.id, hp: Math.floor(sion.maxHp * 3 / 4) }));
    const revived = sionOf(step.state), absent = sionOf(c);
    expect(revived.g23Sion).toEqual({ reviveAtTick: diedAt + 20, revived: true });
    expect(attackSpeedBonus(revived, step.state.tick + 1) - attackSpeedBonus(absent, step.state.tick + 1)).toBe(30000);
    expect(effectiveStatuses(revived.mechanismState!.statuses, step.state.tick).some(g => g.targetId === sion.id && g.kind === 'control-immunity')).toBe(true);
    expect(vampRates(revived, revived.hp).map(r => r.bps)).toContain(4000);
    expect(vampRates(absent, absent.hp).map(r => r.bps)).not.toContain(4000);
    // A second death is final.
    step = stepCombat(patch(idle(step.state), sion.id, { hp: 0 }));
    expect(step.events.some(e => e.type === 'death' && e.unitId === sion.id)).toBe(true);
    expect(step.state.result).toBe('enemyWin');
  });

  it('below 7 Black Rose Sion dies normally', () => {
    const c = idle(start(roseArmy(5))), sion = sionOf(c);
    const step = stepCombat(patch(c, sion.id, { runtime: { ...sion.runtime!, buddyTriggered: true }, hp: 0 }));
    expect(step.events.some(e => e.type === 'death' && e.unitId === sion.id)).toBe(true);
    expect(sionOf(step.state).g23Sion).toBeUndefined();
  });
});

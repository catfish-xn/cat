import { describe, expect, it } from 'vitest';
import { stepCombat, type CombatEvent, type CombatState, type CombatUnit } from '../src/simulation/combat';
import { resolveAbility } from '../src/simulation/combat-abilities';
import { EMPTY_RUNTIME } from '../src/simulation/combat-s13-state';
import { battle, unit } from './combat-helpers';

// ZOMBIE POWER!! as in the original (user 2026-11-11): Nunu is locked in place for DamageDuration (3 s = 60 ticks),
// neither moving nor attacking, while the fumes and the durability run; then he acts again.
const LOCK = 60;
function nunu(patch: Partial<CombatUnit> = {}): CombatUnit {
  return unit('p', 'player', 3, 4, { definitionId: 'nunu', starLevel: 1, ability: resolveAbility('nunu-ability', 1),
    hp: 100000, maxHp: 100000, mana: 125, maxMana: 125, attackDamage: 10, abilityPower: 100, attackRange: 1,
    attackIntervalTicks: 10, baseAttackSpeedBps: 20000, cooldownTicks: 0, moveCooldownTicks: 0,
    runtime: { ...EMPTY_RUNTIME }, statuses: [], tasks: [], shieldLayers: [], mechanics: [], ...patch });
}
function foe(id: string, col: number, row: number, hp: number): CombatUnit {
  return unit(id, 'enemy', col, row, { definitionId: 'neutral-stage-2', ability: resolveAbility('neutral-attack', 1),
    hp, maxHp: hp, mana: 0, maxMana: 0, attackDamage: 0, cooldownTicks: 1000, moveCooldownTicks: 1000,
    runtime: { ...EMPTY_RUNTIME }, statuses: [], tasks: [], shieldLayers: [] });
}
function run(initial: CombatState, count: number) {
  let state = initial; const events: CombatEvent[] = [];
  for (let i = 0; i < count && state.status === 'running'; i++) { const next = stepCombat(state); state = next.state; events.push(...next.events); }
  return events;
}
const castTick = (events: readonly CombatEvent[]) => events.find(e => e.type === 'cast')!.tick;
const attacks = (events: readonly CombatEvent[]) => events.filter(e => e.type === 'attack' && (e as { attackerId?: string }).attackerId === 'p').map(e => e.tick);
const moves = (events: readonly CombatEvent[]) => events.filter(e => e.type === 'movement' && (e as { unitId?: string }).unitId === 'p').map(e => e.tick);

describe('Nunu ZOMBIE POWER!! cast lock', () => {
  it('does not attack an adjacent enemy for the 3 s of the cast, then attacks again', () => {
    const events = run(battle([nunu(), foe('e', 3, 3, 10_000_000)]), 120);
    const at = castTick(events);
    expect(attacks(events).filter(t => t > at && t < at + LOCK)).toEqual([]);
    expect(attacks(events).some(t => t >= at + LOCK)).toBe(true);
  });
  it('stays in place for the 3 s when its target dies, then moves to the next one', () => {
    // The adjacent enemy dies to the first fume tick; the next enemy stands far away.
    const events = run(battle([nunu(), foe('e', 3, 3, 1), foe('far', 3, 0, 10_000_000)]), 160);
    const at = castTick(events);
    expect(events.some(e => e.type === 'death' || (e as { type: string }).type === 'unitDied')).toBe(true);
    expect(moves(events).filter(t => t > at && t < at + LOCK)).toEqual([]);
    expect(moves(events).some(t => t >= at + LOCK)).toBe(true);
  });
});

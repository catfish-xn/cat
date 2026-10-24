/**
 * User-approved 10-24 (S13 third-party data table): Ambessa's gauntlet slam stuns for 1 s (20 ticks, was 0.25 s) and
 * Vi's row shockwave knocks up for 0.5 s (10 ticks, was 0.25 s). The slam↔gauntlet link is an inference (P).
 */
import { describe, expect, it } from 'vitest';
import { resolveAbility } from '../src/simulation/combat-abilities';
import { stepCombat, type CombatState, type CombatUnit } from '../src/simulation/combat';
import { EMPTY_RUNTIME } from '../src/simulation/combat-s13-state';
import { AMBESSA_SLAM_STUN_TICKS, VI_ROW_KNOCKUP_TICKS } from '../src/simulation/combat-g2-2';
import { battle, unit, freeze } from './combat-helpers';

const caster = (definitionId: string, abilityId: string, col: number, row: number, patch: Partial<CombatUnit> = {}) =>
  unit('p', 'player', col, row, { definitionId, ability: resolveAbility(abilityId, 1), hp: 5000, maxHp: 5000, mana: 200, maxMana: 100,
    attackDamage: 100, attackRange: 6, moveCooldownTicks: 1000, baseAttackSpeedBps: 10000, abilityPower: 100,
    runtime: { ...EMPTY_RUNTIME }, tasks: [], statuses: [], shieldLayers: [], mechanics: [], ...patch });
const dummy = (id: string, col: number, row: number) => unit(id, 'enemy', col, row, { definitionId: 'neutral-stage-2',
  ability: resolveAbility('neutral-attack', 1), hp: 100000, maxHp: 100000, attackDamage: 0, cooldownTicks: 1000, moveCooldownTicks: 1000 });
const cast = (units: CombatUnit[]): CombatState => stepCombat(freeze(battle(units, { strategy: { traits: [], units: [] }, combatId: 'cc', rngState: 42 }))).state;
const stunOf = (state: CombatState, id: string) => state.units.find(u => u.id === id)!.statuses.find(s => s.kind === 'stun')!;

describe('short crowd-control durations (user 10-24)', () => {
  it('Ambessa gauntlet slam stuns its target for exactly 20 ticks', () => {
    expect(AMBESSA_SLAM_STUN_TICKS).toBe(20);
    const state = cast([caster('ambessa', 'ambessa-ability', 3, 4, { runtime: { ...EMPTY_RUNTIME, castCount: 1 } }), dummy('e', 3, 3)]);
    const stun = stunOf(state, 'e');
    expect(stun.expiresAtTick! - stun.startsAtTick!).toBe(20);
  });
  it('Vi row shockwave knocks the other enemies in the target row up for exactly 10 ticks', () => {
    expect(VI_ROW_KNOCKUP_TICKS).toBe(10);
    const state = cast([caster('vi', 'vi-ability', 3, 6), dummy('t', 3, 3), dummy('row', 5, 3), dummy('off', 5, 2)]);
    const knock = stunOf(state, 'row');
    expect(knock.expiresAtTick! - knock.startsAtTick!).toBe(10);
    expect(state.units.find(u => u.id === 'off')!.statuses.some(s => s.kind === 'stun')).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { stepCombat, type CombatEvent } from '../src/simulation/combat';
import { resolveAbility } from '../src/simulation/combat-abilities';
import { EMPTY_RUNTIME } from '../src/simulation/combat-s13-state';
import { JINX_ROCKET_FLIGHT_TICKS } from '../src/simulation/cast-windup';
import { jinxRocketEpicenter } from '../src/simulation/ability-projectile';
import { DEFAULT_BOARD } from '../src/simulation/board';
import { battle, unit } from './combat-helpers';

// Jinx's rocket epicenter marker (11-25, authorization ①, display only): on the rocket's launch tick an abilityMarker
// 'jinx-rocket-epicenter' names the cell it explodes on and its explosion tick, so the renderer aims it there and not at the
// target named by the launch event. The cell is the one the rule reads the falloff from; nothing else changes.
const jinx = () => unit('p', 'player', 3, 7, { definitionId: 'jinx', starLevel: 2, ability: resolveAbility('jinx-ability', 2), hp: 100000, maxHp: 100000, mana: 0, maxMana: 60,
  attackDamage: 100, abilityPower: 100, attackRange: 20, baseAttackSpeedBps: 10000, cooldownTicks: 0, moveCooldownTicks: 1000, targetId: 'e',
  runtime: { ...EMPTY_RUNTIME }, statuses: [], tasks: [], shieldLayers: [], mechanics: [] } as any);
const foe = (id: string, col: number, row = 2) => unit(id, 'enemy', col, row, { definitionId: 'neutral-stage-2', ability: resolveAbility('neutral-attack', 1), hp: 10000000, maxHp: 10000000,
  mana: 0, maxMana: 0, attackDamage: 0, cooldownTicks: 100000, moveCooldownTicks: 100000, runtime: { ...EMPTY_RUNTIME }, statuses: [], tasks: [], shieldLayers: [] } as any);

describe('Jinx rocket epicenter marker', () => {
  it('on the launch tick, the explosion cell and tick; one per rocket, none for the zap or the chompers', () => {
    let state = battle([jinx(), foe('e', 3), foe('f', 4), foe('g', 0, 0)], { strategy: { traits: [], units: [] }, combatId: 'jinx-epicenter', rngState: 42 } as any);
    const events: CombatEvent[] = [];
    for (let i = 0; i < 420 && state.status === 'running'; i++) { const r = stepCombat(state); state = r.state; events.push(...r.events); }
    const launched = events.filter(e => e.type === 'abilityProjectileLaunched' && e.skill === 'jinx-rocket');
    const marked = events.filter(e => e.type === 'abilityMarker' && e.marker === 'jinx-rocket-epicenter');
    expect(launched.length).toBeGreaterThan(0);
    expect(marked.map(m => m.type === 'abilityMarker' && [m.tick, m.arrivalTick, m.cell])).toEqual(
      launched.map(l => [l.tick, l.tick + JINX_ROCKET_FLIGHT_TICKS, jinxRocketEpicenter(DEFAULT_BOARD)]));
    expect(events.filter(e => e.type === 'abilityMarker' && e.unitId === 'p' && e.marker !== 'jinx-rocket-epicenter')).toEqual([]);
  });
});

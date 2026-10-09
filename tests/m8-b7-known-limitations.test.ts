import { describe, expect, it } from 'vitest';
import { stepCombat } from '../src/simulation/combat';
import { compileNeutralEncounter } from '../src/simulation/neutral-encounter-compiler';
import { battle, unit } from './combat-helpers';

/** Characterization only: passing this test is NOT acceptance of approved post-damage stun timing. */
describe('B7 reports existing B3 charge-control ordering gap without changing the generic layer', () => {
  it('currently emits an applied stun before a lethal charge packet, then removes it on death', () => {
    const compiled = compileNeutralEncounter('6-7');
    const herald = { ...compiled.units[0], cooldownTicks: 1000, moveCooldownTicks: 1000 };
    // maxHP1000 => 150 charge damage; current HP100 makes that packet lethal.
    const victim = unit('p', 'player', 3, 4, { hp: 100, maxHp: 1000, armor: 0, magicResist: 0,
      cooldownTicks: 1000, moveCooldownTicks: 1000, mana: 0, maxMana: 0,
      ability: { id: 'boundary-dummy', amount: 0, kind: 's13', championId: 'neutral', variables: {} } });
    const result = stepCombat(battle([herald, victim], { combatId: 'b7-stun-order', rngDraws: 0, openingDefinitions: compiled.openingDefinitions }));
    const appliedIndex = result.events.findIndex(e => e.type === 'statusChanged' && e.unitId === 'p' && e.reason === 'applied' && e.status.kind === 'stun');
    const damageIndex = result.events.findIndex(e => e.type === 'packetDamage' && e.unitId === 'p');
    expect(result.events[damageIndex]).toMatchObject({ raw: 150, hpDamage: 100 });
    expect(appliedIndex).toBeGreaterThanOrEqual(0);
    expect(appliedIndex).toBeLessThan(damageIndex);
    expect(result.events.some(e => e.type === 'statusChanged' && e.unitId === 'p' && e.reason === 'death-cleanup')).toBe(true);
    expect(result.state.units.find(u => u.id === 'p')).toMatchObject({ hp: 0, alive: false, statuses: [] });
    expect(result.state.rngDraws).toBe(0);
  });
});

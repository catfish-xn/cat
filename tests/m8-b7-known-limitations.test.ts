import { describe, expect, it } from 'vitest';
import { stepCombat } from '../src/simulation/combat';
import { compileNeutralEncounter } from '../src/simulation/neutral-encounter-compiler';
import { battle, unit } from './combat-helpers';

/** B7 regression migrated after the approved B3 fix: never bless the historical defect. */
describe('B7 accepts the fixed B3 charge-control ordering without changing the generic layer', () => {
  it('does not apply stun or emit fake death cleanup for a lethal charge packet', () => {
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
    expect(damageIndex).toBeGreaterThanOrEqual(0);
    expect(appliedIndex).toBe(-1);
    expect(result.events.some(e => e.type === 'statusChanged' && e.unitId === 'p' && e.reason === 'death-cleanup')).toBe(false);
    expect(result.state.units.find(u => u.id === 'p')).toMatchObject({ hp: 0, alive: false, statuses: [] });
    expect(result.state.rngDraws).toBe(0);
  });
  it('commits a nonlethal packet before applying next-tick stun to the survivor', () => {
    const compiled = compileNeutralEncounter('6-7');
    const herald = { ...compiled.units[0], cooldownTicks: 1000, moveCooldownTicks: 1000 };
    const victim = unit('p', 'player', 3, 4, { hp: 1000, maxHp: 1000, armor: 0, magicResist: 0,
      cooldownTicks: 1000, moveCooldownTicks: 1000, mana: 0, maxMana: 0,
      ability: { id: 'boundary-dummy', amount: 0, kind: 's13', championId: 'neutral', variables: {} } });
    const result = stepCombat(battle([herald, victim], { combatId: 'b7-surviving-stun-order', rngDraws: 0, openingDefinitions: compiled.openingDefinitions }));
    const damageIndex = result.events.findIndex(e => e.type === 'packetDamage' && e.unitId === 'p');
    const appliedIndex = result.events.findIndex(e => e.type === 'statusChanged' && e.unitId === 'p' && e.reason === 'applied' && e.status.kind === 'stun');
    expect(damageIndex).toBeGreaterThanOrEqual(0);
    expect(result.events[damageIndex]).toMatchObject({ raw: 150, hpDamage: 150 });
    expect(appliedIndex).toBeGreaterThan(damageIndex);
    expect(result.events[appliedIndex]).toMatchObject({ status: { kind: 'stun', startsAtTick: 2, expiresAtTick: 12 } });
    expect(result.state.units.find(u => u.id === 'p')).toMatchObject({ hp: 850, alive: true });
    expect(result.state.rngDraws).toBe(0);
  });
});
